import './carregar-env.js'
import { pool } from '../db/pool.js'
import { seedDemoProducts } from '../db/seed-demo.js'

try {
  const result = await seedDemoProducts(pool)
  console.log(`[forma-api] catálogo demonstrativo: ${result.inserted} inseridos, ${result.skipped} já existentes (preservados).`)
} catch (error) {
  console.error('[forma-api] falha no seed; aplique as migrações antes:', error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
