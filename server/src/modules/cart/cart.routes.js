import { Router } from 'express'
import { parseCartItems } from './cart.schemas.js'
import { readCart, validateCoupon } from './cart.service.js'

export const cartRouter = Router()

cartRouter.post('/resumo', async (req, res) => {
  const items = parseCartItems(req.body)
  const cart = await readCart(items)
  res.json({ cart: cart.items, subtotalCentavos: cart.subtotalCentavos, discountCentavos: 0, totalCentavos: cart.subtotalCentavos })
})

cartRouter.post('/cupom', async (req, res) => {
  const items = parseCartItems(req.body)
  const cart = await readCart(items)
  const coupon = await validateCoupon(req.body?.code, cart)
  res.json({
    cart: cart.items,
    subtotalCentavos: cart.subtotalCentavos,
    coupon,
    discountCentavos: coupon.discountCentavos,
    totalCentavos: coupon.totalCentavos,
  })
})