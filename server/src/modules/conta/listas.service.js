import { randomUUID } from 'node:crypto'
import { query } from '../../db/pool.js'
import { conflict, notFound } from '../../utils/httpError.js'

const LIST_COLUMNS = 'id, name, created_at AS "createdAt", updated_at AS "updatedAt"'

function serialize(row) {
  return {
    id: row.id,
    name: row.name,
    // Os produtos de cada lista (productIds) chegam com o bloco de catálogo;
    // por enquanto toda lista nasce vazia, como no front atual.
    productIds: [],
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  }
}

export async function listLists(userId) {
  const { rows } = await query(
    `SELECT ${LIST_COLUMNS} FROM lists WHERE user_id = $1 ORDER BY created_at`,
    [userId],
  )
  return rows.map(serialize)
}

export async function createList(userId, { name }) {
  try {
    const { rows } = await query(
      'INSERT INTO lists (id, user_id, name) VALUES ($1, $2, $3) RETURNING ' + LIST_COLUMNS,
      [randomUUID(), userId, name],
    )
    return serialize(rows[0])
  } catch (error) {
    if (error.code === '23505') {
      throw conflict('nome_em_uso', 'Já existe uma lista com esse nome.')
    }
    throw error
  }
}

export async function updateList(userId, id, { name }) {
  try {
    const { rows } = await query(
      `UPDATE lists SET name = $3, updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING ${LIST_COLUMNS}`,
      [id, userId, name],
    )
    if (!rows[0]) throw notFound('Lista não encontrada.')
    return serialize(rows[0])
  } catch (error) {
    if (error.code === '23505') {
      throw conflict('nome_em_uso', 'Já existe uma lista com esse nome.')
    }
    throw error
  }
}

export async function deleteList(userId, id) {
  const { rowCount } = await query(
    'DELETE FROM lists WHERE id = $1 AND user_id = $2',
    [id, userId],
  )

  if (rowCount === 0) throw notFound('Lista não encontrada.')
}
