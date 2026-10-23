import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {once} from 'node:events'
import {assertLocalDatabaseUrl} from '../src/db/local-database.js'

const url=process.env.FORMA_TEST_DATABASE_URL
test('regressões da apresentação: endereços, UUID e privacidade de pagamentos',{skip:!url},async t=>{
  assertLocalDatabaseUrl(url,{testOnly:true})
  Object.assign(process.env,{DATABASE_URL:url,NODE_ENV:'test',FORMA_DEMO_MODE:'true',FORMA_DEMO_PAYMENT_PROVIDER:'forma_demo',FORMA_API_HOST:'127.0.0.1',FORMA_EMAIL_MODE:'mock'})
  const {pool}=await import('../src/db/pool.js')
  const {createApp}=await import('../src/app.js')
  const {seedDemoProducts}=await import('../src/db/seed-demo.js');await seedDemoProducts(pool)
  const server=createApp().listen(0,'127.0.0.1');await once(server,'listening')
  const base=`http://127.0.0.1:${server.address().port}/api`
  const request=async(path,method='GET',token,body)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return{status:r.status,data:r.status===204?null:await r.json()}}
  const register=async()=> (await request('/auth/registrar','POST',null,{name:'Pessoa fictícia',email:randomUUID()+'@example.test',password:'TesteForma2026!'})).data
  const values={label:'Teste',recipient:'Pessoa fictícia',street:'Rua fictícia',number:'1',district:'Centro',city:'Recife',state:'PE',cep:'50000000'}
  try{
    const a=await register(),b=await register()
    await t.test('UF/CEP obrigatórios e tipos inválidos recebem 400 antes de persistir',async()=>{
      for(const patch of [{state:''},{cep:''},{street:{}},{city:[]},{cep:50000000}]){
        const r=await request('/conta/enderecos','POST',a.token,{...values,...patch});assert.equal(r.status,400)
      }
      assert.equal((await request('/conta/enderecos','GET',a.token)).data.addresses.length,0)
    })
    let addresses
    await t.test('primeiros endereços concorrentes e trocas de principal conservam um principal',async()=>{
      const created=await Promise.all([1,2].map(n=>request('/conta/enderecos','POST',a.token,{...values,label:'Teste '+n})))
      assert.ok(created.every(r=>r.status===201));addresses=created.map(r=>r.data.address)
      assert.equal((await request('/conta/enderecos','GET',a.token)).data.addresses.filter(a=>a.principal).length,1)
      const changed=await Promise.all(addresses.map(a2=>request('/conta/enderecos/'+a2.id+'/principal','PUT',a.token,{})))
      assert.ok(changed.every(r=>r.status===200))
      assert.equal((await request('/conta/enderecos','GET',a.token)).data.addresses.filter(a=>a.principal).length,1)
      assert.equal((await request('/conta/enderecos/'+addresses[0].id+'/principal','PUT',b.token,{})).status,404)
    })
    await t.test('nove operações rejeitam UUID malformado com 400, sem erro interno',async()=>{
      const list=(await request('/conta/listas','POST',a.token,{name:'Teste'})).data.list
      const productId='f04a0000-0000-4000-8000-000000000002'
      for(const [method,path,body]of[['PUT','/conta/enderecos/invalido',values],['PUT','/conta/enderecos/invalido/principal',{}],['DELETE','/conta/enderecos/invalido',{}],['DELETE','/conta/favoritos/invalido',{}],['GET','/conta/listas/invalido'],['PUT','/conta/listas/invalido',{name:'Teste'}],['DELETE','/conta/listas/invalido',{}],['POST','/conta/listas/invalido/itens',{productId}],['DELETE',`/conta/listas/${list.id}/itens/invalido`,{}]]){
        assert.equal((await request(path,method,a.token,body)).status,400,path)
      }
    })
    await t.test('consulta e reconciliação de pagamento alheio devolvem 404',async()=>{
      const items=[{productId:'f04a0000-0000-4000-8000-000000000002',size:'M',quantity:1}]
      const q=(await request('/frete/cotacoes','POST',a.token,{items,addressId:addresses[0].id})).data
      const order=(await request('/checkout','POST',a.token,{items,addressId:addresses[0].id,quoteId:q.quoteId,serviceId:'forma-demo',checkoutKey:randomUUID()})).data.order
      assert.equal((await request('/pagamentos/pedidos/'+order.id,'GET',b.token)).status,404)
      assert.equal((await request('/pagamentos/pedidos/'+order.id+'/reconciliar','POST',b.token,{})).status,404)
      assert.equal((await request('/pagamentos/pedidos/'+order.id,'GET',a.token)).status,200)
      assert.equal((await request('/conta/pedidos','GET',a.token)).data.orders.length,1)
    })
  }finally{await new Promise(r=>server.close(r));await pool.end()}
})
