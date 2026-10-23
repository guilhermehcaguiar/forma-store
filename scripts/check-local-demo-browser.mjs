// Jornada real pela UI: nenhum interceptador/SDK/gateway externo é injetado.
// Cria banco novo na instância descartável indicada por FORMA_TEST_DATABASE_URL.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { assertLocalDatabaseUrl, connectLocalDatabase } from '../server/src/db/local-database.js'

const target = assertLocalDatabaseUrl(process.env.FORMA_TEST_DATABASE_URL, { testOnly: true })
const admin = await connectLocalDatabase(target.href, { testOnly: true })
const database = `forma_local_demo_test_${Date.now()}`
await admin.query(`CREATE DATABASE "${database}"`)
target.pathname = '/' + database
Object.assign(process.env, { DATABASE_URL: target.href, NODE_ENV: 'test', FORMA_DEMO_MODE: 'true',
  FORMA_API_HOST: '127.0.0.1', FORMA_EMAIL_MODE: 'mock', CORS_ORIGIN: 'http://127.0.0.1:5191' })
const { pool } = await import('../server/src/db/pool.js')
for (const file of (await readdir('server/src/db/migrations')).filter(f => f.endsWith('.sql')).sort()) {
  await pool.query(await readFile(`server/src/db/migrations/${file}`, 'utf8'))
}
const { seedDemoProducts } = await import('../server/src/db/seed-demo.js')
const seedRuns = [await seedDemoProducts(pool), await seedDemoProducts(pool)]
assert.deepEqual(seedRuns, [{ inserted: 30, skipped: 0 }, { inserted: 0, skipped: 30 }])
const catalogCounts = (await pool.query(`SELECT count(*)::int AS products,
  count(*) FILTER (WHERE is_printed)::int AS printed, count(DISTINCT color)::int AS colors,
  count(*) FILTER (WHERE promo_price_cents IS NOT NULL)::int AS promotions FROM products`)).rows[0]
assert.deepEqual(catalogCounts, { products: 30, printed: 15, colors: 15, promotions: 12 })
const { provisionDemoAdmin, demoAdmin } = await import('../server/src/db/demo-admin.js')
await provisionDemoAdmin(pool)
const { createApp } = await import('../server/src/app.js')
const { dispatchEmailOutbox } = await import('../server/src/modules/notifications/email.service.js')
const { DEMO_NOTICE } = await import('../server/src/modules/demo/demo.config.js')
const apiServer = createApp().listen(0, '127.0.0.1'); await once(apiServer, 'listening')
const apiOrigin = `http://127.0.0.1:${apiServer.address().port}`
process.env.VITE_API_URL = apiOrigin + '/api'
const { createServer } = await import('vite')
const vite = await createServer({ server: { port: 5191, strictPort: true, host: '127.0.0.1' } })
await vite.listen()
const origin = 'http://127.0.0.1:5191', output = process.env.FORMA_EVIDENCE_DIR ?? '.tmp/local-demo-browser'
await mkdir(output, { recursive: true })
const browser = spawn(process.env.FORMA_BROWSER ?? '/usr/bin/brave', ['--headless=new', '--disable-gpu',
  '--no-first-run', '--disable-background-networking', '--remote-debugging-port=9245',
  `--user-data-dir=/tmp/forma-local-demo-browser-${process.pid}`, 'about:blank'], { stdio: 'ignore' })
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const pending = new Map(), checks = [], errors = [], requests = []
let socket, sequence = 0, transportError
browser.once('exit', (code, signal) => { transportError = new Error(`Navegador de teste encerrou: ${code ?? signal}`) })
const send = (method, params = {}) => new Promise((resolve, reject) => {
  if (transportError || socket?.readyState !== WebSocket.OPEN) { reject(transportError ?? Error('Conexão CDP fechada')); return }
  const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(Error(`Timeout ${method}`)) }, 15000)
  pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }))
})
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw Error('Falha no código do teste no navegador')
  return result.result.value
}
const waitFor = async expression => {
  for (let i = 0; i < 120; i++) { if (transportError) throw transportError; if (await evaluate(`Boolean(${expression})`).catch(() => false)) return; await pause(100) }
  throw Error(`Timeout: ${expression}; tela: ${await evaluate('document.body.innerText')}`)
}
const navigate = async path => {
  console.error('Tela:', path)
  await send('Page.navigate', { url: origin + path }); await waitFor('document.querySelector("main h1")')
}
const select = (id, value) => evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`)
const catalogReady = () => waitFor(`document.querySelector('.catalog-results')?.getAttribute('aria-busy')==='false' && document.querySelector('.catalog-results')?.dataset.query===new URLSearchParams(location.search).toString()`)
const click = text => evaluate(`Array.from(document.querySelectorAll('main button,main a')).find(e=>e.textContent.trim()===${JSON.stringify(text)})?.click()`)
const fill = async (id, value) => {
  await waitFor(`document.getElementById(${JSON.stringify(id)})`)
  return evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`)
}
const submit = id => evaluate(`document.getElementById(${JSON.stringify(id)}).closest('form').requestSubmit()`)
const check = async (label, expression) => { assert.ok(await evaluate(expression), label); checks.push(label) }
const screenshot = async name => {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: name.startsWith('catalog-all-') })
  await writeFile(`${output}/${name}.png`, Buffer.from(shot.data, 'base64'))
}
try {
  let pages
  for (let i = 0; i < 100; i++) { try { pages = await (await fetch('http://127.0.0.1:9245/json')).json(); break } catch { await pause(100) } }
  assert.ok(pages, 'Navegador não iniciou')
  socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  socket.onclose = () => {
    transportError ??= Error('Conexão CDP encerrada')
    for (const handler of pending.values()) { clearTimeout(handler.timer); handler.reject(transportError) }
    pending.clear()
  }
  socket.onmessage = event => {
    const message = JSON.parse(event.data), handler = pending.get(message.id)
    if (handler) { pending.delete(message.id); clearTimeout(handler.timer); if (message.error) handler.reject(message.error); else handler.resolve(message.result) }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
    if (message.method === 'Network.requestWillBeSent') {
      const r = message.params.request
      if (r.url.startsWith(apiOrigin + '/api')) requests.push({ path: new URL(r.url).pathname, method: r.method, body: r.postData })
      assert.ok(!/mercadopago|melhorenvio/.test(r.url), 'Navegador não deve carregar provedores na demo')
    }
  }
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable')
  for (const width of [1440, 390]) {
    console.error('Jornada demo local', width)
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 500 })
    await navigate('/cadastro'); await evaluate('localStorage.clear()'); await navigate('/cadastro')
    const email = `local-demo-${randomUUID()}@example.test`
    for (const [id, value] of Object.entries({ 'register-name': 'Aluno FORMA', 'register-email': email,
      'register-password': 'FormaTeste2026!', 'register-confirm-password': 'FormaTeste2026!' })) await fill(id, value)
    await check(`${width}: opt-in começa desmarcado`, "!document.querySelector('input[name=promo]').checked")
    await submit('register-name'); await waitFor("location.pathname==='/minha-conta' && document.querySelector('.account-stats')")
    checks.push(`${width}: cadastro pela interface`)
    await check(`${width}: cliente não vê atalho administrativo`, "!document.querySelector('.nav-menu a[href=\"/administracao\"]')")
    const userId = (await pool.query('SELECT id FROM users WHERE email=$1', [email])).rows[0].id
    await navigate('/catalogo'); await catalogReady()
    await waitFor('document.querySelectorAll(".product-card").length===30')
    await evaluate("document.querySelectorAll('main img').forEach(img=>img.loading='eager')")
    await waitFor("Array.from(document.querySelectorAll('.product-card img')).every(i=>i.complete&&i.naturalWidth>0)")
    await check(`${width}: 30 imagens distintas carregam`, "document.querySelectorAll('.product-card img').length===30 && new Set(Array.from(document.querySelectorAll('.product-card img')).map(i=>i.src)).size===30")
    await check(`${width}: catálogo sem overflow`, 'document.documentElement.scrollWidth<=innerWidth')
    await screenshot(`catalog-all-${width}`)
    for (const [sort, suffix] of [['name_asc','000000000010'],['price_asc','000000000007'],['price_desc','000000000017'],['newest','000000000030'],['oldest','000000000001']]) {
      await select('catalog-sort', sort); await catalogReady()
      await check(`${width}: ordenação ${sort}`, `document.querySelector('.product-card')?.dataset.productId.endsWith(${JSON.stringify(suffix)})`)
    }
    for (const [id,value] of [['catalog-color','preta'],['catalog-pattern','true'],['catalog-size','M']]) { await select(id,value);await catalogReady() }
    await evaluate("document.getElementById('promo-checkbox').click()");await catalogReady()
    await check(`${width}: filtros combinados`, "document.querySelectorAll('.product-card').length===1 && document.querySelector('.product-card').dataset.productId.endsWith('000000000002')")
    await navigate('/catalogo'+await evaluate('location.search'));await catalogReady()
    await check(`${width}: filtros persistem após recarga`, "document.getElementById('catalog-color').value==='preta'&&document.getElementById('promo-checkbox').checked")
    await screenshot(`catalog-filtered-${width}`)
    await navigate('/minha-conta/dados');await waitFor('document.getElementById("account-name")')
    await fill('account-name','Aluno FORMA atualizado');await submit('account-name')
    await waitFor("document.body.innerText.includes('Dados atualizados com sucesso')")
    await navigate('/minha-conta/dados');await waitFor("document.getElementById('account-name')?.value==='Aluno FORMA atualizado'")
    checks.push(`${width}: perfil editado persiste`);await screenshot(`profile-${width}`)
    await navigate('/minha-conta/listas');await waitFor("Array.from(document.querySelectorAll('main button')).some(b=>b.textContent==='Nova lista')")
    await click('Nova lista');await fill('list-name','Seleção inicial');await submit('list-name')
    await waitFor("document.querySelector('.saved-item a')?.textContent==='Seleção inicial'")
    await click('Renomear');await fill('list-name','Seleção da aula');await submit('list-name')
    await waitFor("document.querySelector('.saved-item a')?.textContent==='Seleção da aula'")
    const listPath=await evaluate("document.querySelector('.saved-item a').getAttribute('href')")
    checks.push(`${width}: lista criada e renomeada`)
    const productId = 'f04a0000-0000-4000-8000-000000000002' 
    await navigate(`/produto/${productId}`); await waitFor('document.querySelector(".product-size-select select")')
    await waitFor("document.getElementById('product-list')?.options.length>1")
    await click('Salvar nos favoritos ♥');await waitFor("document.body.innerText.includes('Salva nos favoritos')")
    await select('product-list',listPath.split('/').at(-1));await click('Salvar na lista')
    await waitFor("document.body.innerText.includes('Peça salva na lista')")
    await screenshot(`product-${width}`)
    await navigate('/favoritos');await waitFor("document.querySelector('.saved-item h3')?.textContent==='Oversized Traço Preto'")
    await check(`${width}: favorito resolve após navegação`, "!!document.querySelector('.saved-item img')")
    await screenshot(`favorites-${width}`)
    await navigate(listPath);await waitFor("document.querySelector('.saved-item h3')?.textContent==='Oversized Traço Preto'")
    await check(`${width}: lista resolve produto após recarga`, "!!document.querySelector('.saved-item img')")
    await screenshot(`list-${width}`)
    await navigate(`/produto/${productId}`);await waitFor("document.querySelector('.product-size-select select')")
    await evaluate(`(()=>{const s=document.querySelector('.product-size-select select');s.value='M';s.dispatchEvent(new Event('change',{bubbles:true}));})()`)
    await click('Adicionar ao carrinho →'); await waitFor("document.body.innerText.includes('Peça adicionada ao carrinho.')"); await navigate('/carrinho')
    await waitFor("document.querySelector('.cart-item-card') && !document.body.innerText.includes('Atualizando preços')")
    await fill('cart-coupon', 'FORMA10'); await click('Aplicar')
    await waitFor("document.querySelector('.summary-values')?.textContent.includes('98,91')")
    checks.push(`${width}: produto → carrinho → cupom`);await screenshot(`cart-${width}`)
    await click('Continuar para o checkout →'); await waitFor("location.pathname==='/checkout'")
    await waitFor("document.body.innerText.includes('Nenhum endereço salvo')")
    await check(`${width}: aviso explícito antes da compra`, `document.body.innerText.includes(${JSON.stringify(DEMO_NOTICE)})`)
    await click('Adicionar endereço →'); await waitFor("location.pathname==='/minha-conta/enderecos'")
    await waitFor("Array.from(document.querySelectorAll('main button')).some(b=>b.textContent==='Novo endereço')")
    await click('Novo endereço')
    for (const [field, value] of Object.entries({ label: 'Casa', recipient: 'Aluno FORMA', cep: '50000000',
      street: 'Rua da Demonstração', number: '100', district: 'Centro', city: 'Recife', state: 'PE' })) await fill('address-' + field, value)
    await submit('address-label'); await waitFor("document.querySelector('.saved-item')?.textContent.includes('Rua da Demonstração')")
    await click('Editar');await fill('address-number','101');await submit('address-label')
    await waitFor("document.querySelector('.saved-item')?.textContent.includes('101')")
    if (await evaluate("Array.from(document.querySelectorAll('main button')).some(b=>b.textContent==='Definir como principal')")) {
      await click('Definir como principal');await waitFor("document.querySelector('.saved-item')?.textContent.includes('Endereço principal')")
    }
    await navigate('/minha-conta/enderecos');await waitFor("document.querySelector('.saved-item')?.textContent.includes('101')")
    await check(`${width}: endereço editado e principal persiste`, "document.querySelector('.saved-item').textContent.includes('Endereço principal')")
    await screenshot(`address-${width}`)
    await click('Remover');await click('Confirmar remoção');await waitFor("!document.querySelector('.saved-item')")
    checks.push(`${width}: endereço removido pela interface`)
    await click('Novo endereço')
    for (const [field,value] of Object.entries({label:'Casa',recipient:'Aluno FORMA',cep:'50000000',street:'Rua da Demonstração',number:'100',district:'Centro',city:'Recife',state:'PE'}))await fill('address-'+field,value)
    await submit('address-label');await waitFor("document.querySelector('.saved-item')?.textContent.includes('Rua da Demonstração')")
    await navigate('/checkout'); await waitFor("document.getElementById('checkout-address')?.value")
    await waitFor("Array.from(document.querySelectorAll('main button')).some(b=>b.textContent==='Calcular frete'&&!b.disabled)")
    await click('Calcular frete'); await waitFor("document.querySelector('.shipping-option input')")
    await check(`${width}: frete demo calculado sem interceptação`, `document.querySelector('.shipping-option').textContent.includes(${JSON.stringify(DEMO_NOTICE)}) && document.querySelector('.shipping-option').textContent.includes('10,00')`)
    await evaluate("document.querySelector('.shipping-option input').click()")
    await waitFor("Array.from(document.querySelectorAll('main button')).some(b=>b.textContent==='Confirmar pedido →'&&!b.disabled)")
    await screenshot(`shipping-${width}`)
    await click('Confirmar pedido →'); await waitFor("document.body.innerText.includes('Obrigado pela sua compra')")
    await check(`${width}: pedido identificado e sem cartões`, `document.body.innerText.includes(${JSON.stringify(DEMO_NOTICE)}) && !document.querySelector('.mp-field') && !document.body.innerText.includes('Pagar com Mercado Pago')`)
    await screenshot(`payment-${width}`)
    const order = (await pool.query('SELECT * FROM orders WHERE user_id=$1', [userId])).rows[0]
    assert.equal(order.transaction_mode, 'demo'); assert.equal(Number(order.total_centavos), 10891)
    // Desktop paga na confirmação; mobile retoma pelo histórico após navegação.
    if (width === 390) {
      await click('Ver meus pedidos'); await waitFor("location.pathname==='/minha-conta/pedidos'")
      await waitFor("document.querySelector('.saved-item')")
      await click('Detalhes →'); await waitFor('document.querySelector(".order-detail")')
      await check(`${width}: retoma pagamento no histórico`, `document.body.innerText.includes(${JSON.stringify(DEMO_NOTICE)}) && document.body.innerText.includes('Confirmar pagamento demonstrativo')`)
    }
    await click('Confirmar pagamento demonstrativo')
    await waitFor(width === 390 ? "document.body.innerText.includes('Pagamento confirmado')" : "document.body.innerText.includes('Pagamento aprovado')")
    checks.push(`${width}: aprovação simulada pela API`)
    await navigate(`/minha-conta/pedidos/${order.id}`); await waitFor("document.querySelector('.order-detail') && document.body.innerText.includes('Pagamento confirmado')")
    await check(`${width}: recarga mantém identificação e total`, `document.body.innerText.includes(${JSON.stringify(DEMO_NOTICE)}) && document.body.innerText.includes('108,91')`)
    await check(`${width}: detalhe sem overflow`, 'document.documentElement.scrollWidth<=innerWidth')
    await screenshot(`confirmed-${width}`)
    await navigate('/minha-conta/pedidos'); await waitFor("document.querySelector('.saved-item')")
    await check(`${width}: histórico identifica demonstração`, `document.querySelector('.saved-item').textContent.includes(${JSON.stringify(DEMO_NOTICE)}) && document.querySelector('.saved-item').textContent.includes('Pagamento confirmado')`)
    await check(`${width}: histórico sem overflow`, 'document.documentElement.scrollWidth<=innerWidth')
    await screenshot(`history-${width}`)
    await dispatchEmailOutbox()
    const payment = (await pool.query('SELECT * FROM payment_attempts WHERE order_id=$1', [order.id])).rows[0]
    assert.equal(payment.provider, 'forma_demo'); assert.equal(payment.status, 'aprovada'); assert.equal(payment.preference_id, null)
    const emailRow = (await pool.query("SELECT * FROM email_outbox WHERE order_id=$1 AND template='purchase_confirmation'", [order.id])).rows[0]
    assert.equal(emailRow.status, 'mocked'); assert.ok(emailRow.mock_message.text.includes(DEMO_NOTICE))
    const reservation = (await pool.query('SELECT status FROM stock_reservations WHERE order_id=$1', [order.id])).rows[0]
    assert.equal(reservation.status, 'consumido')
    checks.push(`${width}: PostgreSQL conserva provedor demo, reserva e e-mail mock`)
    const payRequests = requests.filter(r => r.method === 'POST' && r.path === `/api/demonstracao/pedidos/${order.id}/pagar`)
    assert.equal(payRequests.length, 1); assert.deepEqual(JSON.parse(payRequests[0].body), {})
    checks.push(`${width}: frontend envia somente objeto vazio para pagamento`)
    await navigate('/favoritos');await waitFor("document.querySelector('.saved-item')")
    await click('Remover');await waitFor("!document.querySelector('.saved-item')")
    checks.push(`${width}: favorito removido pela interface`)
    await navigate(listPath);await waitFor("document.querySelector('.saved-item')")
    await click('Remover');await waitFor("!document.querySelector('.saved-item')")
    await navigate('/minha-conta/listas');await waitFor("document.querySelector('.saved-item')")
    await click('Remover');await click('Confirmar remoção');await waitFor("!document.querySelector('.saved-item')")
    checks.push(`${width}: item e lista removidos pela interface`)
    await navigate('/administracao/pedidos'); await waitFor("!location.pathname.startsWith('/administracao')")
    checks.push(`${width}: cliente não acessa administração`)
    await navigate('/minha-conta');await waitFor("document.querySelector('.header__account button:not(:disabled)')")
    await evaluate("document.querySelector('.header__account button:not(:disabled)').click()")
    await waitFor("location.pathname==='/login'")
    await fill('login-email',demoAdmin.email);await fill('login-password',demoAdmin.password);await submit('login-email')
    await waitFor("location.pathname==='/minha-conta'")
    await waitFor("document.querySelector('.nav-menu a[href=\"/administracao\"]')")
    if (width === 1440) {
      for (const desktopWidth of [1440,1280,1024,901]) {
        await send('Emulation.setDeviceMetricsOverride',{width:desktopWidth,height:1000,deviceScaleFactor:1,mobile:false})
        await check(`${desktopWidth}: cabeçalho admin sem sobreposição`, `document.querySelector('.nav-menu').getBoundingClientRect().right<=document.querySelector('.header__account').getBoundingClientRect().left && document.documentElement.scrollWidth<=innerWidth`)
      }
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false})
    } else {
      await evaluate("document.querySelector('.header__toggle').click()")
      await waitFor("document.querySelector('.header__toggle').getAttribute('aria-expanded')==='true'")
    }
    await evaluate("document.querySelector('.nav-menu a[href=\"/administracao\"]').click()")
    await waitFor("location.pathname==='/administracao'")
    await check(`${width}: atalho Painel Admin abre e fecha menu`, "document.querySelector('.header__toggle').getAttribute('aria-expanded')==='false'")
    await navigate('/administracao/produtos');await waitFor("document.querySelectorAll('tbody tr[data-product-id]').length===30")
    await check(`${width}: login normal do administrador e 30 peças`, "document.querySelectorAll('tbody tr[data-product-id]').length===30")
    await screenshot(`admin-products-${width}`)
    const newProduct='f04a0000-0000-4000-8000-000000000013'
    await navigate(`/administracao/produtos/${newProduct}/editar`);await waitFor('document.getElementById("admin-name")')
    await fill('admin-price','154,90');await fill('admin-promo','124,90');await fill('admin-stock-GG','5')
    await click('Salvar alterações');await waitFor("document.querySelector('.form-success')")
    const saved=(await pool.query('SELECT * FROM products WHERE id=$1',[newProduct])).rows[0]
    const sizes=(await pool.query('SELECT * FROM product_sizes WHERE product_id=$1 ORDER BY size',[newProduct])).rows
    const images=(await pool.query('SELECT * FROM product_images WHERE product_id=$1 ORDER BY id',[newProduct])).rows
    assert.equal(saved.price_cents,15490);assert.equal(saved.promo_price_cents,12490)
    assert.equal((await seedDemoProducts(pool)).inserted,0)
    assert.deepEqual((await pool.query('SELECT * FROM products WHERE id=$1',[newProduct])).rows[0],saved)
    assert.deepEqual((await pool.query('SELECT * FROM product_sizes WHERE product_id=$1 ORDER BY size',[newProduct])).rows,sizes)
    assert.deepEqual((await pool.query('SELECT * FROM product_images WHERE product_id=$1 ORDER BY id',[newProduct])).rows,images)
    checks.push(`${width}: seed preserva edição administrativa e estoque`)
    await screenshot(`admin-editor-${width}`)
    if (width === 1440) {
      for (const smaller of [768,320]) {
        await send('Emulation.setDeviceMetricsOverride',{width:smaller,height:1000,deviceScaleFactor:1,mobile:smaller<500})
        await check(`${smaller}: editor administrativo sem overflow`,'document.documentElement.scrollWidth<=innerWidth')
        await screenshot(`admin-editor-${smaller}`)
      }
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false})
    }
    await navigate(`/produto/${newProduct}`);await waitFor("document.body.innerText.includes('124,90')")
    await check(`${width}: preço administrativo aparece na vitrine`, "document.body.innerText.includes('Solar Terracota') && document.body.innerText.includes('124,90')")
    await navigate('/administracao/promocoes');await waitFor("document.querySelectorAll('tbody tr[data-product-id]').length===12")
    checks.push(`${width}: 12 promoções no painel`);await screenshot(`admin-promotions-${width}`)
    await navigate('/administracao/pedidos');await waitFor(`document.body.innerText.includes('${order.id}')`)
    await check(`${width}: painel identifica pedido demo`, `document.body.innerText.includes(${JSON.stringify(DEMO_NOTICE)}) && document.body.innerText.includes('Pagamento confirmado')`)
    await check(`${width}: administração sem overflow`, 'document.documentElement.scrollWidth<=innerWidth')
    await screenshot(`admin-orders-${width}`)
    await navigate('/minha-conta');await waitFor("document.querySelector('.header__account button:not(:disabled)')")
    await evaluate("document.querySelector('.header__account button:not(:disabled)').click()")
    await waitFor("location.pathname==='/login'")
  }
  for (const smaller of [768,320]) {
    await send('Emulation.setDeviceMetricsOverride',{width:smaller,height:1000,deviceScaleFactor:1,mobile:smaller<500})
    for (const path of ['/catalogo','/produto/f04a0000-0000-4000-8000-000000000013','/carrinho','/checkout','/login','/sobre']) {
      await navigate(path)
      if (path === '/catalogo') await catalogReady()
      if (path.startsWith('/produto/')) await waitFor('document.querySelector(".product-gallery img")')
      await check(`${smaller}: layout ${path}`,'document.documentElement.scrollWidth<=innerWidth')
    }
  }
  assert.deepEqual(errors, [])
  const report = { passed: checks.length, checks, seedRuns, catalogCounts, providers: 'demo local explícita; sem interceptação de rede e sem chamadas a MP/ME; e-mail mock', database }
  await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ passed: checks.length, database, output }))
} finally {
  socket?.close(); browser.kill('SIGTERM'); await vite.close()
  await new Promise(resolve => apiServer.close(resolve)); await pool.end(); await admin.end()
}
