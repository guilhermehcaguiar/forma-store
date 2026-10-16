import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCartItems } from '../src/modules/cart/cart.schemas.js'
import { parseCheckout } from '../src/modules/shipping/shipping.schemas.js'
import { buildQuotePayload, mapProviderServices } from '../src/modules/shipping/shipping.provider.js'
import { createSandboxPreference } from '../src/modules/payments/mercadopago.gateway.js'

const previousDatabaseUrl = process.env.DATABASE_URL
process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/forma-test'
const { lockCartStock, readCart, validateCoupon } = await import('../src/modules/cart/cart.service.js')
const { enqueueOrderEmail, renderMockEmail, dispatchEmailOutbox } = await import('../src/modules/notifications/email.service.js')
if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL

const productId = '9b28921a-4e4c-4ad5-b9a2-3c9cb070cd52'
const line = {
  productId,
  name: 'Camisa Forma',
  priceCentavos: 12990,
  weightG: 450,
  lengthCm: 30,
  widthCm: 20,
  heightCm: 5,
  quantity: 2,
}

test('carrinho valida UUID, tamanho e quantidade antes de calcular', () => {
  assert.deepEqual(parseCartItems({ items: [{ productId, size: 'G', quantity: 2 }] }), [
    { productId, size: 'G', quantity: 2 },
  ])
  assert.throws(() => parseCartItems({ items: [{ productId: '1', quantity: 0 }] }), /Verifique os campos/)
})

test('checkout exige chave UUID de idempotência para evitar pedidos duplicados', () => {
  const payload = {
    addressId: '50ad387d-f28c-455f-89de-6b9509c3d7c4',
    quoteId: 'f6db919a-70f2-4e50-b29a-9cf60a4cb823',
    checkoutKey: '1bd6022d-66ab-4ca6-bf2d-dda4f462c834',
    serviceId: '1',
    couponCode: 'forma10',
    items: [{ productId, size: 'G', quantity: 1 }],
  }
  assert.equal(parseCheckout(payload).checkoutKey, payload.checkoutKey)
  assert.throws(() => parseCheckout({ ...payload, checkoutKey: '' }), /Verifique os campos/)
})

test('revalidação server-side usa o preço atual e reserva somente estoque suficiente', async () => {
  const db = {
    async query(sql, values) {
      if (sql.includes('FROM products p')) {
        return { rows: [{
          id: productId,
          name: 'Camisa Forma',
          description: 'Oversized',
          color: 'azul',
          isPrinted: false,
          priceCentavos: 12990,
          promoPriceCentavos: 9990,
          weightG: 450,
          lengthCm: 30,
          widthCm: 20,
          heightCm: 5,
          sizes: [{ size: 'G', stock: 4 }],
          images: [],
        }] }
      }
      if (sql.includes('FOR UPDATE OF ps')) {
        assert.equal(values[0], productId)
        return { rows: [{ id: 'size-g', stock: 4 }] }
      }
      if (sql.includes('FROM coupons')) return { rows: [{ id: 'coupon-1', code: 'FORMA10', discount_percentage: 10 }] }
      throw new Error(`Query inesperada: ${sql}`)
    },
  }
  const items = [{ productId, size: 'G', quantity: 2 }]
  const cart = await readCart(items, db, { validateStock: true })
  assert.equal(cart.items[0].priceCentavos, 9990)
  assert.equal(cart.subtotalCentavos, 19980)
  assert.deepEqual(await lockCartStock(items, db), [{ productSizeId: 'size-g', quantity: 2 }])
  assert.equal((await validateCoupon('forma10', cart, db)).discountCentavos, 1998)
})

test('gateway de pagamento bloqueia produção e exige URL HTTPS do túnel', async () => {
  const previous = {
    mode: process.env.MERCADOPAGO_MODE,
    token: process.env.MERCADOPAGO_TEST_ACCESS_TOKEN,
    url: process.env.MERCADOPAGO_PUBLIC_URL,
  }
  try {
    process.env.MERCADOPAGO_MODE = 'production'
    process.env.MERCADOPAGO_TEST_ACCESS_TOKEN = 'token-test-only'
    await assert.rejects(createSandboxPreference({ id: 'order-1' }, 'buyer@example.test'), /sandbox/)

    process.env.MERCADOPAGO_MODE = 'sandbox'
    delete process.env.MERCADOPAGO_PUBLIC_URL
    await assert.rejects(createSandboxPreference({ id: 'order-1' }, 'buyer@example.test'), /HTTPS temporária/)
  } finally {
    if (previous.mode === undefined) delete process.env.MERCADOPAGO_MODE
    else process.env.MERCADOPAGO_MODE = previous.mode
    if (previous.token === undefined) delete process.env.MERCADOPAGO_TEST_ACCESS_TOKEN
    else process.env.MERCADOPAGO_TEST_ACCESS_TOKEN = previous.token
    if (previous.url === undefined) delete process.env.MERCADOPAGO_PUBLIC_URL
    else process.env.MERCADOPAGO_PUBLIC_URL = previous.url
  }
})

test('mock transacional registra conteúdo de confirmação sem afirmar envio real', () => {
  const message = renderMockEmail({
    recipient_email: 'cliente@example.test',
    subject: 'Pedido FORMA recebido',
    payload: { orderId: 'order-1', status: 'aguardando_pagamento', totalCentavos: 12500 },
  })
  assert.equal(message.to, 'cliente@example.test')
  assert.match(message.text, /Pedido: order-1/)
  assert.match(message.text, /R\$\s?125,00/)
  assert.match(message.text, /nenhuma mensagem foi enviada/)
})

test('outbox usa event_key único e bloqueia transporte não-mock', async () => {
  const statements = []
  const client = {
    async query(sql, values) {
      statements.push({ sql, values })
      if (sql.includes('SELECT o.id')) {
        return { rows: [{ id: 'order-1', status: 'pago', totalCentavos: 12500, email: 'buyer@example.test' }] }
      }
      return { rows: [] }
    },
  }
  assert.equal(await enqueueOrderEmail(client, 'order-1', 'order_status', 'pago'), false)
  assert.ok(statements[1].sql.includes('ON CONFLICT (event_key) DO NOTHING'))
  assert.equal(statements[1].values[2], 'order:order-1:status:pago')

  const previousMode = process.env.FORMA_EMAIL_MODE
  try {
    process.env.FORMA_EMAIL_MODE = 'smtp'
    await assert.rejects(dispatchEmailOutbox(), /mock está disponível/)
  } finally {
    if (previousMode === undefined) delete process.env.FORMA_EMAIL_MODE
    else process.env.FORMA_EMAIL_MODE = previousMode
  }
})

test('payload Melhor Envio converte CEP, gramas e centavos sem perder a quantidade', () => {
  const payload = buildQuotePayload('01001-000', '20040-020', [line])
  assert.deepEqual(payload, {
    from: { postal_code: '01001000' },
    to: { postal_code: '20040020' },
    products: [{
      id: productId,
      width: 20,
      height: 5,
      length: 30,
      weight: 0.45,
      insurance_value: 129.9,
      quantity: 2,
    }],
    options: { receipt: false, own_hand: false },
  })
})

test('cotação não inventa opções e prefere valores customizados oficiais', () => {
  assert.deepEqual(mapProviderServices([]), [])
  assert.deepEqual(mapProviderServices([
    { id: 1, name: 'PAC', price: '20.00', custom_price: '18.50', delivery_time: 7, custom_delivery_time: 5, company: { name: 'Correios' } },
    { id: 2, name: 'Indisponível', error: 'fora da área', price: '0.00' },
    { name: 'Sem identificador', price: '1.00' },
  ]), [{ id: '1', name: 'PAC', company: 'Correios', priceCentavos: 1850, deliveryDays: 5 }])
})

test('CEP de destino e dimensões incompletas impedem consulta externa', () => {
  assert.throws(() => buildQuotePayload('01001000', '123', [line]), /8 dígitos/)
  assert.throws(() => buildQuotePayload('01001000', '20040020', [{ ...line, weightG: 0 }]), /peso e dimensões válidos/)
})
