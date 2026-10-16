import { query } from '../../db/pool.js'

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
