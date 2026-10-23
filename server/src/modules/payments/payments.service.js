import { randomUUID } from 'node:crypto'
import { inTransaction, query } from '../../db/pool.js'
import { badRequest, conflict, HttpError, notFound } from '../../utils/httpError.js'
import { readCart, validateCoupon } from '../cart/cart.service.js'
import { createSandboxPreference, fetchMercadoPagoPayment } from './mercadopago.gateway.js'
import { validateGatewayPayment, verifyPaymentWebhookSignature } from './payment.security.js'
import { consumeOrderReservations, expirePendingOrders, releaseOrderReservations } from './stock.service.js'
import { enqueueOrderEmail } from '../notifications/email.service.js'
import { cardGateway, resolveSavedCardConfig } from './mercadopago.gateway.js'
import { createCardService } from './cards.service.js'
import { config } from '../../config.js'

const PAYMENT_ID_PATTERN = /^\d{1,30}$/

function mapPayment(row) {
  return {
    id: row.id,
    orderId: row.orderId,
    provider: row.provider,
    paymentKind: row.paymentKind,
    status: row.status,
    providerStatus: row.providerStatus,
    providerPaymentId: row.providerPaymentId ?? null,
    checkoutUrl: row.checkoutUrl,
    amountCentavos: Number(row.amountCentavos),
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
    paidAt: row.paidAt?.toISOString?.() ?? row.paidAt,
  }
}

function orderFields(row) {
  return {
    id: row.id,
    userId: row.userId,
    transactionMode: row.transactionMode,
    paymentProvider: row.paymentProvider,
    status: row.status,
    totalCentavos: Number(row.totalCentavos),
    subtotalCentavos: Number(row.subtotalCentavos),
    discountCentavos: Number(row.discountCentavos),
    couponCode: row.couponCode,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    paymentDeadlineAt: row.paymentDeadlineAt,
  }
}

async function cancelPendingOrder(orderId) {
  await inTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, status FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId],
    )
    if (!rows[0] || rows[0].status !== 'aguardando_pagamento') return
    await releaseOrderReservations(client, orderId)
    await client.query(
      `UPDATE orders SET status = 'cancelado' WHERE id = $1`,
      [orderId],
    )
    await client.query(
      `UPDATE payment_attempts SET status = 'cancelada', updated_at = now()
        WHERE order_id = $1 AND status IN ('criada', 'pendente', 'em_processamento')`,
      [orderId],
    )
    await enqueueOrderEmail(client, orderId, 'order_status', 'cancelado')
  })
}

async function loadOrderForPayment(userId, orderId) {
  const { rows } = await query(
    `SELECT o.id, o.user_id AS "userId", o.status, o.transaction_mode AS "transactionMode", o.payment_provider AS "paymentProvider", o.subtotal_centavos AS "subtotalCentavos",
            o.discount_centavos AS "discountCentavos", o.total_centavos AS "totalCentavos",
              o.coupon_code AS "couponCode", o.payment_deadline_at AS "paymentDeadlineAt",
              o.created_at AS "createdAt"
            FROM orders o
      WHERE o.id = $1 AND o.user_id = $2`,
    [orderId, userId],
  )
  if (!rows[0]) throw notFound('Pedido não encontrado para esta conta.')
  return rows[0]
}

export async function validateOrderForPayment(order, db = { query }) {
  const { rows: itemRows } = await db.query(
    `SELECT product_id AS "productId", size, quantity, unit_price_centavos AS "unitPriceCentavos",
            line_total_centavos AS "lineTotalCentavos"
       FROM order_items WHERE order_id = $1 ORDER BY product_id, size`,
    [order.id],
  )
  if (!itemRows.length) throw badRequest('pedido_sem_itens', 'O pedido não tem itens para pagamento.')

  const cart = await readCart(itemRows.map(item => ({
    productId: item.productId,
    size: item.size,
    quantity: Number(item.quantity),
  })), db)
  const currentLines = new Map(cart.items.map(item => [`${item.productId}:${item.size}`, item]))
  for (const saved of itemRows) {
    const current = currentLines.get(`${saved.productId}:${saved.size}`)
    if (!current || current.priceCentavos !== Number(saved.unitPriceCentavos) ||
        current.lineTotalCentavos !== Number(saved.lineTotalCentavos)) {
      throw badRequest('preco_alterado', 'O preço ou a disponibilidade de um produto mudou após o pedido.')
    }
  }

  const coupon = order.couponCode ? await validateCoupon(order.couponCode, cart, db) : null
  const discountCentavos = coupon?.discountCentavos ?? 0
  const shippingCentavos = Number(order.totalCentavos) - Number(order.subtotalCentavos) + Number(order.discountCentavos)
  const totalCentavos = cart.subtotalCentavos - discountCentavos + shippingCentavos
  if (cart.subtotalCentavos !== Number(order.subtotalCentavos) ||
      discountCentavos !== Number(order.discountCentavos) ||
      totalCentavos !== Number(order.totalCentavos)) {
    throw badRequest('pedido_precisa_atualizacao', 'Preço, cupom ou frete mudou. Refaça o checkout antes de pagar.')
  }

  const { rows: reservations } = await db.query(
    `SELECT ps.product_id AS "productId", ps.size, sr.quantity, sr.expires_at AS "expiresAt"
       FROM stock_reservations sr JOIN product_sizes ps ON ps.id = sr.product_size_id
      WHERE sr.order_id = $1 AND sr.status = 'reservado' AND sr.expires_at > now()`,
    [order.id],
  )
  if (reservations.length !== itemRows.length || reservations.some(reservation =>
    !itemRows.some(item => item.productId === reservation.productId && item.size === reservation.size && Number(item.quantity) === Number(reservation.quantity))
  )) {
    throw badRequest('reserva_estoque_expirada', 'A reserva de estoque expirou. Refaça o checkout para confirmar a disponibilidade.')
  }
  return { cart, coupon }
}

export async function createOrderPayment(userId, orderId, createPreference = createSandboxPreference) {
  const orderRow = await loadOrderForPayment(userId, orderId)
  const order = orderFields(orderRow)
  assertGatewayOrder(order)
  if (order.status !== 'aguardando_pagamento') throw conflict('pedido_nao_pendente', 'Este pedido não está aguardando pagamento.')
  if (new Date(order.paymentDeadlineAt).getTime() <= Date.now()) {
    await cancelPendingOrder(orderId)
    throw conflict('pedido_expirado', 'O prazo de reserva terminou. Refaça o checkout para consultar estoque e frete.')
  }

  try {
    await validateOrderForPayment(order)
  } catch (error) {
    await cancelPendingOrder(orderId)
    if (error instanceof HttpError) throw error
    throw new HttpError(503, 'pedido_nao_validado', 'Não foi possível revalidar os valores e o estoque do pedido.')
  }

  const { rows: attempts } = await query(
    `SELECT id, order_id AS "orderId", preference_id AS "preferenceId",
            provider_payment_id AS "providerPaymentId", status,
            provider_status AS "providerStatus", amount_centavos AS "amountCentavos",
            sandbox_checkout_url AS "checkoutUrl", created_at AS "createdAt",
            updated_at AS "updatedAt", paid_at AS "paidAt"
       FROM payment_attempts WHERE order_id = $1`,
    [orderId],
  )
  if (attempts[0] && !attempts[0].checkoutUrl) throw conflict('pagamento_indisponivel', 'Pedido já vinculado a pagamento direto. Consulte o estado antes de continuar.')
  if (attempts[0]?.checkoutUrl) return { payment: mapPayment(attempts[0]) }
  if (attempts[0] && !['criada'].includes(attempts[0].status)) {
    throw conflict('pagamento_indisponivel', 'Esta tentativa de pagamento já foi processada.')
  }

  const preference = await createPreference(order)
  const rows = await inTransaction(async (client) => {
    const { rows: currentOrders } = await client.query(
      `SELECT status, payment_deadline_at AS "paymentDeadlineAt"
         FROM orders WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [orderId, userId],
    )
    const currentOrder = currentOrders[0]
    if (!currentOrder || currentOrder.status !== 'aguardando_pagamento' ||
        new Date(currentOrder.paymentDeadlineAt).getTime() <= Date.now()) {
      await releaseOrderReservations(client, orderId)
      const canceled = await client.query(
        `UPDATE orders SET status = 'cancelado' WHERE id = $1 AND status = 'aguardando_pagamento'`,
        [orderId],
      )
      if (canceled.rowCount) await enqueueOrderEmail(client, orderId, 'order_status', 'cancelado')
      return { expired: true }
    }

    const result = await client.query(
      `INSERT INTO payment_attempts (id, order_id, provider, preference_id, status,
                                     amount_centavos, sandbox_checkout_url)
       VALUES ($1, $2, 'mercadopago', $3, 'criada', $4, $5)
       ON CONFLICT (order_id) DO UPDATE
         SET preference_id = EXCLUDED.preference_id,
             status = 'criada', amount_centavos = EXCLUDED.amount_centavos,
             sandbox_checkout_url = EXCLUDED.sandbox_checkout_url, updated_at = now()
         WHERE payment_attempts.status = 'criada'
       RETURNING id, order_id AS "orderId", preference_id AS "preferenceId",
                 provider_payment_id AS "providerPaymentId", status,
                 provider_status AS "providerStatus", amount_centavos AS "amountCentavos",
                 sandbox_checkout_url AS "checkoutUrl", created_at AS "createdAt",
                 updated_at AS "updatedAt", paid_at AS "paidAt"`,
      [attempts[0]?.id ?? randomUUID(), orderId, preference.preferenceId, order.totalCentavos, preference.sandboxCheckoutUrl],
    )
    return { rows: result.rows }
  })
  if (rows.expired) throw conflict('pedido_expirado', 'A reserva expirou antes de iniciar o pagamento. Refaça o checkout.')
  if (!rows.rows?.[0]) throw conflict('pagamento_indisponivel', 'A tentativa de pagamento não pode ser alterada neste estado.')
  return { payment: mapPayment(rows.rows[0]) }
}

export async function createSavedCardPayment(userId, orderId, cardId, token, gateway = cardGateway) {
  const card = await createCardService(gateway).owned(userId, cardId)
  const order = orderFields(await loadOrderForPayment(userId, orderId))
  assertGatewayOrder(order)
  const { notificationUrl } = resolveSavedCardConfig()
  if (order.status !== 'aguardando_pagamento') throw conflict('pedido_nao_pendente', 'Pedido não está aguardando pagamento.')
  if (new Date(order.paymentDeadlineAt).getTime() <= Date.now()) {
    await cancelPendingOrder(orderId)
    throw conflict('pedido_expirado', 'A reserva expirou. Refaça o checkout.')
  }
  await validateOrderForPayment(order)
  // Conferência server-to-server impede usar token de um cartão alheio.
  const remoteToken = await gateway.getToken(token)
  if (String(remoteToken.card_id) !== card.mp_card_id || remoteToken.live_mode !== false || remoteToken.status !== 'active') {
    throw badRequest('token_cartao_invalido', 'Token de teste não corresponde ao cartão selecionado.')
  }
  const attempt = await inTransaction(async client => {
    const current = (await client.query('SELECT status, payment_deadline_at FROM orders WHERE id = $1 FOR UPDATE', [orderId])).rows[0]
    if (current.status !== 'aguardando_pagamento' || current.payment_deadline_at <= new Date()) throw conflict('pedido_expirado', 'Pedido indisponível para pagamento.')
    const previous = (await client.query('SELECT * FROM payment_attempts WHERE order_id = $1', [orderId])).rows[0]
    if (previous) {
      if (previous.payment_kind !== 'card_saved') throw conflict('metodo_pagamento_definido', 'Pedido já vinculado ao Checkout Pro.')
      // Sem token persistido não há replay seguro após timeout: reconciliar o ID do gateway/webhook.
      throw conflict('pagamento_em_consulta', 'Pagamento já solicitado. Consulte o histórico e reconcilie antes de criar outro pedido.')
    }
    return (await client.query(`INSERT INTO payment_attempts (id, order_id, provider, payment_kind, status, amount_centavos, expected_customer_id, expected_card_id)
      VALUES ($1,$2,'mercadopago','card_saved','em_processamento',$3,$4,$5) RETURNING id`, [randomUUID(), orderId, order.totalCentavos, card.mp_customer_id, card.mp_card_id])).rows[0]
  })
  const payment = await gateway.pay({
    transaction_amount: order.totalCentavos / 100, token, installments: 1,
    payment_method_id: card.payment_method_id, payer: { type: 'customer', id: card.mp_customer_id, email: card.email },
    external_reference: orderId, description: `Pedido FORMA ${orderId}`, metadata: { forma_order_id: orderId },
    notification_url: notificationUrl,
  }, `forma-saved-${attempt.id}`)
  // Vincula apenas ID seguro; nunca persiste resposta bruta/token.
  if (!PAYMENT_ID_PATTERN.test(String(payment.id))) throw new HttpError(502, 'pagamento_invalido', 'Gateway não retornou ID válido. Reconciliação necessária.')
  validateGatewayPayment(payment, { paymentId: payment.id, orderId, preferenceId: null, amountCentavos: order.totalCentavos })
  if (String(payment.payer?.id) !== card.mp_customer_id || String(payment.card?.id) !== card.mp_card_id) {
    throw new HttpError(502, 'pagamento_cartao_divergente', 'Gateway retornou cliente ou cartão divergente. Reconciliação necessária.')
  }
  await query('UPDATE payment_attempts SET provider_payment_id = $2 WHERE id = $1', [attempt.id, String(payment.id)])
  const result = await applyVerifiedPayment(payment)
  return { ...result, payment: await getOrderPayment(userId, orderId) }
}

// Exportada para os testes de integração exercitarem a transição real para
// 'pago' (enfileiramento da confirmação de compra) sem chamar o gateway
// externo — mesmo padrão de createOrder/readCart/consumeOrderReservations.
export async function applyVerifiedPayment(payment, event = null) {
  const { rows: contextRows } = await query(
    `SELECT o.id AS "orderId", o.user_id AS "userId", o.status AS "orderStatus",
            o.total_centavos AS "totalCentavos", pa.preference_id AS "preferenceId",
            pa.payment_kind AS "paymentKind", pa.provider_payment_id AS "providerPaymentId",
            pa.expected_customer_id AS "expectedCustomerId", pa.expected_card_id AS "expectedCardId"
       FROM orders o JOIN payment_attempts pa ON pa.order_id = o.id
      WHERE o.id = $1 AND o.payment_provider = 'mercadopago' AND pa.provider = 'mercadopago'`,
    [payment.external_reference],
  )
  if (!contextRows[0]) return { ignored: true }
  const context = contextRows[0]
  if ((!context.preferenceId && context.paymentKind !== 'card_saved') ||
      (context.paymentKind === 'card_saved' && (
        (context.providerPaymentId && context.providerPaymentId !== String(payment.id)) ||
        String(payment.payer?.id) !== context.expectedCustomerId || String(payment.card?.id) !== context.expectedCardId))) {
    if (event?.eventId) await recordWebhookEvent(event, 'divergente')
    return { ignored: true, divergent: true }
  }
  let verified
  try {
    verified = validateGatewayPayment(payment, {
      paymentId: payment.id,
      orderId: context.orderId,
      preferenceId: context.preferenceId,
      amountCentavos: Number(context.totalCentavos),
    })
  } catch {
    if (event?.eventId) await recordWebhookEvent(event, 'divergente')
    return { ignored: true, divergent: true }
  }

  return inTransaction(async (client) => {
    if (event?.eventId) {
      const eventInsert = await client.query(
        `INSERT INTO payment_webhook_events (event_id, payment_id, action, result)
         VALUES ($1, $2, $3, 'processado') ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
        [event.eventId, verified.paymentId, event.action ?? null],
      )
      if (!eventInsert.rows.length) return { duplicate: true }
    }

    const { rows } = await client.query(
      `SELECT o.id AS "orderId", o.status AS "orderStatus", o.coupon_code AS "couponCode",
              pa.id AS "attemptId", pa.provider_payment_id AS "providerPaymentId"
         FROM orders o JOIN payment_attempts pa ON pa.order_id = o.id
        WHERE o.id = $1 AND pa.preference_id IS NOT DISTINCT FROM $2
        FOR UPDATE OF o, pa`,
      [context.orderId, context.preferenceId],
    )
    const current = rows[0]
    if (!current || (current.providerPaymentId && current.providerPaymentId !== verified.paymentId)) {
      if (event?.eventId) {
        await client.query('UPDATE payment_webhook_events SET result = \'divergente\' WHERE event_id = $1', [event.eventId])
      }
      return { ignored: true, divergent: true }
    }

    if (current.orderStatus === 'pago' && !['aprovada', 'reembolsada', 'revisao_manual'].includes(verified.status)) {
      if (event?.eventId) {
        await client.query('UPDATE payment_webhook_events SET result = \'ignorado\' WHERE event_id = $1', [event.eventId])
      }
      return { ignored: true }
    }

    return applyPaymentTransition(client, current, verified)
  })
}

async function recordWebhookEvent(event, result) {
  await query(
    `INSERT INTO payment_webhook_events (event_id, payment_id, action, result)
     VALUES ($1, $2, $3, $4) ON CONFLICT (event_id) DO NOTHING`,
    [event.eventId, event.paymentId, event.action ?? null, result],
  )
}

async function fetchAndApplyPayment(paymentId, event = null, expectedOrderId = null, fetchPayment = fetchMercadoPagoPayment) {
  if (!PAYMENT_ID_PATTERN.test(String(paymentId))) throw badRequest('pagamento_id_invalido', 'ID de pagamento inválido.')
  const payment = await fetchPayment(String(paymentId))
  if (String(payment.id) !== String(paymentId)) throw badRequest('pagamento_inconsistente', 'O pagamento consultado não corresponde ao ID solicitado.')
  if (expectedOrderId && String(payment.external_reference) !== expectedOrderId) {
    throw badRequest('pagamento_inconsistente', 'O pagamento consultado não pertence a este pedido.')
  }
  return applyVerifiedPayment(payment, event)
}

export async function verifyOrderPayment(userId, orderId, paymentId, fetchPayment = fetchMercadoPagoPayment) {
  const order = await loadOrderForPayment(userId, orderId)
  assertGatewayOrder(order)
  const { rows: attempts } = await query(
    `SELECT provider_payment_id AS "providerPaymentId"
       FROM payment_attempts WHERE order_id = $1`,
    [order.id],
  )
  if (!attempts[0]) throw notFound('O pedido ainda não tem uma tentativa de pagamento.')
  if (attempts[0].providerPaymentId && attempts[0].providerPaymentId !== String(paymentId)) {
    throw badRequest('pagamento_inconsistente', 'O ID consultado não corresponde ao pagamento deste pedido.')
  }
  const result = await fetchAndApplyPayment(paymentId, null, order.id, fetchPayment)
  const { rows } = await query(
    `SELECT pa.status AS "paymentStatus", o.status AS "orderStatus"
       FROM payment_attempts pa JOIN orders o ON o.id = pa.order_id
      WHERE pa.order_id = $1 AND o.user_id = $2`,
    [order.id, userId],
  )
  return { verified: !result.divergent, order: { id: order.id, status: rows[0]?.orderStatus, paymentStatus: rows[0]?.paymentStatus } }
}

export async function handleMercadoPagoWebhook({ signature, requestId, dataId, event }, fetchPayment = fetchMercadoPagoPayment) {
  verifyPaymentWebhookSignature({
    signature,
    requestId,
    dataId,
    secret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
  })
  if (event?.type && event.type !== 'payment') return { ignored: true }
  if (!/^\d{1,80}$/.test(String(event?.id ?? '')) || !dataId) throw badRequest('webhook_invalido', 'Notificação sem ID de evento ou pagamento válido.')
  return fetchAndApplyPayment(String(dataId), {
    eventId: String(event.id),
    paymentId: String(dataId),
    action: ['payment.created', 'payment.updated'].includes(event.action) ? event.action : null,
  }, null, fetchPayment)
}

export async function getOrderPayment(userId, orderId) {
  await loadOrderForPayment(userId, orderId)
  const { rows } = await query(
    `SELECT pa.id, pa.provider, pa.payment_kind AS "paymentKind", pa.order_id AS "orderId", pa.status,
            pa.provider_status AS "providerStatus", pa.provider_payment_id AS "providerPaymentId", pa.sandbox_checkout_url AS "checkoutUrl",
            pa.amount_centavos AS "amountCentavos", pa.created_at AS "createdAt",
            pa.updated_at AS "updatedAt", pa.paid_at AS "paidAt"
       FROM payment_attempts pa JOIN orders o ON o.id = pa.order_id
      WHERE pa.order_id = $1 AND o.user_id = $2`,
    [orderId, userId],
  )
  return rows[0] ? mapPayment(rows[0]) : null
}

export async function runOrderExpirySweep() {
  return expirePendingOrders()
}

// Compartilhada com a demo: mesmas reservas, cupom, outbox e atualização atômica.
export async function applyPaymentTransition(client, current, verified) {
  let attemptStatus = verified.status
  if (verified.status === 'aprovada') {
    if (current.orderStatus === 'aguardando_pagamento') {
      const consumed = await consumeOrderReservations(client, current.orderId)
      if (consumed) {
        await client.query(`UPDATE orders SET status = 'pago' WHERE id = $1`, [current.orderId])
        await enqueueOrderEmail(client, current.orderId, 'purchase_confirmation')
        if (current.couponCode) {
          await client.query(
            `INSERT INTO coupon_redemptions (id, coupon_id, order_id, user_id)
             SELECT $1, c.id, o.id, o.user_id FROM coupons c JOIN orders o ON o.id = $2
              WHERE c.code = $3 ON CONFLICT (order_id) DO NOTHING`,
            [randomUUID(), current.orderId, current.couponCode],
          )
        }
      } else {
        await releaseOrderReservations(client, current.orderId)
        await client.query(`UPDATE orders SET status = 'revisao_manual' WHERE id = $1`, [current.orderId])
        await enqueueOrderEmail(client, current.orderId, 'order_status', 'revisao_manual')
        attemptStatus = 'revisao_manual'
      }
    } else if (current.orderStatus !== 'pago') {
      await client.query(`UPDATE orders SET status = 'revisao_manual' WHERE id = $1`, [current.orderId])
      await enqueueOrderEmail(client, current.orderId, 'order_status', 'revisao_manual')
      attemptStatus = 'revisao_manual'
    }
  } else if (['recusada', 'cancelada'].includes(verified.status) && current.orderStatus === 'aguardando_pagamento') {
    await releaseOrderReservations(client, current.orderId)
    await client.query(`UPDATE orders SET status = 'cancelado' WHERE id = $1`, [current.orderId])
    await enqueueOrderEmail(client, current.orderId, 'order_status', 'cancelado')
  } else if (['reembolsada', 'revisao_manual'].includes(verified.status)) {
    if (current.orderStatus !== 'revisao_manual') {
      await client.query(`UPDATE orders SET status = 'revisao_manual' WHERE id = $1`, [current.orderId])
      await enqueueOrderEmail(client, current.orderId, 'order_status', 'revisao_manual')
    }
  }

  await client.query(
    `UPDATE payment_attempts
        SET provider_payment_id = $2, status = $3, provider_status = $4,
            status_detail = $5, updated_at = now(),
            paid_at = CASE WHEN $4 IN ('approved', 'demo_approved') THEN COALESCE(paid_at, now()) ELSE paid_at END
      WHERE id = $1`,
    [current.attemptId, verified.paymentId, attemptStatus, verified.providerStatus, verified.statusDetail],
  )
  return { orderId: current.orderId, status: attemptStatus }
}

function assertGatewayOrder(order) {
  if (order.paymentProvider !== 'mercadopago' ||
      (config.demo && (config.paymentProvider !== 'mercadopago' || order.transactionMode !== 'demo'))) {
    throw conflict('pagamento_modo_incompativel', 'O provedor deste pedido não corresponde ao modo atual. Pedidos simulados não podem ser enviados ao Mercado Pago.')
  }
}
