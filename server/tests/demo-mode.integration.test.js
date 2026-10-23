import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import net from 'node:net'
import { spawnSync } from 'node:child_process'
import { assertLocalDatabaseUrl } from '../src/db/local-database.js'

const url = process.env.FORMA_TEST_DATABASE_URL

test('demo local: jornada HTTP/SQL, isolamento, estoque, idempotência e e-mail', { skip: !url }, async t => {
  assertLocalDatabaseUrl(url, { testOnly: true })
  Object.assign(process.env, { DATABASE_URL: url, NODE_ENV: 'test', FORMA_DEMO_MODE: 'true',
    FORMA_API_HOST: '127.0.0.1', FORMA_EMAIL_MODE: 'mock' })
  const { pool } = await import('../src/db/pool.js')
  const { createApp } = await import('../src/app.js')
  const { seedDemoProducts } = await import('../src/db/seed-demo.js')
  const { dispatchEmailOutbox } = await import('../src/modules/notifications/email.service.js')
  const { applyVerifiedPayment, runOrderExpirySweep } = await import('../src/modules/payments/payments.service.js')
  const { DEMO_NOTICE } = await import('../src/modules/demo/demo.config.js')
  await seedDemoProducts(pool)
  let externalCalls = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = (input, options) => {
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(String(input)).hostname)) {
      externalCalls++
      throw new Error('Este teste não autoriza conexões externas')
    }
    return originalFetch(input, options)
  }
  const server = createApp().listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/api`
  async function request(path, { method = 'GET', token, body } = {}) {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: r.status, data: r.status === 204 ? null : await r.json() }
  }
  const register = async () => (await request('/auth/registrar', { method: 'POST', body: {
    name: 'Aluno demonstração', email: `${randomUUID()}@example.test`, password: 'FormaTeste2026!', promo: false,
  } })).data
  const addressBody = { label: 'Casa', recipient: 'Aluno', cep: '50000000', street: 'Rua da Demonstração',
    number: '100', district: 'Centro', city: 'Recife', state: 'PE', principal: true }
  const a = await register(), b = await register()
  const address = (await request('/conta/enderecos', { method: 'POST', token: a.token, body: addressBody })).data.address
  const productId = 'f04a0000-0000-4000-8000-000000000002'
  const items = [{ productId, size: 'M', quantity: 1 }]
  const quote = async () => request('/frete/cotacoes', { method: 'POST', token: a.token, body: { addressId: address.id, items } })
  let order, payload
  const pay = (id = order.id, token = a.token, body = {}) => request(`/demonstracao/pedidos/${id}/pagar`, { method: 'POST', token, body })
  const status = async id => (await pool.query('SELECT status FROM orders WHERE id=$1', [id])).rows[0].status
  try {
    await t.test('frete explícito sem credenciais; cotação isolada por dono e valores calculados', async () => {
      assert.equal((await request('/health')).data.demonstration, true)
      assert.equal((await request('/frete/cotacoes', { method: 'POST', body: { addressId: address.id, items } })).status, 401)
      assert.equal((await request('/frete/cotacoes', { method: 'POST', token: b.token, body: { addressId: address.id, items } })).status, 404)
      const q = await quote()
      assert.equal(q.status, 200); assert.equal(q.data.transactionMode, 'demo')
      assert.equal(q.data.services[0].name, DEMO_NOTICE); assert.equal(q.data.services[0].priceCentavos, 1000)
      payload = { items, addressId: address.id, quoteId: q.data.quoteId, serviceId: 'forma-demo',
        couponCode: 'FORMA10', checkoutKey: randomUUID(), status: 'pago', totalCentavos: 1, transactionMode: 'gateway' }
      const results = await Promise.all([0, 1].map(() => request('/checkout', { method: 'POST', token: a.token, body: payload })))
      assert.ok(results.every(r => r.status === 201))
      order = results[0].data.order
      assert.equal(order.id, results[1].data.order.id)
      assert.equal(order.status, 'aguardando_pagamento'); assert.equal(order.transactionMode, 'demo')
      assert.equal(order.totalCentavos, 10891); assert.equal(order.shippingCentavos, 1000)
      assert.equal(order.discountCentavos, 1099)
      assert.equal((await pool.query('SELECT stock FROM product_sizes WHERE product_id=$1 AND size=\'M\'', [productId])).rows[0].stock, 4)
      assert.equal((await pool.query('SELECT status FROM stock_reservations WHERE order_id=$1', [order.id])).rows[0].status, 'reservado')
    })
    await t.test('rota autenticada não aceita status/valor e não expõe pedido de outra conta', async () => {
      assert.equal((await pay(order.id, null)).status, 401)
      assert.equal((await pay(order.id, b.token)).status, 404)
      assert.equal((await pay(order.id, a.token, { status: 'pago' })).status, 400)
      assert.equal((await pay(order.id, a.token, { totalCentavos: 1 })).status, 400)
      assert.equal((await pay(order.id, a.token, [])).status, 400)
      assert.equal(await status(order.id), 'aguardando_pagamento')
      assert.equal((await request(`/conta/pedidos/${order.id}`, { token: b.token })).status, 404)
    })
    await t.test('pedidos gateway e demo não atravessam provedores', async () => {
      const real = randomUUID()
      await pool.query(`INSERT INTO orders(id,user_id,status,address_snapshot,subtotal_centavos,discount_centavos,
        shipping_centavos,total_centavos,shipping_service_id,shipping_service_name,checkout_key,checkout_fingerprint,checkout_payload_fingerprint)
        VALUES($1,$2,'aguardando_pagamento','{}',10000,0,1000,11000,'gateway','Frete externo',gen_random_uuid(),$3,$3)`, [real, a.user.id, real])
      assert.equal((await pay(real)).status, 409); assert.equal(await status(real), 'aguardando_pagamento')
      for (const action of ['preferencia', 'verificar']) {
        assert.equal((await request(`/pagamentos/pedidos/${order.id}/${action}`, {
          method: 'POST', token: a.token, body: { paymentId: '123456' },
        })).status, 409)
      }
      assert.deepEqual(await applyVerifiedPayment({ id: '123456', external_reference: order.id, status: 'approved' }), { ignored: true })
      await assert.rejects(pool.query(`INSERT INTO payment_attempts(id,order_id,provider,payment_kind,provider_payment_id,status,amount_centavos)
        VALUES($1,$2,'forma_demo','demo',$3,'criada',11000)`, [randomUUID(), real, `demo:${randomUUID()}`]), /incompatível/)
      await assert.rejects(pool.query("UPDATE orders SET transaction_mode='gateway' WHERE id=$1", [order.id]), /não pode/)
    })
    await t.test('pagamento concorrente/repetido consome uma reserva, um cupom e uma confirmação', async () => {
      const results = await Promise.all([pay(), pay(), pay()])
      assert.ok(results.every(r => r.status === 200), JSON.stringify(results))
      assert.equal(new Set(results.map(r => r.data.paymentId)).size, 1)
      assert.ok(results.every(r => r.data.provider === 'forma_demo' && r.data.paymentId.startsWith('demo:')))
      assert.equal(await status(order.id), 'pago')
      const payment = (await pool.query('SELECT * FROM payment_attempts WHERE order_id=$1', [order.id])).rows[0]
      assert.equal(payment.provider, 'forma_demo'); assert.equal(payment.payment_kind, 'demo')
      assert.equal(payment.preference_id, null); assert.equal(payment.sandbox_checkout_url, null)
      assert.equal(payment.provider_status, 'demo_approved'); assert.equal(payment.status_detail, DEMO_NOTICE)
      assert.equal((await pool.query('SELECT status FROM stock_reservations WHERE order_id=$1', [order.id])).rows[0].status, 'consumido')
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM coupon_redemptions WHERE order_id=$1', [order.id])).rows[0].n, 1)
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM email_outbox WHERE order_id=$1 AND template='purchase_confirmation'", [order.id])).rows[0].n, 1)
      assert.equal((await pool.query('SELECT stock FROM product_sizes WHERE product_id=$1 AND size=\'M\'', [productId])).rows[0].stock, 4)
      assert.deepEqual(await applyVerifiedPayment({ id: '123456', external_reference: order.id, status: 'approved' }), { ignored: true })
      const history = (await request('/conta/pedidos', { token: a.token })).data.orders
      assert.equal(history.find(o => o.id === order.id).transactionMode, 'demo')
      const detail = (await request(`/conta/pedidos/${order.id}`, { token: a.token })).data.order
      assert.equal(detail.transactionMode, 'demo'); assert.equal(detail.status, 'pago')
    })
    await t.test('mock contém identificação e não depende do opt-in promocional', async () => {
      await dispatchEmailOutbox()
      const email = (await pool.query("SELECT * FROM email_outbox WHERE order_id=$1 AND template='purchase_confirmation'", [order.id])).rows[0]
      assert.equal(email.status, 'mocked'); assert.ok(email.subject.includes(DEMO_NOTICE))
      assert.ok(email.mock_message.text.includes(DEMO_NOTICE)); assert.equal(email.payload.transactionMode, 'demo')
    })
    await t.test('SMTP local recebe confirmação demo; destino externo fica bloqueado mesmo após desligar modo', async () => {
      const messages = []
      const smtp = net.createServer(socket => {
        let buffer = '', data = false, lines = []
        socket.setEncoding('utf8'); socket.write('220 captura local\r\n'); socket.on('error', () => {})
        socket.on('data', chunk => {
          buffer += chunk
          while (buffer.includes('\r\n')) {
            const index = buffer.indexOf('\r\n'), line = buffer.slice(0, index); buffer = buffer.slice(index + 2)
            if (data && line === '.') { messages.push(lines.join('\r\n')); lines = []; data = false; socket.write('250 ok\r\n') }
            else if (data) lines.push(line)
            else if (/^DATA/.test(line)) { data = true; socket.write('354 send\r\n') }
            else if (/^QUIT/.test(line)) socket.end('221 bye\r\n')
            else socket.write('250 ok\r\n')
          }
        })
      })
      smtp.listen(0, '127.0.0.1'); await once(smtp, 'listening')
      Object.assign(process.env, { FORMA_EMAIL_MODE: 'smtp', FORMA_SMTP_HOST: '127.0.0.1',
        FORMA_SMTP_PORT: String(smtp.address().port), FORMA_SMTP_SECURE: 'none', FORMA_SMTP_USER: '', FORMA_SMTP_PASS: '' })
      try {
        await pool.query("UPDATE email_outbox SET status='queued' WHERE order_id=$1 AND template='purchase_confirmation'", [order.id])
        await dispatchEmailOutbox(); assert.equal(messages.length, 1)
        assert.ok(messages[0].includes('DEMONSTRA')); assert.ok(messages[0].includes(order.id))
        assert.equal((await pool.query("SELECT status FROM email_outbox WHERE order_id=$1 AND template='purchase_confirmation'", [order.id])).rows[0].status, 'sent')
        process.env.FORMA_DEMO_MODE = 'false'
        process.env.FORMA_SMTP_HOST = 'smtp.example.invalid'; process.env.FORMA_SMTP_SECURE = 'starttls'
        await pool.query("UPDATE email_outbox SET status='queued' WHERE order_id=$1 AND template='purchase_confirmation'", [order.id])
        await dispatchEmailOutbox()
        const email = (await pool.query("SELECT status,last_error FROM email_outbox WHERE order_id=$1 AND template='purchase_confirmation'", [order.id])).rows[0]
        assert.equal(email.status, 'failed'); assert.match(email.last_error, /loopback/)
      } finally {
        Object.assign(process.env, { FORMA_DEMO_MODE: 'true', FORMA_EMAIL_MODE: 'mock' })
        await new Promise(resolve => smtp.close(resolve))
      }
    })
    await t.test('expiração libera estoque sem pagamento; cotação de outro modo é recusada', async () => {
      const q = await quote()
      await pool.query("UPDATE shipping_quotes SET transaction_mode='gateway', payment_provider='mercadopago' WHERE id=$1", [q.data.quoteId])
      const next = { ...payload, quoteId: q.data.quoteId, checkoutKey: randomUUID() }
      assert.equal((await request('/checkout', { method: 'POST', token: a.token, body: next })).status, 400)
      await pool.query("UPDATE shipping_quotes SET transaction_mode='demo', payment_provider='forma_demo' WHERE id=$1", [q.data.quoteId])
      const r = await request('/checkout', { method: 'POST', token: a.token, body: next })
      assert.equal(r.status, 201)
      await pool.query("UPDATE orders SET payment_deadline_at=now()-interval '1 minute' WHERE id=$1", [r.data.order.id])
      assert.equal((await pay(r.data.order.id)).status, 409)
      await runOrderExpirySweep()
      assert.equal(await status(r.data.order.id), 'cancelado')
      assert.equal((await pool.query('SELECT status FROM stock_reservations WHERE order_id=$1', [r.data.order.id])).rows[0].status, 'liberado')
      assert.equal((await pool.query('SELECT stock FROM product_sizes WHERE product_id=$1 AND size=\'M\'', [productId])).rows[0].stock, 4)
    })
    await t.test('desligar demonstração remove a rota e preserva metadados e pagamentos antigos', () => {
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import { once } from 'node:events'; import assert from 'node:assert/strict';
        const {createApp}=await import('./server/src/app.js'); const {pool}=await import('./server/src/db/pool.js');
        const server=createApp().listen(0,'127.0.0.1');await once(server,'listening');
        try {
          const base='http://127.0.0.1:'+server.address().port+'/api';
          const r=await fetch(base+'/demonstracao/pedidos/${order.id}/pagar',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.DEMO_TEST_SESSION},body:'{}'});
          assert.equal(r.status,404);
          const d=await (await fetch(base+'/conta/pedidos/${order.id}',{headers:{Authorization:'Bearer '+process.env.DEMO_TEST_SESSION}})).json();
          assert.equal(d.order.transactionMode,'demo');assert.equal(d.order.demoPaymentAvailable,false);
          const r2=await fetch(base+'/pagamentos/pedidos/${order.id}/preferencia',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.DEMO_TEST_SESSION},body:'{}'});
          assert.equal(r2.status,409);
        } finally {await new Promise(r=>server.close(r));await pool.end()}
      `], { cwd: new URL('../../', import.meta.url), encoding: 'utf8', timeout: 10000,
        env: { ...process.env, FORMA_DEMO_MODE: 'false', DEMO_TEST_SESSION: a.token } })
      assert.equal(result.status, 0, result.stderr)
    })
    assert.equal(externalCalls, 0)
  } finally {
    globalThis.fetch = originalFetch
    await new Promise(resolve => server.close(resolve)); await pool.end()
  }
})
