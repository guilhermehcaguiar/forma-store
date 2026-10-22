import { assertLocalDatabaseUrl } from '../server/src/db/local-database.js'
// Requer API e Vite ligados ao banco descartável; nunca usar no banco habitual.
// FORMA_TEST_DATABASE_URL=postgresql://.../forma_catalog_test node scripts/check-admin-browser.mjs
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'

const databaseUrl = process.env.FORMA_TEST_DATABASE_URL
assertLocalDatabaseUrl(databaseUrl, { testOnly: true })
process.env.DATABASE_URL = databaseUrl
const { pool } = await import('../server/src/db/pool.js')
const origin = process.env.FORMA_BROWSER_ORIGIN ?? 'http://127.0.0.1:5186'
const apiOrigin = process.env.FORMA_BROWSER_API ?? 'http://127.0.0.1:3336'
const output = '.tmp/admin-browser'
await mkdir(output, { recursive: true })
const browser = spawn(process.env.FORMA_BROWSER ?? '/opt/brave-bin/brave', ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--remote-debugging-port=9240', `--user-data-dir=/tmp/forma-admin-browser-${process.pid}`, 'about:blank'], { stdio: 'ignore' })
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
async function imagesLoaded() {
  await evaluate(`document.querySelectorAll('main img').forEach(img => {img.loading='eager'})`)
  await waitFor(`Array.from(document.querySelectorAll('main img')).every(img => img.complete && img.naturalWidth > 0)`)
}
const clickText = text => evaluate(`Array.from(document.querySelectorAll('main button,main a')).find(el => el.textContent.trim() === ${JSON.stringify(text)})?.click()`)
try {
  let pages
  for (let i = 0; i < 100; i++) {
    try { pages = await (await fetch('http://127.0.0.1:9240/json')).json(); break } catch { await pause(100) }
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
  const registration = async () => {
    const response=await fetch(`${apiOrigin}/api/auth/registrar`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Admin navegador',email:`admin-browser-${crypto.randomUUID()}@example.test`,password:'teste123'})})
    assert.equal(response.status,201);return response.json()
  }
  const customer=await registration(),admin=await registration()
  await pool.query("UPDATE users SET role='administrador' WHERE id=$1",[admin.user.id])
  await send('Page.navigate',{url:origin});await pause(300)
  await evaluate(`localStorage.setItem('forma:apiToken',${JSON.stringify(customer.token)})`)
  await navigate('/administracao/produtos')
  await waitFor('!location.pathname.startsWith("/administracao")')
  await check('Cliente não acessa painel',`!location.pathname.startsWith('/administracao')`)
  await evaluate(`localStorage.setItem('forma:apiToken',${JSON.stringify(admin.token)})`)
  await navigate('/administracao/produtos')
  await waitFor('document.querySelector("tbody tr[data-product-id]")')
  await check('Lista real permite selecionar peça e criar',`!!document.querySelector('a[href="/administracao/produtos/novo"]') && !!document.querySelector('a[href$="/editar"]')`)
  await clickText('Novo produto')
  await waitFor('document.getElementById("admin-name")')
  const fill=async (id,value)=>evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`)
  const toggle=async id=>evaluate(`document.getElementById(${JSON.stringify(id)}).click()`)
  const upload=async()=>evaluate(`(()=>{const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='),c=>c.charCodeAt(0));const dt=new DataTransfer();dt.items.add(new File([bytes],'camisa-teste.png',{type:'image/png'}));const el=document.getElementById('admin-images');el.files=dt.files;el.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  for(const [id,value] of [['admin-name','Oversized navegador'],['admin-description','Descrição pelo formulário'],['admin-color','violeta'],['admin-price','199,90'],['admin-promo','149,90'],['admin-stock-M','8'],['admin-stock-G','2']]) await fill(id,value)
  await toggle('admin-printed');await upload()
  await check('Prévia da imagem local',`!!document.querySelector('.admin-image-grid img[src^="blob:"]')`)
  await clickText('Cadastrar produto')
  await waitFor('location.pathname.endsWith("/editar") && document.querySelector(".form-success") && document.getElementById("admin-name")?.value === "Oversized navegador"')
  const id=await evaluate('location.pathname.split("/").at(-2)')
  const getProduct=async()=> (await (await fetch(`${apiOrigin}/api/admin/produtos/${id}`,{headers:{Authorization:`Bearer ${admin.token}`}})).json()).product
  let product=await getProduct()
  assert.equal(product.price_cents,19990);assert.equal(product.promo_price_cents,14990);assert.equal(product.images.length,1)
  checks.push('Formulário cria com imagem, preços, cor e estoque persistidos')
  await waitFor(`!!document.querySelector('.admin-image-grid img') && !Array.from(document.images).some(img=>img.src.startsWith('blob:'))`)
  await imagesLoaded()
  await check('Imagem persistida reaparece no editor',`document.querySelector('.admin-image-grid img').naturalWidth>0 && !document.querySelector('.admin-image-grid img').src.startsWith('blob:')`)
  await fill('admin-name','Oversized navegador editada');await fill('admin-description','Descrição editada');await fill('admin-color','turquesa');await fill('admin-price','219,90');await fill('admin-promo','179,90');await fill('admin-stock-M','5');await toggle('admin-size-P');await toggle('admin-printed')
  await clickText('Remover imagem');await upload()
  await clickText('Salvar alterações')
  await waitFor(`document.getElementById('admin-name')?.value === 'Oversized navegador editada' && document.querySelector('.form-success') && !Array.from(document.images).some(img=>img.src.startsWith('blob:'))`)
  product=await getProduct();assert.equal(product.color,'turquesa');assert.equal(product.is_printed,false);assert.equal(product.sizes.find(s=>s.size==='M').stock,5);assert.equal(product.sizes.find(s=>s.size==='P').is_active,false)
  checks.push('Edição de texto, cor, estampa, preço, promoção, grade, estoque e substituição de imagem')
  const imageUrl=product.images[0].url
  await navigate(`/produto/${id}`);await waitFor('document.querySelector(".product-gallery img")');await imagesLoaded()
  await check('Detalhe público usa nome, promoção, nova imagem e grade atualizada',`document.body.innerText.includes('Oversized navegador editada') && document.body.innerText.includes('179,90') && document.querySelector('.product-gallery img').src.endsWith(${JSON.stringify(imageUrl)}) && !document.querySelector('option[value=P]')`)
  await navigate('/catalogo?color=turquesa&sort=oldest');await waitFor(`document.querySelector('[data-product-id="${id}"]')`)
  await check('Cor nova e vitrine refletem edição',`!!document.querySelector('[data-product-id="${id}"]') && !!Array.from(document.querySelector('#catalog-color').options).find(o=>o.value==='turquesa')`)
  await navigate(`/administracao/produtos/${id}/editar`);await waitFor('document.getElementById("admin-name")?.value==="Oversized navegador editada"')
  await toggle('admin-active');await clickText('Salvar alterações');await pause(300)
  await waitFor('document.querySelector(".form-success") && !document.getElementById("admin-active").checked')
  assert.equal((await fetch(`${apiOrigin}/api/produtos/${id}`)).status,404);checks.push('Desativar no formulário retira peça da API pública')
  await navigate('/administracao/produtos');await waitFor('document.getElementById("admin-status-filter")')
  await evaluate(`(()=>{const s=document.getElementById('admin-status-filter');s.value='inactive';s.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  await waitFor(`document.querySelector('tr[data-product-id="${id}"]')`)
  await check('Lista mantém peça inativa editável',`document.querySelector('tr[data-product-id="${id}"]').textContent.includes('Inativo') && !!document.querySelector('tr[data-product-id="${id}"] a[href$="/editar"]')`)
  await navigate(`/administracao/produtos/${id}/editar`);await waitFor('document.getElementById("admin-name")')
  await check('Recarga mantém status, preço e tamanhos',`!document.getElementById('admin-active').checked && document.getElementById('admin-price').value==='219.90' && !document.getElementById('admin-size-P').checked && document.getElementById('admin-stock-M').value==='5'`)
  await toggle('admin-active');await fill('admin-promo','');await clickText('Salvar alterações');await pause(300);await waitFor('document.querySelector(".form-success")')
  product=await getProduct();assert.equal(product.is_active,true);assert.equal(product.promo_price_cents,null);checks.push('Reativar e encerrar promoção persistem')
  // Outra sessão altera a peça; o formulário deve preservar o rascunho e mostrar conflito.
  const body={...product,version:product.admin_version,name:'Alteração em outra sessão',sizes:product.sizes.filter(s=>s.is_active).map(s=>({...s,expected_revision:s.revision})),retained_images:product.images.map(i=>i.id),main_image:product.images[0].id}
  assert.equal((await fetch(`${apiOrigin}/api/admin/produtos/${id}`,{method:'PUT',headers:{Authorization:`Bearer ${admin.token}`,'Content-Type':'application/json'},body:JSON.stringify(body)})).status,200)
  await fill('admin-description','Rascunho não perdido');await clickText('Salvar alterações');await waitFor('document.querySelector("main [role=alert]")')
  await check('Conflito aparece sem apagar rascunho',`document.querySelector('[role=alert]').textContent.includes('Outro administrador') && document.getElementById('admin-description').value==='Rascunho não perdido'`)
  await clickText('Reabrir dados atuais do produto');await pause(300);await waitFor('document.getElementById("admin-name")?.value==="Alteração em outra sessão"')
  await check('Reabrir consulta versão persistida',`!document.querySelector('main [role=alert]')`)
  for (const width of [1440,768,390,320]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false})
    for (const path of ['/administracao/produtos',`/administracao/produtos/${id}/editar`]) {
      await navigate(path);await waitFor(path.endsWith('/editar')?'document.getElementById("admin-name")':'document.querySelector("tbody tr[data-product-id]")')
      await check(`Sem overflow ${path.endsWith('/editar')?'editor':'lista'} ${width}px`,'document.documentElement.scrollWidth <= innerWidth')
      if([1440,390].includes(width)) {const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`${output}/${path.endsWith('/editar')?'editor':'list'}-${width}.png`,Buffer.from(shot.data,'base64'))}
    }
  }
  assert.deepEqual(errors,[]);checks.push('Sem exceções JavaScript')
  await writeFile(`${output}/results.json`,JSON.stringify({passed:checks.length,checks},null,2))
  console.log(JSON.stringify({passed:checks.length,output},null,2))
} finally {socket?.close();browser.kill('SIGTERM');await pool.end()}
