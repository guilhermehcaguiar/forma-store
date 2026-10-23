import { randomUUID } from 'node:crypto'
import { inTransaction, query } from '../../db/pool.js'
import { notFound } from '../../utils/httpError.js'

const ADDRESS_COLUMNS = `id, label, recipient, street, number, complement, district,
                         city, state, cep, principal, created_at AS "createdAt", updated_at AS "updatedAt"`

function serialize(row) {
  return {
    id: row.id,
    label: row.label,
    recipient: row.recipient,
    street: row.street,
    number: row.number,
    complement: row.complement,
    district: row.district,
    city: row.city,
    state: row.state,
    cep: row.cep,
    principal: row.principal,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  }
}

// Todas as consultas filtram por user_id: um usuário nunca lê dados de outro (RNF09).
export async function listAddresses(userId) {
  // Principal primeiro; demais do mais antigo para o mais recente.
  const { rows } = await query(
    `SELECT ${ADDRESS_COLUMNS} FROM addresses WHERE user_id = $1
      ORDER BY principal DESC, created_at`,
    [userId],
  )
  return rows.map(serialize)
}

export async function createAddress(userId, values) {
  return inTransaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId])
    // O primeiro endereço da conta nasce como principal; a troca depois disso
    // é sempre uma seleção explícita (setPrincipalAddress).
    const { rows } = await client.query(
      'SELECT count(*)::int AS total FROM addresses WHERE user_id = $1',
      [userId],
    )
    const principal = rows[0].total === 0

    const inserted = await client.query(
      `INSERT INTO addresses (id, user_id, label, recipient, street, number, complement, district, city, state, cep, principal)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING ${ADDRESS_COLUMNS}`,
      [randomUUID(), userId, values.label, values.recipient, values.street, values.number,
        values.complement, values.district, values.city, values.state, values.cep, principal],
    )
    return serialize(inserted.rows[0])
  })
}

export async function updateAddress(userId, id, values) {
  const { rows } = await query(
    `UPDATE addresses
        SET label = $3, recipient = $4, street = $5, number = $6, complement = $7,
            district = $8, city = $9, state = $10, cep = $11, updated_at = now()
      WHERE id = $1 AND user_id = $2
      RETURNING ${ADDRESS_COLUMNS}`,
    [id, userId, values.label, values.recipient, values.street, values.number,
      values.complement, values.district, values.city, values.state, values.cep],
  )

  if (!rows[0]) throw notFound('Endereço não encontrado.')
  return serialize(rows[0])
}

// Seleção explícita do endereço principal (RF05): apenas um por conta.
// A troca é atômica — o anterior perde a marcação no mesmo passo.
export async function setPrincipalAddress(userId, id) {
  return inTransaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId])
    const { rows } = await client.query(
      `UPDATE addresses SET principal = true, updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING ${ADDRESS_COLUMNS}`,
      [id, userId],
    )

    if (!rows[0]) throw notFound('Endereço não encontrado.')

    await client.query(
      `UPDATE addresses SET principal = false, updated_at = now()
        WHERE user_id = $1 AND id <> $2 AND principal`,
      [userId, id],
    )
    return serialize(rows[0])
  })
}

export async function deleteAddress(userId, id) {
  return inTransaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId])
    const { rows } = await client.query(
      'DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING principal',
      [id, userId],
    )

    if (!rows[0]) throw notFound('Endereço não encontrado.')

    // Removendo o principal, o endereço mais antigo restante assume a posição,
    // preservando a invariante de um principal por conta quando há endereços.
    if (rows[0].principal) {
      await client.query(
        `UPDATE addresses SET principal = true, updated_at = now()
          WHERE id = (
            SELECT id FROM addresses WHERE user_id = $1 ORDER BY created_at LIMIT 1
          )`,
        [userId],
      )
    }
    return null
  })
}
