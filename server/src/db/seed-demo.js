import { demoProducts } from './demo-products.js'

// Não repõe estoque nem sobrescreve alterações administrativas em reexecuções.
// O lock evita duas execuções simultâneas inserirem relações duplicadas.
export async function seedDemoProducts(pool) {
  const client = await pool.connect()
  let inserted = 0
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('forma:seed-demo:v1', 0))")
    for (const product of demoProducts) {
      const result = await client.query(`
        INSERT INTO products (id, name, description, color, is_printed, price_cents,
          promo_price_cents, weight_g, length_cm, width_cm, height_cm, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 250, 30, 25, 3, $8)
        ON CONFLICT (id) DO NOTHING RETURNING id`,
      [product.id, product.name, product.description, product.color, product.isPrinted,
        product.priceCentavos, product.promoPriceCentavos, product.createdAt])
      if (!result.rowCount) continue
      for (const variant of product.sizes) {
        await client.query('INSERT INTO product_sizes (product_id, size, stock) VALUES ($1, $2, $3)', [product.id, variant.size, variant.stock])
      }
      await client.query('INSERT INTO product_images (product_id, image_url, is_main) VALUES ($1, $2, true)', [product.id, product.imageUrl])
      inserted++
    }
    await client.query('COMMIT')
    return { inserted, skipped: demoProducts.length - inserted }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
