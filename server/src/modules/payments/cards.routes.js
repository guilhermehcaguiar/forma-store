import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { badRequest } from '../../utils/httpError.js'
import { createCardService } from './cards.service.js'
import { createSavedCardPayment } from './payments.service.js'
import { resolveSavedCardConfig } from './mercadopago.gateway.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function tokenBody(body, paying = false) {
  const allowed = paying ? ['token', 'orderId'] : ['token']
  if (!body || Object.keys(body).some(k => !allowed.includes(k)) || typeof body.token !== 'string' || !/^[a-zA-Z0-9_-]{20,256}$/.test(body.token) || /^\d+$/.test(body.token) || (paying && !uuid.test(body.orderId))) {
    throw badRequest('cartao_dados_invalidos', 'Envie somente o token temporário do SDK e, ao pagar, o ID do pedido.')
  }
  return body
}
export function createCardsRouter(gateway) {
  const router = Router(), cards = createCardService(gateway)
  router.use(requireAuth)
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  router.get('/', async (req, res) => res.json({ cards: await cards.list(req.user.id),
    publicKey: resolveSavedCardConfig({ optional: true })?.publicKey ?? null }))
  router.post('/', async (req, res) => {
    await cards.add(req.user.id, tokenBody(req.body).token)
    res.status(201).json({ cards: await cards.list(req.user.id) })
  })
  router.param('id', (req, _res, next, id) => { if (!uuid.test(id)) throw badRequest('cartao_id_invalido', 'ID do cartão inválido.'); next() })
  router.delete('/:id', async (req, res) => { await cards.remove(req.user.id, req.params.id); res.sendStatus(204) })
  router.post('/:id/pagar', async (req, res) => {
    const body = tokenBody(req.body, true)
    res.json(await createSavedCardPayment(req.user.id, body.orderId, req.params.id, body.token, gateway))
  })
  return router
}
