import test from 'node:test'
import assert from 'node:assert/strict'
import { productImageUrl, getCatalog } from '../src/services/products.js'
import { addCartItem, readCart } from '../src/services/cart.js'

test('imagens locais distinguem assets públicos de uploads da API', () => {
  assert.equal(productImageUrl('/products/demo-2.svg'), '/products/demo-2.svg')
  assert.equal(productImageUrl('uploads/arquivo.png'), 'http://localhost:3333/uploads/arquivo.png')
  assert.equal(productImageUrl('https://externo.example/foto.png'), '')
  assert.equal(productImageUrl('/products/../../segredo'), '')
})

test('filtro booleano false mantém a consulta de peças lisas', async () => {
  const previous = globalThis.fetch
  try {
    globalThis.fetch = async url => {
      assert.equal(new URL(url).searchParams.get('is_printed'), 'false')
      assert.equal(new URL(url).searchParams.has('promo'), false)
      return Response.json({ products: [], filters: { colors: ['preta'] } })
    }
    assert.deepEqual(await getCatalog({ is_printed: false, promo: false }), { products: [], colors: ['preta'] })
  } finally { globalThis.fetch = previous }
})

test('adicionar ao carrinho bloqueia tamanho inexistente, zerado e quantidade acima do estoque', () => {
  const previous = globalThis.window
  const values = new Map()
  globalThis.window = { localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }, dispatchEvent() {} }
  try {
    const product = { id: 'product-test', sizes: [{ size: 'P', stock: 0 }, { size: 'M', stock: 1 }] }
    assert.throws(() => addCartItem(product, 'P'), /esgotado/)
    assert.throws(() => addCartItem(product, 'GG'), /esgotado/)
    addCartItem(product, 'M')
    assert.equal(readCart().items[0].quantity, 1)
    assert.throws(() => addCartItem(product, 'M'), /quantidade disponível/)
    assert.equal(readCart().items[0].quantity, 1)
  } finally { globalThis.window = previous }
})
