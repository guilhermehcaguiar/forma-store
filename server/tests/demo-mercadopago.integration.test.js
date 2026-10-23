import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, createHmac } from 'node:crypto'
import { once } from 'node:events'
import { assertLocalDatabaseUrl } from '../src/db/local-database.js'

const url = process.env.FORMA_TEST_DATABASE_URL
test('frete demo + Mercado Pago sandbox: pedido, cartão e webhook (gateway fixture)', { skip: !url }, async t => {
  assertLocalDatabaseUrl(url, { testOnly: true })
  const secret = randomUUID(), privateKey = 'TEST-' + randomUUID(), publicKey = 'TEST-' + randomUUID()
  Object.assign(process.env, { DATABASE_URL: url, NODE_ENV: 'test', FORMA_DEMO_MODE: 'true',
    FORMA_DEMO_PAYMENT_PROVIDER: 'mercadopago', FORMA_API_HOST: '127.0.0.1', FORMA_EMAIL_MODE: 'mock',
    MERCADOPAGO_MODE: 'sandbox', MERCADOPAGO_TEST_ACCESS_TOKEN: privateKey, MERCADOPAGO_PUBLIC_KEY: publicKey,
    MERCADOPAGO_PUBLIC_URL: 'https://fixture.example.test', MERCADOPAGO_WEBHOOK_SECRET: secret })
  const { pool } = await import('../src/db/pool.js')
  const { config } = await import('../src/config.js')
  const { createApp } = await import('../src/app.js')
  const { seedDemoProducts } = await import('../src/db/seed-demo.js')
  const { dispatchEmailOutbox } = await import('../src/modules/notifications/email.service.js')
  await seedDemoProducts(pool)
  let preferences = 0, paid = 0, fetched = 0, providerPayment
  const gateway = {
    createCustomer: async () => ({ id: 'fixture-customer' }),
    addCard: async () => ({ id: 'fixture-card', payment_method: { id: 'visa' }, last_four_digits: '0000', expiration_month: 12, expiration_year: 2030, live_mode: false }),
    getToken: async () => ({ card_id: 'fixture-card', live_mode: false, status: 'active' }),
    pay: async body => { paid++; return { id: '900000000002', external_reference: body.external_reference,
      transaction_amount: body.transaction_amount, currency_id: 'BRL', live_mode: false, status: 'approved',
      payer: { id: body.payer.id }, card: { id: 'fixture-card' } } },
  }
  const paymentGateway = {
    createPreference: async order => { preferences++; return { preferenceId: 'fixture-' + order.id, sandboxCheckoutUrl: 'https://sandbox.mercadopago.com.br/fixture', liveMode: false } },
    fetchPayment: async () => { fetched++; return structuredClone(providerPayment) },
  }
  const server = createApp({ cardGateway: gateway, paymentGateway }).listen(0, '127.0.0.1'); await once(server, 'listening')
  const origin = `http://127.0.0.1:${server.address().port}/api`
  const request = async (path, { method = 'GET', token, body, headers = {} } = {}) => {
    const r = await fetch(origin + path, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: r.status, data: [204,303].includes(r.status) ? null : await r.json().catch(() => null) }
  }
  const register = async () => (await request('/auth/registrar', { method: 'POST', body: { name: 'Pessoa fictícia sandbox', email: randomUUID() + '@example.test', password: 'FormaTeste2026!' } })).data
  let a, b, address, order, card
  const items = [{ productId: 'f04a0000-0000-4000-8000-000000000002', size: 'M', quantity: 1 }]
  const newOrder = async () => {
    const quote = (await request('/frete/cotacoes', { method: 'POST', token: a.token, body: { addressId: address.id, items } })).data
    assert.equal(quote.services[0].priceCentavos, 1000); assert.equal(quote.paymentProvider, 'mercadopago')
    const result = await request('/checkout', { method: 'POST', token: a.token, body: { items, addressId: address.id, quoteId: quote.quoteId, serviceId: 'forma-demo', couponCode: 'FORMA10', checkoutKey: randomUUID(), paymentProvider: 'forma_demo', status: 'pago' } })
    assert.equal(result.status, 201); return result.data.order
  }
  const status = async id => (await pool.query('SELECT status FROM orders WHERE id=$1', [id])).rows[0].status
  try {
    a = await register(); b = await register()
    address = (await request('/conta/enderecos', { method: 'POST', token: a.token, body: { label: 'Teste', recipient: 'Pessoa fictícia', street: 'Rua fictícia', number: '1', district: 'Centro', city: 'Recife', state: 'PE', cep: '50000000' } })).data.address
    await t.test('configuração autenticada não expõe segredos e cotação demo escolhe provedor do servidor', async () => {
      assert.equal((await request('/pagamentos/configuracao')).status, 401)
      const c = (await request('/pagamentos/configuracao', { token: a.token })).data
      assert.equal(c.provider, 'mercadopago'); assert.equal(c.checkoutProAvailable, true); assert.equal(c.savedCardsAvailable, true)
      assert.ok(!JSON.stringify(c).includes(secret)); assert.ok(!JSON.stringify(c).includes(privateKey))
      const health = (await request('/health')).data
      assert.equal(health.demonstration, true); assert.equal(health.paymentProvider, 'mercadopago')
      order = await newOrder(); assert.equal(order.transactionMode, 'demo'); assert.equal(order.paymentProvider, 'mercadopago'); assert.equal(order.demoPaymentAvailable, false); assert.equal(order.totalCentavos, 10891)
      assert.equal((await request('/conta/pedidos/' + order.id, { token: a.token })).data.order.paymentProvider, 'mercadopago')
    })
    await t.test('aprovação simulada e usuário alheio não podem pagar o pedido Mercado Pago', async () => {
      assert.equal((await request(`/demonstracao/pedidos/${order.id}/pagar`, { method: 'POST', token: a.token, body: {} })).status, 409)
      assert.equal((await request(`/demonstracao/pedidos/${order.id}/pagar`, { method: 'POST', token: b.token, body: {} })).status, 404)
      assert.equal((await request(`/pagamentos/pedidos/${order.id}/preferencia`, { method: 'POST', token: b.token, body: {} })).status, 404)
      assert.equal(preferences, 0); assert.equal(await status(order.id), 'aguardando_pagamento')
      await assert.rejects(pool.query("UPDATE orders SET payment_provider='forma_demo' WHERE id=$1", [order.id]), /não pode/)
      await assert.rejects(pool.query("INSERT INTO payment_attempts(id,order_id,provider,payment_kind,provider_payment_id,status,amount_centavos) VALUES($1,$2,'forma_demo','demo',$3,'criada',10891)", [randomUUID(),order.id,'demo:'+randomUUID()]), /incompatível/)
    })
    await t.test('Checkout Pro é idempotente; retorno do navegador não aprova; webhook confirmado aprova uma vez', async () => {
      const preferencePath = `/pagamentos/pedidos/${order.id}/preferencia`
      assert.equal((await request(preferencePath, { method: 'POST', token: a.token, body: {} })).status, 200)
      assert.equal((await request(preferencePath, { method: 'POST', token: a.token, body: {} })).status, 200); assert.equal(preferences, 1)
      assert.equal((await request(`/pagamentos/retorno?order_id=${order.id}&payment_id=900000000001&status=approved`)).status, 303)
      assert.equal(await status(order.id), 'aguardando_pagamento'); assert.equal(fetched, 0)
      providerPayment = { id: '900000000001', external_reference: order.id, preference_id: 'fixture-' + order.id, transaction_amount: 108.91, currency_id: 'BRL', live_mode: false, status: 'pending' }
      const timestamp = Math.floor(Date.now()/1000), requestId = 'fixture-demo-request'
      const signature = 'ts='+timestamp+',v1='+createHmac('sha256',secret).update(`id:${providerPayment.id};request-id:${requestId};ts:${timestamp};`).digest('hex')
      const webhook = eventId => request('/pagamentos/webhook?data.id='+providerPayment.id, { method: 'POST', headers: { 'x-signature': signature, 'x-request-id': requestId }, body: { id:eventId,type:'payment',action:'payment.updated',data:{id:providerPayment.id},status:'approved' } })
      assert.equal((await webhook('920000000001')).status, 200); assert.equal(await status(order.id), 'aguardando_pagamento')
      providerPayment.status = 'approved'
      assert.equal((await webhook('920000000002')).status, 200); assert.equal((await webhook('920000000002')).status, 200)
      assert.equal(await status(order.id), 'pago')
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM email_outbox WHERE order_id=$1 AND template='purchase_confirmation'", [order.id])).rows[0].n, 1)
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM coupon_redemptions WHERE order_id=$1', [order.id])).rows[0].n, 1)
    })
    await t.test('cadastro tokenizado e pagamento com cartão salvo também funcionam com frete demo', async () => {
      assert.equal((await request('/conta/cartoes', { method: 'POST', token: a.token, body: { cardNumber:'DADO_PROIBIDO' } })).status, 400)
      const added = await request('/conta/cartoes', { method: 'POST', token: a.token, body: { token: randomUUID() } })
      assert.equal(added.status, 201); card = added.data.cards[0]
      order = await newOrder()
      const pay = token => request(`/conta/cartoes/${card.id}/pagar`, { method: 'POST', token, body: { orderId: order.id, token: randomUUID() } })
      assert.equal((await pay(b.token)).status, 404); assert.equal(paid, 0)
      assert.equal((await pay(a.token)).status, 200); assert.equal(paid, 1); assert.equal(await status(order.id), 'pago')
      assert.equal((await pay(a.token)).status, 409); assert.equal(paid, 1)
      await dispatchEmailOutbox()
      const email = (await pool.query("SELECT status,payload,mock_message FROM email_outbox WHERE order_id=$1 AND template='purchase_confirmation'", [order.id])).rows[0]
      assert.equal(email.status, 'mocked'); assert.equal(email.payload.transactionMode, 'demo'); assert.equal(email.payload.paymentProvider, 'mercadopago')
      assert.match(email.mock_message.text, /DEMONSTRAÇÃO/)
    })
    await t.test('troca de configuração não reutiliza cotação do outro provedor; falta de credenciais é explícita', async () => {
      const quote = (await request('/frete/cotacoes', { method: 'POST', token: a.token, body: { addressId: address.id, items } })).data
      await pool.query("UPDATE shipping_quotes SET payment_provider='forma_demo' WHERE id=$1", [quote.quoteId])
      const checkout = await request('/checkout', { method: 'POST', token: a.token, body: { addressId: address.id, items, quoteId:quote.quoteId, serviceId:'forma-demo', checkoutKey:randomUUID() } })
      assert.equal(checkout.status, 400)
      delete process.env.MERCADOPAGO_TEST_ACCESS_TOKEN
      const c = (await request('/pagamentos/configuracao', { token: a.token })).data
      assert.equal(c.checkoutProAvailable, false); assert.equal(c.savedCardsAvailable, false); assert.match(c.message, /Access Token/)
      process.env.MERCADOPAGO_TEST_ACCESS_TOKEN = privateKey
      config.paymentProvider = 'forma_demo'
      assert.equal((await request(`/pagamentos/pedidos/${order.id}/preferencia`, { method:'POST', token:a.token,body:{} })).status, 409)
    })
  } finally { await new Promise(r => server.close(r)); await pool.end() }
})
