import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'

const url = process.env.FORMA_TEST_DATABASE_URL
test('carrinho e perfil HTTP + PostgreSQL descartável', { skip: !url }, async t => {
  const target = new URL(url)
  assert.ok(['localhost','127.0.0.1'].includes(target.hostname) && /test|audit/.test(target.pathname))
  process.env.DATABASE_URL = url
  const { pool } = await import('../src/db/pool.js')
  const { createApp } = await import('../src/app.js')
  const { createOrder } = await import('../src/modules/checkout/checkout.service.js')
  const { readCart } = await import('../src/modules/cart/cart.service.js')
  const { cartFingerprint, addressFingerprint } = await import('../src/modules/shipping/shipping.provider.js')
  const { verifyPassword } = await import('../src/utils/password.js')
  const server = createApp().listen(0,'127.0.0.1');await once(server,'listening')
  const base=`http://127.0.0.1:${server.address().port}/api`
  async function request(path,{method='GET',token,body}={}) {
    const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)})
    return {status:response.status,data:response.status===204?null:await response.json()}
  }
  const register=async()=> (await request('/auth/registrar',{method:'POST',body:{name:'Teste perfil',email:`profile-${randomUUID()}@example.test`,password:'antes123',promo:false}})).data
  const login=async(email,password)=>request('/auth/entrar',{method:'POST',body:{email,password}})
  let a,b,otherSession,email,productId,address
  try {
    a=await register();b=await register();email=a.user.email
    await t.test('sessão obrigatória e perfil restrito ao próprio usuário',async()=>{
      for(const [method,path] of [['GET','/auth/eu'],['PATCH','/auth/eu'],['PUT','/auth/eu/email'],['PUT','/auth/eu/senha'],['POST','/checkout'],['POST','/frete/cotacoes']])assert.equal((await request(path,{method,body:method==='GET'?undefined:{}})).status,401)
      const result=await request('/auth/eu',{method:'PATCH',token:a.token,body:{id:b.user.id,userId:b.user.id,role:'administrador',name:'Nome atualizado',promo:true}})
      assert.equal(result.status,200);assert.equal(result.data.user.id,a.user.id);assert.equal(result.data.user.role,'cliente')
      assert.equal((await request('/auth/eu',{token:b.token})).data.user.name,'Teste perfil')
      assert.equal((await request(`/auth/eu/${b.user.id}`,{token:a.token})).status,404)
      assert.equal((await request('/auth/eu',{method:'PATCH',token:a.token,body:{name:'Nome',email:b.user.email}})).status,400)
      for(const body of [{name:{}},{name:'Teste',promo:'sim'}])assert.equal((await request('/auth/eu',{method:'PATCH',token:a.token,body})).status,400)
    })
    await t.test('e-mail exige senha atual, valida formato/duplicidade e reverte falhas',async()=>{
      otherSession=(await login(email,'antes123')).data
      for(const body of [{email:'inválido',currentPassword:'antes123'},{email:'novo@example.test'},{email:'novo@example.test',currentPassword:'errada'}])assert.equal((await request('/auth/eu/email',{method:'PUT',token:a.token,body})).status,400)
      const duplicate=await request('/auth/eu/email',{method:'PUT',token:a.token,body:{email:b.user.email.toUpperCase(),currentPassword:'antes123'}})
      assert.equal(duplicate.status,409);assert.equal(duplicate.data.error.code,'email_ja_cadastrado')
      assert.equal((await request('/auth/eu',{token:otherSession.token})).status,200,'Falha não revoga sessões')
      assert.equal((await request('/auth/eu',{token:a.token})).data.user.email,email)
    })
    await t.test('troca de e-mail normaliza, persiste, revoga outras sessões e preserva isolamento',async()=>{
      const next=`novo-${randomUUID()}@example.test`
      const result=await request('/auth/eu/email',{method:'PUT',token:a.token,body:{email:` ${next.toUpperCase()} `,currentPassword:'antes123',userId:b.user.id,id:b.user.id}})
      assert.equal(result.status,200);assert.equal(result.data.user.email,next)
      assert.equal((await login(email,'antes123')).status,401);email=next
      assert.equal((await request('/auth/eu',{token:otherSession.token})).status,401)
      assert.equal((await request('/auth/eu',{token:a.token})).data.user.email,email)
      assert.equal((await request('/auth/eu',{token:b.token})).data.user.email,b.user.email)
      otherSession=(await login(email,'antes123')).data
      assert.ok(otherSession.token)
    })
    await t.test('senha valida confirmação/tamanho/atual, grava scrypt e revoga outras sessões',async()=>{
      for(const body of [{currentPassword:'errada',newPassword:'depois123',confirmPassword:'depois123'},{currentPassword:'antes123',newPassword:'123',confirmPassword:'123'},{currentPassword:'antes123',newPassword:'depois123',confirmPassword:'outra'},{currentPassword:'antes123',newPassword:'antes123',confirmPassword:'antes123'}])assert.equal((await request('/auth/eu/senha',{method:'PUT',token:a.token,body})).status,400)
      assert.equal((await request('/auth/eu',{token:otherSession.token})).status,200)
      const result=await request('/auth/eu/senha',{method:'PUT',token:a.token,body:{currentPassword:'antes123',newPassword:'depois123',confirmPassword:'depois123',userId:b.user.id}})
      assert.equal(result.status,200);assert.ok(!JSON.stringify(result.data).includes('password'))
      assert.equal((await request('/auth/eu',{token:otherSession.token})).status,401)
      assert.equal((await request('/auth/eu',{token:a.token})).status,200)
      assert.equal((await login(email,'antes123')).status,401);assert.equal((await login(email,'depois123')).status,200)
      const hash=(await pool.query('SELECT password_hash FROM users WHERE id=$1',[a.user.id])).rows[0].password_hash
      assert.match(hash,/^scrypt:/);assert.ok(await verifyPassword('depois123',hash))
      assert.equal((await login(b.user.email,'antes123')).status,200)
    })
    await t.test('duas trocas concorrentes não aceitam duas vezes a senha antiga',async()=>{
      const body=p=>({currentPassword:'depois123',newPassword:p,confirmPassword:p})
      const results=await Promise.all(['concorrente1','concorrente2'].map(p=>request('/auth/eu/senha',{method:'PUT',token:a.token,body:body(p)})))
      assert.deepEqual(results.map(r=>r.status).sort(),[200,400])
    })
    await t.test('requisição já autenticada revalida sessão depois de aguardar troca de credenciais',async()=>{
      const { createSession }=await import('../src/modules/auth/auth.service.js')
      const session=await createSession(a.user.id)
      const { hashToken }=await import('../src/utils/token.js')
      const client=await pool.connect();let saving
      try {
        await client.query('BEGIN');await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[a.user.id])
        saving=request('/auth/eu',{method:'PATCH',token:session.token,body:{name:'Não deve salvar',promo:false}})
        let waiting=false
        for(let n=0;n<100;n++) {
          const wait=await pool.query("SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'SELECT * FROM users WHERE id=%'")
          if(wait.rowCount){waiting=true;break}
          await new Promise(resolve=>setTimeout(resolve,10))
        }
        assert.ok(waiting)
        await client.query('DELETE FROM sessions WHERE token_hash=$1',[hashToken(session.token)])
        await client.query('COMMIT')
        assert.equal((await saving).status,401)
        assert.equal((await request('/auth/eu',{token:a.token})).data.user.name,'Nome atualizado')
      } finally {await client.query('ROLLBACK');client.release();if(saving)await saving}
    })
    productId=randomUUID()
    await pool.query(`INSERT INTO products (id,name,description,color,price_cents,promo_price_cents,is_active,weight_g,length_cm,width_cm,height_cm) VALUES ($1,'Oversized carrinho','Peça de teste','azul',12000,10000,true,250,30,25,3)`,[productId])
    await pool.query("INSERT INTO product_sizes (product_id,size,stock) VALUES ($1,'M',3),($1,'P',0)",[productId])
    await pool.query("INSERT INTO product_images (product_id,image_url,is_main) VALUES ($1,'/products/demo-2.svg',true)",[productId])
    const items=q=>[{productId,size:'M',quantity:q,priceCentavos:1}]
    const review=async(q,code='')=>request('/cart/resumo',{method:'POST',body:{items:items(q),couponCode:code}})
    await t.test('resumo/cupom usam preços atuais, imagem e totais; removido preserva as outras linhas',async()=>{
      const result=await review(2,'FORMA10');assert.equal(result.status,200)
      const data=result.data;assert.equal(data.subtotalCentavos,20000);assert.equal(data.discountCentavos,2000);assert.equal(data.totalCentavos,18000);assert.equal(data.canCheckout,true)
      assert.equal(data.cart[0].images[0].url,'/products/demo-2.svg')
      const old=data.fingerprint
      await pool.query('UPDATE products SET promo_price_cents=9000 WHERE id=$1',[productId])
      const changed=(await review(2,'FORMA10')).data;assert.equal(changed.totalCentavos,16200);assert.notEqual(changed.fingerprint,old)
      const mixed=await request('/cart/resumo',{method:'POST',body:{items:[...items(1),{productId:randomUUID(),size:'M',quantity:1}]}})
      assert.equal(mixed.data.cart.length,2);assert.equal(mixed.data.canCheckout,false);assert.equal(mixed.data.cart[1].available,false);assert.equal(mixed.data.subtotalCentavos,9000)
      const badCoupon=(await review(1,'INEXISTENTE')).data;assert.equal(badCoupon.canCheckout,false);assert.match(badCoupon.couponError,/inválido/);assert.equal(badCoupon.cart.length,1)
    })
    await t.test('cupom desativado entre revisões bloqueia sem esconder itens e pode ser removido',async()=>{
      const code=`TESTE-${randomUUID()}`.toUpperCase()
      await pool.query('INSERT INTO coupons (code,discount_percentage) VALUES ($1,15)',[code])
      assert.equal((await review(1,code)).data.canCheckout,true)
      await pool.query('UPDATE coupons SET is_active=false WHERE code=$1',[code])
      const changed=(await review(1,code)).data
      assert.equal(changed.canCheckout,false);assert.equal(changed.discountCentavos,0);assert.equal(changed.cart.length,1);assert.match(changed.couponError,/inativo/)
      assert.equal((await review(1)).data.canCheckout,true)
    })
    address=(await request('/conta/enderecos',{method:'POST',token:a.token,body:{label:'Casa',recipient:'Teste',street:'Rua fictícia',number:'1',district:'Centro',city:'Recife',state:'PE',cep:'50000000'}})).data.address
    await t.test('excesso/zero/variante retirada/peça desativada bloqueiam antes do provedor',async()=>{
      const excess=(await review(4)).data;assert.equal(excess.canCheckout,false);assert.equal(excess.cart[0].stock,3);assert.match(excess.cart[0].issue,/estoque/)
      assert.equal((await request('/cart/cupom',{method:'POST',body:{items:items(4),code:'FORMA10'}})).data.error.code,'estoque_indisponivel')
      for(const query of ["UPDATE product_sizes SET stock=0 WHERE product_id=$1 AND size='M'","UPDATE product_sizes SET is_active=false WHERE product_id=$1 AND size='M'","UPDATE products SET is_active=false WHERE id=$1"]) {
        await pool.query(query,[productId]);assert.equal((await review(1)).data.canCheckout,false)
        const shipping=await request('/frete/cotacoes',{method:'POST',token:a.token,body:{addressId:address.id,items:items(1)}})
        assert.equal(shipping.status,400);assert.ok(['estoque_indisponivel','produto_indisponivel'].includes(shipping.data.error.code))
      }
      await pool.query('UPDATE products SET is_active=true WHERE id=$1',[productId]);await pool.query("UPDATE product_sizes SET is_active=true,stock=3 WHERE product_id=$1 AND size='M'",[productId])
    })
    await t.test('preço ou estoque alterado depois de cotação simulada é recusado na confirmação',async()=>{
      const cart=await readCart(items(2)),quoteId=randomUUID()
      await pool.query(`INSERT INTO shipping_quotes (id,user_id,address_id,address_fingerprint,cart_fingerprint,services,expires_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,now()+interval '10 minutes')`,[quoteId,a.user.id,address.id,addressFingerprint(address),cartFingerprint(cart.items),JSON.stringify([{id:'fixture',name:'Frete simulado',priceCentavos:1000}])])
      const data={items:items(2),addressId:address.id,quoteId,checkoutKey:randomUUID(),serviceId:'fixture',couponCode:''}
      await pool.query('UPDATE products SET promo_price_cents=8000 WHERE id=$1',[productId])
      await assert.rejects(createOrder(a.user.id,data),e=>e.code==='cotacao_expirada')
      await pool.query("UPDATE product_sizes SET stock=1 WHERE product_id=$1 AND size='M'",[productId])
      await assert.rejects(createOrder(a.user.id,data),e=>e.code==='estoque_indisponivel')
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM orders WHERE user_id=$1',[a.user.id])).rows[0].n,0)
    })
    await t.test('outro usuário não pode ler/editar endereço ou pedido alheio',async()=>{
      const result=await request(`/conta/enderecos/${address.id}`,{method:'PUT',token:b.token,body:{label:'Ataque',recipient:'Teste',street:'Rua',number:'2',district:'Centro',city:'Recife',state:'PE',cep:'50000000'}})
      assert.equal(result.status,404)
      assert.equal((await request('/conta/enderecos',{token:b.token})).data.addresses.length,0)
      const orderItems=items(1),cart=await readCart(orderItems),quoteId=randomUUID()
      await pool.query(`INSERT INTO shipping_quotes (id,user_id,address_id,address_fingerprint,cart_fingerprint,services,expires_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,now()+interval '10 minutes')`,[quoteId,a.user.id,address.id,addressFingerprint(address),cartFingerprint(cart.items),JSON.stringify([{id:'fixture',name:'Frete simulado',priceCentavos:1000}])])
      const order=await createOrder(a.user.id,{items:orderItems,addressId:address.id,quoteId,checkoutKey:randomUUID(),serviceId:'fixture',couponCode:''})
      assert.equal((await request(`/conta/pedidos/${order.id}`,{token:a.token})).status,200)
      assert.equal((await request(`/conta/pedidos/${order.id}`,{token:b.token})).status,404)
    })
  } finally {await new Promise(resolve=>server.close(resolve));await pool.end()}
})
