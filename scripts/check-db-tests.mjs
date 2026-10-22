// Cada arquivo recebe banco próprio: testes de SMTP reivindicam o outbox global.
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { assertLocalDatabaseUrl, connectLocalDatabase } from '../server/src/db/local-database.js'

const target = assertLocalDatabaseUrl(process.env.FORMA_TEST_DATABASE_URL, { testOnly: true })
const admin = await connectLocalDatabase(target.href, { testOnly: true })
const files = (await readdir('server/tests')).filter(f => f.endsWith('.test.js'))
const migrations = (await readdir('server/src/db/migrations')).filter(f => /^\d+.*\.sql$/.test(f)).sort()
await mkdir('.tmp/db-tests', { recursive: true })
let failed = false
const results = []
try {
  for (const [index, file] of files.entries()) {
    const name = `forma_test_${Date.now()}_${index}`
    await admin.query(`CREATE DATABASE "${name}"`)
    const url = new URL(target); url.pathname = '/' + name
    const client = await connectLocalDatabase(url.href, { testOnly: true })
    try {
      await client.query('CREATE TABLE schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
      for (const migration of migrations) {
        await client.query('BEGIN')
        await client.query(await readFile(`server/src/db/migrations/${migration}`, 'utf8'))
        await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [migration])
        await client.query('COMMIT')
      }
    } finally { await client.end() }
    const result = await new Promise((resolve, reject) => {
      const proc = spawn(process.execPath, ['--test', '--test-reporter=tap', `server/tests/${file}`], { env: { ...process.env, DATABASE_URL: url.href, FORMA_TEST_DATABASE_URL: url.href } })
      let output = ''
      proc.stdout.on('data', d => { output += d }); proc.stderr.on('data', d => { output += d })
      proc.on('error', reject); proc.on('exit', code => resolve({ file, code, output }))
    })
    await writeFile(`.tmp/db-tests/${file}.tap`, result.output)
    const counts = Object.fromEntries(['tests', 'pass', 'fail', 'skipped'].map(k => [k, Number(result.output.match(new RegExp(`# ${k} (\\d+)`))?.[1] ?? 0)]))
    console.log(JSON.stringify({ file, code: result.code, ...counts }))
    results.push({ file, code: result.code, ...counts })
    if (result.code) failed = true
  }
  await writeFile('.tmp/db-tests/results.json', JSON.stringify(results, null, 2))
} finally { await admin.end() }
process.exitCode = failed ? 1 : 0
