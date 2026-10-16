import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { access, readdir } from 'node:fs/promises'

const databaseUrl = process.env.FORMA_TEST_DATABASE_URL
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')
test('administração HTTP e PostgreSQL: permissões, catálogo, concorrência e pedidos', { skip: !databaseUrl }, async t => {
  const target = new URL(databaseUrl)
  assert.ok(['localhost', '127.0.0.1'].includes(target.hostname) && /test|audit/.test(target.pathname))
  process.env.DATABASE_URL = databaseUrl
  const { pool, inTransaction } = await import('../src/db/pool.js')
  const { createApp } = await import('../src/app.js')
  const { uploadDirectory } = await import('../src/middleware/upload.js')
  const { createOrder } = await import('../src/modules/checkout/checkout.service.js')
  const { readCart } = await import('../src/modules/cart/cart.service.js')
  const { addressFingerprint, cartFingerprint } = await import('../src/modules/shipping/shipping.provider.js')
  const { releaseOrderReservations, consumeOrderReservations } = await import('../src/modules/payments/stock.service.js')
  const server = createApp().listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  async function request(path, { token, body, method = 'GET' } = {}) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json'
    const response = await fetch(base + '/api' + path, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined })
    return { status: response.status, data: await response.json() }
  }
  const register = async () => (await request('/auth/registrar', { method: 'POST', body: { name: 'Admin teste', email: `admin-${randomUUID()}@example.test`, password: 'teste123', role: 'administrador' } })).data
  let admin, customer, product, oldImage
  const draft = (p = product) => ({ ...p, version: p.admin_version, sizes: p.sizes.filter(s => s.is_active).map(s => ({ size: s.size, stock: s.stock, expected_revision: s.revision })), retained_images: p.images.map(i => i.id), main_image: p.images.find(i => i.main)?.id ?? '' })
  const put = async data => request(`/admin/produtos/${product.id}`, { method: 'PUT', token: admin.token, body: data })
  const fresh = async () => { product = (await request(`/admin/produtos/${product.id}`, { token: admin.token })).data.product; return product }
  try {
    await t.test('anônimo e cliente não podem consultar/criar/editar, nem promover a si mesmos', async () => {
      customer = await register(); admin = await register()
      assert.equal(customer.user.role, 'cliente')
      await pool.query("UPDATE users SET role='administrador' WHERE id=$1", [admin.user.id])
      const before = await readdir(uploadDirectory)
      for (const [method, path] of [['GET','/admin/produtos'], ['GET',`/admin/produtos/${randomUUID()}`], ['POST','/admin/produtos'], ['PUT',`/admin/produtos/${randomUUID()}`], ['GET','/admin/usuarios'], ['GET','/admin/visao-geral']]) {
        assert.equal((await request(path, { method })).status, 401)
        assert.equal((await request(path, { method, token: customer.token, body: method === 'POST' || method === 'PUT' ? { role: 'administrador' } : undefined })).status, 403)
      }
      assert.deepEqual(await readdir(uploadDirectory), before)
    })
    await t.test('criação multipart, imagem local, grade, promoção e persistência', async () => {
      const form = new FormData()
      const data = { name: 'Oversized integração', description: 'Descrição persistente', color: 'azul', is_printed: true, is_active: true, price_cents: 15000, promo_price_cents: 12000, weight_g: 250, length_cm: 30, width_cm: 25, height_cm: 3, sizes: JSON.stringify([{ size: 'M', stock: 10 }, { size: 'G', stock: 0 }]), main_image: 'new:0' }
      for (const [key, value] of Object.entries(data)) form.append(key, value)
      form.append('images', new Blob([png], { type: 'image/png' }), 'camisa.png')
      const response = await request('/admin/produtos', { token: admin.token, method: 'POST', body: form })
      assert.equal(response.status, 201, JSON.stringify(response.data)); product = response.data.product
      assert.equal(product.price_cents, 15000); assert.equal(product.sizes.length, 2)
      oldImage = product.images[0].url
      assert.equal((await fetch(base + '/' + oldImage)).status, 200)
      assert.equal((await fresh()).description, 'Descrição persistente')
      assert.equal((await request(`/produtos/${product.id}`)).data.product.promo_price_centavos, 12000)
    })
    await t.test('validação rejeita campos/preços/variantes/imagens inválidos sem gravar arquivos', async () => {
      const original = structuredClone(product)
      for (const change of [{ price_cents: -1 }, { promo_price_cents: 15000 }, { is_active: 'sim' }, { sizes: [{size:'X',stock:1}] }, { sizes: [{size:'M',stock:-1}] }, { retained_images: [randomUUID()], main_image: '' }]) assert.equal((await put({ ...draft(), ...change })).status, 400)
      const before = (await readdir(uploadDirectory)).sort()
      for (const [bytes, mime] of [[Buffer.from('não é PNG'), 'image/png'], [Buffer.from('<svg/>'), 'image/svg+xml'], [png, 'image/png']]) {
        const form = new FormData(); form.append('images', new Blob([bytes], {type:mime}), 'arquivo.png')
        // O PNG válido também é descartado quando os campos obrigatórios faltam.
        assert.equal((await request('/admin/produtos', {token:admin.token,method:'POST',body:form})).status,400)
      }
      assert.deepEqual((await readdir(uploadDirectory)).sort(), before)
      assert.deepEqual(await fresh(), original)
    })
    await t.test('galeria mantém imagens, define principal e desfaz uploads acima dos limites', async () => {
      const form = new FormData(), data = draft()
      for (const key of ['name','description','color','is_printed','is_active','price_cents','promo_price_cents','weight_g','length_cm','width_cm','height_cm','version','sizes','retained_images']) {
        form.append(key, Array.isArray(data[key]) ? JSON.stringify(data[key]) : data[key] ?? '')
      }
      form.append('main_image','new:1')
      for(let n=0;n<2;n++)form.append('images',new Blob([png],{type:'image/png'}),`nova-${n}.png`)
      const response=await request(`/admin/produtos/${product.id}`,{method:'PUT',token:admin.token,body:form})
      assert.equal(response.status,200,JSON.stringify(response.data));product=response.data.product
      assert.equal(product.images.length,3);assert.equal(product.images.filter(i=>i.main).length,1)
      assert.notEqual(product.images.find(i=>i.main).url,oldImage)
      const before=(await readdir(uploadDirectory)).sort()
      for(const [count,bytes,status] of [[6,png,400],[1,Buffer.alloc(5*1024*1024+1),413]]) {
        const invalid=new FormData()
        for(let n=0;n<count;n++)invalid.append('images',new Blob([bytes],{type:'image/png'}),`limite-${n}.png`)
        assert.equal((await request('/admin/produtos',{method:'POST',token:admin.token,body:invalid})).status,status)
      }
      assert.deepEqual((await readdir(uploadDirectory)).sort(),before)
    })
    await t.test('edição completa aparece na API pública; versões antigas não sobrescrevem', async () => {
      const stale = draft()
      const result = await put({ ...draft(), name:'Oversized editada',description:'Nova descrição',color:'verde',is_printed:false,price_cents:19000,promo_price_cents:16000,weight_g:300,length_cm:32,width_cm:26,height_cm:4,sizes:draft().sizes.map(s=>({...s,stock:s.size==='M'?12:3})) })
      assert.equal(result.status,200,JSON.stringify(result.data)); product = result.data.product
      const publicProduct = (await request(`/produtos/${product.id}`)).data.product
      assert.equal(publicProduct.name,'Oversized editada'); assert.equal(publicProduct.color,'verde'); assert.equal(publicProduct.price_centavos,19000)
      assert.equal((await put(stale)).status,409)
      const parallel = await Promise.all([put({...draft(),name:'Concorrente A'}),put({...draft(),name:'Concorrente B'})])
      assert.deepEqual(parallel.map(r=>r.status).sort(),[200,409]); await fresh()
    })
    await t.test('edição aguarda estoque sem bloquear a FK do checkout e recusa revisão vencida', async () => {
      const client = await pool.connect()
      let saving
      try {
        await client.query('BEGIN')
        await client.query("SELECT id FROM product_sizes WHERE product_id=$1 AND size='M' FOR UPDATE", [product.id])
        saving = put(draft())
        let waiting = false
        for (let n=0;n<100;n++) {
          const result = await pool.query("SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'SELECT * FROM product_sizes WHERE product_id%'")
          if(result.rowCount) { waiting=true;break }
          await new Promise(resolve=>setTimeout(resolve,10))
        }
        assert.ok(waiting,'Edição deve aguardar a variante bloqueada pelo checkout')
        await client.query("SET LOCAL lock_timeout='1s'")
        // A inserção de order_items usa este mesmo bloqueio de FK no produto.
        await client.query('SELECT id FROM products WHERE id=$1 FOR KEY SHARE',[product.id])
        await client.query("UPDATE product_sizes SET stock=stock-1 WHERE product_id=$1 AND size='M'",[product.id])
        await client.query('COMMIT')
        assert.equal((await saving).data.error.code,'estoque_alterado')
      } finally {await client.query('ROLLBACK');client.release();if(saving)await saving}
      await fresh()
    })
    await t.test('desativação, reativação e retirada de tamanho preservam o ID e estoque', async () => {
      const g = product.sizes.find(s=>s.size==='G')
      let response=await put({...draft(),is_active:false,sizes:draft().sizes.filter(s=>s.size!=='G')}); assert.equal(response.status,200);product=response.data.product
      assert.equal((await request(`/produtos/${product.id}`)).status,404)
      assert.ok(!(await request('/produtos')).data.products.some(p=>p.id===product.id))
      assert.equal(product.sizes.find(s=>s.size==='G').id,g.id);assert.equal(product.sizes.find(s=>s.size==='G').stock,3)
      response=await put({...draft(),is_active:true,sizes:[...draft().sizes,{size:'G',stock:3,expected_revision:product.sizes.find(s=>s.size==='G').revision}]});assert.equal(response.status,200);product=response.data.product
      assert.equal(product.sizes.find(s=>s.size==='G').id,g.id)
      assert.equal((await request(`/produtos/${product.id}`)).status,200)
    })
    async function order() {
      const address=(await request('/conta/enderecos',{token:customer.token,method:'POST',body:{label:'Casa',recipient:'Teste',street:'Rua fictícia',number:'1',district:'Centro',city:'Recife',state:'PE',cep:'50000000'}})).data.address
      const items=[{productId:product.id,size:'M',quantity:2}], cart=await readCart(items),quoteId=randomUUID()
      await pool.query(`INSERT INTO shipping_quotes (id,user_id,address_id,address_fingerprint,cart_fingerprint,services,expires_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,now()+interval '10 minutes')`,[quoteId,customer.user.id,address.id,addressFingerprint(address),cartFingerprint(cart.items),JSON.stringify([{id:'fixture',name:'Frete simulado de teste',priceCentavos:1000,deliveryDays:3}])])
      return createOrder(customer.user.id,{addressId:address.id,items,quoteId,checkoutKey:randomUUID(),serviceId:'fixture',couponCode:''})
    }
    await t.test('reserva muda revisão; alterações comerciais bloqueadas; liberação idempotente', async () => {
      const stale=draft(), previous=product.sizes.find(s=>s.size==='M').stock
      const pending=await order(); assert.equal((await put(stale)).data.error.code,'estoque_alterado');await fresh()
      assert.equal(product.sizes.find(s=>s.size==='M').stock,previous-2)
      for(const change of [{price_cents:20000},{is_active:false},{color:'preta'},{sizes:draft().sizes.filter(s=>s.size!=='M')}]) assert.equal((await put({...draft(),...change})).data.error.code,'produto_com_reservas')
      const result=await put({...draft(),name:'Nome pode mudar durante reserva'});assert.equal(result.status,200);product=result.data.product
      const beforeRelease=draft()
      await inTransaction(async c=>{assert.equal(await releaseOrderReservations(c,pending.id),1);assert.equal(await releaseOrderReservations(c,pending.id),0);await c.query("UPDATE orders SET status='cancelado' WHERE id=$1",[pending.id])})
      assert.equal((await put(beforeRelease)).data.error.code,'estoque_alterado');await fresh()
      assert.equal(product.sizes.find(s=>s.size==='M').stock,previous)
      await assert.rejects(pool.query('UPDATE product_sizes SET stock=-1 WHERE product_id=$1',[product.id]), e=>e.code==='23514')
    })
    await t.test('pedido pago mantém snapshots, IDs históricos e arquivo após editar/retirar variante', async () => {
      const paid=await order()
      // Consumo interno de reserva: não chama gateway nem simula homologação do pagamento.
      await inTransaction(async c=>{assert.equal(await consumeOrderReservations(c,paid.id),true);await c.query("UPDATE orders SET status='pago' WHERE id=$1",[paid.id])})
      const snapshot=(await pool.query('SELECT * FROM order_items WHERE order_id=$1',[paid.id])).rows[0]
      await fresh();const variant=product.sizes.find(s=>s.size==='M')
      const result=await put({...draft(),name:'Após compra',price_cents:22000,promo_price_cents:null,retained_images:[],main_image:'',sizes:draft().sizes.filter(s=>s.size!=='M')})
      assert.equal(result.status,200,JSON.stringify(result.data));product=result.data.product
      assert.equal(product.sizes.find(s=>s.size==='M').id,variant.id)
      assert.deepEqual((await pool.query('SELECT * FROM order_items WHERE order_id=$1',[paid.id])).rows[0],snapshot)
      assert.equal((await pool.query('SELECT total_centavos::integer AS total_centavos FROM orders WHERE id=$1',[paid.id])).rows[0].total_centavos,33000)
      await access(uploadDirectory+oldImage.replace('uploads/',''))
      assert.equal((await fetch(base+'/'+oldImage)).status,200)
      await assert.rejects(readCart([{productId:product.id,size:'M',quantity:1}],pool,{validateStock:true}),e=>e.code==='estoque_indisponivel')
      assert.ok(!(await request(`/produtos/${product.id}`)).data.product.sizes.some(s=>s.size==='M'))
    })
  } finally { await new Promise(resolve=>server.close(resolve));await pool.end() }
})
