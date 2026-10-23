import test from 'node:test'
import assert from 'node:assert/strict'
import { addCartItem, cartKey, readCart, rememberCartPrices, removeCartItem, setCartCoupon, setCartQuantity } from '../src/services/cart.js'
import { assertCartReady, priceChanges } from '../src/services/cartReview.js'

test('quantidade respeita estoque, cupom recalcula, remoção e preços aceitos persistem', () => {
  const previous=globalThis.window, values=new Map()
  globalThis.window={localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},dispatchEvent(){}}
  try {
    const product={id:'teste',name:'Peça de teste',color:'azul',images:[{url:'/products/demo-2.webp',main:true}],price_centavos:12000,promo_price_centavos:10000,sizes:[{size:'M',stock:2},{size:'G',stock:1}]}
    addCartItem(product,'M');setCartCoupon('FORMA10');setCartQuantity('teste','M',2,2)
    assert.equal(readCart().couponCode,'FORMA10');assert.equal(readCart().items[0].priceCentavos,10000)
    assert.equal(readCart().items[0].name,'Peça de teste')
    assert.deepEqual(readCart().items[0].images,product.images)
    assert.equal(readCart().items[0].stock,undefined,'cache de exibição não conserva autoridade de estoque')
    for(const q of [3,1.5,-1,NaN])assert.throws(()=>setCartQuantity('teste','M',q,2))
    assert.equal(readCart().items[0].quantity,2)
    const lines=[{productId:'teste',size:'M',available:true,priceCentavos:9000}]
    assert.equal(priceChanges(readCart(),lines).length,1)
    const oldKey=cartKey(readCart());rememberCartPrices(lines,oldKey,true)
    assert.equal(readCart().items[0].priceCentavos,9000);assert.equal(priceChanges(readCart(),lines).length,0)
    assert.throws(()=>rememberCartPrices(lines,oldKey,true),/carrinho mudou/)
    const legacy=readCart();delete legacy.items[0].name;delete legacy.items[0].images
    values.set('forma:cart',JSON.stringify(legacy))
    rememberCartPrices([{...lines[0],name:product.name,color:product.color,images:product.images}],cartKey(readCart()))
    assert.equal(readCart().items[0].name,product.name,'revisão enriquece carrinho antigo para exibição sem API')
    assert.deepEqual(readCart().items[0].images,product.images)
    assert.equal(readCart().items[0].priceCentavos,9000,'snapshot não aceita novo preço silenciosamente')
    addCartItem(product,'G');removeCartItem('teste','M')
    assert.equal(readCart().items[0].size,'G');assert.equal(readCart().couponCode,'FORMA10')
    removeCartItem('teste','G');assert.deepEqual(readCart(),{items:[],couponCode:''})
  } finally {globalThis.window=previous}
})
test('pré-finalização exige estoque, cupom e aceite do preço; carrinho antigo não inventa histórico',()=>{
  assert.throws(()=>assertCartReady(null),/vazio/)
  assert.throws(()=>assertCartReady({canCheckout:false,priceChanges:[],couponError:'Cupom expirou'}),/Cupom expirou/)
  assert.throws(()=>assertCartReady({canCheckout:true,priceChanges:[{}]}),/preços mudaram/)
  assert.throws(()=>assertCartReady({canCheckout:false,priceChanges:[]}),/estoque/)
  assert.doesNotThrow(()=>assertCartReady({canCheckout:true,priceChanges:[]}))
  assert.deepEqual(priceChanges({items:[{productId:'a',size:'M'}]},[{productId:'a',size:'M',available:true,priceCentavos:1000}]),[])
})
