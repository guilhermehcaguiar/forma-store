import { assertLocalDatabaseUrl } from '../src/db/local-database.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'

const url = process.env.FORMA_TEST_DATABASE_URL
test('upgrade 0010 → 0011 → 0012 preserva usuário, produto, pedido e tentativa legada', { skip: !url }, async () => {
  assertLocalDatabaseUrl(url, { testOnly: true })
  process.env.DATABASE_URL = url
  const { pool } = await import('../src/db/pool.js')
  const client = await pool.connect()
  try {
    const schema = 'upgrade_' + randomUUID().replaceAll('-', '')
    await client.query(`CREATE SCHEMA ${schema}`)
    await client.query(`SET search_path TO ${schema}`)
    const migrations = new URL('../src/db/migrations/', import.meta.url)
    const files = (await readdir(migrations)).filter(f => /^\d+.*\.sql$/.test(f)).sort()
    for (const file of files.filter(f => f < '0011')) await client.query(await readFile(new URL(file, migrations), 'utf8'))
    const user = randomUUID(), product = randomUUID(), order = randomUUID(), attempt = randomUUID()
    await client.query("INSERT INTO users(id,name,email,password_hash,promo) VALUES ($1,'Aluno','upgrade@example.test','hash-fixture',true)", [user])
    await client.query("INSERT INTO products(id,name,color,price_cents,weight_g,length_cm,width_cm,height_cm) VALUES ($1,'Editado pelo administrador','vinho',12345,250,30,25,3)", [product])
    await client.query(`INSERT INTO orders(id,user_id,status,address_snapshot,subtotal_centavos,discount_centavos,shipping_centavos,total_centavos,shipping_service_id,shipping_service_name,checkout_key,checkout_fingerprint,checkout_payload_fingerprint)
      VALUES ($1,$2,'aguardando_pagamento','{}',12345,0,1000,13345,'fixture','Frete fixture',gen_random_uuid(),'fp','payload')`, [order, user])
    await client.query("INSERT INTO payment_attempts(id,order_id,preference_id,amount_centavos,sandbox_checkout_url) VALUES ($1,$2,'pref-upgrade',13345,'https://sandbox.example.test')", [attempt, order])
    const before = (await client.query('SELECT * FROM orders WHERE id=$1', [order])).rows[0]
    for (const file of files.filter(f => f >= '0011')) await client.query(await readFile(new URL(file, migrations), 'utf8'))
    assert.deepEqual((await client.query('SELECT * FROM orders WHERE id=$1', [order])).rows[0], before)
    const payment = (await client.query('SELECT * FROM payment_attempts WHERE id=$1', [attempt])).rows[0]
    assert.equal(payment.payment_kind, 'checkout_pro'); assert.equal(payment.preference_id, 'pref-upgrade')
    assert.equal((await client.query('SELECT price_cents FROM products WHERE id=$1', [product])).rows[0].price_cents, 12345)
    assert.equal((await client.query('SELECT promo FROM users WHERE id=$1', [user])).rows[0].promo, true)
    assert.equal((await client.query('SELECT count(*)::int AS n FROM payment_cards')).rows[0].n, 0)
  } finally { client.release(); await pool.end() }
})
