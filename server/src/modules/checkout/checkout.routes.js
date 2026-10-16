import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { parseCheckout } from '../shipping/shipping.schemas.js'
import { createOrder } from './checkout.service.js'

export const checkoutRouter = Router()
checkoutRouter.use(requireAuth)

checkoutRouter.post('/', async (req, res) => {
  const data = parseCheckout(req.body)
  const order = await createOrder(req.user.id, data)
  res.status(201).json({ order })
})
