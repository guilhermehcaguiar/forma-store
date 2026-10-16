import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { query } from '../../db/pool.js'
import { badRequest, notFound } from '../../utils/httpError.js'

export const pedidosRouter = Router()
pedidosRouter.use(requireAuth)

pedidosRouter.get('/', async (req, res) => {
  const { rows } = await query(
        `SELECT orders.id, orders.status, orders.subtotal_centavos AS "subtotalCentavos",
          orders.discount_centavos AS "discountCentavos", orders.shipping_centavos AS "shippingCentavos",
          orders.total_centavos AS "totalCentavos", orders.coupon_code AS "couponCode",
          orders.shipping_service_name AS "shippingService", orders.shipping_delivery_days AS "deliveryDays",
            pa.status AS "paymentStatus",
          orders.created_at AS "createdAt"
       FROM orders LEFT JOIN payment_attempts pa ON pa.order_id = orders.id
          WHERE orders.user_id = $1 ORDER BY orders.created_at DESC`,
    [req.user.id],
  )
  res.json({ orders: rows })
})

pedidosRouter.get('/:id', async (req, res) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
    throw badRequest('pedido_invalido', 'ID do pedido inválido.')
  }
  const { rows } = await query(
    `SELECT orders.id, orders.status, orders.address_snapshot AS "addressSnapshot",
            orders.subtotal_centavos AS "subtotalCentavos", orders.discount_centavos AS "discountCentavos",
            orders.shipping_centavos AS "shippingCentavos", orders.total_centavos AS "totalCentavos",
            orders.coupon_code AS "couponCode", orders.shipping_service_id AS "shippingServiceId",
            orders.shipping_service_name AS "shippingService", orders.shipping_company_name AS "shippingCompany",
            orders.shipping_delivery_days AS "deliveryDays", orders.created_at AS "createdAt",
            pa.status AS "paymentStatus", pa.provider_status AS "providerStatus",
            pa.sandbox_checkout_url AS "sandboxCheckoutUrl",
            COALESCE(jsonb_agg(jsonb_build_object(
              'productId', oi.product_id, 'name', oi.product_name, 'color', oi.color,
              'size', oi.size, 'quantity', oi.quantity, 'unitPriceCentavos', oi.unit_price_centavos,
              'lineTotalCentavos', oi.line_total_centavos, 'productSnapshot', oi.product_snapshot
            )) FILTER (WHERE oi.id IS NOT NULL), '[]'::jsonb) AS items
       FROM orders
       LEFT JOIN payment_attempts pa ON pa.order_id = orders.id
       LEFT JOIN order_items oi ON oi.order_id = orders.id
      WHERE orders.id = $1 AND orders.user_id = $2
      GROUP BY orders.id, pa.id`,
    [req.params.id, req.user.id],
  )
  if (!rows[0]) throw notFound('Pedido não encontrado.')
  res.json({ order: rows[0] })
})
