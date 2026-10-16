import { randomUUID } from 'node:crypto'
import { inTransaction, pool, query } from '../../db/pool.js'
import { badRequest, notFound } from '../../utils/httpError.js'
import { readCart, validateCoupon } from '../cart/cart.service.js'
import { addressFingerprint, buildQuotePayload, cartFingerprint, mapProviderServices, requestProviderQuote } from './shipping.provider.js'

const QUOTE_TTL_MINUTES = 20
 

async function getOwnedAddress(userId, addressId, db = pool) {
  const { rows } = await db.query(
    `SELECT id, label, recipient, street, number, complement, district, city, state, cep, principal
       FROM addresses WHERE id = $1 AND user_id = $2`,
    [addressId, userId],
  )
  if (!rows[0]) throw notFound('Endereço não encontrado para esta conta.')
  if (!/^\d{8}$/.test(String(rows[0].cep ?? '').replace(/\D/g, ''))) {
    throw badRequest('cep_invalido', 'O CEP do endereço selecionado precisa ter 8 dígitos.')
  }
  return rows[0]
}

export async function createShippingQuote(userId, addressId, inputItems) {
  const address = await getOwnedAddress(userId, addressId)
  const cart = await readCart(inputItems)
  const payload = buildQuotePayload(process.env.MELHOR_ENVIO_ORIGIN_CEP, address.cep, cart.items)
  const providerResponse = await requestProviderQuote(payload)
  const services = mapProviderServices(providerResponse)
  if (!services.length) return { quoteId: null, services: [], expiresAt: null }

  const id = randomUUID()
  const expiresAt = new Date(Date.now() + QUOTE_TTL_MINUTES * 60 * 1000)
  const addressHash = addressFingerprint(address)
  await query(
    `DELETE FROM shipping_quotes WHERE user_id = $1 AND expires_at <= now()`
      , [userId],
  )
  await query(
    `INSERT INTO shipping_quotes (id, user_id, address_id, address_fingerprint, cart_fingerprint, services, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [id, userId, addressId, addressHash, cartFingerprint(cart.items), JSON.stringify(services), expiresAt],
  )
  return { quoteId: id, services, expiresAt: expiresAt.toISOString() }
}

export async function createOrder(userId, data) {
  return inTransaction(async (client) => {
    const address = await getOwnedAddress(userId, data.addressId, client)
    const cart = await readCart(data.items, client)
    const quoteResult = await client.query(
      `SELECT id, address_id AS "addressId", address_fingerprint AS "addressFingerprint",
              cart_fingerprint AS "cartFingerprint", services
         FROM shipping_quotes
        WHERE id = $1 AND user_id = $2 AND expires_at > now()
        FOR UPDATE`,
      [data.quoteId, userId],
    )
    const quote = quoteResult.rows[0]
    if (!quote || quote.addressId !== data.addressId || quote.addressFingerprint !== addressFingerprint(address) || quote.cartFingerprint !== cartFingerprint(cart.items)) {
      throw badRequest('cotacao_expirada', 'A cotação expirou ou o endereço/carrinho mudou. Faça uma nova cotação.')
    }

    const service = quote.services.find((entry) => entry.id === data.serviceId)
    if (!service) throw badRequest('frete_invalido', 'Selecione uma opção de frete desta cotação.')

    const coupon = data.couponCode ? await validateCoupon(data.couponCode, cart, client) : null
    const discountCentavos = coupon?.discountCentavos ?? 0
    const totalCentavos = cart.subtotalCentavos - discountCentavos + service.priceCentavos
    const orderId = randomUUID()
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

    await client.query(
      `INSERT INTO orders (id, user_id, address_id, address_snapshot, status, subtotal_centavos,
                           discount_centavos, shipping_centavos, total_centavos, coupon_code,
                           shipping_service_id, shipping_service_name, shipping_delivery_days)
       VALUES ($1, $2, $3, $4::jsonb, 'aguardando_pagamento', $5, $6, $7, $8, $9, $10, $11, $12)`,
      [orderId, userId, data.addressId, JSON.stringify(addressSnapshot), cart.subtotalCentavos,
        discountCentavos, service.priceCentavos, totalCentavos, coupon?.code ?? null,
        service.id, service.name, service.deliveryDays],
    )

    for (const item of cart.items) {
      await client.query(
        `INSERT INTO order_items (id, order_id, product_id, product_name, color, size, quantity,
                                 unit_price_centavos, line_total_centavos)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [randomUUID(), orderId, item.productId, item.name, item.color, item.size,
          item.quantity, item.priceCentavos, item.lineTotalCentavos],
      )
    }

    await client.query('DELETE FROM shipping_quotes WHERE id = $1', [data.quoteId])
    return {
      id: orderId,
      status: 'aguardando_pagamento',
      subtotalCentavos: cart.subtotalCentavos,
      discountCentavos,
      shippingCentavos: service.priceCentavos,
      totalCentavos,
      couponCode: coupon?.code ?? null,
      shippingService: service.name,
      deliveryDays: service.deliveryDays,
      createdAt: new Date().toISOString(),
    }
  })
}
