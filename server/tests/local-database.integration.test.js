import test from 'node:test'
import assert from 'node:assert/strict'
import { assertLocalDatabaseUrl, connectLocalDatabase, createLocalPool } from '../src/db/local-database.js'

const url=process.env.FORMA_TEST_DATABASE_URL
test('PostgreSQL descartável real: cliente e pool verificam cada conexão local', {skip:!url}, async () => {
  assertLocalDatabaseUrl(url,{testOnly:true})
  for(const host of ['127.0.0.1','localhost']) {
    const local = new URL(url); local.hostname = host
    const client=await connectLocalDatabase(local.href,{testOnly:true})
    try {
      assert.equal((await client.query('SELECT current_database() AS name')).rows[0].name,decodeURIComponent(local.pathname.slice(1)))
    } finally {await client.end()}
  }
  const pool=createLocalPool(url,{testOnly:true})
  try {
    for(let i=0;i<3;i++)assert.equal((await pool.query('SELECT 1 AS ok')).rows[0].ok,1)
    const connection=await pool.connect()
    try {await connection.query('BEGIN');await connection.query('CREATE TEMP TABLE guard_probe (id integer)');await connection.query('INSERT INTO guard_probe VALUES (1)');await connection.query('ROLLBACK')}
    finally {connection.release()}
  } finally {await pool.end()}
})
