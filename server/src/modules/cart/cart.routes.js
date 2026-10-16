import { Router } from 'express'
import { parseCartItems } from './cart.schemas.js'
import { cartFingerprint } from '../shipping/shipping.provider.js'
import { readCart, validateCoupon } from './cart.service.js'

export const cartRouter = Router()

cartRouter.post('/resumo', async (req, res) => {
  const items = parseCartItems(req.body)
  const cart = await readCart(items, undefined, { review: true })
  let coupon = null, couponError = ''
  if (req.body?.couponCode) {
    try { coupon = await validateCoupon(req.body.couponCode, cart) }
    catch (error) { if (error.status !== 400) throw error; couponError = error.message }
  }
  const canCheckout = cart.items.every(item => !item.issue) && !couponError
  res.json({ cart: cart.items, subtotalCentavos: cart.subtotalCentavos,
    discountCentavos: coupon?.discountCentavos ?? 0, totalCentavos: coupon?.totalCentavos ?? cart.subtotalCentavos,
    coupon, couponError, canCheckout, fingerprint: cartFingerprint(cart.items) })
})

cartRouter.post('/cupom', async (req, res) => {
  const items = parseCartItems(req.body)
  const cart = await readCart(items, undefined, { validateStock: true })
  const coupon = await validateCoupon(req.body?.code, cart)
  res.json({
    cart: cart.items,
    subtotalCentavos: cart.subtotalCentavos,
    coupon,
    discountCentavos: coupon.discountCentavos,
    totalCentavos: coupon.totalCentavos,
  })
})