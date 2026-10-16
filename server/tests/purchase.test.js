import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCartItems } from '../src/modules/cart/cart.schemas.js'
import { buildQuotePayload, mapProviderServices } from '../src/modules/shipping/shipping.provider.js'

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
