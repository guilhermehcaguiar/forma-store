import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import { api } from '../services/api'
import { formatPrice } from '../services/products'
import { cartKey, readCart, rememberCartPrices, removeCartItem, setCartCoupon, setCartQuantity, useCart } from '../services/cart'
import { assertCartReady, useCartReview } from '../services/cartReview'
import ProductImage from '../components/ProductImage'

export default function Cart() {
  const cart = useCart(), navigate = useNavigate()
  const review = useCartReview(cart)
  const summary = review.data
  const [couponInput, setCouponInput] = useState(cart.couponCode)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lines = cart.items.map(item => summary?.cart.find(line => line.productId === item.productId && line.size === item.size) ?? { ...item, name: item.name || 'Item do carrinho', images: item.images ?? [], sizes: [], stock: 0 })
  const ready = Boolean(summary && !review.loading && !review.error)
  function act(action) { setError('');setMessage('');try { action() } catch (failure) { setError(failure.message) } }
  async function applyCoupon(event) {
    event.preventDefault(); setError(''); setMessage(''); setBusy(true)
    const expectedKey = cartKey(readCart())
    try {
      const data = await api.post('/cart/cupom', { items: cart.items, code: couponInput })
      if (expectedKey !== cartKey(readCart())) throw new Error('O carrinho mudou. Aplique o cupom novamente.')
      setCartCoupon(data.coupon.code)
      setMessage(`Cupom de ${data.coupon.discountPercentage}% aplicado.`)
    } catch (failure) { setError(failure.fields?.code ?? failure.message) }
    finally { setBusy(false) }
  }
  async function proceed() {
    setBusy(true);setError('')
    try { assertCartReady(await review.refresh());navigate('/checkout') }
    catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  return <section className="page cart-page">
    <header className="page-header"><p className="eyebrow">Sua seleção</p><h1>Seu carrinho</h1><p className="page-header__subtitle">Gerencie os itens escolhidos e aplique seus cupons de desconto.</p></header>
    <div className="cart-layout"><div className="cart-items-container">
      {!cart.items.length ? <EmptyState title="Seu carrinho está vazio" description="Explore o catálogo e adicione as peças que você gostar." action={<Button to="/catalogo">Ir para o catálogo</Button>} /> : null}
      {lines.map(item => <article className="card cart-item-card" key={`${item.productId}:${item.size}`} data-product-id={item.productId}>
        <ProductImage product={item} className="cart-item-image" /><div className="cart-item-card__details">
          <h2>{item.name}</h2><p>{item.color}{item.size ? ` · Tamanho ${item.size}` : ''}</p>
          {ready && item.available ? <strong>{formatPrice(item.priceCentavos)}</strong> : null}
          {ready && item.issue ? <p className="form-alert" role="alert">{item.issue}</p> : null}
          {ready && summary.priceChanges.some(line => line.productId === item.productId && line.size === item.size) ? <p className="form-alert">Preço alterado: de {formatPrice(cart.items.find(line => line.productId === item.productId && line.size === item.size).priceCentavos)} para {formatPrice(item.priceCentavos)}.</p> : null}
        </div><div className="cart-item-card__actions"><div className="quantity-control" role="group" aria-label={`Quantidade de ${item.name}`}>
          <button type="button" aria-label="Diminuir quantidade" disabled={!ready || busy} onClick={() => act(() => setCartQuantity(item.productId, item.size, Math.max(0, Math.min(item.stock, item.quantity - 1)), item.stock))}>−</button>
          <span>{item.quantity}</span>
          <button type="button" aria-label="Aumentar quantidade" disabled={!ready || busy || item.quantity >= Math.min(20, item.stock)} onClick={() => act(() => setCartQuantity(item.productId, item.size, item.quantity + 1, item.stock))}>+</button>
        </div><Button type="button" size="small" variant="ghost" disabled={busy} onClick={() => act(() => removeCartItem(item.productId, item.size))}>Remover</Button></div>
      </article>)}
      {cart.items.length ? <Button to="/catalogo" variant="ghost">← Continuar comprando</Button> : null}
    </div><aside className="cart-summary card"><h2>Resumo do pedido</h2>
      <dl className="summary-values"><div><dt>Subtotal</dt><dd>{ready ? formatPrice(summary.subtotalCentavos) : '—'}</dd></div><div><dt>Desconto</dt><dd>{ready && summary.discountCentavos ? `− ${formatPrice(summary.discountCentavos)}` : '—'}</dd></div><div><dt>Total parcial</dt><dd>{ready ? formatPrice(summary.totalCentavos) : '—'}</dd></div></dl>
      <form className="coupon-form" onSubmit={applyCoupon}><label htmlFor="cart-coupon">Cupom de desconto</label><div><input id="cart-coupon" value={couponInput} onChange={event => setCouponInput(event.target.value.toUpperCase())} maxLength={50} disabled={!cart.items.length || busy} /><Button type="submit" disabled={busy || !ready || !cart.items.length || summary.cart.some(item => item.issue)}>Aplicar</Button></div></form>
      {cart.couponCode ? <p>Cupom: {cart.couponCode} <Button type="button" variant="ghost" disabled={busy} onClick={() => act(() => {setCartCoupon('');setCouponInput('')})}>Remover cupom</Button></p> : null}
      {ready && summary.couponError ? <p className="form-alert" role="alert">{summary.couponError} Remova ou substitua o cupom.</p> : null}
      {message ? <p className="form-success" role="status">{message}</p> : null}
      {error || review.error ? <p className="form-alert" role="alert">{error || review.error}</p> : null}
      {review.loading && cart.items.length ? <p role="status">Atualizando preços e estoque...</p> : null}
      {ready && summary.priceChanges.length ? <Button type="button" disabled={busy} onClick={() => act(() => rememberCartPrices(summary.cart, review.key, true))}>Aceitar preços atualizados</Button> : null}
      {cart.items.length ? <Button type="button" variant="ghost" disabled={busy || review.loading} onClick={() => {setError('');review.refresh().catch(() => {})}}>Atualizar carrinho</Button> : null}
      <p className="cart-summary__note">O frete será cotado no checkout. Itens indisponíveis não entram no total e precisam ser removidos. Preços e estoque serão conferidos novamente antes de continuar.</p>
      <Button type="button" disabled={busy || !review.canCheckout || !cart.items.length} onClick={proceed}>Continuar para o checkout →</Button>
    </aside></div>
  </section>
}
