import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAdminProduct } from '../src/modules/admin/products.schemas.js'

const valid = { name: 'Oversized', description: 'Algodão', color: ' Azul ', is_printed: 'false', is_active: 'true', price_cents: '10000', promo_price_cents: '', weight_g: '250', length_cm: '30', width_cm: '25', height_cm: '3', sizes: JSON.stringify([{ size: 'M', stock: 5 }]) }
test('produto administrativo normaliza texto, booleanos, preço e grade', () => {
  assert.throws(() => parseAdminProduct(null), error => error.code === 'validacao')
  const data = parseAdminProduct(valid)
  assert.equal(data.color, 'azul'); assert.equal(data.price_cents, 10000)
  assert.equal(data.is_printed, false); assert.equal(data.is_active, true)
  assert.equal(data.promo_price_cents, null)
})
test('recusa preços inválidos, inteiros fora do PostgreSQL, grade repetida e campos ausentes', () => {
  for (const changed of [{ name: '' }, { color: '' }, { price_cents: 0 }, { price_cents: 2147483648 }, { price_cents: [100] }, { promo_price_cents: 10000 }, { promo_price_cents: -1 }, { promo_price_cents: 0 }, { is_printed: 'sim' }, { is_active: 'sim' }, { sizes: [] }, { sizes: '{' }, { sizes: [{ size: 'M', stock: -1 }] }, { sizes: [{ size: 'M', stock: 1.5 }] }, { sizes: [{ size: 'XG', stock: 1 }] }, { sizes: [{ size: 'M', stock: 1 }, { size: 'M', stock: 2 }] }]) {
    assert.throws(() => parseAdminProduct({ ...valid, ...changed }), error => error.code === 'validacao', JSON.stringify(changed))
  }
})
test('edição exige versão, imagens pertencentes ao contrato e no máximo cinco arquivos', () => {
  assert.throws(() => parseAdminProduct(valid, { updating: true }), /Verifique/)
  assert.throws(() => parseAdminProduct({ ...valid, retained_images: ['https://example.test/foto'] }), /Verifique/)
  assert.throws(() => parseAdminProduct({ ...valid, main_image: 'new:4' }, { fileCount: 1 }), /Verifique/)
  assert.throws(() => parseAdminProduct(valid, { fileCount: 6 }), /Verifique/)
})
