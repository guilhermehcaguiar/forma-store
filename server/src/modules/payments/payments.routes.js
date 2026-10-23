import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { badRequest, HttpError } from '../../utils/httpError.js'
import { createOrderPayment, getOrderPayment, handleMercadoPagoWebhook, verifyOrderPayment } from './payments.service.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
import { safeHttpUrl } from '../../utils/credentials.js'
import { getPaymentConfiguration } from './mercadopago.gateway.js'

const PAYMENT_ID_PATTERN = /^\d{1,30}$/
export function createPaymentsRouter(gateway = {}) {
  const paymentsRouter = Router()

  paymentsRouter.get('/configuracao', requireAuth, (_req, res) => {
    res.set('Cache-Control', 'no-store').json(getPaymentConfiguration())
  })

  paymentsRouter.get('/retorno', (req, res) => {
    const orderId = typeof req.query.order_id === 'string' && UUID_PATTERN.test(req.query.order_id) ? req.query.order_id : ''
    const paymentId = typeof req.query.payment_id === 'string' && PAYMENT_ID_PATTERN.test(req.query.payment_id)
      ? req.query.payment_id
      : typeof req.query.collection_id === 'string' && PAYMENT_ID_PATTERN.test(req.query.collection_id)
        ? req.query.collection_id
        : ''
    const frontendUrl = process.env.MERCADOPAGO_FRONTEND_URL ?? 'http://localhost:5173'
    const base = safeHttpUrl(frontendUrl)
    if (!base) throw new HttpError(503, 'retorno_nao_configurado', 'Configure a URL HTTP(S) do frontend sem credenciais, query ou fragmento.')
    const redirect = new URL('/checkout', base)
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
    }, gateway.fetchPayment)
    res.sendStatus(200)
  })

  paymentsRouter.post('/pedidos/:orderId/preferencia', requireAuth, async (req, res) => {
    if (!UUID_PATTERN.test(req.params.orderId)) throw badRequest('pedido_invalido', 'ID do pedido inválido.')
    const result = await createOrderPayment(req.user.id, req.params.orderId, gateway.createPreference)
    res.json(result)
  })

  paymentsRouter.post('/pedidos/:orderId/verificar', requireAuth, async (req, res) => {
    if (!UUID_PATTERN.test(req.params.orderId)) throw badRequest('pedido_invalido', 'ID do pedido inválido.')
    const paymentId = typeof req.body?.paymentId === 'string' || typeof req.body?.paymentId === 'number'
      ? String(req.body.paymentId).trim()
      : ''
    if (!PAYMENT_ID_PATTERN.test(paymentId)) throw badRequest('pagamento_id_invalido', 'ID de pagamento inválido.')
    const result = await verifyOrderPayment(req.user.id, req.params.orderId, paymentId, gateway.fetchPayment)
    res.json(result)
  })

  paymentsRouter.post('/pedidos/:orderId/reconciliar', requireAuth, async (req, res) => {
    if (!UUID_PATTERN.test(req.params.orderId)) throw badRequest('pedido_invalido', 'ID do pedido inválido.')
    const payment = await getOrderPayment(req.user.id, req.params.orderId)
    if (!payment?.providerPaymentId) throw badRequest('pagamento_sem_id', 'Aguarde o webhook ou informe o ID do Mercado Pago na verificação do pedido. Nenhuma nova cobrança foi iniciada.')
    res.json(await verifyOrderPayment(req.user.id, req.params.orderId, payment.providerPaymentId, gateway.fetchPayment))
  })

  paymentsRouter.get('/pedidos/:orderId', requireAuth, async (req, res) => {
    if (!UUID_PATTERN.test(req.params.orderId)) throw badRequest('pedido_invalido', 'ID do pedido inválido.')
    const payment = await getOrderPayment(req.user.id, req.params.orderId)
    res.json({ payment })
  })
  return paymentsRouter
}
