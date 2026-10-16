import { pool } from '../../db/pool.js'
import { badRequest, validationError } from '../../utils/httpError.js'

export async function readCart(items, db = pool, { validateStock = false, review = false } = {}) {
  if (!items.length) return { items: [], subtotalCentavos: 0 }

  const ids = [...new Set(items.map((item) => item.productId))]
  const { rows } = await db.query(
    `SELECT p.id, p.is_active, p.name, p.description, p.color, p.is_printed AS "isPrinted",
            p.price_cents AS "priceCentavos", p.promo_price_cents AS "promoPriceCentavos",
            p.weight_g AS "weightG", p.length_cm AS "lengthCm", p.width_cm AS "widthCm",
            p.height_cm AS "heightCm",
            COALESCE(jsonb_agg(DISTINCT jsonb_build_object('size', ps.size, 'stock', ps.stock))
              FILTER (WHERE ps.id IS NOT NULL), '[]'::jsonb) AS sizes,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('url', pi.image_url, 'main', pi.is_main)
                         ORDER BY pi.is_main DESC)
                        FROM product_images pi WHERE pi.product_id = p.id), '[]'::jsonb) AS images
       FROM products p
       LEFT JOIN product_sizes ps ON ps.product_id = p.id AND ps.is_active = true
      WHERE p.id = ANY($1::uuid[]) ${review ? '' : 'AND p.is_active = true'}
      GROUP BY p.id`,
    [ids],
  )

  const products = new Map(rows.map((row) => [row.id, row]))
  const lines = items.map((item) => {
    const product = products.get(item.productId)
    if (!product) {
      if (!review) throw badRequest('produto_indisponivel', 'Um produto do carrinho não está mais disponível.')
      return { ...item, name: 'Produto indisponível', images: [], sizes: [], available: false, stock: 0, priceCentavos: null, lineTotalCentavos: 0, issue: 'Esta peça não está mais disponível. Remova-a do carrinho.' }
    }

    const sizes = product.sizes.map((entry) => ({ ...entry, stock: Number(entry.stock) }))
    const selectedSize = sizes.find((entry) => entry.size === item.size)
    if (validateStock && (!selectedSize || selectedSize.stock < item.quantity)) {
      throw badRequest('estoque_indisponivel', `Não há estoque suficiente para ${product.name}${item.size ? ` (${item.size})` : ''}.`)
    }

    const variantActive = product.is_active && Boolean(selectedSize)
    const stock = variantActive ? selectedSize.stock : 0
    const available = Boolean(variantActive && stock > 0)
    const issue = !variantActive ? 'Peça ou tamanho indisponível. Remova este item do carrinho.'
      : stock < item.quantity ? `O estoque mudou. Disponível: ${stock} unidade(s). Reduza a quantidade ou remova o item.` : ''
    const priceCentavos = product.promoPriceCentavos ?? product.priceCentavos
    if (!Number.isSafeInteger(priceCentavos) || priceCentavos < 0) {
      throw badRequest('produto_invalido', `O preço de ${product.name} não está configurado corretamente.`)
    }

    return {
      ...(review ? { available, stock, issue } : {}),
      productId: product.id,
      name: product.name,
      description: product.description,
      color: product.color,
      isPrinted: product.isPrinted,
      size: item.size,
      quantity: item.quantity,
      priceCentavos,
      lineTotalCentavos: review && !available ? 0 : priceCentavos * item.quantity,
      weightG: product.weightG,
      lengthCm: product.lengthCm,
      widthCm: product.widthCm,
      heightCm: product.heightCm,
      images: product.images,
      sizes,
    }
  })

  return {
    items: lines,
    subtotalCentavos: lines.reduce((total, item) => total + item.lineTotalCentavos, 0),
  }
}

export async function lockCartStock(items, db) {
  const sorted = [...items].sort((left, right) =>
    `${left.productId}:${left.size}`.localeCompare(`${right.productId}:${right.size}`),
  )
  const locked = []

  for (const item of sorted) {
    const { rows } = await db.query(
      `SELECT ps.id, ps.stock
         FROM product_sizes ps
         JOIN products p ON p.id = ps.product_id
        WHERE ps.product_id = $1 AND ps.size = $2 AND p.is_active = true AND ps.is_active = true
        FOR UPDATE OF ps`,
      [item.productId, item.size],
    )
    if (!rows[0] || Number(rows[0].stock) < item.quantity) {
      throw badRequest('estoque_indisponivel', 'O tamanho selecionado não possui estoque suficiente.')
    }
    locked.push({ productSizeId: rows[0].id, quantity: item.quantity })
  }

  return locked
}

export async function validateCoupon(code, cart, db = pool) {
  const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : ''
  if (!normalizedCode) throw validationError({ code: 'Informe um cupom.' })

  const { rows } = await db.query(
    'SELECT id, code, discount_percentage FROM coupons WHERE code = $1 AND is_active = true',
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
    couponId: coupon.id,
    code: coupon.code,
    discountPercentage: percentage,
    discountCentavos,
    totalCentavos: cart.subtotalCentavos - discountCentavos,
  }
}
