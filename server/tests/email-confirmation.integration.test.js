// Teste de integração (opt-in) do e-mail de confirmação de compra (RF18).
//
// Executa somente com FORMA_TEST_DATABASE_URL apontando para um PostgreSQL
// descartável LOCAL com as migrações e o seed aplicados (padrão dos outros
// testes de integração deste projeto). Nenhuma rede externa: os envios SMTP
// vão para mini servidores de captura em 127.0.0.1 deste próprio teste, que
// exercem o protocolo real do cliente SMTP (EHLO/MAIL/RCPT/DATA/QUIT). Em
// verificação manual, o mesmo fluxo pode ser apontado ao Mailpit (porta 1025)
// e acompanhado na interface em http://127.0.0.1:8025.
//
// Cenários: confirmação única por compra efetivamente paga (webhook repetido e
// reconciliação repetida não duplicam), opt-in promocional independente
// (promo=false recebe a confirmação), modo mock explícito sem alegar entrega,
// entrega SMTP com destino/conteúdo corretos e sem dados de pagamento,
// falha de SMTP registrada com backoff e nova tentativa controlada sem perder
// o pedido, e recusa de configuração inválida sem queimar tentativas.

import test from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'

const url = process.env.FORMA_TEST_DATABASE_URL
test('e-mail de confirmação de compra: outbox transacional + SMTP local', { skip: !url }, async t => {
  const target = new URL(url)
  assert.ok(['localhost', '127.0.0.1'].includes(target.hostname) && /test|audit/.test(target.pathname))
  process.env.DATABASE_URL = url

  const { pool } = await import('../src/db/pool.js')
  const { createApp } = await import('../src/app.js')
  const { createOrder } = await import('../src/modules/checkout/checkout.service.js')
  const { readCart } = await import('../src/modules/cart/cart.service.js')
  const { addressFingerprint, cartFingerprint } = await import('../src/modules/shipping/shipping.provider.js')
  const { applyVerifiedPayment } = await import('../src/modules/payments/payments.service.js')
  const { dispatchEmailOutbox } = await import('../src/modules/notifications/email.service.js')

  const EMAIL_ENV_VARS = [
    'FORMA_EMAIL_MODE', 'FORMA_EMAIL_FROM', 'FORMA_EMAIL_MAX_ATTEMPTS',
    'FORMA_SMTP_HOST', 'FORMA_SMTP_PORT', 'FORMA_SMTP_SECURE',
    'FORMA_SMTP_USER', 'FORMA_SMTP_PASS',
  ]
  const previousEmailEnv = {}
  for (const name of EMAIL_ENV_VARS) previousEmailEnv[name] = process.env[name]
  const setEmailEnv = (values) => {
    for (const name of EMAIL_ENV_VARS) delete process.env[name]
    Object.assign(process.env, values)
  }

  const server = createApp().listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/api`
  const request = async (path, { method = 'GET', token, body } = {}) => {
    const response = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: response.status, data: response.status === 204 ? null : await response.json() }
  }

  // Mini servidor SMTP de captura (equivalente local ao Mailpit, sem rede).
  function createCaptureSmtpServer({ rejectAtMailFrom = false } = {}) {
    const captured = []
    const waiters = []
    const maybeResolve = () => {
      while (waiters.length && captured.length >= waiters[0].count) {
        waiters.shift().resolve(captured.length)
      }
    }
    const server = net.createServer()
    server.on('connection', (socket) => {
      let buffer = ''
      let current = null
      socket.setEncoding('utf8')
      socket.write('220 mini-smtp FORMA teste\r\n')
      socket.on('data', (chunk) => {
        buffer += chunk
        let index = buffer.indexOf('\r\n')
        while (index !== -1) {
          const line = buffer.slice(0, index)
          buffer = buffer.slice(index + 2)
          if (current?.inData) {
            if (line === '.') {
              current.inData = false
              captured.push(current)
              maybeResolve()
              socket.write('250 ok: mensagem enfileirada\r\n')
            } else {
              current.data.push(line.startsWith('.') ? line.slice(1) : line)
            }
          } else {
            const verb = line.split(' ')[0].toUpperCase()
            if (verb === 'EHLO' || verb === 'HELO') socket.write('250-mini-smtp\r\n250 8BITMIME\r\n')
            else if (verb === 'MAIL') {
              if (rejectAtMailFrom) {
                socket.write('421 serviço temporariamente indisponível\r\n')
              } else {
                current = { mailFrom: line, rcptTo: [], data: [], inData: false }
                socket.write('250 ok\r\n')
              }
            } else if (verb === 'RCPT') {
              current?.rcptTo.push(line)
              socket.write('250 ok\r\n')
            } else if (verb === 'DATA') {
              current.inData = true
              socket.write('354 envie o conteúdo\r\n')
            } else if (verb === 'QUIT') {
              socket.write('221 tchau\r\n')
              socket.end()
            } else if (verb === 'AUTH') {
              socket.write('535 autenticação não suportada\r\n')
            } else {
              socket.write('250 ok\r\n')
            }
          }
          index = buffer.indexOf('\r\n')
        }
      })
      socket.on('error', () => {})
    })
    // Espera determinística por N mensagens, sem sleep.
    const waitForMessages = (count, timeoutMs = 5000) => {
      if (captured.length >= count) return Promise.resolve(captured.length)
      return new Promise((resolve, reject) => {
        const waiter = {
          count,
          resolve: (delivered) => {
            clearTimeout(timer)
            resolve(delivered)
          },
        }
        const timer = setTimeout(() => {
          const index = waiters.indexOf(waiter)
          if (index !== -1) waiters.splice(index, 1)
          reject(new Error(`Timeout aguardando ${count} mensagem(ns) no SMTP de captura; entregues: ${captured.length}`))
        }, timeoutMs)
        waiters.push(waiter)
      })
    }
    return { server, captured, waitForMessages }
  }

  const goodSmtp = createCaptureSmtpServer()
  await once(goodSmtp.server.listen(0, '127.0.0.1'), 'listening')
  const badSmtp = createCaptureSmtpServer({ rejectAtMailFrom: true })
  await once(badSmtp.server.listen(0, '127.0.0.1'), 'listening')
  const bodyOf = (message) => message.data.join('\r\n')

  let account, address, productId
  const items = [{ productId: null, size: 'M', quantity: 2, priceCentavos: 1 }]
  let paymentSerial = 0

  const outboxRows = async (orderId, template) => (await pool.query(
    `SELECT id, event_key, recipient_email, status, attempts, next_attempt_at, sent_at, last_error, mock_message
       FROM email_outbox WHERE order_id = $1 AND template = $2`,
    [orderId, template],
  )).rows

  async function createPendingOrder() {
    const cart = await readCart(items)
    const quoteId = randomUUID()
    await pool.query(
      `INSERT INTO shipping_quotes (id, user_id, address_id, address_fingerprint, cart_fingerprint, services, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, now() + interval '10 minutes')`,
      [quoteId, account.user.id, address.id, addressFingerprint(address), cartFingerprint(cart.items),
        JSON.stringify([{ id: 'fixture', name: 'Frete simulado', priceCentavos: 1000 }])],
    )
    return createOrder(account.user.id, {
      items, addressId: address.id, quoteId,
      checkoutKey: randomUUID(), serviceId: 'fixture', couponCode: '',
    })
  }

  // Fixtura de tentativa de pagamento na forma do gateway (sem rede), aplicada
  // pela transição real applyVerifiedPayment — o caminho que enfileira o
  // e-mail de confirmação de compra.
  async function createPaymentFixture(order) {
    paymentSerial += 1
    const paymentId = String(900000000 + paymentSerial)
    const preferenceId = `pref-${order.id}`
    await pool.query(
      `INSERT INTO payment_attempts (id, order_id, provider, preference_id, status, amount_centavos, sandbox_checkout_url)
       VALUES ($1, $2, 'mercadopago', $3, 'criada', $4, 'https://sandbox.example.test/checkout')`,
      [randomUUID(), order.id, preferenceId, order.totalCentavos],
    )
    const payment = {
      id: paymentId,
      external_reference: order.id,
      preference_id: preferenceId,
      transaction_amount: order.totalCentavos / 100,
      currency_id: 'BRL',
      live_mode: false,
      status: 'approved',
      status_detail: 'accredited',
    }
    return {
      paymentId,
      apply: eventId => applyVerifiedPayment(payment, eventId ? { eventId, paymentId, action: 'payment.updated' } : null),
    }
  }

  try {
    account = (await request('/auth/registrar', {
      method: 'POST',
      body: { name: 'Teste e-mail', email: `email-${randomUUID()}@example.test`, password: 'senha123', promo: false },
    })).data
    productId = randomUUID()
    items[0].productId = productId
    await pool.query(
      `INSERT INTO products (id, name, description, color, price_cents, promo_price_cents, is_active, weight_g, length_cm, width_cm, height_cm)
       VALUES ($1, 'Oversized e-mail', 'Peça de teste do e-mail', 'azul', 12000, 10000, true, 250, 30, 25, 3)`,
      [productId],
    )
    await pool.query("INSERT INTO product_sizes (product_id, size, stock) VALUES ($1, 'M', 9)", [productId])
    await pool.query("INSERT INTO product_images (product_id, image_url, is_main) VALUES ($1, '/products/demo-2.svg', true)", [productId])
    address = (await request('/conta/enderecos', {
      method: 'POST', token: account.token,
      body: {
        label: 'Casa', recipient: 'Cliente Teste', street: 'Rua Fictícia', number: '123',
        complement: 'Apto 4', district: 'Centro', city: 'Recife', state: 'PE', cep: '50000000',
      },
    })).data.address

    let order1, fixture1
    await t.test('compra confirmada pelo pagamento enfileira exatamente uma confirmação; repetições não duplicam', async () => {
      order1 = await createPendingOrder()
      fixture1 = await createPaymentFixture(order1)

      assert.deepEqual(await fixture1.apply(`evt-${order1.id}-a`), { orderId: order1.id, status: 'aprovada' })
      assert.equal((await pool.query('SELECT status FROM orders WHERE id = $1', [order1.id])).rows[0].status, 'pago')

      const attempt = (await pool.query('SELECT provider_payment_id, paid_at FROM payment_attempts WHERE order_id = $1', [order1.id])).rows[0]
      assert.equal(attempt.provider_payment_id, fixture1.paymentId)
      assert.ok(attempt.paid_at, 'paid_at preenchido')

      const reservations = (await pool.query('SELECT status FROM stock_reservations WHERE order_id = $1', [order1.id])).rows
      assert.equal(reservations.length, 1)
      assert.equal(reservations[0].status, 'consumido')

      const confirmation = await outboxRows(order1.id, 'purchase_confirmation')
      assert.equal(confirmation.length, 1)
      assert.equal(confirmation[0].event_key, `order:${order1.id}:purchase_confirmation`)
      assert.equal(confirmation[0].recipient_email, account.user.email)
      assert.equal(confirmation[0].status, 'queued')

      // Webhook repetido (mesmo event_id) e reconciliações repetidas.
      assert.deepEqual(await fixture1.apply(`evt-${order1.id}-a`), { duplicate: true })
      assert.deepEqual(await fixture1.apply(`evt-${order1.id}-b`), { orderId: order1.id, status: 'aprovada' })
      assert.deepEqual(await fixture1.apply(null), { orderId: order1.id, status: 'aprovada' })
      assert.deepEqual(await fixture1.apply(null), { orderId: order1.id, status: 'aprovada' })

      assert.equal((await outboxRows(order1.id, 'purchase_confirmation')).length, 1)
      const paidAtAfter = (await pool.query('SELECT paid_at FROM payment_attempts WHERE order_id = $1', [order1.id])).rows[0].paid_at
      assert.equal(paidAtAfter.getTime(), attempt.paid_at.getTime(), 'paid_at preservado nas repetições')

      const templates = (await pool.query('SELECT template FROM email_outbox WHERE order_id = $1', [order1.id])).rows.map(row => row.template)
      assert.deepEqual([...templates].sort(), ['order_confirmation', 'purchase_confirmation'])

      // Opt-in promocional independente: promo=false não impede a confirmação.
      assert.equal((await pool.query('SELECT promo FROM users WHERE id = $1', [account.user.id])).rows[0].promo, false)
    })

    await t.test('modo mock explícito gera prévias e nunca se apresenta como entrega', async () => {
      setEmailEnv({ FORMA_EMAIL_MODE: 'mock' })
      assert.equal(await dispatchEmailOutbox(), 2)

      const confirmation = await outboxRows(order1.id, 'purchase_confirmation')
      assert.equal(confirmation[0].status, 'mocked')
      assert.equal(confirmation[0].sent_at, null)
      const preview = confirmation[0].mock_message
      assert.ok(preview?.text, 'prévia com texto')
      assert.match(preview.text, /Sua compra na FORMA foi confirmada/)
      assert.match(preview.text, /nenhuma mensagem foi enviada para um endereço externo/)
      assert.equal(preview.to, account.user.email)
      assert.equal(goodSmtp.captured.length, 0, 'nenhuma conexão SMTP em modo mock')
    })

    let order2
    await t.test('modo smtp entrega confirmação única com destino e conteúdo corretos', async () => {
      order2 = await createPendingOrder()
      const fixture2 = await createPaymentFixture(order2)
      assert.deepEqual(await fixture2.apply(`evt-${order2.id}-a`), { orderId: order2.id, status: 'aprovada' })

      setEmailEnv({
        FORMA_EMAIL_MODE: 'smtp', FORMA_SMTP_HOST: '127.0.0.1',
        FORMA_SMTP_PORT: String(goodSmtp.server.address().port), FORMA_SMTP_SECURE: 'none',
      })
      assert.equal(await dispatchEmailOutbox(), 2)
      await goodSmtp.waitForMessages(2)
      assert.equal(goodSmtp.captured.length, 2, 'order_confirmation + purchase_confirmation')

      const confirmations = goodSmtp.captured.filter((message) => bodyOf(message).includes(`Subject: Compra FORMA ${order2.id} confirmada`))
      assert.equal(confirmations.length, 1, 'entrega única da confirmação')
      const message = confirmations[0]
      assert.deepEqual(message.rcptTo, [`RCPT TO:<${account.user.email}>`])
      assert.match(message.mailFrom, /MAIL FROM:<no-reply@forma\.local>/)

      const body = bodyOf(message)
      assert.match(body, new RegExp(`Pedido: ${order2.id}`))
      assert.match(body, /Oversized e-mail/)
      assert.match(body, /tamanho: M, quantidade: 2/)
      assert.match(body, /R\$\s?100,00 por unidade/)
      assert.match(body, /Subtotal: R\$\s?200,00/)
      assert.match(body, /Frete: Frete simulado — R\$\s?10,00/)
      assert.match(body, /Total: R\$\s?210,00/)
      assert.match(body, /Endereço de entrega/)
      assert.match(body, /Cliente Teste/)
      assert.match(body, /Rua Fictícia, 123 — Apto 4/)
      assert.match(body, /CEP 50000-000/)
      assert.ok(!body.includes('nenhuma mensagem foi enviada'), 'entrega real não carrega aviso de mock')
      for (const forbidden of ['cvv', 'CVV', 'PAN', 'paymentId', 'providerPaymentId', 'mercadopago']) {
        assert.ok(!body.includes(forbidden), `conteúdo não deve expor ${forbidden}`)
      }

      const row = (await outboxRows(order2.id, 'purchase_confirmation'))[0]
      assert.equal(row.status, 'sent')
      assert.equal(row.attempts, 1)
      assert.ok(row.sent_at, 'sent_at preenchido')
      assert.equal(row.next_attempt_at, null)
      assert.equal(row.last_error, null)
    })

    await t.test('falha de SMTP registra erro e backoff; nova tentativa controlada entrega uma única vez', async () => {
      const order3 = await createPendingOrder()
      const fixture3 = await createPaymentFixture(order3)
      assert.deepEqual(await fixture3.apply(`evt-${order3.id}-a`), { orderId: order3.id, status: 'aprovada' })

      setEmailEnv({
        FORMA_EMAIL_MODE: 'smtp', FORMA_SMTP_HOST: '127.0.0.1',
        FORMA_SMTP_PORT: String(badSmtp.server.address().port), FORMA_SMTP_SECURE: 'none',
      })
      await dispatchEmailOutbox()

      const failed = (await outboxRows(order3.id, 'purchase_confirmation'))[0]
      assert.equal(failed.status, 'failed')
      assert.equal(failed.attempts, 1)
      assert.match(failed.last_error, /421/)
      assert.ok(failed.next_attempt_at > new Date(), 'backoff futuro')
      assert.equal(
        (await pool.query('SELECT next_attempt_at <= now() + interval \'3 minutes\' AS soon FROM email_outbox WHERE id = $1', [failed.id])).rows[0].soon,
        true,
        'backoff exponencial curto para a primeira falha',
      )
      assert.equal(badSmtp.captured.length, 0, 'servidor com falha não registrou entrega')

      // O pedido não é perdido pelo erro de e-mail.
      const orderRow = (await pool.query('SELECT status, total_centavos FROM orders WHERE id = $1', [order3.id])).rows[0]
      assert.equal(orderRow.status, 'pago')
      assert.equal(Number(orderRow.total_centavos), 21000)
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM order_items WHERE order_id = $1', [order3.id])).rows[0].n, 1)

      // Backoff vencido + servidor recuperado: nova tentativa entrega uma vez.
      await pool.query('UPDATE email_outbox SET next_attempt_at = now() WHERE order_id = $1', [order3.id])
      setEmailEnv({
        FORMA_EMAIL_MODE: 'smtp', FORMA_SMTP_HOST: '127.0.0.1',
        FORMA_SMTP_PORT: String(goodSmtp.server.address().port), FORMA_SMTP_SECURE: 'none',
      })
      await dispatchEmailOutbox()
      await goodSmtp.waitForMessages(4)

      const retried = (await outboxRows(order3.id, 'purchase_confirmation'))[0]
      assert.equal(retried.status, 'sent')
      assert.equal(retried.attempts, 2)
      assert.ok(retried.sent_at)
      assert.equal(retried.next_attempt_at, null)

      const confirmations = goodSmtp.captured.filter((message) => bodyOf(message).includes(`Subject: Compra FORMA ${order3.id} confirmada`))
      assert.equal(confirmations.length, 1, 'nenhuma duplicata após falha e nova tentativa')
    })

    await t.test('configuração inválida é recusada sem queimar tentativas do outbox', async () => {
      setEmailEnv({ FORMA_EMAIL_MODE: 'smtp' })
      await assert.rejects(dispatchEmailOutbox(), /FORMA_SMTP_HOST/)
      setEmailEnv({ FORMA_EMAIL_MODE: 'smtpx' })
      await assert.rejects(dispatchEmailOutbox(), /FORMA_EMAIL_MODE/)
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM email_outbox WHERE status = \'sending\'')).rows[0].n, 0)
    })

    await t.test('reivindicação interrompida é recuperada no mock e falha real não é mascarada', async () => {
      const staleId = randomUUID()
      await pool.query(
        `INSERT INTO email_outbox (id, order_id, user_id, event_key, recipient_email, template, subject, payload, status, attempts, next_attempt_at)
         VALUES ($1, $2, $3, $4, $5, 'order_status', 'Atualização do pedido FORMA (lease vencido)', $6::jsonb, 'sending', 1, now() - interval '1 minute')`,
        [staleId, order1.id, account.user.id, `synthetic-mock-${staleId}`, account.user.email,
          JSON.stringify({ orderId: order1.id, status: 'cancelado', totalCentavos: 21000 })],
      )
      const failedId = randomUUID()
      await pool.query(
        `INSERT INTO email_outbox (id, order_id, user_id, event_key, recipient_email, template, subject, payload, status, attempts, next_attempt_at, last_error)
         VALUES ($1, $2, $3, $4, $5, 'order_status', 'Atualização do pedido FORMA (falha real)', $6::jsonb, 'failed', 1, now() + interval '1 hour', 'SMTP recusou MAIL FROM: 421')`,
        [failedId, order1.id, account.user.id, `synthetic-failed-${failedId}`, account.user.email,
          JSON.stringify({ orderId: order1.id, status: 'cancelado', totalCentavos: 21000 })],
      )

      setEmailEnv({ FORMA_EMAIL_MODE: 'mock' })
      assert.equal(await dispatchEmailOutbox(), 1, 'somente a reivindicação interrompida é recuperada no mock')
      const stale = (await pool.query('SELECT status, mock_message FROM email_outbox WHERE id = $1', [staleId])).rows[0]
      assert.equal(stale.status, 'mocked')
      assert.match(stale.mock_message.text, /nenhuma mensagem foi enviada para um endereço externo/)
      const failed = (await pool.query('SELECT status, attempts, last_error FROM email_outbox WHERE id = $1', [failedId])).rows[0]
      assert.equal(failed.status, 'failed', 'modo mock não converte falha de SMTP em prévia')
      assert.equal(failed.attempts, 1)
      assert.match(failed.last_error, /421/)
    })

    await t.test('tentativas esgotadas param automaticamente e o reenvio manual entrega', async () => {
      const rowId = randomUUID()
      await pool.query(
        `INSERT INTO email_outbox (id, order_id, user_id, event_key, recipient_email, template, subject, payload, status, attempts, next_attempt_at)
         VALUES ($1, $2, $3, $4, $5, 'order_status', 'Atualização do pedido FORMA (esgotado)', $6::jsonb, 'queued', 5, NULL)`,
        [rowId, order1.id, account.user.id, `synthetic-retry-${rowId}`, account.user.email,
          JSON.stringify({ orderId: order1.id, status: 'cancelado', totalCentavos: 21000 })],
      )

      setEmailEnv({
        FORMA_EMAIL_MODE: 'smtp', FORMA_SMTP_HOST: '127.0.0.1',
        FORMA_SMTP_PORT: String(badSmtp.server.address().port), FORMA_SMTP_SECURE: 'none',
      })
      assert.equal(await dispatchEmailOutbox(), 1)
      let row = (await pool.query('SELECT status, attempts, next_attempt_at, last_error FROM email_outbox WHERE id = $1', [rowId])).rows[0]
      assert.equal(row.status, 'failed')
      assert.equal(row.attempts, 6)
      assert.equal(row.next_attempt_at, null, 'esgotadas não agendam nova tentativa')
      assert.match(row.last_error, /421/)

      assert.equal(await dispatchEmailOutbox(), 0, 'não é reprojetada automaticamente')
      row = (await pool.query('SELECT status, attempts FROM email_outbox WHERE id = $1', [rowId])).rows[0]
      assert.equal(row.status, 'failed')
      assert.equal(row.attempts, 6)

      await pool.query("UPDATE email_outbox SET status = 'queued', next_attempt_at = NULL, last_error = NULL WHERE id = $1", [rowId])
      setEmailEnv({
        FORMA_EMAIL_MODE: 'smtp', FORMA_SMTP_HOST: '127.0.0.1',
        FORMA_SMTP_PORT: String(goodSmtp.server.address().port), FORMA_SMTP_SECURE: 'none',
      })
      assert.equal(await dispatchEmailOutbox(), 1)
      row = (await pool.query('SELECT status, attempts, sent_at FROM email_outbox WHERE id = $1', [rowId])).rows[0]
      assert.equal(row.status, 'sent')
      assert.equal(row.attempts, 7)
      assert.ok(row.sent_at)
    })

    await t.test('lease vencido em SMTP reenvia a linha presa: worker é at-least-once, não exactly-once', async () => {
      // Simula um worker que morreu APÓS o servidor SMTP aceitar a mensagem e
      // ANTES de gravar status='sent': a linha fica 'sending' com lease
      // vencido e o banco não tem como saber se o envio anterior ocorreu.
      const staleId = randomUUID()
      await pool.query(
        `INSERT INTO email_outbox (id, order_id, user_id, event_key, recipient_email, template, subject, payload, status, attempts, next_attempt_at)
         VALUES ($1, $2, $3, $4, $5, 'order_status', 'Atualização do pedido FORMA (envio repetido)', $6::jsonb, 'sending', 1, now() - interval '1 minute')`,
        [staleId, order1.id, account.user.id, `synthetic-stale-smtp-${staleId}`, account.user.email,
          JSON.stringify({ orderId: order1.id, status: 'cancelado', totalCentavos: 21000 })],
      )

      setEmailEnv({
        FORMA_EMAIL_MODE: 'smtp', FORMA_SMTP_HOST: '127.0.0.1',
        FORMA_SMTP_PORT: String(goodSmtp.server.address().port), FORMA_SMTP_SECURE: 'none',
      })
      const before = goodSmtp.captured.length
      assert.equal(await dispatchEmailOutbox(), 1, 'linha presa é reivindicada novamente')
      await goodSmtp.waitForMessages(before + 1)

      const resent = goodSmtp.captured.filter((message) => bodyOf(message).includes('Subject: Atualização do pedido FORMA (envio repetido)'))
      // Se o worker original tinha de fato entregado antes de morrer, ESTA é a
      // segunda cópia da mesma mensagem: duplicidade nesse cenário é possível e
      // documentada (at-least-once). A guarda por attempts impede apenas que
      // dois workers enviem simultaneamente a mesma reivindicação.
      assert.equal(resent.length, 1, 'mensagem é reenviada pelo worker de recuperação')
      const row = (await pool.query('SELECT status, attempts, sent_at FROM email_outbox WHERE id = $1', [staleId])).rows[0]
      assert.equal(row.status, 'sent')
      assert.equal(row.attempts, 2, 'cada reivindicação consume uma tentativa')
      assert.ok(row.sent_at)
    })
  } finally {
    for (const [name, value] of Object.entries(previousEmailEnv)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    await new Promise(resolve => server.close(resolve))
    await new Promise(resolve => goodSmtp.server.close(resolve))
    await new Promise(resolve => badSmtp.server.close(resolve))
    await pool.end()
  }
})
