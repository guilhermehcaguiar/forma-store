import './carregar-env.js'
import { pool } from '../db/pool.js'
import { seedDemoProducts } from '../db/seed-demo.js'

try {
  const result = await seedDemoProducts(pool)
  console.log(`[forma-api] catálogo demonstrativo: ${result.inserted} inseridos, ${result.skipped} já existentes (preservados).`)
} catch {
  console.error('[forma-api] Falha no seed; confira PostgreSQL e migrações. Detalhes privados omitidos.')
  process.exitCode = 1
} finally {
  await pool.end()
}
