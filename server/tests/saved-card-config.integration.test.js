import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { assertLocalDatabaseUrl } from '../src/db/local-database.js'

const url=process.env.FORMA_TEST_DATABASE_URL
test('cartão salvo: configuração incompleta não cria tentativa nem chama gateway (fixtures)',{skip:!url},async t=>{
  assertLocalDatabaseUrl(url,{testOnly:true});process.env.DATABASE_URL=url
  const {pool}=await import('../src/db/pool.js')
  const {createApp}=await import('../src/app.js')
  const {readCart}=await import('../src/modules/cart/cart.service.js')
  const {addressFingerprint,cartFingerprint}=await import('../src/modules/shipping/shipping.provider.js')
  const configured={MERCADOPAGO_MODE:'sandbox',MERCADOPAGO_TEST_ACCESS_TOKEN:randomUUID(),MERCADOPAGO_PUBLIC_KEY:`TEST-${randomUUID()}`,MERCADOPAGO_PUBLIC_URL:'https://fixture.example.test',MERCADOPAGO_WEBHOOK_SECRET:randomUUID()}
  const previous=Object.fromEntries(Object.keys(configured).map(k=>[k,process.env[k]]))
  Object.assign(process.env,configured)
  let tokenCalls=0,payCalls=0,preferenceCalls=0
  const gateway={
    createCustomer:async()=>({id:'customer-config-test'}),
    addCard:async()=>({id:'card-config-test',payment_method:{id:'master'},last_four_digits:'0000',expiration_month:12,expiration_year:2030,cardholder:{name:'Fixture'},live_mode:false}),
    getToken:async()=>{tokenCalls++;return {card_id:'card-config-test',live_mode:false,status:'active'}},
    pay:async body=>{
      payCalls++;assert.equal(body.notification_url,'https://fixture.example.test/api/pagamentos/webhook')
      return {id:'700000000001',external_reference:body.external_reference,transaction_amount:body.transaction_amount,currency_id:'BRL',live_mode:false,status:'approved',payer:{id:body.payer.id},card:{id:'card-config-test'}}
    },
  }
  const paymentGateway={createPreference:async order=>{preferenceCalls++;return {preferenceId:`pref-${order.id}`,sandboxCheckoutUrl:'https://sandbox.mercadopago.com.br/fixture',liveMode:false}}}
  const server=createApp({cardGateway:gateway,paymentGateway}).listen(0,'127.0.0.1');await once(server,'listening')
  const base=`http://127.0.0.1:${server.address().port}/api`
  let auth
  async function request(path,{method='GET',body}={}) {
    const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${auth.token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)})
    return {status:r.status,data:await r.json()}
  }
  let address,productId,card,order
  async function newOrder(quantity=1){
    const items=[{productId,size:'M',quantity}],cart=await readCart(items),quoteId=randomUUID()
    await pool.query(`INSERT INTO shipping_quotes(id,user_id,address_id,address_fingerprint,cart_fingerprint,services,expires_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,now()+interval '10 minutes')`,[quoteId,auth.user.id,address.id,addressFingerprint(address),cartFingerprint(cart.items),JSON.stringify([{id:'fixture',name:'Frete fixture',priceCentavos:1000}])])
    const result=await request('/checkout',{method:'POST',body:{items,addressId:address.id,quoteId,serviceId:'fixture',checkoutKey:randomUUID()}})
    assert.equal(result.status,201);return result.data.order
  }
  async function snapshot(){
    return (await pool.query(`SELECT jsonb_build_object('order',to_jsonb(o),'attempts',(SELECT jsonb_agg(to_jsonb(p)) FROM payment_attempts p WHERE p.order_id=o.id),'stock',(SELECT jsonb_agg(to_jsonb(s)) FROM product_sizes s WHERE s.product_id=$2),'reservations',(SELECT jsonb_agg(to_jsonb(r)) FROM stock_reservations r WHERE r.order_id=o.id),'emails',(SELECT jsonb_agg(to_jsonb(e)) FROM email_outbox e WHERE e.order_id=o.id)) AS state FROM orders o WHERE o.id=$1`,[order.id,productId])).rows[0].state
  }
  const pay=()=>request(`/conta/cartoes/${card.id}/pagar`,{method:'POST',body:{orderId:order.id,token:randomUUID().replaceAll('-','')}})
  try{
    auth=(await request('/auth/registrar',{method:'POST',body:{name:'Configuração checkout',email:`config-${randomUUID()}@example.test`,password:'SenhaFixture2026!',promo:false}})).data
    address=(await request('/conta/enderecos',{method:'POST',body:{label:'Casa',recipient:'Cliente',cep:'50000000',street:'Rua Fixture',number:'1',district:'Centro',city:'Recife',state:'PE',principal:true}})).data.address
    productId=randomUUID();await pool.query("INSERT INTO products(id,name,color,price_cents,weight_g,length_cm,width_cm,height_cm) VALUES($1,'Peça configuração','azul',10000,250,30,25,3)",[productId])
    await pool.query("INSERT INTO product_sizes(product_id,size,stock) VALUES($1,'M',10)",[productId])
    const added=await request('/conta/cartoes',{method:'POST',body:{token:randomUUID().replaceAll('-','')}});assert.equal(added.status,201);card=added.data.cards[0]
    order=await newOrder()
    for(const [label,key,value] of [
      ['sem URL','MERCADOPAGO_PUBLIC_URL',undefined],
      ['sem segredo','MERCADOPAGO_WEBHOOK_SECRET',undefined],
      ['URL HTTP','MERCADOPAGO_PUBLIC_URL','http://fixture.example.test'],
      ['URL com credencial','MERCADOPAGO_PUBLIC_URL','https://user:PRIVATE_CANARY@fixture.example.test'],
      ['URL local','MERCADOPAGO_PUBLIC_URL','https://localhost'],
      ['IP privado','MERCADOPAGO_PUBLIC_URL','https://192.168.1.2'],
      ['IPv6 loopback','MERCADOPAGO_PUBLIC_URL','https://[::1]'],
      ['URL fictícia do exemplo','MERCADOPAGO_PUBLIC_URL','https://forma-tunel.example.invalid'],
      ['segredo fictício do exemplo','MERCADOPAGO_WEBHOOK_SECRET','WEBHOOK-FICTICIO-TROQUE'],
    ])await t.test(`${label}: 503, sem tentativa/gateway/alteração do pedido e carteira indisponível para pagar`,async()=>{
      Object.assign(process.env,configured);if(value===undefined)delete process.env[key];else process.env[key]=value
      const before=await snapshot(),result=await pay()
      assert.equal(result.status,503);assert.ok(!JSON.stringify(result.data).includes('PRIVATE_CANARY'))
      assert.deepEqual(await snapshot(),before)
      assert.equal(payCalls,0);assert.equal(tokenCalls,0);assert.equal(preferenceCalls,0)
      const listing=(await request('/conta/cartoes')).data
      assert.equal(listing.publicKey,null);assert.equal(listing.cards.length,1)
      assert.ok(!JSON.stringify(listing).includes(configured.MERCADOPAGO_WEBHOOK_SECRET))
    })
    await t.test('Checkout Pro independente do bloqueio por segredo ausente no cartão salvo',async()=>{
      Object.assign(process.env,configured);delete process.env.MERCADOPAGO_WEBHOOK_SECRET
      const other=await newOrder(2)
      const result=await request(`/pagamentos/pedidos/${other.id}/preferencia`,{method:'POST',body:{}})
      assert.equal(result.status,200);assert.equal(preferenceCalls,1);assert.equal(payCalls,0)
      assert.match(result.data.payment.checkoutUrl,/^https:\/\/sandbox\.mercadopago/)
    })
    await t.test('configuração válida: Public Key pública, callback correto e pagamento fixture único',async()=>{
      Object.assign(process.env,configured)
      const listing=(await request('/conta/cartoes')).data;assert.equal(listing.publicKey,configured.MERCADOPAGO_PUBLIC_KEY)
      const result=await pay();assert.equal(result.status,200);assert.equal(result.data.status,'aprovada')
      assert.equal(tokenCalls,1);assert.equal(payCalls,1)
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM payment_attempts WHERE order_id=$1',[order.id])).rows[0].n,1)
      assert.equal((await pool.query('SELECT status FROM orders WHERE id=$1',[order.id])).rows[0].status,'pago')
    })
  }finally{
    for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value}
    await new Promise(resolve=>server.close(resolve));await pool.end()
  }
})
