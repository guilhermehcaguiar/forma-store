import { query } from '../../db/pool.js'
import { conflict, notFound } from '../../utils/httpError.js'

// Favoritos por conta (RF19). O produto é referenciado pelo id do contrato do
// catálogo (docs/forma/API_CONTRATOS.md); a tabela de produtos é de outro bloco,
// então aqui o vínculo é apenas o UUID (sem chave estrangeira).

export async function listFavorites(userId) {
  const { rows } = await query(
    'SELECT product_id AS "productId" FROM favorites WHERE user_id = $1 ORDER BY added_at',
    [userId],
  )
  return rows.map((row) => row.productId)
}

export async function addFavorite(userId, productId) {
  const { rowCount } = await query(
    'INSERT INTO favorites (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [userId, productId],
  )

  if (rowCount === 0) {
    throw conflict('favorito_duplicado', 'Esta peça já está nos seus favoritos.')
  }
}

export async function removeFavorite(userId, productId) {
  const { rowCount } = await query(
    'DELETE FROM favorites WHERE user_id = $1 AND product_id = $2',
    [userId, productId],
  )

  if (rowCount === 0) throw notFound('Favorito não encontrado.')
}
