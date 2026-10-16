import { useEffect, useState } from 'react'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import { api } from '../services/api'
import { formatPrice } from '../services/products'
import { removeCartItem, setCartCoupon, setCartQuantity, useCart } from '../services/cart'

export default function Cart() {
  const cart = useCart()
  const [summary, setSummary] = useState(null)
  const [couponInput, setCouponInput] = useState(cart.couponCode)
  const [message, setMessage] = useState('')
  const [summaryError, setSummaryError] = useState('')
  const [couponError, setCouponError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    async function loadSummary() {
      if (!cart.items.length) {
        setSummary({ cart: [], subtotalCentavos: 0, discountCentavos: 0, totalCentavos: 0 })
        setSummaryError('')
        return
      }
      try {
        let data = await api.post('/cart/resumo', { items: cart.items })
        if (cart.couponCode) data = await api.post('/cart/cupom', { items: cart.items, code: cart.couponCode })
        if (active) { setSummary(data); setSummaryError('') }
      } catch (loadError) {
        if (active) { setSummaryError(loadError.message); setSummary(null) }
      }
    }
    loadSummary()
    return () => { active = false }
  }, [cart.items, cart.couponCode])

  async function applyCoupon(event) {
    event.preventDefault()
    setMessage('')
    setCouponError('')
    if (!cart.items.length) return
    setLoading(true)
    try {
      const data = await api.post('/cart/cupom', { items: cart.items, code: couponInput })
      setCartCoupon(data.coupon.code)
      setMessage(`Cupom de ${data.coupon.discountPercentage}% aplicado.`)
    } catch (couponError) {
      setCartCoupon('')
      setCouponError(couponError.message)
    } finally {
      setLoading(false)
    }
  }

  const cartLines = summary?.cart ?? []
  return <section className="page cart-page">
    <header className="page-header">
      <p className="eyebrow">Sua seleção</p>
      <h1>Seu carrinho</h1>
      <p className="page-header__subtitle">Gerencie os itens escolhidos e aplique seus cupons de desconto.</p>
    </header>
    <div className="cart-layout">
      <div className="cart-items-container">
        {!cart.items.length ? <EmptyState title="Seu carrinho está vazio" description="Explore o catálogo e adicione as peças que você gostar." action={<Button to="/catalogo">Ir para o catálogo</Button>} /> : null}
        {cart.items.length > 0 && summaryError && !summary ? <p className="form-alert" role="alert">{summaryError}</p> : null}
        {cartLines.map((item) => <article className="card cart-item-card" key={`${item.productId}:${item.size}`}>
          <div className="cart-item-card__details">
            <h2>{item.name}</h2>
            <p>{item.color}{item.size ? ` · Tamanho ${item.size}` : ''}</p>
            <strong>{formatPrice(item.priceCentavos)}</strong>
          </div>
          <div className="cart-item-card__actions">
            <div className="quantity-control" aria-label={`Quantidade de ${item.name}`}>
              <button type="button" aria-label="Diminuir quantidade" onClick={() => setCartQuantity(item.productId, item.size, item.quantity - 1)}>−</button>
              <span>{item.quantity}</span>
              <button type="button" aria-label="Aumentar quantidade" onClick={() => setCartQuantity(item.productId, item.size, item.quantity + 1)}>+</button>
            </div>
            <Button type="button" size="small" variant="ghost" onClick={() => removeCartItem(item.productId, item.size)}>Remover</Button>
          </div>
        </article>)}
        {cart.items.length > 0 && !cartLines.length && !error ? <p role="status">Carregando itens do carrinho...</p> : null}
        {cart.items.length > 0 ? <Button to="/catalogo" variant="ghost">← Continuar comprando</Button> : null}
      </div>
      <aside className="cart-summary card">
        <h2>Resumo do pedido</h2>
        <dl className="summary-values">
          <div><dt>Subtotal</dt><dd>{summary ? formatPrice(summary.subtotalCentavos) : '—'}</dd></div>
          <div><dt>Desconto</dt><dd>{summary?.discountCentavos ? `− ${formatPrice(summary.discountCentavos)}` : '—'}</dd></div>
          <div><dt>Total parcial</dt><dd>{summary ? formatPrice(summary.totalCentavos) : '—'}</dd></div>
        </dl>
        <form className="coupon-form" onSubmit={applyCoupon}>
          <label htmlFor="cart-coupon">Cupom de desconto</label>
          <div><input id="cart-coupon" value={couponInput} onChange={event => setCouponInput(event.target.value.toUpperCase())} maxLength={50} disabled={!cart.items.length} /><Button type="submit" disabled={loading || !cart.items.length}>{loading ? 'Validando...' : 'Aplicar'}</Button></div>
          {message ? <p className="form-success" role="status">{message}</p> : null}
          {couponError ? <p className="form-alert" role="alert">{couponError}</p> : null}
        </form>
        <p className="cart-summary__note">O frete será cotado no checkout para o endereço selecionado.</p>
        <Button to={cart.items.length && summary ? '/checkout' : undefined} disabled={!cart.items.length || !summary}>Continuar para o checkout →</Button>
      </aside>
    </div>
  </section>
}