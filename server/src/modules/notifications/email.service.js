import { randomUUID } from 'node:crypto'
import { inTransaction } from '../../db/pool.js'
import { HttpError } from '../../utils/httpError.js'

function formatPrice(centavos) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(centavos) / 100)
}

export async function enqueueOrderEmail(client, orderId, template, statusKey = '') {
  const { rows } = await client.query(
    `SELECT o.id, o.status, o.total_centavos AS "totalCentavos",
            o.payment_deadline_at AS "paymentDeadlineAt", o.shipping_service_name AS "shippingService",
            o.shipping_delivery_days AS "deliveryDays", u.email
       FROM orders o JOIN users u ON u.id = o.user_id
      WHERE o.id = $1`,
    [orderId],
  )
  const order = rows[0]
  if (!order) return false

  const eventKey = statusKey
    ? `order:${orderId}:status:${statusKey}`
    : `order:${orderId}:${template}`
  const subject = template === 'order_confirmation'
    ? `Pedido FORMA ${orderId} recebido`
    : `Atualização do pedido FORMA ${orderId}`
  const payload = {
    orderId,
    status: statusKey || order.status,
    totalCentavos: Number(order.totalCentavos),
    paymentDeadlineAt: order.paymentDeadlineAt?.toISOString?.() ?? order.paymentDeadlineAt,
    shippingService: order.shippingService,
    deliveryDays: order.deliveryDays,
  }

  const result = await client.query(
    `INSERT INTO email_outbox (id, order_id, user_id, event_key, recipient_email, template, subject, payload, status)
     VALUES ($1, $2, (SELECT user_id FROM orders WHERE id = $2), $3, $4, $5, $6, $7::jsonb, 'queued')
     ON CONFLICT (event_key) DO NOTHING
     RETURNING id`,
    [randomUUID(), orderId, eventKey, order.email, template, subject, JSON.stringify(payload)],
  )
  return Boolean(result.rows[0])
}

export function renderMockEmail(row) {
  const payload = row.payload
  const statusText = {
    aguardando_pagamento: 'aguardando pagamento',
    pago: 'pagamento confirmado',
    cancelado: 'cancelado; eventual reserva de estoque foi liberada',
    revisao_manual: 'em revisão manual; não realize o envio automaticamente',
  }[payload.status] ?? payload.status
  const lines = [
    `Olá, este é um aviso de teste da FORMA.`,
    `Pedido: ${payload.orderId}`,
    `Status: ${statusText}`,
    `Total: ${formatPrice(payload.totalCentavos)}`,
  ]
  if (payload.shippingService) lines.push(`Frete: ${payload.shippingService}${payload.deliveryDays ? ` (${payload.deliveryDays} dias úteis)` : ''}`)
  if (payload.paymentDeadlineAt && payload.status === 'aguardando_pagamento') {
    lines.push(`Reserva de estoque até: ${new Date(payload.paymentDeadlineAt).toLocaleString('pt-BR')}`)
  }
  lines.push('Modo mock: nenhuma mensagem foi enviada para um endereço externo.')
  return { to: row.recipient_email, subject: row.subject, text: lines.join('\n') }
}

export async function dispatchEmailOutbox(limit = 50) {
  const mode = process.env.FORMA_EMAIL_MODE ?? 'mock'
  if (mode !== 'mock') throw new HttpError(503, 'email_mode_nao_suportado', 'Apenas o transporte de e-mail mock está disponível nesta etapa.')

  return inTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, recipient_email, template, subject, payload
         FROM email_outbox
        WHERE status = 'queued'
        ORDER BY created_at
        LIMIT $1
        FOR UPDATE SKIP LOCKED`,
      [limit],
    )
    for (const row of rows) {
      const message = renderMockEmail(row)
      await client.query(
        `UPDATE email_outbox
            SET status = 'mocked', mock_message = $2::jsonb, processed_at = now(), attempts = attempts + 1
          WHERE id = $1 AND status = 'queued'`,
        [row.id, JSON.stringify(message)],
      )
    }
    return rows.length
  })
}

export async function runEmailOutboxSweep() {
  return dispatchEmailOutbox()
}
