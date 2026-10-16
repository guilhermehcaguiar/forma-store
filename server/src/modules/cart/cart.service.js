import { pool } from '../../db/pool.js'
import { badRequest } from '../../utils/httpError.js'

export async function readCart(items, db = pool) {
  if (!items.length) return { items: [], subtotalCentavos: 0 }

  const ids = [...new Set(items.map((item) => item.productId))]
  const { rows } = await db.query(
    `SELECT p.id, p.name, p.description, p.color, p.price_cents AS "priceCentavos",
            p.promo_price_cents AS "promoPriceCentavos", p.weight_g AS "weightG",
            p.length_cm AS "lengthCm", p.width_cm AS "widthCm", p.height_cm AS "heightCm",
            COALESCE(jsonb_agg(DISTINCT jsonb_build_object('size', ps.size, 'stock', ps.stock))
              FILTER (WHERE ps.id IS NOT NULL), '[]'::jsonb) AS sizes
       FROM products p
       LEFT JOIN product_sizes ps ON ps.product_id = p.id
      WHERE p.id = ANY($1::uuid[]) AND p.is_active = true
      GROUP BY p.id`,
    [ids],
  )

  const products = new Map(rows.map((row) => [row.id, row]))
  const lines = items.map((item) => {
    const product = products.get(item.productId)
    if (!product) throw badRequest('produto_indisponivel', 'Um produto do carrinho não está mais disponível.')

    const sizes = product.sizes.filter((entry) => Number(entry.stock) > 0)
    if (product.sizes.length && !sizes.some((entry) => entry.size === item.size && Number(entry.stock) >= item.quantity)) {
      throw badRequest('estoque_indisponivel', `Não há estoque suficiente para ${product.name}${item.size ? ` (${item.size})` : ''}.`)
    }

    const priceCentavos = product.promoPriceCentavos ?? product.priceCentavos
    if (!Number.isSafeInteger(priceCentavos) || priceCentavos < 0) {
      throw badRequest('produto_invalido', `O preço de ${product.name} não está configurado corretamente.`)
    }

    return {
      productId: product.id,
      name: product.name,
      color: product.color,
      size: item.size,
      quantity: item.quantity,
      priceCentavos,
      lineTotalCentavos: priceCentavos * item.quantity,
      weightG: product.weightG,
      lengthCm: product.lengthCm,
      widthCm: product.widthCm,
      heightCm: product.heightCm,
      sizes,
    }
  })

  return {
    items: lines,
    subtotalCentavos: lines.reduce((total, item) => total + item.lineTotalCentavos, 0),
  }
}

export async function validateCoupon(code, cart, db = pool) {
  const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : ''
  if (!normalizedCode) throw validationError({ code: 'Informe um cupom.' })

  const { rows } = await db.query(
    'SELECT code, discount_percentage FROM coupons WHERE code = $1 AND is_active = true',
    [normalizedCode],
  )
  const coupon = rows[0]
  if (!coupon) throw badRequest('cupom_invalido', 'Cupom inválido ou inativo.')

  const percentage = Number(coupon.discount_percentage)
  if (!Number.isInteger(percentage) || percentage < 1 || percentage > 100) {
    throw badRequest('cupom_invalido', 'O desconto deste cupom está configurado incorretamente.')
  }

  const discountCentavos = Math.round((cart.subtotalCentavos * percentage) / 100)
  return {
    code: coupon.code,
    discountPercentage: percentage,
    discountCentavos,
    totalCentavos: cart.subtotalCentavos - discountCentavos,
  }
}
