import { randomUUID } from 'node:crypto'
import { hashPassword } from '../utils/password.js'
import { assertLocalDatabaseUrl, assertLocalConnection } from './local-database.js'

export const demoAdmin = { email: 'admin@forma.local', password: 'FormaDemo2026!', name: 'Administrador de demonstração' }

export async function provisionDemoAdmin(pool, { env = process.env.NODE_ENV ?? 'development', databaseUrl = process.env.DATABASE_URL } = {}) {
  if (process.env.NODE_ENV === 'production' || !['development', 'test'].includes(env)) {
    throw new Error('Administrador demonstrativo permitido somente em desenvolvimento/teste com PostgreSQL local.')
  }
  const target = assertLocalDatabaseUrl(pool.options?.connectionString ?? databaseUrl)
  assertLocalDatabaseUrl(databaseUrl ?? target.href)
  const client = await pool.connect()
  try {
    await assertLocalConnection(client)
    const hash = await hashPassword(demoAdmin.password)
    const result = await client.query(`INSERT INTO users (id, name, email, password_hash, promo, role)
      VALUES ($1, $2, $3, $4, false, 'administrador') ON CONFLICT DO NOTHING RETURNING id`,
    [randomUUID(), demoAdmin.name, demoAdmin.email, hash])
    return { created: result.rowCount === 1 }
  } finally { client.release() }
}
