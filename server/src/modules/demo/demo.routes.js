import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { parseDemoPayment, payDemoOrder } from './demo.service.js'

export function createDemoRouter() {
  const router = Router()
  router.use(requireAuth)
  router.post('/pedidos/:id/pagar', async (req, res) => {
    parseDemoPayment(req.params.id, req.body)
    res.set('Cache-Control', 'no-store').json(await payDemoOrder(req.user.id, req.params.id))
  })
  return router
}
