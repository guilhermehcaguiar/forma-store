import test from 'node:test'
import assert from 'node:assert/strict'
import { getTestCheckoutUrl, usesLocalDemoPayment } from '../src/services/payments.js'

test('frete demo com Mercado Pago não oferece aprovação simulada', () => {
  assert.equal(usesLocalDemoPayment({ transactionMode: 'demo', paymentProvider: 'mercadopago' }), false)
  assert.equal(usesLocalDemoPayment({ transactionMode: 'demo', paymentProvider: 'forma_demo' }), true)
  assert.equal(usesLocalDemoPayment({ transactionMode: 'gateway', paymentProvider: 'mercadopago' }), false)
  assert.equal(usesLocalDemoPayment({ transactionMode: 'demo' }), true)
  assert.equal(usesLocalDemoPayment({ transactionMode: 'gateway' }), false)
})

test('retorno do gateway aceita só HTTPS nos hosts do Mercado Pago', () => {
  for (const host of ['sandbox.mercadopago.com.br', 'www.mercadopago.com.br']) {
    const checkoutUrl = `https://${host}/checkout/v1/redirect?pref_id=fixture`
    assert.equal(getTestCheckoutUrl({ checkoutUrl }), checkoutUrl)
  }
  for (const checkoutUrl of ['http://www.mercadopago.com.br/checkout', 'https://www.mercadopago.com.br.evil.example.test/checkout', 'https://user:pass@www.mercadopago.com.br/checkout', 'javascript:alert(1)']) assert.throws(() => getTestCheckoutUrl({ checkoutUrl }))
})
