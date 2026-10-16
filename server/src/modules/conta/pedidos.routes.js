import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { query } from '../../db/pool.js'

export const pedidosRouter = Router()
pedidosRouter.use(requireAuth)

pedidosRouter.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT id, status, subtotal_centavos AS "subtotalCentavos",
            discount_centavos AS "discountCentavos", shipping_centavos AS "shippingCentavos",
            total_centavos AS "totalCentavos", coupon_code AS "couponCode",
            shipping_service_name AS "shippingService", shipping_delivery_days AS "deliveryDays",
            created_at AS "createdAt"
       FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.user.id],
  )
  res.json({ orders: rows })
})
