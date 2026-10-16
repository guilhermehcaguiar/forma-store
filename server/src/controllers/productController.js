import { query } from '../db/pool.js'
import { notFound } from '../utils/httpError.js'
import { parseProductId } from '../modules/conta/produto.schemas.js'

const PRODUCT_SELECT = `
  SELECT p.id, p.name, p.description, p.color, p.is_printed,
         p.price_cents AS price_centavos, p.promo_price_cents AS promo_price_centavos,
         p.weight_g, p.length_cm, p.width_cm, p.height_cm, p.created_at,
         COALESCE(jsonb_agg(DISTINCT jsonb_build_object('size', ps.size, 'stock', ps.stock))
           FILTER (WHERE ps.id IS NOT NULL), '[]'::jsonb) AS sizes,
         COALESCE(jsonb_agg(DISTINCT jsonb_build_object('url', pi.image_url, 'main', pi.is_main))
           FILTER (WHERE pi.id IS NOT NULL), '[]'::jsonb) AS images
    FROM products p
    LEFT JOIN product_sizes ps ON ps.product_id = p.id
    LEFT JOIN product_images pi ON pi.product_id = p.id
`

export async function getProducts(req, res) {
  const values = []
  const conditions = ['p.is_active = true']
  const add = (condition, value) => {
    values.push(value)
    conditions.push(condition.replace('?', `$${values.length}`))
  }

  if (req.query.color) add('p.color = ?', req.query.color)
  if (req.query.is_printed === 'true' || req.query.is_printed === 'false') {
    add('p.is_printed = ?', req.query.is_printed === 'true')
  }
  if (req.query.promo === 'true') conditions.push('p.promo_price_cents IS NOT NULL')
  if (req.query.size) {
    add('EXISTS (SELECT 1 FROM product_sizes filter_size WHERE filter_size.product_id = p.id AND filter_size.size = ? AND filter_size.stock > 0)', req.query.size)
  }

  const sort = {
    price_asc: 'COALESCE(p.promo_price_cents, p.price_cents) ASC',
    price_desc: 'COALESCE(p.promo_price_cents, p.price_cents) DESC',
    newest: 'p.created_at DESC',
    oldest: 'p.created_at ASC',
  }[req.query.sort] ?? "translate(lower(p.name), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc') ASC, p.name ASC"

  const [products, colors] = await Promise.all([
    query(`${PRODUCT_SELECT} WHERE ${conditions.join(' AND ')} GROUP BY p.id ORDER BY ${sort}, p.id ASC`, values),
    query('SELECT DISTINCT color FROM products WHERE is_active = true ORDER BY color'),
  ])
  res.json({ products: products.rows, filters: { colors: colors.rows.map(row => row.color) } })
}

export async function getProduct(req, res) {
  const { productId } = parseProductId({ productId: req.params.id })
  const { rows } = await query(
    `${PRODUCT_SELECT} WHERE p.id = $1 AND p.is_active = true GROUP BY p.id`,
    [productId],
  )
  if (!rows[0]) throw notFound('Produto não encontrado.')
  res.json({ product: rows[0] })
}
