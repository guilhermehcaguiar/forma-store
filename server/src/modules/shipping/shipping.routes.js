import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { parseShippingQuote } from './shipping.schemas.js'
import { createShippingQuote } from './shipping.service.js'

export const shippingRouter = Router()
shippingRouter.use(requireAuth)

shippingRouter.post('/cotacoes', async (req, res) => {
  const { addressId, items } = parseShippingQuote(req.body)
  const quote = await createShippingQuote(req.user.id, addressId, items)
  res.json(quote)
})
