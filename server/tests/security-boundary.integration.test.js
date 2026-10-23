import { assertLocalDatabaseUrl } from '../src/db/local-database.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { once } from 'node:events'

const url = process.env.FORMA_TEST_DATABASE_URL
test('fronteira HTTP: valores autoritativos, conta, webhook e dados privados (fixtures)', { skip: !url }, async t => {
  assertLocalDatabaseUrl(url, { testOnly: true })
  process.env.DATABASE_URL = url
  const { pool } = await import('../src/db/pool.js')
  const { createApp } = await import('../src/app.js')
  const { readCart } = await import('../src/modules/cart/cart.service.js')
  const { cartFingerprint, addressFingerprint } = await import('../src/modules/shipping/shipping.provider.js')
  const { provisionDemoAdmin } = await import('../src/db/demo-admin.js')
  const { errorHandler } = await import('../src/middleware/errors.js')
  const envKeys = ['MERCADOPAGO_MODE','MERCADOPAGO_TEST_ACCESS_TOKEN','MERCADOPAGO_PUBLIC_KEY','MERCADOPAGO_WEBHOOK_SECRET','MERCADOPAGO_PUBLIC_URL','NODE_ENV']
  const previous = Object.fromEntries(envKeys.map(k=>[k,process.env[k]]))
  const secret = randomUUID(), privateValue = randomUUID(), publicKey = `TEST-${randomUUID()}`
  Object.assign(process.env,{MERCADOPAGO_PUBLIC_URL:'https://fixture.example.test',MERCADOPAGO_MODE:'sandbox',MERCADOPAGO_TEST_ACCESS_TOKEN:privateValue,MERCADOPAGO_PUBLIC_KEY:publicKey,MERCADOPAGO_WEBHOOK_SECRET:secret})
  let fetched = 0, providerPayment
  const paymentGateway = {
    createPreference: async order => ({preferenceId:`fixture-pref-${order.id}`,sandboxCheckoutUrl:'https://sandbox.mercadopago.com.br/fixture',liveMode:false}),
    fetchPayment: async () => { fetched++; return structuredClone(providerPayment) },
  }
  const server = createApp({paymentGateway}).listen(0,'127.0.0.1');await once(server,'listening')
  const base=`http://127.0.0.1:${server.address().port}/api`
  async function request(path,{method='GET',token,body,headers={}}={}) {
    const r=await fetch(base+path,{method,redirect:'manual',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...headers},body:body===undefined?undefined:JSON.stringify(body)})
    return {status:r.status,data:r.status===204||r.status===303?null:r.headers.get('content-type')?.includes('application/json')?await r.json():await r.text(),location:r.headers.get('location')}
  }
  const register=async()=> (await request('/auth/registrar',{method:'POST',body:{name:'Cliente segurança',email:`security-${randomUUID()}@example.test`,password:'SenhaFixture2026!',promo:false}})).data
  let a,b,address,otherAddress,productId,order
  const addressBody={label:'Casa',recipient:'Cliente',cep:'50000000',street:'Rua de teste',number:'100',district:'Centro',city:'Recife',state:'PE',principal:true}
  async function quote(user=a,ownedAddress=address,quantity=1) {
    const items=[{productId,size:'M',quantity}],cart=await readCart(items),id=randomUUID()
    await pool.query(`INSERT INTO shipping_quotes(id,user_id,address_id,address_fingerprint,cart_fingerprint,services,expires_at)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,now()+interval '10 minutes')`,[id,user.user.id,ownedAddress.id,addressFingerprint(ownedAddress),cartFingerprint(cart.items),JSON.stringify([{id:'fixture-service',name:'Frete fixture',priceCentavos:1234,deliveryDays:3}])])
    return {items,addressId:ownedAddress.id,quoteId:id,serviceId:'fixture-service',checkoutKey:randomUUID(),couponCode:'FORMA10'}
  }
  const checkout=body=>request('/checkout',{method:'POST',token:a.token,body})
  const orderStatus=async()=> (await request(`/conta/pedidos/${order.id}`,{token:a.token})).data.order.status
  const paymentId=String(BigInt('0x'+randomUUID().replaceAll('-','').slice(0,14)))
  function headers(dataId=paymentId,requestId='fixture-request',timestamp=Math.floor(Date.now()/1000)) {
    const manifest=`id:${dataId};request-id:${requestId};ts:${timestamp};`
    return {'x-request-id':requestId,'x-signature':`ts=${timestamp},v1=${createHmac('sha256',secret).update(manifest).digest('hex')}`}
  }
  async function webhook(id=paymentId+'02',signature=headers(),extra={}) {
    return request(`/pagamentos/webhook?data.id=${paymentId}`,{method:'POST',headers:signature,body:{id,type:'payment',action:'payment.updated',data:{id:paymentId},...extra}})
  }
  try {
    a=await register();b=await register()
    address=(await request('/conta/enderecos',{method:'POST',token:a.token,body:addressBody})).data.address
    otherAddress=(await request('/conta/enderecos',{method:'POST',token:b.token,body:addressBody})).data.address
    productId=randomUUID()
    await pool.query(`INSERT INTO products(id,name,color,price_cents,promo_price_cents,weight_g,length_cm,width_cm,height_cm) VALUES($1,'Peça segurança','azul',10000,8000,250,30,25,3)`,[productId])
    await pool.query("INSERT INTO product_sizes(product_id,size,stock) VALUES($1,'M',100)",[productId])
    await t.test('corpo tenta forjar preço/desconto/frete/estoque/status/usuário: servidor recalcula e ignora',async()=>{
      const payload=await quote()
      const r=await checkout({...payload,userId:b.user.id,status:'pago',totalCentavos:1,discountCentavos:999999,shippingCentavos:0,stock:999999,addressSnapshot:otherAddress,
        items:payload.items.map(item=>({...item,priceCentavos:1,unitPriceCentavos:1,lineTotalCentavos:1,stock:999999}))})
      assert.equal(r.status,201);order=r.data.order
      assert.equal(order.subtotalCentavos,8000);assert.equal(order.discountCentavos,800);assert.equal(order.shippingCentavos,1234);assert.equal(order.totalCentavos,8434)
      assert.equal(await orderStatus(),'aguardando_pagamento')
      assert.equal((await pool.query('SELECT user_id FROM orders WHERE id=$1',[order.id])).rows[0].user_id,a.user.id)
      // O modo externo mantém a impressão anterior, inclusive após a migração
      // da demo: pedidos pendentes legados continuam deduplicados pelo carrinho.
      const legacyFingerprint = createHash('sha256').update(JSON.stringify({
        addressId: address.id, addressFingerprint: addressFingerprint(address),
        cartFingerprint: cartFingerprint((await readCart(payload.items)).items),
      })).digest('hex')
      assert.equal((await pool.query('SELECT checkout_fingerprint FROM orders WHERE id=$1', [order.id])).rows[0].checkout_fingerprint, legacyFingerprint)
    })
    await t.test('quantidades inválidas, duplicadas e estoque adulterado são recusados',async()=>{
      const payload=await quote(a,address,2)
      for(const quantity of [0,-1,1.5,21,true,[2]]) assert.equal((await checkout({...payload,items:[{productId,size:'M',quantity}]})).status,400)
      assert.equal((await checkout({...payload,items:[...payload.items,...payload.items]})).status,400)
      await pool.query("UPDATE product_sizes SET stock=0 WHERE product_id=$1 AND size='M'",[productId])
      assert.equal((await checkout({...payload,stock:999999,items:payload.items.map(i=>({...i,stock:999999}))})).status,400)
      await pool.query("UPDATE product_sizes SET stock=99 WHERE product_id=$1 AND size='M'",[productId])
    })
    await t.test('cupom inválido/inativo e cotação alheia/expirada/serviço forjado/endereço alheio recusados',async()=>{
      const payload=await quote(a,address,2)
      assert.equal((await checkout({...payload,couponCode:'INVALIDO',discountPercentage:100})).status,400)
      await pool.query("UPDATE coupons SET is_active=false WHERE code='FORMA10'")
      assert.equal((await checkout(payload)).status,400)
      await pool.query("UPDATE coupons SET is_active=true WHERE code='FORMA10'")
      assert.equal((await checkout({...payload,serviceId:'gratis-forjado'})).status,400)
      const foreign=await quote(b,otherAddress,2)
      assert.equal((await checkout({...payload,quoteId:foreign.quoteId})).status,400)
      assert.equal((await checkout({...payload,addressId:otherAddress.id})).status,404)
      await pool.query("UPDATE shipping_quotes SET expires_at=now()-interval '1 minute' WHERE id=$1",[payload.quoteId])
      assert.equal((await checkout(payload)).status,400)
      const changed=await quote(a,address,2)
      await pool.query("UPDATE addresses SET number='101' WHERE id=$1",[address.id])
      assert.equal((await checkout(changed)).status,400)
      await pool.query("UPDATE addresses SET number='100' WHERE id=$1",[address.id])
    })
    await t.test('pedido/tentativa são privados, retorno do navegador não aprova nem consulta gateway',async()=>{
      assert.equal((await request(`/conta/pedidos/${order.id}`,{token:b.token})).status,404)
      assert.equal((await request(`/pagamentos/pedidos/${order.id}/preferencia`,{method:'POST',token:b.token,body:{}})).status,404)
      assert.equal((await request(`/pagamentos/pedidos/${order.id}/verificar`,{method:'POST',token:b.token,body:{paymentId}})).status,404)
      const r=await request(`/pagamentos/retorno?order_id=${order.id}&payment_id=${paymentId}&status=approved&collection_status=approved&token=${privateValue}`)
      assert.equal(r.status,303);assert.equal(fetched,0);assert.equal(await orderStatus(),'aguardando_pagamento')
      assert.ok(!r.location.includes('status')&&!r.location.includes(privateValue))
      await request(`/pagamentos/pedidos/${order.id}/preferencia`,{method:'POST',token:a.token,body:{totalCentavos:1,status:'pago'}})
      providerPayment={id:paymentId,external_reference:order.id,preference_id:`fixture-pref-${order.id}`,transaction_amount:84.34,currency_id:'BRL',live_mode:false,status:'pending'}
      const verified=await request(`/pagamentos/pedidos/${order.id}/verificar`,{method:'POST',token:a.token,body:{paymentId,status:'approved'}})
      assert.equal(verified.data.order.status,'aguardando_pagamento');assert.equal(fetched,1)
    })
    await t.test('consulta oficial fixture precisa corresponder ao ID, pedido, valor, moeda, preferência e sandbox',async()=>{
      const original=structuredClone(providerPayment)
      for(const change of [{id:String(BigInt(paymentId)+1n)},{external_reference:randomUUID()},{transaction_amount:1},{currency_id:'USD'},{preference_id:'outra'},{live_mode:true}]) {
        providerPayment={...original,...change,status:'approved'}
        const r=await request(`/pagamentos/pedidos/${order.id}/verificar`,{method:'POST',token:a.token,body:{paymentId}})
        assert.ok(r.status===400 || r.data.verified===false)
        assert.equal(await orderStatus(),'aguardando_pagamento')
      }
      providerPayment=original
    })
    await t.test('webhook ausente/adulterado/antigo/futuro não consulta gateway; body status não aprova',async()=>{
      const before=fetched
      assert.equal((await webhook(paymentId+'01',{})).status,400)
      assert.equal((await webhook(paymentId+'01',headers('999999'))).status,401)
      assert.equal((await webhook(paymentId+'01',headers(paymentId,'fixture-request',1))).status,401)
      assert.equal((await webhook(paymentId+'01',headers(paymentId,'fixture-request',Math.floor(Date.now()/1000)+86400))).status,401)
      assert.equal(fetched,before)
      assert.equal((await webhook(paymentId+'01',headers(),{status:'approved'})).status,200)
      assert.equal(await orderStatus(),'aguardando_pagamento')
    })
    await t.test('aprovação via webhook verificado é idempotente para pedido/estoque/cupom/e-mail',async()=>{
      providerPayment.status='approved'
      assert.equal((await webhook()).status,200);assert.equal((await webhook()).status,200)
      assert.equal(await orderStatus(),'pago')
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM email_outbox WHERE order_id=$1 AND template='purchase_confirmation'",[order.id])).rows[0].n,1)
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM coupon_redemptions WHERE order_id=$1',[order.id])).rows[0].n,1)
      assert.equal((await pool.query('SELECT status FROM stock_reservations WHERE order_id=$1',[order.id])).rows[0].status,'consumido')
    })
    await t.test('PAN/CVV são recusados em qualquer corpo JSON; Public Key é a única credencial pública',async()=>{
      for(const field of ['pan','cardNumber','card_number','cvv','cvc','securityCode','security_code']) {
        const r=await request('/checkout',{method:'POST',token:a.token,body:{nested:{[field]:'MARCADOR_NAO_SENSIVEL'}}})
        assert.equal(r.status,400);assert.equal(r.data.error.code,'dados_cartao_proibidos')
      }
      const good=(await request('/conta/cartoes',{token:a.token})).data
      assert.equal(good.publicKey,publicKey);assert.ok(!JSON.stringify(good).includes(privateValue))
      process.env.MERCADOPAGO_PUBLIC_KEY=privateValue
      assert.equal((await request('/conta/cartoes',{token:a.token})).data.publicKey,null)
      process.env.MERCADOPAGO_PUBLIC_KEY=publicKey
      assert.ok(!JSON.stringify(await request(`/nao-existe?token=${privateValue}`)).includes(privateValue))
      const logged=[],old=console.error;console.error=(...args)=>logged.push(args)
      try { errorHandler(new Error(privateValue),{}, {status(){return this},json(){}},()=>{}) } finally { console.error=old }
      assert.ok(!JSON.stringify(logged).includes(privateValue))
    })
    await t.test('admin demo recusa produção, banco remoto e override de host na URL',async()=>{
      for(const connectionString of ['postgres://example.invalid/forma','postgres://127.0.0.1/forma?host=example.invalid']) {
        const fake={options:{connectionString},query(){throw Error('não deveria conectar')}}
        await assert.rejects(provisionDemoAdmin(fake,{env:'development',databaseUrl:url}),/somente/)
      }
      process.env.NODE_ENV='production';await assert.rejects(provisionDemoAdmin(pool,{env:'development',databaseUrl:url}),/somente/)
      process.env.NODE_ENV='test'
      const fake={options:{connectionString:url},async connect(){return {connectionParameters:{host:'127.0.0.1',database:'test'},connection:{stream:{remoteAddress:'127.0.0.1'}},async query(){return {rows:[{address:'192.0.2.1',database:'test'}]}},release(){}}}}
      await assert.rejects(provisionDemoAdmin(fake),/loopback/)
      assert.equal(typeof (await provisionDemoAdmin(pool)).created,'boolean')
    })
  } finally {
    for(const [k,v] of Object.entries(previous)) { if(v===undefined)delete process.env[k];else process.env[k]=v }
    await new Promise(resolve=>server.close(resolve));await pool.end()
  }
})
