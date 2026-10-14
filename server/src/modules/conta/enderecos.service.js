import { randomUUID } from 'node:crypto'
import { query } from '../../db/pool.js'
import { notFound } from '../../utils/httpError.js'

const ADDRESS_COLUMNS = `id, label, recipient, street, number, complement, district,
                         city, state, cep, created_at AS "createdAt", updated_at AS "updatedAt"`

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
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  }
}

// Todas as consultas filtram por user_id: um usuário nunca lê dados de outro (RNF09).
export async function listAddresses(userId) {
  const { rows } = await query(
    `SELECT ${ADDRESS_COLUMNS} FROM addresses WHERE user_id = $1 ORDER BY created_at`,
    [userId],
  )
  return rows.map(serialize)
}

export async function createAddress(userId, values) {
  const { rows } = await query(
    `INSERT INTO addresses (id, user_id, label, recipient, street, number, complement, district, city, state, cep)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${ADDRESS_COLUMNS}`,
    [randomUUID(), userId, values.label, values.recipient, values.street, values.number,
      values.complement, values.district, values.city, values.state, values.cep],
  )
  return serialize(rows[0])
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

export async function deleteAddress(userId, id) {
  const { rowCount } = await query(
    'DELETE FROM addresses WHERE id = $1 AND user_id = $2',
    [id, userId],
  )

  if (rowCount === 0) throw notFound('Endereço não encontrado.')
}
