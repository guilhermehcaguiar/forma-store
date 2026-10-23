import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { assertDemoTestSeller, selectTestCheckoutUrl, validateGatewayPayment, verifyPaymentWebhookSignature } from '../src/modules/payments/payment.security.js'

function signedHeaders({ paymentId, requestId, secret, timestamp }) {
  const manifest = `id:${paymentId};request-id:${requestId};ts:${timestamp};`
  const digest = createHmac('sha256', secret).update(manifest).digest('hex')
  return `ts=${timestamp},v1=${digest}`
}

test('Checkout Pro usa init_point somente para vendedor de teste verificado', () => {
  const pref = { init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=fixture', sandbox_init_point: 'https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=fixture' }
  assert.equal(selectTestCheckoutUrl(pref), pref.sandbox_init_point)
  assert.equal(selectTestCheckoutUrl(pref, true), pref.init_point)
  assert.throws(() => selectTestCheckoutUrl({ sandbox_init_point: pref.init_point }))
  for (const value of ['https://evil.example.test/checkout', 'javascript:alert(1)', 'https://user:pass@www.mercadopago.com.br/checkout']) {
    assert.throws(() => selectTestCheckoutUrl({ init_point: value }, true))
  }
})

test('demo aceita chave de teste e exige vendedor test_user para chave APP_USR', async () => {
  let lookedUp = 0
  await assertDemoTestSeller('TEST-fixture', () => { throw Error('não deve consultar') })
  await assertDemoTestSeller('APP_USR-fixture', async () => { lookedUp++; return { tags: ['test_user'] } })
  assert.equal(lookedUp, 1)
  for (const user of [{ tags: [] }, { tags: 'test_user' }, null]) {
    await assert.rejects(assertDemoTestSeller('APP_USR-fixture', async () => user), error => error.code === 'vendedor_nao_demonstrativo')
  }
  await assert.rejects(assertDemoTestSeller('APP_USR-fixture', async () => { throw Error('detalhe privado') }), error => error.code === 'conta_teste_nao_verificada' && !error.message.includes('privado'))
  await assert.rejects(assertDemoTestSeller('outra-chave', async () => ({})), error => error.code === 'credencial_teste_invalida')
})

test('Mercado Pago webhook signature validates signed id and request id, rejecting tampering', () => {
  const timestamp = 1_760_000_000
  const signature = signedHeaders({ paymentId: '987654', requestId: 'req-test-1', secret: 'test-secret', timestamp })
  assert.doesNotThrow(() => verifyPaymentWebhookSignature({
    signature,
    requestId: 'req-test-1',
    dataId: '987654',
    secret: 'test-secret',
    now: () => timestamp * 1000,
  }))
  assert.throws(() => verifyPaymentWebhookSignature({
    signature,
    requestId: 'req-test-2',
    dataId: '987654',
    secret: 'test-secret',
    now: () => timestamp * 1000,
  }), /Assinatura da notificação/i)
})

test('gateway payment must match order, amount, currency and sandbox mode', () => {
  const payment = {
    id: 987654,
    external_reference: 'order-test-1',
    transaction_amount: 129.9,
    currency_id: 'BRL',
    live_mode: false,
    status: 'approved',
    status_detail: 'accredited',
  }
  const expected = { paymentId: '987654', orderId: 'order-test-1', preferenceId: 'preference-test-1', amountCentavos: 12990 }
  assert.deepEqual(validateGatewayPayment(payment, expected), {
    paymentId: '987654',
    status: 'aprovada',
    providerStatus: 'approved',
    statusDetail: 'accredited',
    amountCentavos: 12990,
  })
  assert.throws(() => validateGatewayPayment({ ...payment, transaction_amount: 120 }, expected), /não corresponde/)
  assert.throws(() => validateGatewayPayment({ ...payment, live_mode: true }, expected), /não corresponde/)
  assert.throws(() => validateGatewayPayment({ ...payment, external_reference: 'other-order' }, expected), /não corresponde/)
  assert.throws(() => validateGatewayPayment({ ...payment, preference_id: 'other-preference' }, expected), /não corresponde/)
})
