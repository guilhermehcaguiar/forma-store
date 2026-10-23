import { assertLocalDatabaseUrl } from '../src/db/local-database.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { access, readFile } from 'node:fs/promises'
import { demoProducts } from '../src/db/demo-products.js'
import { seedDemoProducts } from '../src/db/seed-demo.js'

test('dados demonstrativos têm variantes, estoque, promoções e imagens locais coerentes', async () => {
  assert.equal(demoProducts.length, 30)
  assert.equal(new Set(demoProducts.map(p => p.id)).size, 30)
  assert.equal(new Set(demoProducts.map(p => p.color)).size, 15)
  assert.equal(demoProducts.filter(p => p.promoPriceCentavos != null).length, 12)
  assert.equal(demoProducts.filter(p => p.sizes.every(v => v.stock === 0)).length, 1)
  assert.equal(demoProducts.filter(p => p.isPrinted).length, 15)
  assert.equal(new Set(demoProducts.map(p => p.imageUrl)).size, 30)
  const hashes = new Set()
  for (const product of demoProducts) {
    assert.deepEqual(product.sizes.map(v => v.size), ['P', 'M', 'G', 'GG'])
    assert.ok(product.sizes.every(v => Number.isInteger(v.stock) && v.stock >= 0))
    assert.ok(Number.isInteger(product.priceCentavos) && product.priceCentavos > 0)
    assert.ok(product.promoPriceCentavos == null || product.promoPriceCentavos < product.priceCentavos)
    assert.match(product.imageUrl, /^\/products\//)
    const image = new URL(`../../public${product.imageUrl}`, import.meta.url)
    await access(image)
    const bytes = await readFile(image)
    if (product.imageUrl.endsWith('.webp')) {
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF')
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP')
    }
    hashes.add(createHash('sha256').update(bytes).digest('hex'))
  }
  assert.equal(hashes.size, 30, 'Nenhum arquivo de produto duplicado')
})

const databaseUrl = process.env.FORMA_TEST_DATABASE_URL
test('catálogo HTTP + PostgreSQL descartável', { skip: !databaseUrl }, async t => {
  assertLocalDatabaseUrl(databaseUrl, { testOnly: true })
  process.env.DATABASE_URL = databaseUrl
  const { pool } = await import('../src/db/pool.js')
  const { createApp } = await import('../src/app.js')
  const { readCart } = await import('../src/modules/cart/cart.service.js')
  const { createOrder } = await import('../src/modules/checkout/checkout.service.js')
  const { addressFingerprint, cartFingerprint } = await import('../src/modules/shipping/shipping.provider.js')
  const server = createApp().listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/api`
  const ids = demoProducts.map(p => p.id)
  const catalog = async filters => {
    const response = await fetch(`${base}/produtos?${new URLSearchParams(filters)}`)
    assert.equal(response.status, 200)
    return response.json()
  }
  try {
    await t.test('ampliação dos 12 anteriores insere só 18 e preserva edições, tamanhos, estoque e imagens', async () => {
      const legacy = demoProducts.slice(0, 12)
      assert.equal((await seedDemoProducts(pool, legacy)).inserted, 12)
      const id = ids[0]
      await pool.query(`UPDATE products SET name='Peça editada', description='Descrição própria', color='vinho',
        is_printed=true, price_cents=12345, promo_price_cents=10000, is_active=false, admin_version=2 WHERE id=$1`, [id])
      await pool.query("UPDATE product_sizes SET stock=2, is_active=false WHERE product_id=$1 AND size='P'", [id])
      await pool.query("UPDATE product_images SET image_url='/uploads/preservada.webp' WHERE product_id=$1", [id])
      const snapshot = async () => ({
        product: (await pool.query('SELECT * FROM products WHERE id=$1', [id])).rows,
        sizes: (await pool.query('SELECT * FROM product_sizes WHERE product_id=$1 ORDER BY size', [id])).rows,
        images: (await pool.query('SELECT * FROM product_images WHERE product_id=$1 ORDER BY id', [id])).rows,
      })
      const before = await snapshot()
      assert.deepEqual(await seedDemoProducts(pool), { inserted: 18, skipped: 12 })
      assert.deepEqual(await snapshot(), before)
      assert.deepEqual(await seedDemoProducts(pool), { inserted: 0, skipped: 30 })
      assert.deepEqual(await snapshot(), before)
      // Restaurar só a fixture modificada, usando os valores anteriores conhecidos.
      const original = legacy[0]
      await pool.query(`UPDATE products SET name=$2, description=$3, color=$4, is_printed=$5,
        price_cents=$6, promo_price_cents=$7, is_active=true, admin_version=1 WHERE id=$1`,
      [id, original.name, original.description, original.color, original.isPrinted, original.priceCentavos, original.promoPriceCentavos])
      await pool.query("UPDATE product_sizes SET stock=4,is_active=true WHERE product_id=$1 AND size='P'", [id])
      await pool.query('UPDATE product_images SET image_url=$2 WHERE product_id=$1', [id, original.imageUrl])
    })
    await t.test('seed repetido e concorrente não duplica nem repõe estoque/preço/data', async () => {
      await seedDemoProducts(pool)
      const count = async () => (await pool.query(`SELECT
        (SELECT count(*)::int FROM products WHERE id = ANY($1::uuid[])) AS products,
        (SELECT count(*)::int FROM product_sizes WHERE product_id = ANY($1::uuid[])) AS sizes,
        (SELECT count(*)::int FROM product_images WHERE product_id = ANY($1::uuid[])) AS images`, [ids])).rows[0]
      assert.deepEqual(await count(), { products: 30, sizes: 120, images: 30 })
      await pool.query("UPDATE product_sizes SET stock = 7 WHERE product_id = $1 AND size = 'M'", [ids[0]])
      await pool.query('UPDATE products SET price_cents = 11800 WHERE id = $1', [ids[0]])
      await pool.query("UPDATE products SET created_at = '2020-01-01T12:00:00Z', is_active = false WHERE id = $1", [ids[0]])
      try {
        const results = await Promise.all([seedDemoProducts(pool), seedDemoProducts(pool)])
        assert.ok(results.every(r => r.inserted === 0 && r.skipped === 30))
        assert.deepEqual(await count(), { products: 30, sizes: 120, images: 30 })
        assert.equal((await pool.query("SELECT stock FROM product_sizes WHERE product_id = $1 AND size = 'M'", [ids[0]])).rows[0].stock, 7)
        assert.equal((await pool.query('SELECT price_cents FROM products WHERE id = $1', [ids[0]])).rows[0].price_cents, 11800)
        const saved = (await pool.query('SELECT created_at, is_active FROM products WHERE id = $1', [ids[0]])).rows[0]
        assert.equal(saved.created_at.toISOString(), '2020-01-01T12:00:00.000Z')
        assert.equal(saved.is_active, false)
      } finally {
        await pool.query("UPDATE product_sizes SET stock = 8 WHERE product_id = $1 AND size = 'M'", [ids[0]])
        await pool.query('UPDATE products SET price_cents = 11990 WHERE id = $1', [ids[0]])
        await pool.query('UPDATE products SET created_at = $2, is_active = true WHERE id = $1', [ids[0], demoProducts[0].createdAt])
      }
    })
    await t.test('imagens novas substituem só placeholders conhecidos e preservam edições administrativas', async () => {
      const product = demoProducts[1]
      try {
        await pool.query("UPDATE product_images SET image_url='/products/demo-2.svg' WHERE product_id=$1", [product.id])
        await seedDemoProducts(pool)
        const image = async () => (await pool.query('SELECT image_url FROM product_images WHERE product_id=$1', [product.id])).rows[0].image_url
        assert.equal(await image(), '/products/demo-2.webp')
        await pool.query("UPDATE product_images SET image_url='/uploads/admin-custom.webp' WHERE product_id=$1", [product.id])
        await pool.query("UPDATE products SET description='Descrição do administrador' WHERE id=$1", [product.id])
        await seedDemoProducts(pool)
        assert.equal(await image(), '/uploads/admin-custom.webp')
        assert.equal((await pool.query('SELECT description FROM products WHERE id=$1', [product.id])).rows[0].description, 'Descrição do administrador')
        await pool.query("UPDATE product_images SET image_url='/products/demo-2.svg' WHERE product_id=$1", [product.id])
        await pool.query("UPDATE products SET color='vinho' WHERE id=$1", [product.id])
        await seedDemoProducts(pool)
        assert.equal(await image(), '/products/demo-2.svg', 'nova foto preta não representa produto recolorido pelo administrador')
        await pool.query('UPDATE products SET color=$2,admin_version=2 WHERE id=$1', [product.id, product.color])
        await seedDemoProducts(pool)
        assert.equal(await image(), '/products/demo-2.svg', 'edição administrativa preserva até imagem legada conhecida')
      } finally {
        await pool.query('UPDATE products SET color=$2, description=$3, admin_version=1 WHERE id=$1', [product.id, product.color, product.description])
        await pool.query('UPDATE product_images SET image_url=$2 WHERE product_id=$1', [product.id, product.imageUrl])
      }
    })
    await t.test('cores vêm de todos os produtos ativos, independentemente dos filtros', async () => {
      const customId = randomUUID()
      await pool.query(`INSERT INTO products (id, name, color, price_cents, weight_g, length_cm, width_cm, height_cm)
        VALUES ($1, 'Produto de teste extra', 'vinho', 9900, 250, 30, 25, 3)`, [customId])
      try {
        await seedDemoProducts(pool)
        assert.equal((await pool.query('SELECT color FROM products WHERE id = $1', [customId])).rows[0].color, 'vinho')
        assert.ok((await catalog({ color: 'preta', size: 'P' })).filters.colors.includes('vinho'))
        await pool.query('UPDATE products SET is_active = false WHERE id = $1', [customId])
        assert.ok(!(await catalog({})).filters.colors.includes('vinho'))
      } finally { await pool.query('DELETE FROM products WHERE id = $1', [customId]) }
    })
    await t.test('480 combinações de cor/estampa/tamanho/promoção coincidem com o modelo', async () => {
      let combinations = 0
      for (const color of ['', ...new Set(demoProducts.map(p => p.color))]) {
        for (const printed of ['', 'true', 'false']) for (const size of ['', 'P', 'M', 'G', 'GG']) for (const promo of ['', 'true']) {
          const filters = Object.fromEntries(Object.entries({ color, is_printed: printed, size, promo }).filter(([, value]) => value))
          const expected = demoProducts.filter(p => (!color || p.color === color) && (!printed || p.isPrinted === (printed === 'true')) && (!size || p.sizes.some(v => v.size === size && v.stock > 0)) && (!promo || p.promoPriceCentavos != null)).map(p => p.id).sort()
          const data = await catalog(filters)
          assert.deepEqual(data.products.filter(p => ids.includes(p.id)).map(p => p.id).sort(), expected, JSON.stringify(filters))
          assert.equal(data.filters.colors.length, 15)
          combinations++
        }
      }
      assert.equal(combinations, 480)
    })
    await t.test('A–Z, preços efetivos e datas estão ordenados com desempate estável', async () => {
      const price = p => p.promo_price_centavos ?? p.price_centavos
      for (const sort of ['name_asc', 'price_asc', 'price_desc', 'newest', 'oldest']) {
        const products = (await catalog({ sort })).products
        const normalize = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        for (let i = 1; i < products.length; i++) {
          const left = products[i - 1], right = products[i]
          if (sort === 'name_asc') assert.ok(normalize(left.name) <= normalize(right.name))
          if (sort === 'price_asc') assert.ok(price(left) <= price(right))
          if (sort === 'price_desc') assert.ok(price(left) >= price(right))
          if (sort === 'newest') assert.ok(new Date(left.created_at) >= new Date(right.created_at))
          if (sort === 'oldest') assert.ok(new Date(left.created_at) <= new Date(right.created_at))
        }
        assert.deepEqual((await catalog({ sort })).products.map(p => p.id), products.map(p => p.id))
      }
    })
    await t.test('detalhes por URL, variantes completas, imagens e erros de identificador', async () => {
      const product = await (await fetch(`${base}/produtos/${ids[1]}`)).json()
      assert.equal(product.product.description, demoProducts[1].description)
      assert.equal(product.product.sizes.length, 4)
      assert.equal(product.product.images[0].url, demoProducts[1].imageUrl)
      const filtered = (await catalog({ size: 'M', color: 'preta' })).products.find(p => p.id === ids[1])
      assert.equal(filtered.sizes.length, 4, 'Filtrar M não deve esconder os demais tamanhos no detalhe')
      assert.equal((await fetch(`${base}/produtos/invalido`)).status, 400)
      assert.equal((await fetch(`${base}/produtos/${randomUUID()}`)).status, 404)
    })
    await t.test('carrinho recalcula promoção/cupom e devolve a imagem correta', async () => {
      const response = await fetch(`${base}/cart/cupom`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ productId: ids[1], size: 'M', quantity: 2 }], code: 'FORMA10', priceCentavos: 1 }) })
      assert.equal(response.status, 200)
      const data = await response.json()
      assert.equal(data.subtotalCentavos, 21980)
      assert.equal(data.discountCentavos, 2198)
      assert.equal(data.totalCentavos, 19782)
      assert.equal(data.cart[0].images[0].url, demoProducts[1].imageUrl)
    })
    await t.test('tamanho zerado e peça esgotada são recusados antes da cotação externa e do pedido', async () => {
      const registration = await fetch(`${base}/auth/registrar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Teste catálogo', email: `catalog-${randomUUID()}@example.test`, password: 'teste123' }) })
      const account = await registration.json()
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${account.token}` }
      const address = await (await fetch(`${base}/conta/enderecos`, { method: 'POST', headers, body: JSON.stringify({ label: 'Casa', recipient: 'Teste', street: 'Rua fictícia', number: '1', district: 'Centro', city: 'Recife', state: 'PE', cep: '50000000' }) })).json()
      for (const [productId, size, quantity] of [[ids[1], 'P', 1], [ids[11], 'M', 1], [ids[1], 'M', 6]]) {
        const items = [{ productId, size, quantity }]
        const quote = await fetch(`${base}/frete/cotacoes`, { method: 'POST', headers, body: JSON.stringify({ addressId: address.address.id, items }) })
        assert.equal(quote.status, 400)
        assert.equal((await quote.json()).error.code, 'estoque_indisponivel')
        const cart = await readCart(items)
        const quoteId = randomUUID()
        await pool.query(`INSERT INTO shipping_quotes (id, user_id, address_id, address_fingerprint, cart_fingerprint, services, expires_at)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, now() + interval '10 minutes')`, [quoteId, account.user.id, address.address.id, addressFingerprint(address.address), cartFingerprint(cart.items), JSON.stringify([{ id: 'fixture', name: 'Frete local simulado', priceCentavos: 1000 }])])
        await assert.rejects(createOrder(account.user.id, { addressId: address.address.id, items, quoteId, checkoutKey: randomUUID(), serviceId: 'fixture', couponCode: '' }), error => error.code === 'estoque_indisponivel')
      }
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM orders WHERE user_id = $1', [account.user.id])).rows[0].count, 0)
    })
  } finally {
    await new Promise(resolve => server.close(resolve))
    await pool.end()
  }
})
