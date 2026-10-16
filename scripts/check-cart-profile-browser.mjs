// Requer API e Vite ligados ao banco descartável; nunca usar no banco habitual.
// FORMA_TEST_DATABASE_URL=postgresql://.../forma_catalog_test node scripts/check-cart-profile-browser.mjs
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'

const databaseUrl = process.env.FORMA_TEST_DATABASE_URL
const target = new URL(databaseUrl)
assert.ok(['localhost', '127.0.0.1'].includes(target.hostname) && /test|audit/.test(target.pathname))
process.env.DATABASE_URL = databaseUrl
const { pool } = await import('../server/src/db/pool.js')
const origin = process.env.FORMA_BROWSER_ORIGIN ?? 'http://127.0.0.1:5186'
const apiOrigin = process.env.FORMA_BROWSER_API ?? 'http://127.0.0.1:3336'
const output = '.tmp/cart-profile-browser'
await mkdir(output, { recursive: true })
const browser = spawn(process.env.FORMA_BROWSER ?? '/opt/brave-bin/brave', ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--remote-debugging-port=9241', `--user-data-dir=/tmp/forma-cart-profile-browser-${process.pid}`, 'about:blank'], { stdio: 'ignore' })
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
    try { pages = await (await fetch('http://127.0.0.1:9241/json')).json(); break } catch { await pause(100) }
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
  const requests=[]
  const oldMessage=socket.onmessage
  socket.onmessage=event=>{const m=JSON.parse(event.data);if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);oldMessage(event)}
  const request=async(path,{method='GET',body,token}={})=>{
    const r=await fetch(`${apiOrigin}/api${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)})
    return {status:r.status,data:r.status===204?null:await r.json()}
  }
  const register=async()=> (await request('/auth/registrar',{method:'POST',body:{name:'Conta navegador',email:`cart-browser-${crypto.randomUUID()}@example.test`,password:'antes123'}})).data
  const account=await register(),other=await register()
  const otherSession=(await request('/auth/entrar',{method:'POST',body:{email:account.user.email,password:'antes123'}})).data
  const id=crypto.randomUUID()
  await pool.query(`INSERT INTO products (id,name,description,color,is_printed,price_cents,promo_price_cents,weight_g,length_cm,width_cm,height_cm) VALUES ($1,'Oversized navegador carrinho','Fixture local de teste','preta',true,12000,10000,250,30,25,3)`,[id])
  await pool.query("INSERT INTO product_sizes (product_id,size,stock) VALUES ($1,'M',2),($1,'G',0)",[id])
  await pool.query("INSERT INTO product_images (product_id,image_url,is_main) VALUES ($1,'/products/demo-2.svg',true)",[id])
  const fill=async(id,value)=>evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`)
  const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
  const cartReady=()=>waitFor(`!document.body.innerText.includes('Atualizando preços e estoque...') && !!document.querySelector('.cart-item-card') && Array.from(document.querySelectorAll('main button')).some(b=>b.textContent==='Atualizar carrinho'&&!b.disabled)`)
  const quantity=()=>evaluate(`document.querySelector('.quantity-control span')?.textContent`)
  await send('Page.navigate',{url:origin});await pause(200)
  await evaluate(`localStorage.setItem('forma:apiToken',${JSON.stringify(account.token)});localStorage.removeItem('forma:cart')`)
  await navigate(`/produto/${id}`);await waitFor(`document.querySelector('.product-size-select select')`)
  await evaluate(`(()=>{const s=document.querySelector('.product-size-select select');s.value='M';s.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  await clickText('Adicionar ao carrinho →')
  await navigate('/carrinho');await cartReady();await imagesLoaded()
  await check('Imagem e preço promocional chegam da API',`document.querySelector('.cart-item-image img').src.endsWith('/products/demo-2.svg') && document.body.innerText.includes('100,00')`)
  await click('[aria-label="Aumentar quantidade"]');await cartReady()
  assert.equal(await quantity(),'2')
  await check('Aumentar respeita estoque disponível',`document.querySelector('[aria-label="Aumentar quantidade"]').disabled`)
  await click('[aria-label="Diminuir quantidade"]');await cartReady();assert.equal(await quantity(),'1')
  checks.push('Diminuir quantidade persiste')
  await fill('cart-coupon','ERRADO');await clickText('Aplicar');await waitFor(`document.body.innerText.includes('Cupom inválido')`)
  await check('Cupom inválido mantém itens e permite correção',`document.querySelectorAll('.cart-item-card').length===1`)
  await fill('cart-coupon','FORMA10');await clickText('Aplicar');await waitFor(`document.body.innerText.includes('Cupom de 10% aplicado')`);await cartReady()
  await check('Cupom calcula total em centavos',`document.querySelector('.summary-values').textContent.includes('90,00')`)
  await click('[aria-label="Aumentar quantidade"]');await cartReady()
  await check('Quantidade recalcula desconto sem perder cupom',`document.querySelector('.summary-values').textContent.includes('180,00') && document.body.innerText.includes('FORMA10')`)
  await send('Page.reload',{ignoreCache:true});await pause(250);await cartReady();await imagesLoaded()
  await check('Recarga mantém quantidade, cupom, total e imagem',`document.querySelector('.quantity-control span').textContent==='2' && document.querySelector('.summary-values').textContent.includes('180,00') && document.querySelector('.cart-item-image img').naturalWidth>0`)
  await pool.query('UPDATE products SET promo_price_cents=9000 WHERE id=$1',[id])
  await clickText('Atualizar carrinho');await waitFor(`document.body.innerText.includes('Aceitar preços atualizados')`)
  await check('Preço alterado exige aceite antes de continuar',`document.body.innerText.includes('de R$') && Array.from(document.querySelectorAll('main button')).find(b=>b.textContent.includes('Continuar para o checkout')).disabled`)
  await clickText('Aceitar preços atualizados');await cartReady()
  await check('Aceite recalcula promoção e desconto',`!document.body.innerText.includes('Aceitar preços atualizados') && document.querySelector('.summary-values').textContent.includes('162,00')`)
  await pool.query("UPDATE product_sizes SET stock=1 WHERE product_id=$1 AND size='M'",[id])
  await clickText('Continuar para o checkout →');await waitFor(`document.body.innerText.includes('O estoque mudou')`)
  await check('Pré-avançar detecta redução de estoque sem ir ao checkout',`location.pathname==='/carrinho' && Array.from(document.querySelectorAll('main button')).find(b=>b.textContent.includes('Continuar para o checkout')).disabled`)
  await click('[aria-label="Diminuir quantidade"]');await cartReady();assert.equal(await quantity(),'1')
  await check('Reduzir ajusta ao saldo e mantém limite',`document.querySelector('[aria-label="Aumentar quantidade"]').disabled`)
  // O endereço é fictício. Não haverá chamada ao provedor de frete.
  await request('/conta/enderecos',{method:'POST',token:account.token,body:{label:'Casa',recipient:'Teste',street:'Rua fictícia',number:'1',district:'Centro',city:'Recife',state:'PE',cep:'50000000'}})
  await clickText('Continuar para o checkout →');await waitFor(`location.pathname==='/checkout' && document.getElementById('checkout-address')`)
  await waitFor(`Array.from(document.querySelectorAll('main button')).some(b=>b.textContent==='Calcular frete'&&!b.disabled)`)
  const freteBefore=requests.filter(u=>u.endsWith('/api/frete/cotacoes')).length
  await pool.query("UPDATE product_sizes SET stock=0 WHERE product_id=$1 AND size='M'",[id])
  await clickText('Calcular frete');await waitFor(`document.body.innerText.includes('Revise') || document.body.innerText.includes('revise')`)
  assert.equal(requests.filter(u=>u.endsWith('/api/frete/cotacoes')).length,freteBefore);checks.push('Checkout reconfere estoque antes de chamar cotação')
  // Resposta de cotação controlada e registro SQL fictício: não valida frete externo.
  await pool.query("UPDATE product_sizes SET stock=2 WHERE product_id=$1 AND size='M'",[id])
  await clickText('Atualizar pedido');await waitFor(`Array.from(document.querySelectorAll('main button')).some(b=>b.textContent==='Calcular frete'&&!b.disabled)`)
  const {readCart:serverCart}=await import('../server/src/modules/cart/cart.service.js')
  const {cartFingerprint,addressFingerprint}=await import('../server/src/modules/shipping/shipping.provider.js')
  const {getOwnedAddress}=await import('../server/src/modules/shipping/shipping.service.js')
  const selectedAddress=await getOwnedAddress(account.user.id,await evaluate('document.getElementById("checkout-address").value'))
  const quoteId=crypto.randomUUID(),quoted=await serverCart([{productId:id,size:'M',quantity:1}])
  const services=[{id:'fixture-browser',name:'Frete local simulado — teste',priceCentavos:1000,deliveryDays:3}]
  await pool.query(`INSERT INTO shipping_quotes (id,user_id,address_id,address_fingerprint,cart_fingerprint,services,expires_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,now()+interval '10 minutes')`,[quoteId,account.user.id,selectedAddress.id,addressFingerprint(selectedAddress),cartFingerprint(quoted.items),JSON.stringify(services)])
  const fixtureReply=Buffer.from(JSON.stringify({quoteId,services,expiresAt:new Date(Date.now()+600000).toISOString()})).toString('base64')
  const handleMessage=socket.onmessage
  socket.onmessage=event=>{const m=JSON.parse(event.data);handleMessage(event);if(m.method==='Fetch.requestPaused' && m.params.request.method==='OPTIONS')send('Fetch.continueRequest',{requestId:m.params.requestId}).catch(error=>errors.push(String(error)));else if(m.method==='Fetch.requestPaused')send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:origin}],body:fixtureReply}).catch(error=>errors.push(String(error)))}
  await send('Fetch.enable',{patterns:[{urlPattern:`${apiOrigin}/api/frete/cotacoes`,requestStage:'Request'}]})
  await clickText('Calcular frete');await waitFor('document.querySelector(".shipping-option input")')
  await click('.shipping-option input');await waitFor(`Array.from(document.querySelectorAll('main button')).some(b=>b.textContent==='Confirmar pedido →'&&!b.disabled)`)
  await send('Fetch.disable');socket.onmessage=handleMessage
  const checkoutBefore=requests.filter(u=>u.endsWith('/api/checkout')).length
  await pool.query('UPDATE products SET promo_price_cents=8000 WHERE id=$1',[id])
  await clickText('Confirmar pedido →');await waitFor(`document.body.innerText.includes('Os preços mudaram')`)
  assert.equal(requests.filter(u=>u.endsWith('/api/checkout')).length,checkoutBefore)
  checks.push('Antes de confirmar pedido, preço alterado bloqueia envio mesmo com cotação simulada selecionada')
  await pool.query('UPDATE products SET promo_price_cents=9000 WHERE id=$1',[id]);await pool.query("UPDATE product_sizes SET stock=0 WHERE product_id=$1 AND size='M'",[id])
  await navigate('/carrinho');await cartReady()
  await check('Item zerado mantém imagem e remoção',`!!document.querySelector('.cart-item-image img') && document.body.innerText.includes('Disponível: 0')`)
  await pool.query('UPDATE products SET is_active=false WHERE id=$1',[id]);await clickText('Atualizar carrinho');await cartReady()
  await check('Produto desativado fica visível para remover e bloqueia finalização',`document.body.innerText.includes('Peça ou tamanho indisponível') && !!Array.from(document.querySelectorAll('main button')).find(b=>b.textContent==='Remover')`)
  await clickText('Remover');await waitFor(`document.body.innerText.includes('Seu carrinho está vazio')`)
  await check('Remover último item limpa cupom e total',`JSON.parse(localStorage.getItem('forma:cart')).couponCode==='' && document.querySelectorAll('.cart-item-card').length===0`)
  await send('Page.reload',{ignoreCache:true});await pause(250);await waitFor(`document.body.innerText.includes('Seu carrinho está vazio')`)
  checks.push('Carrinho vazio sobrevive à recarga')
  // Erro de rede não deve prender o usuário com itens que não consegue remover.
  await pool.query('UPDATE products SET is_active=true WHERE id=$1',[id]);await pool.query("UPDATE product_sizes SET stock=2 WHERE product_id=$1 AND size='M'",[id])
  await evaluate(`localStorage.setItem('forma:cart',JSON.stringify({items:[{productId:${JSON.stringify(id)},size:'M',quantity:1,priceCentavos:9000}],couponCode:''}))`)
  await send('Network.setBlockedURLs',{urls:[`${apiOrigin}/api/cart/resumo`]})
  await navigate('/carrinho');await waitFor(`document.body.innerText.includes('Não foi possível conectar')`)
  await check('Falha da API bloqueia avanço e mantém remoção',`Array.from(document.querySelectorAll('main button')).find(b=>b.textContent.includes('Continuar para o checkout')).disabled && !!Array.from(document.querySelectorAll('main button')).find(b=>b.textContent==='Remover')`)
  await send('Network.setBlockedURLs',{urls:[]});await clickText('Atualizar carrinho');await cartReady();checks.push('Repetir consulta recupera carrinho após erro')
  await navigate('/minha-conta/dados');await waitFor('document.getElementById("account-name")')
  await fill('account-name','Nome no navegador');await click('#account-profile button[type=submit]');await waitFor(`document.body.innerText.includes('Dados atualizados com sucesso')`)
  await check('Nome continua editável pelo fluxo existente',`document.body.innerText.includes('Nome no navegador')`)
  await fill('account-email-email','invalido');await fill('account-email-currentPassword','antes123');await click('#account-email button[type=submit]');await waitFor(`document.querySelector('#account-email-email-error')`)
  checks.push('E-mail inválido recebe erro por campo')
  await fill('account-email-email',other.user.email);await click('#account-email button[type=submit]');await waitFor(`document.querySelector('#account-email').textContent.includes('já está cadastrado')`)
  checks.push('E-mail duplicado mantém formulário corrigível')
  const nextEmail=`alterado-${crypto.randomUUID()}@example.test`
  await fill('account-email-email',nextEmail);await fill('account-email-currentPassword','errada');await click('#account-email button[type=submit]');await waitFor(`document.querySelector('#account-email-currentPassword-error')?.textContent.includes('incorreta')`)
  checks.push('Troca de e-mail exige senha atual correta')
  await fill('account-email-currentPassword','antes123');await click('#account-email button[type=submit]');await waitFor(`document.querySelector('#account-email').textContent.includes('E-mail alterado com sucesso')`)
  assert.equal((await request('/auth/eu',{token:otherSession.token})).status,401)
  await check('Troca mantém sessão atual e limpa senha do formulário',`document.querySelector('.account-summary').textContent.includes(${JSON.stringify(nextEmail)}) && document.getElementById('account-email-currentPassword').value===''`)
  await send('Page.reload',{ignoreCache:true});await pause(250);await waitFor(`document.getElementById('account-email')?.textContent.includes(${JSON.stringify(nextEmail)})`)
  checks.push('Novo e-mail persiste após recarga e outras sessões são revogadas')
  await fill('account-password-currentPassword','antes123');await fill('account-password-newPassword','depois123');await fill('account-password-confirmPassword','divergente');await click('#account-password button[type=submit]');await waitFor(`document.querySelector('#account-password-confirmPassword-error')`)
  checks.push('Senha divergente é rejeitada')
  await fill('account-password-currentPassword','errada');await fill('account-password-confirmPassword','depois123');await click('#account-password button[type=submit]');await waitFor(`document.querySelector('#account-password-currentPassword-error')`)
  checks.push('Troca de senha rejeita senha atual incorreta')
  await fill('account-password-currentPassword','antes123');await click('#account-password button[type=submit]');await waitFor(`document.querySelector('#account-password').textContent.includes('Senha alterada com sucesso')`)
  await check('Senhas não persistem nos campos ou localStorage',`Array.from(document.querySelectorAll('#account-password input')).every(i=>i.value==='') && !JSON.stringify(localStorage).includes('depois123') && !JSON.stringify(localStorage).includes('antes123')`)
  await send('Page.reload',{ignoreCache:true});await pause(250);await waitFor('document.getElementById("account-password")');checks.push('Sessão atual permanece válida após trocar senha e recarregar')
  assert.equal((await request('/auth/entrar',{method:'POST',body:{email:nextEmail,password:'antes123'}})).status,401)
  assert.equal((await request('/auth/entrar',{method:'POST',body:{email:nextEmail,password:'depois123'}})).status,200)
  checks.push('Login aceita nova credencial e rejeita senha anterior')
  for(const width of [1440,768,390,320]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false})
    for(const path of ['/carrinho','/minha-conta/dados']) {
      await navigate(path);await waitFor(path==='/carrinho'?`!!document.querySelector('.cart-item-card')`:`!!document.getElementById('account-password')`)
      await check(`Sem overflow ${path} em ${width}px`,'document.documentElement.scrollWidth<=innerWidth')
      if([1440,390].includes(width)) {const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`${output}/${path==='/carrinho'?'cart':'profile'}-${width}.png`,Buffer.from(shot.data,'base64'))}
    }
  }
  assert.deepEqual(errors,[]);checks.push('Sem exceções JavaScript')
  await writeFile(`${output}/results.json`,JSON.stringify({passed:checks.length,checks},null,2));console.log(JSON.stringify({passed:checks.length,output},null,2))
} finally {socket?.close();browser.kill('SIGTERM');await pool.end()}
