// Testes unitários do e-mail de confirmação de compra (RF18): configuração
// por variáveis de ambiente, render por template, mensagem MIME e backoff.
// Não usam banco, rede nem SMTP; a entrega real é exercida pelo teste de
// integração opt-in (email-confirmation.integration.test.js).

import test from 'node:test'
import assert from 'node:assert/strict'

const previousDatabaseUrl = process.env.DATABASE_URL
process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/forma-test'
const {
  resolveEmailConfig, describeEmailMode, computeRetryDelayMinutes,
  enqueueOrderEmail, renderEmailContent, renderMockEmail,
} = await import('../src/modules/notifications/email.service.js')
const { composeMimeMessage } = await import('../src/modules/notifications/smtp.client.js')
if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL

const EMAIL_ENV_VARS = [
  'FORMA_EMAIL_MODE', 'FORMA_EMAIL_FROM', 'FORMA_EMAIL_MAX_ATTEMPTS',
  'FORMA_SMTP_HOST', 'FORMA_SMTP_PORT', 'FORMA_SMTP_SECURE',
  'FORMA_SMTP_USER', 'FORMA_SMTP_PASS',
]

function captureEnv(names) {
  const snapshot = {}
  for (const name of names) snapshot[name] = process.env[name]
  return snapshot
}

function restoreEnv(snapshot) {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
}

function setEmailEnv(values) {
  for (const name of EMAIL_ENV_VARS) delete process.env[name]
  Object.assign(process.env, values)
}

const purchaseFixtureRow = {
  id: 'order-1',
  userId: 'user-1',
  status: 'pago',
  createdAt: new Date('2026-10-16T12:00:00Z'),
  subtotalCentavos: 20000,
  discountCentavos: 3000,
  shippingCentavos: 1000,
  totalCentavos: 18000,
  couponCode: 'CUPOM15',
  shippingService: 'PAC',
  shippingCompany: 'Correios',
  deliveryDays: 5,
  paymentDeadlineAt: new Date('2026-10-16T12:30:00Z'),
  addressSnapshot: {
    label: 'Casa',
    recipient: 'Cliente Teste',
    street: 'Rua Fictícia',
    number: '123',
    complement: 'Apto 4',
    district: 'Centro',
    city: 'Recife',
    state: 'PE',
    cep: '50000000',
  },
  email: 'cliente@example.test',
}

function fakeClient() {
  const statements = []
  return {
    statements,
    async query(sql, values) {
      statements.push({ sql, values })
      if (sql.includes('SELECT o.id')) return { rows: [purchaseFixtureRow] }
      if (sql.includes('FROM order_items')) {
        return { rows: [{ name: 'Camisa Teste', color: 'azul', size: 'M', quantity: 2, unitPriceCentavos: 10000, lineTotalCentavos: 20000 }] }
      }
      return { rows: [{ id: 'email-1' }] }
    },
  }
}

test('sem FORMA_EMAIL_MODE o padrão é mock, com aviso explícito de não entrega', () => {
  const snapshot = captureEnv(EMAIL_ENV_VARS)
  try {
    setEmailEnv({})
    const config = resolveEmailConfig()
    assert.equal(config.mode, 'mock')
    assert.equal(config.from, 'no-reply@forma.local')
    assert.equal(config.maxAttempts, 5)
    assert.match(describeEmailMode(), /mock/)
    assert.match(describeEmailMode(), /NENHUM e-mail é entregue/)
  } finally {
    restoreEnv(snapshot)
  }
})

test('modo de e-mail inválido é recusado com mensagem clara', () => {
  const snapshot = captureEnv(EMAIL_ENV_VARS)
  try {
    setEmailEnv({ FORMA_EMAIL_MODE: 'sendgrid' })
    assert.throws(() => resolveEmailConfig(), /FORMA_EMAIL_MODE deve ser "mock" ou "smtp"/)
    setEmailEnv({ FORMA_EMAIL_MODE: 'smtpx' })
    assert.throws(() => describeEmailMode(), /FORMA_EMAIL_MODE deve ser/)
  } finally {
    restoreEnv(snapshot)
  }
})

test('modo smtp exige host e valida porta, TLS, credenciais e tentativas', () => {
  const snapshot = captureEnv(EMAIL_ENV_VARS)
  try {
    setEmailEnv({ FORMA_EMAIL_MODE: 'smtp' })
    assert.throws(() => resolveEmailConfig(), /FORMA_SMTP_HOST/)

    setEmailEnv({ FORMA_EMAIL_MODE: 'smtp', FORMA_SMTP_HOST: '127.0.0.1' })
    const config = resolveEmailConfig()
    assert.equal(config.mode, 'smtp')
    assert.equal(config.smtp.host, '127.0.0.1')
    assert.equal(config.smtp.port, 1025)
    assert.equal(config.smtp.secure, 'none')

    setEmailEnv({ FORMA_EMAIL_MODE: 'smtp', FORMA_SMTP_HOST: '127.0.0.1', FORMA_SMTP_PORT: 'número' })
    assert.throws(() => resolveEmailConfig(), /FORMA_SMTP_PORT/)

    setEmailEnv({ FORMA_EMAIL_MODE: 'smtp', FORMA_SMTP_HOST: 'smtp.example.test', FORMA_SMTP_SECURE: 'tls' })
    assert.throws(() => resolveEmailConfig(), /FORMA_SMTP_SECURE/)

    setEmailEnv({ FORMA_EMAIL_MODE: 'smtp', FORMA_SMTP_HOST: 'smtp.example.test', FORMA_SMTP_USER: 'usuario' })
    assert.throws(() => resolveEmailConfig(), /juntos/)

    // Plaintext para host externo é recusado MESMO sem credenciais: a mensagem
    // do pedido (endereço, itens, valores) viaja no corpo.
    setEmailEnv({ FORMA_EMAIL_MODE: 'smtp', FORMA_SMTP_HOST: 'smtp.example.test' })
    assert.throws(() => resolveEmailConfig(), /só é aceito para 127\.0\.0\.1\/localhost/)
    setEmailEnv({ FORMA_EMAIL_MODE: 'smtp', FORMA_SMTP_HOST: 'smtp.example.test', FORMA_SMTP_PORT: '25' })
    assert.throws(() => resolveEmailConfig(), /starttls ou ssl/)

    setEmailEnv({
      FORMA_EMAIL_MODE: 'smtp', FORMA_SMTP_HOST: 'smtp.example.test',
      FORMA_SMTP_USER: 'usuario', FORMA_SMTP_PASS: 'segredo', FORMA_SMTP_SECURE: 'none',
    })
    assert.throws(() => resolveEmailConfig(), /starttls ou ssl/)

    setEmailEnv({
      FORMA_EMAIL_MODE: 'smtp', FORMA_SMTP_HOST: '127.0.0.1',
      FORMA_SMTP_USER: 'usuario', FORMA_SMTP_PASS: 'segredo',
    })
    assert.equal(resolveEmailConfig().smtp.user, 'usuario')

    setEmailEnv({ FORMA_EMAIL_MODE: 'smtp', FORMA_SMTP_HOST: '127.0.0.1', FORMA_EMAIL_MAX_ATTEMPTS: 'abc' })
    assert.throws(() => resolveEmailConfig(), /FORMA_EMAIL_MAX_ATTEMPTS/)

    // O aviso de inicialização nunca imprime credenciais.
    setEmailEnv({
      FORMA_EMAIL_MODE: 'smtp', FORMA_SMTP_HOST: '127.0.0.1',
      FORMA_SMTP_USER: 'usuario', FORMA_SMTP_PASS: 'segredo',
    })
    const notice = describeEmailMode()
    assert.ok(!notice.includes('segredo'))
    assert.ok(!notice.includes('usuario'))
  } finally {
    restoreEnv(snapshot)
  }
})

test('backoff de nova tentativa é exponencial com teto de 60 minutos', () => {
  assert.equal(computeRetryDelayMinutes(1), 2)
  assert.equal(computeRetryDelayMinutes(2), 4)
  assert.equal(computeRetryDelayMinutes(3), 8)
  assert.equal(computeRetryDelayMinutes(10), 60)
})

test('enqueue recusa template não transacional e não consulta o banco', async () => {
  const client = {
    async query() {
      throw new Error('template inválido não deveria consultar o banco')
    },
  }
  await assert.rejects(enqueueOrderEmail(client, 'order-1', 'promotional'), /promocionais não usam este fluxo/)
})

test('confirmação de compra persiste event_key/assunto/payload com itens e endereço', async () => {
  const client = fakeClient()
  assert.equal(await enqueueOrderEmail(client, 'order-1', 'purchase_confirmation'), true)
  const insert = client.statements.find((statement) => statement.sql.includes('INSERT INTO email_outbox'))
  assert.ok(insert, 'INSERT do outbox executado')
  assert.equal(insert.values[3], 'order:order-1:purchase_confirmation')
  assert.equal(insert.values[5], 'purchase_confirmation')
  assert.equal(insert.values[6], 'Compra FORMA order-1 confirmada')
  const payload = JSON.parse(insert.values[7])
  assert.equal(payload.status, 'pago')
  assert.equal(payload.subtotalCentavos, 20000)
  assert.equal(payload.discountCentavos, 3000)
  assert.equal(payload.shippingCentavos, 1000)
  assert.equal(payload.totalCentavos, 18000)
  assert.equal(payload.couponCode, 'CUPOM15')
  assert.equal(payload.address.cep, '50000000')
  assert.deepEqual(payload.items, [{
    name: 'Camisa Teste', color: 'azul', size: 'M',
    quantity: 2, unitPriceCentavos: 10000, lineTotalCentavos: 20000,
  }])
  const serialized = JSON.stringify(payload)
  assert.ok(!serialized.includes('paymentId'))
  assert.ok(!serialized.includes('providerStatus'))
  assert.ok(!serialized.includes('mercadopago'))
})

test('conteúdo da confirmação traz pedido, itens, valores e endereço; prévia mock avisa não entrega', () => {
  const row = {
    recipient_email: 'cliente@example.test',
    template: 'purchase_confirmation',
    subject: 'Compra FORMA order-1 confirmada',
    payload: {
      orderId: 'order-1',
      status: 'pago',
      createdAt: '2026-10-16T12:00:00.000Z',
      subtotalCentavos: 20000,
      discountCentavos: 3000,
      shippingCentavos: 1000,
      totalCentavos: 18000,
      couponCode: 'CUPOM15',
      shippingService: 'PAC',
      shippingCompany: 'Correios',
      deliveryDays: 5,
      items: [{ name: 'Camisa Teste', color: 'azul', size: 'M', quantity: 2, unitPriceCentavos: 10000, lineTotalCentavos: 20000 }],
      address: purchaseFixtureRow.addressSnapshot,
    },
  }
  const content = renderEmailContent(row)
  assert.equal(content.to, 'cliente@example.test')
  assert.equal(content.subject, 'Compra FORMA order-1 confirmada')
  assert.match(content.text, /Sua compra na FORMA foi confirmada/)
  assert.match(content.text, /Pedido: order-1/)
  assert.match(content.text, /Camisa Teste — cor: azul, tamanho: M, quantidade: 2/)
  assert.match(content.text, /R\$\s?100,00 por unidade/)
  assert.match(content.text, /Subtotal: R\$\s?200,00/)
  assert.match(content.text, /Desconto: R\$\s?30,00 \(cupom CUPOM15\)/)
  assert.match(content.text, /Frete: PAC — Correios — 5 dias úteis — R\$\s?10,00/)
  assert.match(content.text, /Total: R\$\s?180,00/)
  assert.match(content.text, /Endereço de entrega/)
  assert.match(content.text, /Cliente Teste/)
  assert.match(content.text, /Rua Fictícia, 123 — Apto 4/)
  assert.match(content.text, /CEP 50000-000/)
  assert.ok(!content.text.includes('nenhuma mensagem foi enviada'))
  for (const forbidden of ['cvv', 'CVV', 'paymentId', 'providerStatus', 'mercadopago']) {
    assert.ok(!content.text.includes(forbidden))
  }

  const preview = renderMockEmail(row)
  assert.match(preview.text, /nenhuma mensagem foi enviada para um endereço externo/)
  assert.match(preview.text, /Pedido: order-1/)
})

test('avisos de status legados continuam renderizando em texto puro', () => {
  const content = renderEmailContent({
    recipient_email: 'buyer@example.test',
    subject: 'Atualização do pedido FORMA order-9',
    payload: { orderId: 'order-9', status: 'cancelado', totalCentavos: 12500 },
  })
  assert.match(content.text, /Status: cancelado/)
  assert.match(content.text, /R\$\s?125,00/)
})

test('mensagem MIME é texto puro UTF-8 com dot-stuffing e sem injeção de cabeçalho', () => {
  const { data } = composeMimeMessage({
    from: 'no-reply@forma.local',
    to: 'cliente@example.test',
    subject: 'Compra confirmada\r\nBcc: vitima@example.test',
    text: 'Linha normal\n.começa com ponto\núltima linha',
  })
  assert.ok(data.startsWith('From: no-reply@forma.local\r\nTo: cliente@example.test\r\n'))
  assert.match(data, /Content-Type: text\/plain; charset=UTF-8\r?\n/)
  assert.match(data, /Content-Transfer-Encoding: 8bit/)
  assert.match(data, /Message-ID: <.+@forma\.local>/)
  assert.match(data, /Date: /)
  assert.ok(!/\r?\nBcc: /i.test(data), 'quebra de linha injetada no assunto foi neutralizada')
  assert.ok(data.includes('Subject: Compra confirmada Bcc: vitima@example.test'))
  assert.match(data, /\r\n\.\.começa com ponto/, 'linha iniciada por ponto recebe dot-stuffing')
  assert.ok(data.endsWith('\r\n'))

  assert.throws(() => composeMimeMessage({
    from: 'remetente\r\nBcc: vitima@example.test', to: 'cliente@example.test', subject: 's', text: 't',
  }), /Endereço de e-mail inválido/)

  // SMTPUTF8 não é implementado: endereço não-ASCII é recusado no envelope.
  assert.throws(() => composeMimeMessage({
    from: 'usuário@exemplo.com', to: 'cliente@example.test', subject: 'assunto', text: 'corpo',
  }), /apenas ASCII é suportado/)
})
