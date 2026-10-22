import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { assertLocalDatabaseUrl, assertLocalConnection, connectLocalDatabase, createLocalPool } from '../src/db/local-database.js'

const local = 'postgresql://fixture@127.0.0.1:55435/forma_test'
const refused = [
  local+'?host=remote.example.invalid', local+'?%68ost=remote.example.invalid',
  local+'?hostaddr=192.0.2.1', local+'?service=remote', local+'?port=5433',
  local+'?sslcert=/private/file', local+'?options=--search_path=other',
  local+'#fragment', 'postgresql://fixture@remote.example.invalid/forma_test',
  'postgresql://fixture@127.0.0.2/forma_test', 'postgresql:///forma_test',
  'postgresql://fixture@127.0.0.1,remote.example.invalid/forma_test',
]

test('política única recusa query/host/ambiente indireto e aceita URLs loopback explícitas', () => {
  for (const url of refused) assert.throws(()=>assertLocalDatabaseUrl(url), /somente/)
  for (const host of ['localhost','127.0.0.1','[::1]']) {
    assert.ok(assertLocalDatabaseUrl(`postgresql://fixture@${host}:55435/forma_test`,{testOnly:true}))
  }
  for (const key of ['PGHOST','PGHOSTADDR','PGPORT','PGSERVICE','PGSERVICEFILE','PGDATABASE','PGUSER','PGPASSWORD','PGOPTIONS','PGPASSFILE']) {
    assert.throws(()=>assertLocalDatabaseUrl(local,{environment:{[key]:'PRIVATE_CANARY'}}), e=>/somente/.test(e.message)&&!e.message.includes('PRIVATE_CANARY'))
  }
  assert.throws(()=>assertLocalDatabaseUrl(local.replace('forma_test','forma'),{testOnly:true}),/descartável/)
})

test('recusa antes de construir/conectar cliente: nenhuma query ou escrita remota', async () => {
  const Original = pg.Client
  let constructors=0
  pg.Client=class { constructor(){constructors++;throw Error('Não pode construir cliente')} }
  try {
    for (const url of refused) await assert.rejects(connectLocalDatabase(url,{testOnly:true}),/somente/)
    for (const url of refused) assert.throws(()=>createLocalPool(url,{testOnly:true}),/somente/)
    assert.equal(constructors,0)
  } finally {pg.Client=Original}
})

function connected({host='127.0.0.1',peer='127.0.0.1',server='127.0.0.1',database='forma_test'}={}) {
  const queries=[]
  return {queries, connectionParameters:{host,database:'forma_test'},connection:{stream:{remoteAddress:peer}},
    async query(sql){queries.push(sql);return {rows:[{address:server,database}]}},async end(){},release(){}}
}

test('peer remoto é recusado sem SQL; servidor/database divergentes só recebem SELECT de identidade', async () => {
  for (const options of [{host:'remote.example.invalid'},{peer:'192.0.2.1'},{peer:null}]) {
    const client=connected(options)
    await assert.rejects(assertLocalConnection(client,{testOnly:true}),/loopback/)
    assert.deepEqual(client.queries,[])
  }
  for (const options of [{server:'192.0.2.1'},{database:'outro_test'}]) {
    const client=connected(options)
    await assert.rejects(assertLocalConnection(client,{testOnly:true}),/escrita recusada/)
    assert.equal(client.queries.length,1);assert.match(client.queries[0],/^SELECT /)
  }
  for(const address of ['127.0.0.1','::1','::ffff:127.0.0.1']) await assertLocalConnection(connected({peer:address,server:address}),{testOnly:true})
})

test('factory fixa localhost em loopback e verifica identidade antes de liberar cliente', async () => {
  const Original=pg.Client
  let options,connections=0
  pg.Client=class { constructor(value){options=value;Object.assign(this,connected())}async connect(){connections++} }
  try {
    const client=await connectLocalDatabase(local.replace('127.0.0.1','localhost'),{testOnly:true})
    assert.equal(new URL(options.connectionString).hostname,'127.0.0.1');assert.equal(connections,1)
    assert.match(client.queries[0],/^SELECT host\(inet_server_addr/)
    await client.end()
  } finally {pg.Client=Original}
})


test('runners e integrações diretas rejeitam a URL da revisão antes de qualquer operação', () => {
  const cwd=fileURLToPath(new URL('../../',import.meta.url))
  for(const file of [
    'scripts/check-db-tests.mjs','scripts/check-security-browser.mjs','scripts/check-demo-browser.mjs',
    'server/tests/admin-products.integration.test.js','server/tests/cart-profile.integration.test.js',
    'server/tests/cards-migration.integration.test.js','server/tests/catalog.test.js',
    'server/tests/demo-cards.integration.test.js','server/tests/email-confirmation.integration.test.js',
    'server/tests/security-boundary.integration.test.js','server/tests/upgrade.integration.test.js',
    'server/tests/local-database.integration.test.js','server/tests/saved-card-config.integration.test.js',
  ]) {
    const result=spawnSync(process.execPath,[file],{cwd,encoding:'utf8',timeout:10000,env:{...process.env,FORMA_TEST_DATABASE_URL:local+'?host=remote.example.invalid'}})
    assert.equal(result.status,1,file)
    assert.match(result.stdout+result.stderr,/Permitido somente PostgreSQL local/,file)
  }
})
