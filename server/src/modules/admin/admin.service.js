import { query } from '../../db/pool.js'

export async function listOrders() {
  const { rows } = await query(`SELECT o.id, o.status, o.transaction_mode AS "transactionMode", o.payment_provider AS "paymentProvider", o.total_centavos AS "totalCentavos", o.created_at AS "createdAt",
    u.name AS "customerName", pa.status AS "paymentStatus", pa.payment_kind AS "paymentKind",
    o.shipping_service_name AS "shippingService",
    COALESCE((SELECT jsonb_agg(jsonb_build_object('name', oi.product_name, 'size', oi.size, 'quantity', oi.quantity,
      'unitPriceCentavos', oi.unit_price_centavos)) FROM order_items oi WHERE oi.order_id = o.id), '[]'::jsonb) AS items
    FROM orders o JOIN users u ON u.id = o.user_id LEFT JOIN payment_attempts pa ON pa.order_id = o.id
    ORDER BY o.created_at DESC LIMIT 200`)
  return rows
}

// Totais persistidos e consulta de usuários, sob autorização do roteador.

export async function getOverview() {
  const { rows } = await query(`
    SELECT
      (SELECT count(*) FROM users)                          AS users,
      (SELECT count(*) FROM addresses)                      AS addresses,
      (SELECT count(*) FROM lists)                          AS lists,
      (SELECT count(*) FROM products WHERE is_active)        AS products,
      (SELECT count(*) FROM orders)                          AS orders
  `)

  const row = rows[0]
  return {
    users: Number(row.users),
    addresses: Number(row.addresses),
    lists: Number(row.lists),
    products: Number(row.products),
    orders: Number(row.orders),
  }
}

export async function listUsers() {
  const { rows } = await query(
    `SELECT id, name, email, promo, role, created_at AS "createdAt"
       FROM users
      ORDER BY created_at DESC`,
  )

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    promo: row.promo,
    role: row.role,
    createdAt: row.createdAt?.toISOString() ?? null,
  }))
}
