// PostgreSQL persistente do projeto, sem sudo, Docker ou serviço de sistema.
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import dotenv from 'dotenv'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const local = resolve(root, '.local')
const data = resolve(local, 'postgres')
const socket = resolve(local, 'postgres-socket')
const envPath = resolve(root, 'server/.env')
const port = 55434
let client

function run(command, args, { quiet = false } = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: quiet ? 'pipe' : 'inherit' })
  if (result.error) throw new Error(`Não foi possível executar ${command}. Instale os binários PostgreSQL (initdb e pg_ctl).`)
  if (result.status !== 0) throw new Error(`${command} não concluiu. Confira as mensagens acima e .local/postgres.log.`)
}

try {
  const initialized = existsSync(resolve(data, 'PG_VERSION'))
  if (!initialized && existsSync(envPath)) {
    throw new Error('server/.env já existe e foi preservado. Use o PostgreSQL configurado nele; a preparação automática não substitui configurações existentes.')
  }
  mkdirSync(local, { recursive: true, mode: 0o700 })
  mkdirSync(socket, { recursive: true, mode: 0o700 })
  if (!initialized) {
    const passwordPath = resolve(local, 'postgres-password')
    if (!existsSync(passwordPath)) writeFileSync(passwordPath, `${randomBytes(24).toString('hex')}\n`, { mode: 0o600, flag: 'wx' })
    run('initdb', ['-D', data, '--username=forma', `--pwfile=${passwordPath}`, '--auth-local=trust', '--auth-host=scram-sha-256', '--encoding=UTF8', '--locale=C'])
  }
  // Se a criação de .env foi interrompida, o arquivo privado permite retomá-la.
  if (!existsSync(envPath)) {
    const password = readFileSync(resolve(local, 'postgres-password'), 'utf8').trim()
    const template = readFileSync(resolve(root, 'server/.env.example'), 'utf8')
    writeFileSync(envPath, template.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=postgresql://forma:${password}@127.0.0.1:${port}/forma`), { mode: 0o600, flag: 'wx' })
  }
  const values = dotenv.parse(readFileSync(envPath))
  const url = new URL(values.DATABASE_URL)
  if (url.hostname !== '127.0.0.1' || url.port !== String(port) || url.pathname !== '/forma' || url.username !== 'forma') {
    throw new Error('server/.env aponta para outro banco e foi preservado. Este comando gerencia somente o PostgreSQL local da FORMA na porta 55434.')
  }
  const status = spawnSync('pg_ctl', ['-D', data, 'status'], { stdio: 'ignore' })
  if (status.status !== 0) run('pg_ctl', ['-D', data, '-l', resolve(local, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${socket}`, 'start'])
  url.pathname = '/postgres'
  client = new pg.Client({ connectionString: url.href })
  await client.connect()
  const result = await client.query("SELECT 1 FROM pg_database WHERE datname = 'forma'")
  if (!result.rowCount) await client.query('CREATE DATABASE forma OWNER forma')
  console.log('[forma-api] PostgreSQL do projeto disponível em 127.0.0.1:55434; server/.env configurado. Dados existentes preservados.')
} catch (error) {
  console.error('[forma-api]', error.message)
  process.exitCode = 1
} finally {
  await client?.end()
}
