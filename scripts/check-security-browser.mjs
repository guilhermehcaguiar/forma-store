// Contrato do navegador + HTTP/SQL reais. SDK, pagamentos e cotação são fixtures explícitas.
// Nenhum PAN/CVV, token temporário real ou credencial externa é usado/persistido.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, readFile, readdir, writeFile, unlink } from 'node:fs/promises'
import { assertLocalDatabaseUrl, connectLocalDatabase } from '../server/src/db/local-database.js'

const target=assertLocalDatabaseUrl(process.env.FORMA_TEST_DATABASE_URL,{testOnly:true})
const admin=await connectLocalDatabase(target.href,{testOnly:true})
const dbName=`forma_security_browser_test_${Date.now()}`
await admin.query(`CREATE DATABASE "${dbName}"`)
target.pathname='/'+dbName;process.env.DATABASE_URL=target.href;process.env.CORS_ORIGIN='http://127.0.0.1:5189'
const {pool}=await import('../server/src/db/pool.js')
for(const file of (await readdir('server/src/db/migrations')).filter(f=>f.endsWith('.sql')).sort()) await pool.query(await readFile(`server/src/db/migrations/${file}`,'utf8'))
const {createApp}=await import('../server/src/app.js')
const {readCart}=await import('../server/src/modules/cart/cart.service.js')
const {addressFingerprint,cartFingerprint}=await import('../server/src/modules/shipping/shipping.provider.js')
const origin='http://127.0.0.1:5189',checks=[],files=[]
Object.assign(process.env,{MERCADOPAGO_PUBLIC_URL:'https://fixture.example.test',MERCADOPAGO_WEBHOOK_SECRET:randomUUID(),CORS_ORIGIN:origin,MERCADOPAGO_MODE:'sandbox',MERCADOPAGO_TEST_ACCESS_TOKEN:randomUUID(),MERCADOPAGO_PUBLIC_KEY:`TEST-${randomUUID()}`})
let providerCardId,serial=0,paymentSerial=0
const cardGateway={
  createCustomer:async user=>({id:`fixture-customer-${user.id}`}),
  addCard:async()=>({id:providerCardId=`fixture-card-${++serial}`,live_mode:false,payment_method:{id:'master'},last_four_digits:'0000',expiration_month:12,expiration_year:2030,cardholder:{name:'FIXTURE'}}),
  removeCard:async()=>({}),getToken:async()=>({card_id:providerCardId,status:'active',live_mode:false}),
  pay:async body=>({id:String(BigInt(Date.now())*1000n+BigInt(++paymentSerial)),external_reference:body.external_reference,transaction_amount:body.transaction_amount,payer:{id:body.payer.id},card:{id:providerCardId},currency_id:'BRL',live_mode:false,status:'approved'}),
}
const apiServer=createApp({cardGateway}).listen(0,'127.0.0.1');await once(apiServer,'listening')
const api=`http://127.0.0.1:${apiServer.address().port}/api`
process.env.VITE_API_URL=api
const {createServer}=await import('vite')
const vite=await createServer({server:{port:5189,strictPort:true}});await vite.listen()
const browser=spawn(process.env.FORMA_BROWSER??'/usr/bin/brave',['--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--remote-debugging-port=9244',`--user-data-dir=/tmp/forma-security-browser-${process.pid}`,'about:blank'],{stdio:'ignore'})
const pause=ms=>new Promise(r=>setTimeout(r,ms)),pending=new Map()
let socket,sequence=0
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error(`Timeout ${method}`))},15000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}))})
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error('Falha no código do teste no navegador');return r.result.value}
const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(`Boolean(${expression})`).catch(()=>false))return;await pause(100)}throw Error(`Timeout: ${expression}`)}
const navigate=async path=>{await send('Page.navigate',{url:origin+path});await waitFor('document.querySelector("main h1")')}
const check=async(label,expression)=>{assert.ok(await evaluate(expression),label);checks.push(label)}
// Todas as chamadas de ataque seguintes são fetch executados dentro do navegador.
const request=(path,{method='GET',who='a',body}={})=>evaluate(`window.attack(${JSON.stringify(path)},${JSON.stringify(method)},${JSON.stringify(who)},${JSON.stringify(body)})`)
const click=text=>evaluate(`Array.from(document.querySelectorAll('main button')).find(e=>e.textContent.trim()===${JSON.stringify(text)})?.click()`)
try {
  let pages
  for(let i=0;i<100;i++){try{pages=await(await fetch('http://127.0.0.1:9244/json')).json();break}catch{await pause(100)}}
  assert.ok(pages)
  socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl)
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
  socket.onmessage=event=>{const m=JSON.parse(event.data),h=pending.get(m.id);if(h){pending.delete(m.id);clearTimeout(h.timer);if(m.error)h.reject(m.error);else h.resolve(m.result)}}
  await send('Runtime.enable');await send('Page.enable')
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.__cardRequests=[];window.__cardResponses=[];
    const originalFetch=window.fetch;
    window.fetch=(url,options)=>{if(String(url).includes('/conta/cartoes')&&options?.body)window.__cardRequests.push(JSON.parse(options.body));return originalFetch(url,options).then(async r=>{if(String(url).includes('/conta/cartoes')&&options?.body){const data=await r.clone().json().catch(()=>({}));window.__cardResponses.push({status:r.status,code:data.error?.code})}return r})};
    // Fixture de contrato: os campos são iframes, sem entrada de número/CVV neste teste.
    window.MercadoPago=class { fields={create:()=>({mount:id=>{const el=document.getElementById(id),frame=document.createElement('iframe');frame.title='SDK FIXTURE';el.appendChild(frame);return {unmount(){frame.remove()}}}}),createCardToken:async()=>({id:crypto.randomUUID().replaceAll('-','')})} };
  `})
  await navigate('/login')
  await evaluate(`window.api=${JSON.stringify(api)};window.accounts={};window.attack=async(path,method='GET',who='a',body)=>{const r=await fetch(window.api+path,{method,redirect:'manual',headers:{'Content-Type':'application/json',...(accounts[who]?{Authorization:'Bearer '+accounts[who].token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:r.headers.get('content-type')?.includes('application/json')?await r.json():null}};`)
  for(const who of ['a','b']) {
    await evaluate(`(async()=>{const r=await attack('/auth/registrar','POST','none',{name:'Cliente navegador',email:crypto.randomUUID()+'@example.test',password:'SenhaFixture2026!',promo:false});accounts.${who}=r.data;return r.status===201})()`).then(ok=>assert.ok(ok))
    const response=await request('/conta/enderecos',{method:'POST',who,body:{label:'Casa',recipient:'Cliente',cep:'50000000',street:'Rua Fixture',number:'1',district:'Centro',city:'Recife',state:'PE',principal:true}})
    await evaluate(`accounts.${who}.address=${JSON.stringify(response.data.address)}`)
  }
  const aId=await evaluate('accounts.a.user.id'),address=await evaluate('accounts.a.address'),bAddress=await evaluate('accounts.b.address')
  const productId=randomUUID()
  await pool.query("INSERT INTO products(id,name,color,price_cents,promo_price_cents,weight_g,length_cm,width_cm,height_cm) VALUES($1,'Peça segurança navegador','azul',10000,8000,250,30,25,3)",[productId])
  await pool.query("INSERT INTO product_sizes(product_id,size,stock) VALUES($1,'M',100)",[productId])
  const items=[{productId,size:'M',quantity:1}],cart=await readCart(items),quoteId=randomUUID()
  await pool.query(`INSERT INTO shipping_quotes(id,user_id,address_id,address_fingerprint,cart_fingerprint,services,expires_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,now()+interval '10 minutes')`,[quoteId,aId,address.id,addressFingerprint(address),cartFingerprint(cart.items),JSON.stringify([{id:'fixture',name:'Frete fixture',priceCentavos:1234}])])
  const payload={items,addressId:address.id,quoteId,serviceId:'fixture',checkoutKey:randomUUID(),couponCode:'FORMA10'}
  for(const width of [1440,390]) {
    console.error('Dimensão',width)
    await pool.query(`INSERT INTO shipping_quotes(id,user_id,address_id,address_fingerprint,cart_fingerprint,services,expires_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,now()+interval '10 minutes') ON CONFLICT(id) DO NOTHING`,[quoteId,aId,address.id,addressFingerprint(address),cartFingerprint(cart.items),JSON.stringify([{id:'fixture',name:'Frete fixture',priceCentavos:1234}])])
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500})
    for(const [label,body,status] of [
      ['quantidade negativa',{...payload,items:[{...items[0],quantity:-1}]},400],
      ['quantidade fracionária',{...payload,items:[{...items[0],quantity:1.5}]},400],
      ['quantidade acima do limite',{...payload,items:[{...items[0],quantity:21}]},400],
      ['cupom forjado',{...payload,couponCode:'CUPOM_FORJADO',discountPercentage:100},400],
      ['frete forjado',{...payload,serviceId:'frete-gratis-forjado',shippingCentavos:0},400],
      ['endereço alheio',{...payload,addressId:bAddress.id},404],
    ]) { assert.equal((await request('/checkout',{method:'POST',body})).status,status,label);checks.push(`${width}: ${label} recusado`) }
    await pool.query('UPDATE product_sizes SET stock=0 WHERE product_id=$1',[productId])
    assert.equal((await request('/checkout',{method:'POST',body:{...payload,stock:999999}})).status,400);checks.push(`${width}: estoque forjado recusado`)
    await pool.query('UPDATE product_sizes SET stock=100 WHERE product_id=$1',[productId])
    const r=await request('/checkout',{method:'POST',body:{...payload,checkoutKey:randomUUID(),totalCentavos:1,discountCentavos:99999,shippingCentavos:0,status:'pago',items:[{...items[0],priceCentavos:1}]}})
    assert.equal(r.status,201,r.data?.error?.code);const order=r.data.order
    assert.equal(order.totalCentavos,8434);assert.equal(order.status,'aguardando_pagamento');checks.push(`${width}: preço/desconto/frete/status recalculados pelo servidor`)
    for(const path of [`/conta/pedidos/${order.id}`,`/pagamentos/pedidos/${order.id}/verificar`]) {
      assert.equal((await request(path,{who:'b',method:path.includes('verificar')?'POST':'GET',body:path.includes('verificar')?{paymentId:'123456'}:undefined})).status,404);checks.push(`${width}: pedido/pagamento de outra conta recusado`)
    }
    await request(`/pagamentos/retorno?order_id=${order.id}&payment_id=123456&status=approved`)
    assert.equal((await request(`/conta/pedidos/${order.id}`)).data.order.status,'aguardando_pagamento');checks.push(`${width}: retorno do navegador não aprova pedido`)
    for(const field of ['cardNumber','cvv']) {
      assert.equal((await request('/checkout',{method:'POST',body:{[field]:'MARCADOR_NAO_SENSIVEL'}})).status,400);checks.push(`${width}: campo bruto ${field} recusado`)
    }
    // Preserve contas apenas na memória do Node enquanto a navegação substitui o documento.
    const accounts=await evaluate('accounts')
    await evaluate(`localStorage.setItem('forma:apiToken',accounts.a.token)`)
    await navigate('/minha-conta/cartoes')
    await waitFor(`Array.from(document.querySelectorAll('main button')).some(b=>b.textContent==='Adicionar cartão'&&!b.disabled)`)
    await click('Adicionar cartão');await waitFor('document.querySelectorAll(".mp-field iframe").length===3')
    await check(`${width}: formulário monta três campos do SDK`, `!document.querySelector('input[name=cardNumber],input[name=cvv],input[name=securityCode]')`)
    await evaluate(`(()=>{for(const [name,value] of [['holder','FIXTURE'],['document','00000000000']]){const el=document.querySelector('input[name='+name+']');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))}document.querySelector('.account-form').requestSubmit()})()`)
    await waitFor(`document.querySelector('.saved-item')&&!document.getElementById('mp-add-cardNumber')&&__cardResponses.some(r=>r.status===201)`)
    await check(`${width}: inclusão envia somente token opaco fixture`, `__cardRequests.length===1&&Object.keys(__cardRequests[0]).join(',')==='token'`)
    const localCard=(await pool.query('SELECT c.id,c.mp_card_id FROM payment_cards c JOIN payment_customers p ON p.id=c.payment_customer_id WHERE p.user_id=$1 ORDER BY c.created_at DESC LIMIT 1',[aId])).rows[0]
    await evaluate(`window.api=${JSON.stringify(api)};window.accounts=${JSON.stringify(accounts)};window.attack=async(path,method='GET',who='a',body)=>{const r=await fetch(api+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+accounts[who].token},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:r.headers.get('content-type')?.includes('application/json')?await r.json():null}}`)
    assert.equal((await request(`/conta/cartoes/${localCard.id}`,{method:'DELETE',who:'b'})).status,404)
    assert.equal((await request(`/conta/cartoes/${localCard.id}/pagar`,{method:'POST',who:'b',body:{orderId:order.id,token:randomUUID()}})).status,404)
    assert.equal((await request('/conta/cartoes',{who:'b'})).data.cards.length,0);checks.push(`${width}: outra conta não lista/exclui/paga com cartão alheio`)
    for (const key of ['MERCADOPAGO_PUBLIC_URL','MERCADOPAGO_WEBHOOK_SECRET']) {
      const value=process.env[key];delete process.env[key]
      await navigate(`/checkout?order_id=${order.id}`)
      await waitFor(`document.body.innerText.includes('Pagamento com cartão salvo aguarda configuração do sandbox.')`)
      await check(`${width}: ${key} ausente oculta cartão salvo e preserva Checkout Pro`, `!document.getElementById('saved-card')&&Array.from(document.querySelectorAll('main button')).some(b=>b.textContent==='Pagar com Mercado Pago (teste)'&&!b.disabled)`)
      process.env[key]=value
    }
    await navigate(`/checkout?order_id=${order.id}`);await waitFor('document.getElementById("saved-card")?.options.length>1')
    await evaluate(`(()=>{const s=document.getElementById('saved-card');s.value=${JSON.stringify(localCard.id)};s.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await waitFor('document.querySelector("#mp-saved-cvv iframe")');await waitFor(`Array.from(document.querySelectorAll('main button')).some(b=>b.textContent==='Pagar com cartão salvo (teste)'&&!b.disabled)`);await click('Pagar com cartão salvo (teste)')
    await waitFor(`document.body.innerText.includes('Pagamento aprovado')||document.querySelector('#mp-saved-cvv')?.closest('form')?.querySelector('[role=alert]')`);assert.ok(await evaluate(`document.body.innerText.includes('Pagamento aprovado')`),JSON.stringify(await evaluate('__cardResponses')))
    await check(`${width}: pagamento envia só orderId/token e usa CVV do SDK fixture`, `__cardRequests.length===1&&Object.keys(__cardRequests[0]).sort().join(',')==='orderId,token'`)
    const token=await evaluate('__cardRequests[0].token')
    const persisted=(await pool.query(`SELECT to_jsonb(t)::text AS data FROM payment_attempts t WHERE order_id=$1 UNION ALL SELECT to_jsonb(t)::text FROM orders t WHERE id=$1 UNION ALL SELECT to_jsonb(t)::text FROM payment_cards t JOIN payment_customers p ON p.id=t.payment_customer_id WHERE p.user_id=$2`,[order.id,aId])).rows
    assert.ok(persisted.every(row=>!row.data.includes(token)));checks.push(`${width}: token fixture não persiste em pedido/tentativa/cartão`)
    // Recria helper perdido na navegação para a segunda dimensão.
    await evaluate(`window.api=${JSON.stringify(api)};window.accounts=${JSON.stringify(accounts)};window.attack=async(path,method='GET',who='a',body)=>{const r=await fetch(api+path,{method,redirect:'manual',headers:{'Content-Type':'application/json',Authorization:'Bearer '+accounts[who].token},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:r.headers.get('content-type')?.includes('application/json')?await r.json():null}}`)
  }
  // Arquivos canários próprios, jamais lê ou modifica um .env real.
  for(const dir of ['.local','server/.local']) await mkdir(dir,{recursive:true})
  const suffix=randomUUID(),marker=randomUUID()
  for(const file of [`.local/security-${suffix}.txt`,`server/.local/security-${suffix}.txt`,`.env.security-${suffix}`,`server/.env.security-${suffix}`]) {
    files.push(file);await writeFile(file,marker,{mode:0o600})
    for(const path of [`/${file}`,`/@fs/${process.cwd()}/${file}`,`/${file}?raw`,`/${file}?import`]) {
      const response=await fetch(origin+path),body=await response.text()
      assert.equal(response.status,403,path);assert.ok(!body.includes(marker),path);checks.push(`Vite nega arquivo privado: ${file.split('/')[0]} (${checks.length})`)
    }
  }
  assert.equal((await fetch(origin+'/src/App.jsx')).status,200)
  await mkdir('.tmp/security-audit',{recursive:true})
  await writeFile('.tmp/security-audit/browser.json',JSON.stringify({passed:checks.length,checks,providers:'SDK/cartão/pagamento/cotação fixtures; HTTP, React, Chromium e PostgreSQL reais; nenhum sandbox externo'},null,2))
  console.log(JSON.stringify({passed:checks.length,output:'.tmp/security-audit/browser.json'}))
} finally {
  for(const file of files)await unlink(file).catch(()=>{})
  socket?.close();browser.kill('SIGTERM');await vite.close();await new Promise(r=>apiServer.close(r));await pool.end();await admin.end()
}
