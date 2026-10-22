// Fluxo local completo. Frete/pagamento são fixtures explícitas; não homologa provedores.
import assert from 'node:assert/strict'
import { assertLocalDatabaseUrl } from '../server/src/db/local-database.js'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import net from 'node:net'
import { mkdir, writeFile } from 'node:fs/promises'

const target = assertLocalDatabaseUrl(process.env.FORMA_TEST_DATABASE_URL, { testOnly: true })
process.env.DATABASE_URL = target.href
const { pool } = await import('../server/src/db/pool.js')
const { readCart } = await import('../server/src/modules/cart/cart.service.js')
const { getOwnedAddress } = await import('../server/src/modules/shipping/shipping.service.js')
const { cartFingerprint, addressFingerprint } = await import('../server/src/modules/shipping/shipping.provider.js')
const { applyVerifiedPayment } = await import('../server/src/modules/payments/payments.service.js')
const { dispatchEmailOutbox } = await import('../server/src/modules/notifications/email.service.js')
const { provisionDemoAdmin, demoAdmin } = await import('../server/src/db/demo-admin.js')
const origin = process.env.FORMA_BROWSER_ORIGIN ?? 'http://127.0.0.1:5187'
const apiOrigin = process.env.FORMA_BROWSER_API ?? 'http://127.0.0.1:3337'
const output = '.tmp/demo-browser'
await mkdir(output, { recursive: true })
const captured = []
const smtp = net.createServer(socket => {
  let buffer = '', lines = [], inData = false
  socket.setEncoding('utf8'); socket.write('220 FORMA SMTP de captura local\r\n')
  socket.on('error', () => {})
  socket.on('data', chunk => {
    buffer += chunk
    while (buffer.includes('\r\n')) {
      const index = buffer.indexOf('\r\n'), line = buffer.slice(0,index); buffer = buffer.slice(index+2)
      if (inData) {
        if (line === '.') { captured.push(lines.join('\r\n')); lines = []; inData = false; socket.write('250 captured\r\n') }
        else lines.push(line)
      } else if (/^DATA/.test(line)) { inData = true; socket.write('354 send\r\n') }
      else if (/^QUIT/.test(line)) { socket.end('221 bye\r\n') }
      else socket.write('250 ok\r\n')
    }
  })
})
smtp.listen(0,'127.0.0.1'); await once(smtp,'listening')
Object.assign(process.env, { FORMA_EMAIL_MODE:'smtp', FORMA_SMTP_HOST:'127.0.0.1', FORMA_SMTP_PORT:String(smtp.address().port), FORMA_SMTP_SECURE:'none' })
delete process.env.FORMA_SMTP_USER; delete process.env.FORMA_SMTP_PASS
const browser = spawn(process.env.FORMA_BROWSER ?? '/usr/bin/brave', ['--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--remote-debugging-port=9242',`--user-data-dir=/tmp/forma-demo-browser-${process.pid}`,'about:blank'], { stdio:'ignore' })
const pause = ms => new Promise(r => setTimeout(r,ms))
const pending = new Map(), checks = [], errors = []
let socket, sequence = 0, fixtureReply
const send = (method,params={}) => new Promise((resolve,reject) => {
  const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout CDP ${method}`)) },15000)
  pending.set(id,{resolve,reject,timer}); socket.send(JSON.stringify({id,method,params}))
})
const evaluate = async expression => {
  const r = await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
  return r.result.value
}
async function waitFor(expression) {
  for(let i=0;i<120;i++) { if(await evaluate(`Boolean(${expression})`).catch(()=>false)) return; await pause(100) }
  throw new Error(`Não apareceu: ${expression}. Tela: ${await evaluate('document.body.innerText')}`)
}
async function navigate(path) { await send('Page.navigate',{url:origin+path}); await pause(250); await waitFor('document.querySelector("main h1")') }
const clickText = text => evaluate(`Array.from(document.querySelectorAll('main button,main a')).find(el=>el.textContent.trim()===${JSON.stringify(text)})?.click()`)
const fill = (id,value) => evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`)
const check = async (label,expression) => { assert.ok(await evaluate(expression),label); checks.push(label) }
const submit = id => evaluate(`document.getElementById(${JSON.stringify(id)}).closest('form').requestSubmit()`)
async function screenshot(name) { const r = await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}); await writeFile(`${output}/${name}.png`,Buffer.from(r.data,'base64')) }
try {
  let pages
  for(let i=0;i<100;i++) { try { pages = await (await fetch('http://127.0.0.1:9242/json')).json(); break } catch { await pause(100) } }
  assert.ok(pages,'Navegador não iniciou')
  socket = new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl)
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
  socket.onmessage = event => {
    const m=JSON.parse(event.data),h=pending.get(m.id)
    if(h) { pending.delete(m.id);clearTimeout(h.timer);if(m.error)h.reject(m.error);else h.resolve(m.result) }
    if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)
    if(m.method==='Fetch.requestPaused') {
      const action = m.params.request.method==='OPTIONS' ? send('Fetch.continueRequest',{requestId:m.params.requestId}) : send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:origin}],body:fixtureReply})
      action.catch(e=>errors.push(String(e)))
    }
  }
  await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true})
  for(const width of [1440,390]) {
    console.error('Fluxo completo',width)
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500})
    await navigate('/login');await evaluate('localStorage.clear()');await navigate('/checkout')
    await check(`Checkout exige conta (${width})`,`!document.getElementById('checkout-address') && document.body.innerText.includes('Entre na sua conta')`)
    await navigate('/cadastro')
    await check(`Opt-in inicia desmarcado (${width})`,`!document.querySelector('input[name=promo]').checked`)
    const email=`journey-${crypto.randomUUID()}@example.test`
    for(const [id,value] of Object.entries({'register-name':'Aluno FORMA','register-email':email,'register-password':'FormaTeste2026!','register-confirm-password':'FormaTeste2026!'})) await fill(id,value)
    await submit('register-name');await waitFor(`location.pathname==='/minha-conta' && document.querySelector('.account-stats')`)
    checks.push(`Cadastro pelo formulário (${width})`)
    const sessionToken = await evaluate(`localStorage.getItem('forma:apiToken')`)
    const userId=(await pool.query('SELECT id FROM users WHERE email=$1',[email])).rows[0].id
    await navigate('/administracao/pedidos');await waitFor(`!location.pathname.startsWith('/administracao')`);checks.push(`Cliente recusado no painel (${width})`)
    await navigate('/minha-conta/listas');await waitFor(`Array.from(document.querySelectorAll('main button')).some(b=>b.textContent==='Nova lista')`)
    await clickText('Nova lista');await fill('list-name','Seleção para aula');await submit('list-name');await waitFor(`document.querySelector('.saved-item a')`)
    const listPath=await evaluate(`document.querySelector('.saved-item a').getAttribute('href')`)
    const productId='f04a0000-0000-4000-8000-000000000002'
    await navigate(`/produto/${productId}`);await waitFor(`document.getElementById('product-list')?.options.length>1`)
    await clickText('Salvar nos favoritos ♥');await waitFor(`document.body.innerText.includes('Salva nos favoritos')`)
    await evaluate(`(()=>{const s=document.getElementById('product-list');s.value=s.options[1].value;s.dispatchEvent(new Event('change',{bubbles:true}));})()`)
    await clickText('Salvar na lista');await waitFor(`document.body.innerText.includes('Peça salva na lista')`)
    await navigate('/favoritos');await waitFor(`document.querySelector('.saved-item h3')?.textContent==='Oversized Traço Preto'`)
    await waitFor(`document.querySelector('.saved-item img')?.naturalWidth>0`)
    await check(`Favorito em recarga direta tem nome e imagem (${width})`,`document.querySelector('.saved-item img')?.naturalWidth>0`)
    await navigate(listPath);await waitFor(`document.querySelector('.saved-item h3')?.textContent==='Oversized Traço Preto'`);checks.push(`Lista em recarga direta resolve produto (${width})`)
    await navigate('/minha-conta/enderecos');await waitFor(`Array.from(document.querySelectorAll('main button')).some(b=>b.textContent==='Novo endereço')`)
    await clickText('Novo endereço')
    for(const [field,value] of Object.entries({label:'Casa',recipient:'Aluno FORMA',cep:'50000000',street:'Rua da Demonstração',number:'100',district:'Centro',city:'Recife',state:'PE'}))await fill('address-'+field,value)
    await submit('address-label');await waitFor(`document.querySelector('.saved-item')?.textContent.includes('Rua da Demonstração')`);checks.push(`Endereço salvo pelo formulário (${width})`)
    await navigate('/minha-conta/cartoes');await waitFor(`document.body.innerText.includes('aguardam configuração do sandbox')`)
    await check(`Cartões exibem bloqueio de configuração real (${width})`,`Array.from(document.querySelectorAll('main button')).find(b=>b.textContent==='Adicionar cartão').disabled`)
    await navigate(`/produto/${productId}`);await waitFor(`document.querySelector('.product-size-select select')`)
    await evaluate(`(()=>{const s=document.querySelector('.product-size-select select');s.value='M';s.dispatchEvent(new Event('change',{bubbles:true}));})()`)
    await clickText('Adicionar ao carrinho →');await navigate('/carrinho');await waitFor(`document.querySelector('.cart-item-card') && !document.body.innerText.includes('Atualizando preços')`)
    await fill('cart-coupon','FORMA10');await clickText('Aplicar');await waitFor(`document.body.innerText.includes('Cupom de 10% aplicado')`)
    await waitFor(`document.querySelector('.summary-values')?.textContent.includes('98,91') && !document.body.innerText.includes('Atualizando preços')`)
    await check(`Carrinho e cupom em centavos (${width})`,`document.querySelector('.summary-values').textContent.includes('98,91')`)
    await clickText('Continuar para o checkout →');await waitFor(`location.pathname==='/checkout' && document.getElementById('checkout-address')?.value`)
    const address=await getOwnedAddress(userId,await evaluate(`document.getElementById('checkout-address').value`))
    const quoteId=crypto.randomUUID(),cart=await readCart([{productId,size:'M',quantity:1}])
    const services=[{id:'fixture-browser',name:'Frete fixture local — sem consulta externa',priceCentavos:1000,deliveryDays:3}]
    await pool.query(`INSERT INTO shipping_quotes(id,user_id,address_id,address_fingerprint,cart_fingerprint,services,expires_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,now()+interval '10 minutes')`,[quoteId,userId,address.id,addressFingerprint(address),cartFingerprint(cart.items),JSON.stringify(services)])
    fixtureReply=Buffer.from(JSON.stringify({quoteId,services,expiresAt:new Date(Date.now()+600000).toISOString()})).toString('base64')
    await send('Fetch.enable',{patterns:[{urlPattern:`${apiOrigin}/api/frete/cotacoes`,requestStage:'Request'}]})
    await clickText('Calcular frete');await waitFor(`document.querySelector('.shipping-option input')`)
    await evaluate(`document.querySelector('.shipping-option input').click()`)
    await waitFor(`Array.from(document.querySelectorAll('main button')).some(b=>b.textContent==='Confirmar pedido →'&&!b.disabled)`)
    await send('Fetch.disable');await clickText('Confirmar pedido →');await waitFor(`document.body.innerText.includes('Obrigado pela sua compra')`)
    const order=(await pool.query('SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',[userId])).rows[0]
    assert.equal(Number(order.total_centavos),10891);checks.push(`Pedido real criado a partir de cotação fixture (${width})`)
    await clickText('Pagar com Mercado Pago (teste)');await waitFor(`document.body.innerText.includes('Configure um Access Token de teste')`);checks.push(`Checkout Pro informa ausência de credencial (${width})`)
    const paymentId=String(BigInt(Date.now())*1000n+BigInt(width)),preferenceId=`fixture-browser-${order.id}`
    await pool.query(`INSERT INTO payment_attempts(id,order_id,preference_id,status,amount_centavos,sandbox_checkout_url) VALUES ($1,$2,$3,'criada',$4,'https://sandbox.example.test/fixture')`,[crypto.randomUUID(),order.id,preferenceId,order.total_centavos])
    const result=await applyVerifiedPayment({id:paymentId,external_reference:order.id,preference_id:preferenceId,transaction_amount:Number(order.total_centavos)/100,currency_id:'BRL',live_mode:false,status:'approved',status_detail:'fixture'})
    assert.equal(result.status,'aprovada')
    await dispatchEmailOutbox()
    assert.equal(captured.filter(body=>body.includes(`Subject: Compra FORMA ${order.id} confirmada`)).length,1);checks.push(`Pagamento fixture confirmado e SMTP local capturado (${width})`)
    await navigate(`/checkout?order_id=${order.id}`);await waitFor(`document.body.innerText.includes('Pagamento aprovado')`)
    await check(`Retorno apresenta estado persistido (${width})`,`!document.body.innerText.includes('· aguardando pagamento.')`)
    await navigate('/minha-conta/pedidos');await waitFor(`document.body.innerText.includes('Pagamento confirmado')`)
    await navigate(`/minha-conta/pedidos/${order.id}`);await waitFor(`document.body.innerText.includes('Oversized Traço Preto')`)
    await screenshot(`order-${width}`)
    await check(`Histórico sem overflow (${width})`,`document.documentElement.scrollWidth<=innerWidth`)
    // Credencial demonstrativa no banco de teste; autenticação normal pela tela.
    await provisionDemoAdmin(pool)
    await evaluate('localStorage.removeItem("forma:apiToken")');await navigate('/login')
    await fill('login-email',demoAdmin.email);await fill('login-password',demoAdmin.password);await submit('login-email')
    await waitFor(`location.pathname==='/minha-conta'`);await navigate('/administracao/pedidos')
    await waitFor(`document.body.innerText.includes(${JSON.stringify(order.id)})`)
    await screenshot(`admin-orders-${width}`);await check(`Admin consulta pedido e estados sem overflow (${width})`,`document.documentElement.scrollWidth<=innerWidth`)
    assert.ok(sessionToken) // nunca impresso ou persistido pelo teste
  }
  assert.deepEqual(errors,[])
  await writeFile(`${output}/results.json`,JSON.stringify({passed:checks.length,checks,providers:'fixtures de frete/pagamento; SMTP de captura local; nenhum sandbox externo'},null,2))
  console.log(JSON.stringify({passed:checks.length,output,capturedMessages:captured.length}))
} finally {
  socket?.close();browser.kill('SIGTERM');await new Promise(resolve=>smtp.close(resolve));await pool.end()
}
