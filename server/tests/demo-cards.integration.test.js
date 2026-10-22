import { assertLocalDatabaseUrl } from '../src/db/local-database.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'

const url = process.env.FORMA_TEST_DATABASE_URL
test('demonstração: administrador, carteira isolada e pagamento direto (gateway fixture)', { skip: !url }, async t => {
  assertLocalDatabaseUrl(url, { testOnly: true })
  process.env.DATABASE_URL = url
  const { pool } = await import('../src/db/pool.js')
  const { createApp } = await import('../src/app.js')
  const { provisionDemoAdmin, demoAdmin } = await import('../src/db/demo-admin.js')
  const { hashPassword } = await import('../src/utils/password.js')
  const { readCart } = await import('../src/modules/cart/cart.service.js')
  const { createOrder } = await import('../src/modules/checkout/checkout.service.js')
  const { cartFingerprint, addressFingerprint } = await import('../src/modules/shipping/shipping.provider.js')
  const { applyVerifiedPayment } = await import('../src/modules/payments/payments.service.js')
  const { HttpError } = await import('../src/utils/httpError.js')
  const keys = ['MERCADOPAGO_MODE','MERCADOPAGO_TEST_ACCESS_TOKEN','MERCADOPAGO_PUBLIC_KEY','MERCADOPAGO_PUBLIC_URL','MERCADOPAGO_WEBHOOK_SECRET']
  const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]))
  Object.assign(process.env, { MERCADOPAGO_MODE:'sandbox', MERCADOPAGO_TEST_ACCESS_TOKEN:randomUUID(), MERCADOPAGO_PUBLIC_KEY:`TEST-${randomUUID()}`, MERCADOPAGO_PUBLIC_URL:'https://fixture.example.test', MERCADOPAGO_WEBHOOK_SECRET:randomUUID() })
  let cardSerial = 0, payCalls = 0, paymentStatus = 'approved', timeout = false, lastPayment, failCard = false, customerCalls = 0
  let tokenCardId = '', wrongToken = false
  const paymentBase = BigInt('0x' + randomUUID().replaceAll('-', '').slice(0, 14))
  const gateway = {
    createCustomer: async user => { customerCalls++; return { id: `fixture-customer-${user.id}` } },
    addCard: async () => {
      if (failCard) throw new HttpError(503, 'cartao_fixture_indisponivel', 'Fixture: cartão recusado')
      return { id: `fixture-card-${++cardSerial}`, payment_method: { id: 'master' }, last_four_digits: '6351', expiration_month: 12, expiration_year: 2030, cardholder: { name: 'DEMONSTRAÇÃO' }, live_mode: false }
    },
    removeCard: async () => ({}),
    getToken: async () => ({ card_id: wrongToken ? 'outro-cartao' : tokenCardId, status: 'active', live_mode: false }),
    pay: async body => {
      payCalls++
      lastPayment = { id: String(paymentBase + BigInt(payCalls)), external_reference: body.external_reference, transaction_amount: body.transaction_amount,
        payer: { id: body.payer.id }, card: { id: tokenCardId }, currency_id: 'BRL', live_mode: false, status: paymentStatus, status_detail: 'fixture' }
      if (timeout) throw new HttpError(503, 'gateway_fixture_timeout', 'Fixture: gateway temporariamente indisponível')
      return lastPayment
    },
  }
  const server = createApp({ cardGateway: gateway }).listen(0, '127.0.0.1'); await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/api`
  async function request(path, { method = 'GET', token, body } = {}) {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: r.status, data: r.status === 204 ? null : await r.json() }
  }
  const register = async () => (await request('/auth/registrar', { method: 'POST', body: { name: 'Cliente demonstração', email: `demo-${randomUUID()}@example.test`, password: 'TesteForma2026!', promo: false } })).data
  const ephemeral = () => randomUUID().replaceAll('-', '') // identificador fictício, nunca token do provedor
  let admin, a, b, card, address, productId
  async function pending() {
    const items = [{ productId, size: 'M', quantity: 1 }], cart = await readCart(items), quoteId = randomUUID()
    await pool.query(`INSERT INTO shipping_quotes (id, user_id, address_id, address_fingerprint, cart_fingerprint, services, expires_at)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,now()+interval '10 minutes')`,
    [quoteId, a.user.id, address.id, addressFingerprint(address), cartFingerprint(cart.items), JSON.stringify([{ id: 'fixture', name: 'Frete fixture local', priceCentavos: 1000 }])])
    return createOrder(a.user.id, { items, addressId: address.id, quoteId, serviceId: 'fixture', checkoutKey: randomUUID(), couponCode: '' })
  }
  const pay = orderId => request(`/conta/cartoes/${card.id}/pagar`, { method: 'POST', token: a.token, body: { orderId, token: ephemeral() } })
  try {
    await t.test('provisionamento local idempotente, hash normal, produção/remoto recusados', async () => {
      await pool.query('DELETE FROM users WHERE email = $1', [demoAdmin.email])
      assert.deepEqual(await provisionDemoAdmin(pool), { created: true })
      admin = (await request('/auth/entrar', { method: 'POST', body: { email: demoAdmin.email, password: demoAdmin.password } })).data
      assert.equal(admin.user.role, 'administrador')
      const hash = await hashPassword('SenhaAlterada2026!')
      await pool.query('UPDATE users SET password_hash=$2 WHERE id=$1', [admin.user.id, hash])
      assert.deepEqual(await provisionDemoAdmin(pool), { created: false })
      assert.equal((await pool.query('SELECT password_hash FROM users WHERE id=$1', [admin.user.id])).rows[0].password_hash, hash)
      assert.equal((await request('/auth/entrar', { method: 'POST', body: { email: demoAdmin.email, password: demoAdmin.password } })).status, 401)
      await assert.rejects(provisionDemoAdmin(pool, { env: 'production', databaseUrl: url }), /somente/)
      await assert.rejects(provisionDemoAdmin(pool, { env: 'development', databaseUrl: 'postgres://example.com/forma' }), /somente/)
    })
    a = await register(); b = await register()
    await t.test('falha ao anexar cartão preserva cliente remoto para a próxima inclusão', async () => {
      const c = await register(), before = customerCalls
      failCard = true
      assert.equal((await request('/conta/cartoes', { method: 'POST', token: c.token, body: { token: ephemeral() } })).status, 503)
      failCard = false
      assert.equal((await request('/conta/cartoes', { method: 'POST', token: c.token, body: { token: ephemeral() } })).status, 201)
      assert.equal(customerCalls, before + 1)
    })
    await t.test('admin permitido; anônimo e cliente recusados; sem endpoint para forçar pago', async () => {
      for (const path of ['/admin/produtos', '/admin/pedidos']) {
        assert.equal((await request(path)).status, 401)
        assert.equal((await request(path, { token: a.token })).status, 403)
        assert.equal((await request(path, { token: admin.token })).status, 200)
      }
      assert.equal((await request('/admin/pedidos/forcar-pago', { token: admin.token, method: 'POST', body: { status: 'pago' } })).status, 404)
    })
    await t.test('carteira autenticada, inclusão e isolamento de leitura/exclusão', async () => {
      assert.equal((await request('/conta/cartoes')).status, 401)
      assert.equal((await request('/conta/cartoes', { token: a.token, method: 'POST', body: { token: ephemeral() } })).status, 201)
      const list = (await request('/conta/cartoes', { token: a.token })).data.cards
      assert.equal(list.length, 1); card = list[0]; tokenCardId = card.providerCardId
      assert.equal((await request('/conta/cartoes', { token: b.token })).data.cards.length, 0)
      assert.equal((await request(`/conta/cartoes/${card.id}`, { token: b.token, method: 'DELETE' })).status, 404)
      assert.equal((await request('/conta/cartoes', { token: a.token, method: 'POST', body: { token: ephemeral(), securityCode: 'proibido' } })).status, 400)
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM payment_customers WHERE user_id=$1', [a.user.id])).rows[0].n, 1)
    })
    address = (await request('/conta/enderecos', { method: 'POST', token: a.token, body: { label: 'Casa', recipient: 'Cliente Teste', cep: '50000000', street: 'Rua Fictícia', number: '123', district: 'Centro', city: 'Recife', state: 'PE', principal: true } })).data.address
    productId = randomUUID()
    await pool.query(`INSERT INTO products (id, name, color, price_cents, weight_g, length_cm, width_cm, height_cm) VALUES ($1,'Peça pagamento fixture','azul',10000,250,30,25,3)`, [productId])
    await pool.query("INSERT INTO product_sizes (product_id,size,stock) VALUES ($1,'M',100)", [productId])
    await t.test('pedido alheio, cartão alheio e token incompatível recusados antes de cobrar', async () => {
      const order = await pending()
      assert.equal((await request(`/conta/cartoes/${card.id}/pagar`, { method: 'POST', token: b.token, body: { orderId: order.id, token: ephemeral() } })).status, 404)
      const ownCard = (await request('/conta/cartoes', { method: 'POST', token: b.token, body: { token: ephemeral() } })).data.cards[0]
      assert.equal((await request(`/conta/cartoes/${ownCard.id}/pagar`, { method: 'POST', token: b.token, body: { orderId: order.id, token: ephemeral() } })).status, 404)
      wrongToken = true; assert.equal((await pay(order.id)).status, 400); wrongToken = false
      assert.equal(payCalls, 0)
    })
    await t.test('aprovação consome reserva uma vez, confirma pedido e enfileira e-mail único', async () => {
      const order = await pending(), responses = await Promise.all([pay(order.id), pay(order.id)])
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 409], JSON.stringify(responses))
      const response = responses.find(r => r.status === 200)
      assert.equal(response.status, 200, JSON.stringify(response.data)); assert.equal(response.data.status, 'aprovada')
      assert.equal((await request(`/conta/pedidos/${order.id}`, { token: a.token })).data.order.status, 'pago')
      assert.equal((await pay(order.id)).status, 409); assert.equal(payCalls, 1)
      assert.deepEqual(await applyVerifiedPayment(lastPayment), { orderId: order.id, status: 'aprovada' })
      const event = { eventId: `fixture-event-${order.id}`, paymentId: lastPayment.id, action: 'payment.updated' }
      assert.deepEqual(await applyVerifiedPayment(lastPayment, event), { orderId: order.id, status: 'aprovada' })
      assert.deepEqual(await applyVerifiedPayment(lastPayment, event), { duplicate: true })
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM email_outbox WHERE order_id=$1 AND template='purchase_confirmation'", [order.id])).rows[0].n, 1)
      assert.equal((await pool.query('SELECT status FROM stock_reservations WHERE order_id=$1', [order.id])).rows[0].status, 'consumido')
      assert.equal((await request('/admin/pedidos', { token: admin.token })).data.orders.find(o => o.id === order.id).items[0].name, 'Peça pagamento fixture')
    })
    await t.test('recusa libera reserva sem confirmação de compra', async () => {
      paymentStatus = 'rejected'; const order = await pending()
      assert.equal((await pay(order.id)).data.status, 'recusada')
      assert.equal((await pool.query('SELECT status FROM orders WHERE id=$1', [order.id])).rows[0].status, 'cancelado')
      assert.equal((await pool.query('SELECT status FROM stock_reservations WHERE order_id=$1', [order.id])).rows[0].status, 'liberado')
    })
    await t.test('timeout não permite segunda cobrança e reconciliação exige cliente/cartão esperados', async () => {
      timeout = true; paymentStatus = 'approved'; const order = await pending()
      assert.equal((await pay(order.id)).status, 503)
      assert.equal((await pay(order.id)).status, 409)
      assert.equal((await applyVerifiedPayment({ ...lastPayment, payer: { id: 'alheio' } })).divergent, true)
      assert.deepEqual(await applyVerifiedPayment(lastPayment), { orderId: order.id, status: 'aprovada' })
      timeout = false
    })
    await t.test('remoção afeta só a carteira e preserva histórico/tentativas', async () => {
      assert.equal((await request(`/conta/cartoes/${card.id}`, { method: 'DELETE', token: a.token })).status, 204)
      assert.equal((await request('/conta/cartoes', { token: a.token })).data.cards.length, 0)
      assert.equal((await request('/conta/pedidos', { token: a.token })).data.orders.filter(o => o.status === 'pago').length, 2)
      const cols = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('payment_cards','payment_customers','payment_attempts')")).rows
      assert.ok(cols.every(c => !/token|cvv|pan|security_code/.test(c.column_name)))
    })
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
    await new Promise(resolve => server.close(resolve)); await pool.end()
  }
})
