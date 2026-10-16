import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { validateGatewayPayment, verifyPaymentWebhookSignature } from '../src/modules/payments/payment.security.js'

function signedHeaders({ paymentId, requestId, secret, timestamp }) {
  const manifest = `id:${paymentId};request-id:${requestId};ts:${timestamp};`
  const digest = createHmac('sha256', secret).update(manifest).digest('hex')
  return `ts=${timestamp},v1=${digest}`
}

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
