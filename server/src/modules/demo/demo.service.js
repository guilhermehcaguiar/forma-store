import { randomUUID } from 'node:crypto'
import { inTransaction } from '../../db/pool.js'
import { assertLocalConnection } from '../../db/local-database.js'
import { badRequest, conflict, notFound } from '../../utils/httpError.js'
import { applyPaymentTransition, validateOrderForPayment } from '../payments/payments.service.js'
import { config } from '../../config.js'
import { resolveDemoConfig } from './demo.config.js'
import { demoPaymentResult } from './demo.gateway.js'

export async function payDemoOrder(userId, orderId) {
  if (!config.demo || !resolveDemoConfig()) throw notFound()
  return inTransaction(async client => {
    await assertLocalConnection(client)
    const order = (await client.query(`SELECT id, status, transaction_mode AS "transactionMode", payment_provider AS "paymentProvider",
      total_centavos AS "totalCentavos", subtotal_centavos AS "subtotalCentavos",
      discount_centavos AS "discountCentavos", coupon_code AS "couponCode",
      payment_deadline_at AS "paymentDeadlineAt" FROM orders
      WHERE id = $1 AND user_id = $2 FOR UPDATE`, [orderId, userId])).rows[0]
    if (!order) throw notFound('Pedido não encontrado para esta conta.')
    if (order.transactionMode !== 'demo' || order.paymentProvider !== 'forma_demo' || config.paymentProvider !== 'forma_demo') {
      throw conflict('pedido_nao_demonstrativo', 'Pagamento demonstrativo aceita somente pedidos criados com frete demonstrativo.')
    }
    const previous = (await client.query('SELECT * FROM payment_attempts WHERE order_id = $1 FOR UPDATE', [orderId])).rows[0]
    if (previous && previous.provider !== 'forma_demo') throw conflict('metodo_pagamento_definido', 'Pedido vinculado a outro provedor.')
    if (order.status === 'pago' && previous?.status === 'aprovada') {
      return { orderId, status: previous.status, provider: previous.provider, paymentId: previous.provider_payment_id }
    }
    if (order.status !== 'aguardando_pagamento') throw conflict('pedido_nao_pendente', 'Pedido não está aguardando pagamento.')
    if (new Date(order.paymentDeadlineAt) <= new Date()) throw conflict('pedido_expirado', 'A reserva expirou. Refaça o checkout.')
    if (previous) throw conflict('pagamento_indisponivel', 'Tentativa já registrada; consulte o histórico.')
    await validateOrderForPayment(order, client)
    const attemptId = randomUUID()
    const verified = demoPaymentResult(attemptId)
    await client.query(`INSERT INTO payment_attempts
      (id, order_id, provider, payment_kind, provider_payment_id, status, amount_centavos)
      VALUES ($1, $2, 'forma_demo', 'demo', $3, 'criada', $4)`,
    [attemptId, orderId, verified.paymentId, order.totalCentavos])
    const result = await applyPaymentTransition(client, {
      orderId, orderStatus: order.status, couponCode: order.couponCode, attemptId,
    }, verified)
    return { ...result, provider: 'forma_demo', paymentId: verified.paymentId }
  })
}

export function parseDemoPayment(orderId, body) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
    throw badRequest('pedido_invalido', 'ID do pedido inválido.')
  }
  if (!body || Array.isArray(body) || Object.keys(body).length) {
    throw badRequest('demo_corpo_invalido', 'Envie somente um objeto vazio; valores e aprovação são controlados pelo servidor.')
  }
}
