import { demoProducts } from './demo-products.js'

// Não repõe estoque nem sobrescreve alterações administrativas em reexecuções.
// O lock evita duas execuções simultâneas inserirem relações duplicadas.
export async function seedDemoProducts(pool, products = demoProducts) {
  const client = await pool.connect()
  let inserted = 0
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('forma:seed-demo:v1', 0))")
    for (const product of products) {
      const result = await client.query(`
        INSERT INTO products (id, name, description, color, is_printed, price_cents,
          promo_price_cents, weight_g, length_cm, width_cm, height_cm, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 250, 30, 25, 3, $8)
        ON CONFLICT (id) DO NOTHING RETURNING id`,
      [product.id, product.name, product.description, product.color, product.isPrinted,
        product.priceCentavos, product.promoPriceCentavos, product.createdAt])
      if (!result.rowCount) {
        // Atualiza somente o placeholder conhecido; uploads/imagens do admin são preservados.
        await client.query(`UPDATE product_images pi SET image_url = $2 FROM products p
          WHERE pi.product_id = $1 AND pi.image_url = $3 AND p.id = pi.product_id
            AND p.color = $4 AND p.is_printed = $5 AND p.admin_version = 1`,
          [product.id, product.imageUrl, `/products/demo-${demoProducts.indexOf(product) + 1}.svg`, product.color, product.isPrinted])
        const legacy = product.description.replace(' Imagem criada por IA para representar esta peça demonstrativa.', ' A imagem é uma ilustração identificada, não uma fotografia.')
        await client.query('UPDATE products SET description = $2 WHERE id = $1 AND description = $3 AND admin_version = 1', [product.id, product.description, legacy])
        continue
      }
      for (const variant of product.sizes) {
        await client.query('INSERT INTO product_sizes (product_id, size, stock) VALUES ($1, $2, $3)', [product.id, variant.size, variant.stock])
      }
      await client.query('INSERT INTO product_images (product_id, image_url, is_main) VALUES ($1, $2, true)', [product.id, product.imageUrl])
      inserted++
    }
    await client.query('COMMIT')
    return { inserted, skipped: products.length - inserted }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
