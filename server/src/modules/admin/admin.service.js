import { query } from '../../db/pool.js'

// Dados do painel administrativo. Bloco mínimo desta etapa: o servidor já
// valida o papel em cada rota; o gerenciamento operacional (produtos, preços,
// promoções, pedidos) chega com a migração do catálogo (0002_catalogo.sql em
// diante, conforme docs/forma/API_CONTRATOS.md).

export async function getOverview() {
  const { rows } = await query(`
    SELECT
      (SELECT count(*) FROM users)                          AS users,
      (SELECT count(*) FROM addresses)                      AS addresses,
      (SELECT count(*) FROM lists)                          AS lists,
      0                                                     AS products,
      0                                                     AS orders
  `)

  const row = rows[0]
  return {
    users: Number(row.users),
    addresses: Number(row.addresses),
    lists: Number(row.lists),
    // Catálogo e pedidos ainda não existem no banco; os totais reais chegam
    // com as migrações futuras.
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
