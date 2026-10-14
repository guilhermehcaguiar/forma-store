// Executor de migrações do FORMA.
//
// Padrão de organização (docs/forma/API_CONTRATOS.md):
//   - Um arquivo SQL por migração, nomeado NNNN_descricao.sql (ex.: 0001_conta.sql).
//   - A numeração é sequencial e não é reutilizada; migrações aplicadas nunca
//     são editadas — correções viram novas migrações.
//   - Cada arquivo roda dentro de uma transação e é registrado em
//     schema_migrations, tornando a execução idempotente.
//
// Uso:
//   node src/db/migrations/run.js status  (padrão)
//   node src/db/migrations/run.js up

import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { pool, query } from '../pool.js'

const MIGRATIONS_DIR = fileURLToPath(new URL('.', import.meta.url))
const MIGRATION_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/i

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text        PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

async function listMigrationFiles() {
  const files = await readdir(MIGRATIONS_DIR)
  return files.filter((file) => MIGRATION_PATTERN.test(file)).sort()
}

async function listApplied() {
  const { rows } = await query('SELECT name FROM schema_migrations ORDER BY name')
  return rows.map((row) => row.name)
}

async function applyMigration(file) {
  const sql = await readFile(`${MIGRATIONS_DIR}${file}`, 'utf8')
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
    await client.query('COMMIT')
    console.log(`[forma-api] migração aplicada: ${file}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw new Error(`Falha ao aplicar a migração ${file}: ${error.message}`)
  } finally {
    client.release()
  }
}

async function runUp() {
  await ensureMigrationsTable()
  const files = await listMigrationFiles()
  const applied = new Set(await listApplied())
  const pending = files.filter((file) => !applied.has(file))

  if (pending.length === 0) {
    console.log('[forma-api] nenhuma migração pendente.')
    return
  }

  for (const file of pending) {
    await applyMigration(file)
  }
  console.log(`[forma-api] ${pending.length} migração(ões) aplicada(s).`)
}

async function showStatus() {
  await ensureMigrationsTable()
  const files = await listMigrationFiles()
  const applied = new Set(await listApplied())

  if (files.length === 0) {
    console.log('[forma-api] nenhum arquivo de migração encontrado.')
    return
  }

  for (const file of files) {
    console.log(`[${applied.has(file) ? 'aplicada' : 'pendente'}] ${file}`)
  }
}

const command = process.argv[2] ?? 'status'

try {
  if (command === 'up') {
    await runUp()
  } else if (command === 'status') {
    await showStatus()
  } else {
    console.error(`[forma-api] comando desconhecido: ${command}. Use "up" ou "status".`)
    process.exitCode = 1
  }
} catch (error) {
  console.error(`[forma-api] ${error.message}`)
  console.error('[forma-api] confira se o PostgreSQL local está em execução e se a DATABASE_URL está correta.')
  process.exitCode = 1
} finally {
  await pool.end()
}
