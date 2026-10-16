import { randomUUID } from 'node:crypto'
import { inTransaction, pool } from '../../db/pool.js'
import { conflict, notFound, validationError } from '../../utils/httpError.js'

const columns = ['name', 'description', 'color', 'is_printed', 'price_cents', 'promo_price_cents', 'weight_g', 'length_cm', 'width_cm', 'height_cm', 'is_active']
const commercial = ['color', 'is_printed', 'price_cents', 'promo_price_cents', 'weight_g', 'length_cm', 'width_cm', 'height_cm', 'is_active']

export async function listAdminProducts(db = pool, id = null) {
  const { rows } = await db.query(`SELECT p.*,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'size', s.size, 'stock', s.stock, 'revision', s.revision, 'is_active', s.is_active,
      'reserved', (SELECT COALESCE(sum(sr.quantity), 0) FROM stock_reservations sr WHERE sr.product_size_id = s.id AND sr.status = 'reservado')) ORDER BY s.size)
      FROM product_sizes s WHERE s.product_id = p.id), '[]'::jsonb) AS sizes,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'url', i.image_url, 'main', i.is_main) ORDER BY i.is_main DESC, i.id)
      FROM product_images i WHERE i.product_id = p.id), '[]'::jsonb) AS images
    FROM products p ${id ? 'WHERE p.id = $1' : ''} ORDER BY p.name, p.id`, id ? [id] : [])
  return rows
}

export async function getAdminProduct(id, db = pool) {
  const rows = await listAdminProducts(db, id)
  if (!rows[0]) throw notFound('Produto não encontrado.')
  return rows[0]
}

export async function saveAdminProduct(id, data, files = []) {
  return inTransaction(async client => {
    let current, variants = [], images = []
    if (id) {
      // Compatível com KEY SHARE das FKs do checkout, que já bloqueia os tamanhos.
      const result = await client.query('SELECT * FROM products WHERE id = $1 FOR NO KEY UPDATE', [id])
      current = result.rows[0]
      if (!current) throw notFound('Produto não encontrado.')
      if (current.admin_version !== data.version) throw conflict('produto_alterado', 'Outro administrador alterou a peça. Reabra o produto antes de salvar.')
      variants = (await client.query('SELECT * FROM product_sizes WHERE product_id = $1 ORDER BY size FOR UPDATE', [id])).rows
      for (const variant of variants) {
        const draft = data.sizes.find(v => v.size === variant.size)
        if (draft && draft.expected_revision !== variant.revision) throw conflict('estoque_alterado', 'O estoque mudou durante a edição. Reabra a peça para consultar os valores atuais.')
      }
      images = (await client.query('SELECT * FROM product_images WHERE product_id = $1 ORDER BY id', [id])).rows
      if (data.retained_images.some(imageId => !images.some(image => image.id === imageId))) throw validationError({ retained_images: 'Uma imagem não pertence a esta peça.' })
      const reserved = (await client.query(`SELECT ps.size FROM stock_reservations sr JOIN product_sizes ps ON ps.id = sr.product_size_id
        WHERE ps.product_id = $1 AND sr.status = 'reservado'`, [id])).rows
      if (reserved.length && (commercial.some(key => current[key] !== data[key]) || reserved.some(v => !data.sizes.some(s => s.size === v.size)))) {
        throw conflict('produto_com_reservas', 'Há reservas de pedidos pendentes. Aguarde a conclusão ou liberação para alterar preços, cor, entrega, status ou retirar tamanhos reservados.')
      }
    }
    const productId = id ?? randomUUID()
    const values = columns.map(key => data[key])
    if (id) await client.query(`UPDATE products SET ${columns.map((key, index) => `${key} = $${index + 2}`).join(', ')}, admin_version = admin_version + 1 WHERE id = $1`, [id, ...values])
    else await client.query(`INSERT INTO products (id, ${columns.join(', ')}) VALUES ($1, ${values.map((_, index) => `$${index + 2}`).join(', ')})`, [productId, ...values])

    // Não apagamos variantes: reservas históricas continuam apontando para o mesmo ID.
    for (const variant of variants) if (!data.sizes.some(v => v.size === variant.size)) {
      if (variant.is_active) await client.query('UPDATE product_sizes SET is_active = false WHERE id = $1', [variant.id])
    }
    for (const variant of data.sizes) {
      await client.query(`INSERT INTO product_sizes (product_id, size, stock) VALUES ($1, $2, $3)
        ON CONFLICT (product_id, size) DO UPDATE SET stock = EXCLUDED.stock, is_active = true`, [productId, variant.size, variant.stock])
    }
    const kept = data.retained_images.map(imageId => images.find(image => image.id === imageId))
    const added = files.map(file => ({ id: randomUUID(), image_url: `uploads/${file.filename}` }))
    const all = [...kept, ...added]
    const mainId = data.main_image.startsWith('new:') ? added[Number(data.main_image.slice(4))]?.id : data.main_image || all[0]?.id
    if (id) await client.query('DELETE FROM product_images WHERE product_id = $1 AND NOT (id = ANY($2::uuid[]))', [id, data.retained_images])
    for (const image of kept) await client.query('UPDATE product_images SET is_main = $2 WHERE id = $1', [image.id, image.id === mainId])
    for (const image of added) await client.query('INSERT INTO product_images (id, product_id, image_url, is_main) VALUES ($1, $2, $3, $4)', [image.id, productId, image.image_url, image.id === mainId])
    // Arquivos anteriores permanecem disponíveis para snapshots dos pedidos.
    return getAdminProduct(productId, client)
  })
}
