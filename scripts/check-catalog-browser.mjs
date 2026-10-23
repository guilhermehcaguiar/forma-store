import { assertLocalDatabaseUrl } from '../server/src/db/local-database.js'
// Requer API e Vite ligados ao banco descartável; nunca usar no banco habitual.
// FORMA_TEST_DATABASE_URL=postgresql://.../forma_catalog_test node scripts/check-catalog-browser.mjs
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { demoProducts } from '../server/src/db/demo-products.js'

const databaseUrl = process.env.FORMA_TEST_DATABASE_URL
assertLocalDatabaseUrl(databaseUrl, { testOnly: true })
process.env.DATABASE_URL = databaseUrl
const { pool } = await import('../server/src/db/pool.js')
const origin = process.env.FORMA_BROWSER_ORIGIN ?? 'http://127.0.0.1:5186'
const apiOrigin = process.env.FORMA_BROWSER_API ?? 'http://127.0.0.1:3336'
const output = '.tmp/catalog-browser'
await mkdir(output, { recursive: true })
const browser = spawn(process.env.FORMA_BROWSER ?? '/opt/brave-bin/brave', ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--remote-debugging-port=9239', `--user-data-dir=/tmp/forma-catalog-browser-${process.pid}`, 'about:blank'], { stdio: 'ignore' })
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const pending = new Map(), errors = [], checks = []
let socket, sequence = 0
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence
  const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout CDP ${method}`)) }, 15000)
  pending.set(id, { resolve, reject, timeout })
  socket.send(JSON.stringify({ id, method, params }))
})
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
async function waitFor(expression) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(`Boolean(${expression})`).catch(() => false)) return
    await pause(100)
  }
  throw new Error(`Não apareceu: ${expression}. Tela: ${await evaluate('document.body.innerText')}`)
}
async function navigate(path) {
  console.error('Tela:', path)
  await send('Page.navigate', { url: origin + path })
  await pause(200)
  await waitFor('document.querySelector("main h1")')
}
async function check(name, expression) {
  assert.ok(await evaluate(expression), name)
  checks.push(name)
}
async function select(id, value) {
  await evaluate(`(() => { const select=document.getElementById(${JSON.stringify(id)}); select.value=${JSON.stringify(value)}; select.dispatchEvent(new Event('change',{bubbles:true})); })()`)
  const key = { 'catalog-color': 'color', 'catalog-pattern': 'is_printed', 'catalog-size': 'size', 'catalog-sort': 'sort' }[id]
  await waitFor(`new URLSearchParams(location.search).get(${JSON.stringify(key)}) === ${JSON.stringify(value)}`)
  await waitFor('document.querySelector(".catalog-results")?.getAttribute("aria-busy") === "false" && document.querySelector(".catalog-results")?.dataset.query === new URLSearchParams(location.search).toString()')
}
async function imagesLoaded() {
  await waitFor('document.querySelector("main img")')
  await evaluate(`document.querySelectorAll('main img').forEach(img => {img.loading='eager'})`)
  await waitFor(`Array.from(document.querySelectorAll('main img')).every(img => img.complete && img.naturalWidth > 0)`)
}
const clickText = text => evaluate(`Array.from(document.querySelectorAll('main button,main a')).find(el => el.textContent.trim() === ${JSON.stringify(text)})?.click()`)
try {
  let pages
  for (let i = 0; i < 100; i++) {
    try { pages = await (await fetch('http://127.0.0.1:9239/json')).json(); break } catch { await pause(100) }
  }
  assert.ok(pages, 'Não foi possível iniciar o navegador')
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  socket.onmessage = event => {
    const message = JSON.parse(event.data)
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
    const handler = pending.get(message.id)
    if (handler) { pending.delete(message.id); clearTimeout(handler.timeout); if (message.error) handler.reject(message.error); else handler.resolve(message.result) }
  }
  await send('Runtime.enable')
  await send('Network.enable')
  await send('Network.setCacheDisabled', { cacheDisabled: true })
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await navigate('/')
  await waitFor('document.querySelectorAll(".product-card").length === 4')
  await imagesLoaded()
  await check('Vitrine consulta quatro destaques disponíveis com imagens', `document.querySelectorAll('.product-card').length === 4 && !Array.from(document.querySelectorAll('.product-card')).some(c => c.textContent.includes('Esgotada'))`)
  await navigate('/catalogo')
  await waitFor('document.querySelectorAll(".product-card").length === 30')
  await imagesLoaded()
  await check('Catálogo tem 30 peças e 15 cores reais', `document.querySelectorAll('.product-card').length === 30 && document.querySelector('#catalog-color').options.length === 16`)
  await check('29 imagens geradas são próprias e identificadas', `Array.from(document.querySelectorAll('.product-card img')).filter(img => img.src.endsWith('.webp')).length === 29 && new Set(Array.from(document.querySelectorAll('.product-card img')).map(img=>img.src)).size === 30`)
  await check('Cinco ordenações estão acessíveis', `document.querySelector('#catalog-sort').options.length === 5 && !!document.querySelector('option[value=oldest]')`)
  await select('catalog-color', 'preta')
  await select('catalog-pattern', 'true')
  await select('catalog-size', 'M')
  await evaluate('document.getElementById("promo-checkbox").click()')
  await waitFor('document.querySelector(".catalog-results")?.getAttribute("aria-busy") === "false" && document.querySelector(".catalog-results")?.dataset.query === new URLSearchParams(location.search).toString() && document.querySelectorAll(".product-card").length === 1')
  await check('Combinação preta + estampada + M + promoção seleciona Traço Preto', `document.querySelector('.product-card').dataset.productId === ${JSON.stringify(demoProducts[1].id)}`)
  await send('Page.reload', { ignoreCache: true })
  await pause(300)
  await waitFor('document.querySelectorAll(".product-card").length === 1')
  await check('Recarga preserva filtros e resultado pela URL', `document.getElementById('catalog-color').value === 'preta' && document.getElementById('catalog-pattern').value === 'true' && document.getElementById('catalog-size').value === 'M' && document.getElementById('promo-checkbox').checked`)
  await select('catalog-size', 'P')
  await waitFor(`document.body.innerText.includes('Nenhum produto encontrado')`)
  await check('Combinação sem estoque exibe vazio', `document.querySelectorAll('.product-card').length === 0`)
  await clickText('Limpar filtros')
  await waitFor('document.querySelectorAll(".product-card").length === 30')
  await check('Limpar filtros restaura coleção e cores', `!location.search && document.getElementById('catalog-color').options.length === 16`)
  for (const [sort, firstId] of [['oldest', demoProducts[0].id], ['newest', demoProducts[29].id], ['price_asc', demoProducts[6].id], ['price_desc', demoProducts[16].id]]) {
    await select('catalog-sort', sort)
    await check(`Ordenação ${sort} usa a API`, `document.querySelector('.product-card').dataset.productId === ${JSON.stringify(firstId)}`)
  }
  await navigate(`/produto/${demoProducts[0].id}`)
  await waitFor('document.querySelector(".product-gallery img")')
  await imagesLoaded()
  await check('Detalhe direto usa a foto preta adequada e descrição', `document.querySelector('.product-gallery img').src.endsWith('/products/camisa-preta.png') && document.body.innerText.includes('ombros deslocados')`)
  await navigate(`/produto/${demoProducts[1].id}`)
  await waitFor('document.querySelector(".product-size-select select")')
  await imagesLoaded()
  await check('Detalhe mostra promoção e tamanho P zerado desabilitado', `document.querySelector('option[value=P]').disabled && document.body.innerText.includes('109,90') && !!document.querySelector('del')`)
  await evaluate(`(() => {const s=document.querySelector('.product-size-select select');s.value='M';s.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  await clickText('Adicionar ao carrinho →')
  await navigate('/carrinho')
  await waitFor('document.querySelector(".cart-item-card")')
  await imagesLoaded()
  await check('Carrinho renderiza a imagem e o preço promocional da API', `document.querySelector('.cart-item-image img').src.endsWith('/products/demo-2.webp') && document.body.innerText.includes('109,90')`)
  await send('Page.reload', { ignoreCache: true })
  await pause(300)
  await waitFor('document.querySelector(".cart-item-card")')
  await check('Carrinho e variante sobrevivem à recarga', `document.body.innerText.includes('Tamanho M')`)
  await evaluate(`localStorage.setItem('forma:cart', JSON.stringify({items:[{productId:${JSON.stringify(demoProducts[11].id)},size:'M',quantity:1}],couponCode:''}))`)
  await navigate('/carrinho')
  await waitFor(`document.body.innerText.includes('O estoque mudou')`)
  await check('Carrinho adulterado com peça esgotada não oferece checkout', `!document.querySelector('main a[href="/checkout"]')`)
  await navigate(`/produto/${demoProducts[11].id}`)
  await waitFor(`document.body.innerText.includes('Sem tamanhos com estoque')`)
  await check('Peça totalmente esgotada não pode ser adicionada', `Array.from(document.querySelectorAll('main button')).some(b => b.textContent.includes('Adicionar ao carrinho') && b.disabled)`)
  // Uma conta fictícia é promovida apenas via SQL no banco de teste, nunca por API pública.
  const registration = await fetch(`${apiOrigin}/api/auth/registrar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Catálogo navegador', email: `catalog-browser-${crypto.randomUUID()}@example.test`, password: 'teste123' }) })
  assert.equal(registration.status, 201)
  const account = await registration.json()
  await pool.query("UPDATE users SET role='administrador' WHERE id=$1", [account.user.id])
  await evaluate(`localStorage.setItem('forma:apiToken',${JSON.stringify(account.token)})`)
  await navigate('/administracao/produtos')
  await waitFor('document.querySelectorAll("tbody tr[data-product-id]").length === 30')
  await check('Admin consulta as 30 peças com estoque e imagens', `document.querySelectorAll('tbody tr[data-product-id]').length === 30 && document.querySelectorAll('.admin-product-image').length === 30`)
  await navigate('/administracao/promocoes')
  await waitFor('document.querySelectorAll("tbody tr[data-product-id]").length === 12')
  await check('Admin consulta 12 promoções demonstrativas', `document.querySelectorAll('tbody tr[data-product-id]').length === 12`)
  for (const width of [1440, 768, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false })
    for (const route of ['/', '/catalogo', `/produto/${demoProducts[1].id}`, '/carrinho', '/administracao/produtos']) {
      await navigate(route)
      await pause(120)
      await check(`Sem overflow ${route} em ${width}px`, 'document.documentElement.scrollWidth <= innerWidth')
      if ([1440, 390].includes(width) && ['/catalogo', `/produto/${demoProducts[1].id}`].includes(route)) {
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
        await writeFile(`${output}/${route === '/catalogo' ? 'catalog' : 'product'}-${width}.png`, Buffer.from(shot.data, 'base64'))
      }
    }
  }
  await send('Network.setBlockedURLs', { urls: [`${origin}/products/demo-2.webp`] })
  await navigate(`/produto/${demoProducts[1].id}`)
  await waitFor('document.querySelector(".product-image__fallback")')
  await check('Imagem indisponível tem fallback identificado', `document.querySelector('.product-image__fallback').textContent.includes('Foto não disponível')`)
  await send('Network.setBlockedURLs', { urls: [`${apiOrigin}/api/produtos*`] })
  await navigate('/catalogo')
  await waitFor('document.querySelector("main [role=alert]")')
  await check('Falha da API aparece como erro, sem catálogo fictício', `document.querySelectorAll('.product-card').length === 0`)
  assert.deepEqual(errors, [], 'Não deve haver exceções JavaScript')
  checks.push('Sem exceções JavaScript')
  await writeFile(`${output}/results.json`, JSON.stringify({ passed: checks.length, checks }, null, 2))
  console.log(JSON.stringify({ passed: checks.length, output }, null, 2))
} finally {
  socket?.close()
  browser.kill('SIGTERM')
  await pool.end()
}
