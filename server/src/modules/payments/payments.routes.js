import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { badRequest } from '../../utils/httpError.js'
import { createOrderPayment, getOrderPayment, handleMercadoPagoWebhook, verifyOrderPayment } from './payments.service.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PAYMENT_ID_PATTERN = /^\d{1,30}$/
export const paymentsRouter = Router()

paymentsRouter.get('/retorno', (req, res) => {
  const orderId = typeof req.query.order_id === 'string' && UUID_PATTERN.test(req.query.order_id) ? req.query.order_id : ''
  const paymentId = typeof req.query.payment_id === 'string' && PAYMENT_ID_PATTERN.test(req.query.payment_id)
    ? req.query.payment_id
    : typeof req.query.collection_id === 'string' && PAYMENT_ID_PATTERN.test(req.query.collection_id)
      ? req.query.collection_id
      : ''
  const frontendUrl = process.env.MERCADOPAGO_FRONTEND_URL ?? 'http://localhost:5173'
  const redirect = new URL('/checkout', frontendUrl)
  if (orderId) redirect.searchParams.set('order_id', orderId)
  if (paymentId) redirect.searchParams.set('payment_id', paymentId)
  res.redirect(303, redirect.toString())
})

paymentsRouter.post('/webhook', async (req, res) => {
  await handleMercadoPagoWebhook({
    signature: req.get('x-signature'),
    requestId: req.get('x-request-id'),
    dataId: req.query['data.id'] ?? req.query.data_id ?? req.body?.data?.id,
    event: req.body,
  })
  res.sendStatus(200)
})

paymentsRouter.post('/pedidos/:orderId/preferencia', requireAuth, async (req, res) => {
  if (!UUID_PATTERN.test(req.params.orderId)) throw badRequest('pedido_invalido', 'ID do pedido inválido.')
  const result = await createOrderPayment(req.user.id, req.params.orderId)
  res.json(result)
})

paymentsRouter.post('/pedidos/:orderId/verificar', requireAuth, async (req, res) => {
  if (!UUID_PATTERN.test(req.params.orderId)) throw badRequest('pedido_invalido', 'ID do pedido inválido.')
  const paymentId = typeof req.body?.paymentId === 'string' || typeof req.body?.paymentId === 'number'
    ? String(req.body.paymentId).trim()
    : ''
  if (!PAYMENT_ID_PATTERN.test(paymentId)) throw badRequest('pagamento_id_invalido', 'ID de pagamento inválido.')
  const result = await verifyOrderPayment(req.user.id, req.params.orderId, paymentId)
  res.json(result)
})

paymentsRouter.get('/pedidos/:orderId', requireAuth, async (req, res) => {
  if (!UUID_PATTERN.test(req.params.orderId)) throw badRequest('pedido_invalido', 'ID do pedido inválido.')
  const payment = await getOrderPayment(req.user.id, req.params.orderId)
  res.json({ payment })
})
