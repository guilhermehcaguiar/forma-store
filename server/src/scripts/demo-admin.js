import './carregar-env.js'
import { createLocalPool } from '../db/local-database.js'
import { demoAdmin, provisionDemoAdmin } from '../db/demo-admin.js'
let pool
try {
  pool = createLocalPool(process.env.DATABASE_URL)
  const result = await provisionDemoAdmin(pool)
  console.log(`[forma-api] ${result.created ? 'Criado' : 'Preservado sem alterar senha ou papel'}: ${demoAdmin.email}`)
} catch {
  console.error('[forma-api] Administrador demonstrativo não provisionado. Exige development/test, URL sem overrides e conexão PostgreSQL loopback; confira também a disponibilidade do banco.')
  process.exitCode = 1
} finally { await pool?.end() }
