import { createHash, randomUUID } from 'node:crypto'
import { inTransaction } from '../../db/pool.js'
import { badRequest, conflict } from '../../utils/httpError.js'
import { lockCartStock, readCart, validateCoupon } from '../cart/cart.service.js'
import { addressFingerprint, cartFingerprint } from '../shipping/shipping.provider.js'
import { getOwnedAddress } from '../shipping/shipping.service.js'
import { enqueueOrderEmail } from '../notifications/email.service.js'
import { config } from '../../config.js'

const PAYMENT_HOLD_MINUTES = 30

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function serializeOrder(row) {
  return {
    id: row.id,
    transactionMode: row.transactionMode,
    paymentProvider: row.paymentProvider,
    demoPaymentAvailable: row.paymentProvider === 'forma_demo' && config.demo && config.paymentProvider === 'forma_demo',
    status: row.status,
    subtotalCentavos: Number(row.subtotalCentavos),
    discountCentavos: Number(row.discountCentavos),
    shippingCentavos: Number(row.shippingCentavos),
    totalCentavos: Number(row.totalCentavos),
    couponCode: row.couponCode,
    shippingService: row.shippingService,
    shippingCompany: row.shippingCompany,
    deliveryDays: row.deliveryDays,
    paymentDeadlineAt: row.paymentDeadlineAt?.toISOString?.() ?? row.paymentDeadlineAt,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
  }
}

async function findExistingOrder(client, userId, checkoutKey, checkoutFingerprint, payloadFingerprint) {
  const byKey = await client.query(
    `SELECT id, status, transaction_mode AS "transactionMode", payment_provider AS "paymentProvider", subtotal_centavos AS "subtotalCentavos",
            discount_centavos AS "discountCentavos", shipping_centavos AS "shippingCentavos",
            total_centavos AS "totalCentavos", coupon_code AS "couponCode",
            shipping_service_id AS "shippingServiceId", shipping_service_name AS "shippingService",
            shipping_company_name AS "shippingCompany",
            shipping_delivery_days AS "deliveryDays", payment_deadline_at AS "paymentDeadlineAt",
            created_at AS "createdAt", checkout_payload_fingerprint AS "payloadFingerprint"
       FROM orders WHERE user_id = $1 AND checkout_key = $2 FOR UPDATE`,
    [userId, checkoutKey],
  )
  if (byKey.rows[0]) {
    if (byKey.rows[0].payloadFingerprint !== payloadFingerprint) {
      throw conflict('chave_checkout_reutilizada', 'A chave de idempotência já foi usada com outro pedido.')
    }
    return byKey.rows[0]
  }

  const active = await client.query(
    `SELECT id, status, transaction_mode AS "transactionMode", payment_provider AS "paymentProvider", subtotal_centavos AS "subtotalCentavos",
            discount_centavos AS "discountCentavos", shipping_centavos AS "shippingCentavos",
            total_centavos AS "totalCentavos", coupon_code AS "couponCode",
            shipping_service_id AS "shippingServiceId", shipping_service_name AS "shippingService",
            shipping_company_name AS "shippingCompany",
            shipping_delivery_days AS "deliveryDays", payment_deadline_at AS "paymentDeadlineAt",
            created_at AS "createdAt", checkout_payload_fingerprint AS "payloadFingerprint"
       FROM orders
      WHERE user_id = $1 AND checkout_fingerprint = $2 AND status = 'aguardando_pagamento'
      FOR UPDATE`,
    [userId, checkoutFingerprint],
  )
  if (active.rows[0] && active.rows[0].payloadFingerprint !== payloadFingerprint) {
    throw conflict('pedido_pendente', 'Já existe um pedido pendente para este carrinho com outros valores ou opções.')
  }
  return active.rows[0] ?? null
}

export async function createOrder(userId, data) {
  return inTransaction(async (client) => {
    const address = await getOwnedAddress(userId, data.addressId, client)
    const cart = await readCart(data.items, client)
    const coupon = data.couponCode ? await validateCoupon(data.couponCode, cart, client) : null
    const checkoutFingerprint = fingerprint({
      addressId: data.addressId,
      ...(config.demo ? { transactionMode: 'demo' } : {}),
      ...(config.demo && config.paymentProvider === 'mercadopago' ? { paymentProvider: 'mercadopago' } : {}),
      addressFingerprint: addressFingerprint(address),
      cartFingerprint: cartFingerprint(cart.items),
    })
    const payloadFingerprint = fingerprint({
      checkoutFingerprint,
      couponCode: coupon?.code ?? null,
      serviceId: data.serviceId,
    })

    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${userId}:${checkoutFingerprint}`])
    const existing = await findExistingOrder(client, userId, data.checkoutKey, checkoutFingerprint, payloadFingerprint)
    if (existing) return serializeOrder(existing)

    const lockedSizes = await lockCartStock(data.items, client)
    const validatedCart = await readCart(data.items, client, { validateStock: true })
    const validatedCoupon = data.couponCode ? await validateCoupon(data.couponCode, validatedCart, client) : null
    if (validatedCart.subtotalCentavos !== cart.subtotalCentavos || validatedCoupon?.code !== coupon?.code ||
        validatedCoupon?.discountCentavos !== coupon?.discountCentavos) {
      throw badRequest('pedido_precisa_atualizacao', 'Preço ou desconto mudou. Revise o carrinho antes de continuar.')
    }

    const quoteResult = await client.query(
      `SELECT id, address_id AS "addressId", address_fingerprint AS "addressFingerprint",
              cart_fingerprint AS "cartFingerprint", services, transaction_mode AS "transactionMode", payment_provider AS "paymentProvider"
         FROM shipping_quotes
        WHERE id = $1 AND user_id = $2 AND expires_at > now()
        FOR UPDATE`,
      [data.quoteId, userId],
    )
    const quote = quoteResult.rows[0]
    if (quote && (quote.transactionMode !== (config.demo ? 'demo' : 'gateway') || quote.paymentProvider !== config.paymentProvider)) {
      throw badRequest('modo_cotacao_incompativel', 'O modo da loja mudou. Faça uma nova cotação.')
    }
    if (!quote || quote.addressId !== data.addressId || quote.addressFingerprint !== addressFingerprint(address) || quote.cartFingerprint !== cartFingerprint(validatedCart.items)) {
      throw badRequest('cotacao_expirada', 'A cotação expirou ou o endereço/carrinho mudou. Faça uma nova cotação.')
    }

    const service = quote.services.find((entry) => entry.id === data.serviceId)
    if (!service) throw badRequest('frete_invalido', 'Selecione uma opção de frete desta cotação.')

    const discountCentavos = validatedCoupon?.discountCentavos ?? 0
    const totalCentavos = validatedCart.subtotalCentavos - discountCentavos + service.priceCentavos
    const orderId = randomUUID()
    const paymentDeadlineAt = new Date(Date.now() + PAYMENT_HOLD_MINUTES * 60 * 1000)
    const addressSnapshot = {
      label: address.label,
      recipient: address.recipient,
      street: address.street,
      number: address.number,
      complement: address.complement,
      district: address.district,
      city: address.city,
      state: address.state,
      cep: address.cep,
    }
    const shippingSnapshot = { quoteId: quote.id, selectedService: service, services: quote.services }

    const inserted = await client.query(
      `INSERT INTO orders (id, user_id, address_id, address_snapshot, status, subtotal_centavos,
                           discount_centavos, shipping_centavos, total_centavos, coupon_code,
                           shipping_service_id, shipping_service_name, shipping_delivery_days,
                           checkout_key, checkout_fingerprint, payment_deadline_at,
                             checkout_payload_fingerprint, shipping_company_name, shipping_quote_snapshot, transaction_mode, payment_provider)
       VALUES ($1, $2, $3, $4::jsonb, 'aguardando_pagamento', $5, $6, $7, $8, $9, $10, $11,
                             $12, $13, $14, $15, $16, $17, $18::jsonb, $19, $20)
       RETURNING id, status, transaction_mode AS "transactionMode", payment_provider AS "paymentProvider", subtotal_centavos AS "subtotalCentavos",
                 discount_centavos AS "discountCentavos", shipping_centavos AS "shippingCentavos",
                 total_centavos AS "totalCentavos", coupon_code AS "couponCode",
                 shipping_service_name AS "shippingService", shipping_company_name AS "shippingCompany",
                 shipping_delivery_days AS "deliveryDays", payment_deadline_at AS "paymentDeadlineAt",
                 created_at AS "createdAt"`,
      [orderId, userId, data.addressId, JSON.stringify(addressSnapshot), validatedCart.subtotalCentavos,
        discountCentavos, service.priceCentavos, totalCentavos, validatedCoupon?.code ?? null,
        service.id, service.name, service.deliveryDays, data.checkoutKey, checkoutFingerprint,
        paymentDeadlineAt, payloadFingerprint, service.company ?? '', JSON.stringify(shippingSnapshot), quote.transactionMode, quote.paymentProvider],
    )

    for (const item of validatedCart.items) {
      await client.query(
        `INSERT INTO order_items (id, order_id, product_id, product_name, color, size, quantity,
                                 unit_price_centavos, line_total_centavos, product_snapshot)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
        [randomUUID(), orderId, item.productId, item.name, item.color, item.size,
          item.quantity, item.priceCentavos, item.lineTotalCentavos,
          JSON.stringify({
            description: item.description,
            color: item.color,
            isPrinted: item.isPrinted,
            size: item.size,
            weightG: item.weightG,
            dimensionsCm: { length: item.lengthCm, width: item.widthCm, height: item.heightCm },
            images: item.images,
          })],
      )
    }

    for (const reservation of lockedSizes) {
      const update = await client.query(
        `UPDATE product_sizes SET stock = stock - $2
          WHERE id = $1 AND stock >= $2 RETURNING id`,
        [reservation.productSizeId, reservation.quantity],
      )
      if (!update.rows[0]) throw badRequest('estoque_indisponivel', 'O estoque mudou durante a confirmação do pedido.')
      await client.query(
        `INSERT INTO stock_reservations (id, order_id, product_size_id, quantity, status, expires_at)
         VALUES ($1, $2, $3, $4, 'reservado', $5)`,
        [randomUUID(), orderId, reservation.productSizeId, reservation.quantity, paymentDeadlineAt],
      )
    }

    await enqueueOrderEmail(client, orderId, 'order_confirmation')
    await client.query('DELETE FROM shipping_quotes WHERE id = $1', [data.quoteId])
    return serializeOrder(inserted.rows[0])
  })
}
