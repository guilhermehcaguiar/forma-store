import SavedCardPayment from '../components/SavedCardPayment'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import Button from '../components/Button'
import { listAddresses, formatAddress } from '../services/account'
import { assertCartReady, useCartReview } from '../services/cartReview'
import { clearCart, useCart } from '../services/cart'
import { formatPrice } from '../services/products'
import { requestShippingQuote, submitCheckout } from '../services/shipping'
import { clearCheckoutKey, createOrderCheckout, getCheckoutKey, getOrder, verifyOrderPayment } from '../services/payments'

export default function Checkout() {
  const { user, ready } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const cart = useCart()
  const itemsKey = JSON.stringify(cart.items)
  const review = useCartReview(cart)
  const summary = !review.error && !review.loading ? review.data : null
  const [addresses, setAddresses] = useState([])
  const [addressOwnerId, setAddressOwnerId] = useState('')
  const [addressId, setAddressId] = useState('')
  const currentAddresses = user?.id === addressOwnerId ? addresses : []
  const selectedAddressId = currentAddresses.some(address => address.id === addressId) ? addressId : ''
  const quoteContext = `${user?.id ?? ''}:${selectedAddressId}:${itemsKey}:${review.data?.fingerprint ?? ''}`
  const quoteContextRef = useRef(quoteContext)
  useEffect(() => { quoteContextRef.current = quoteContext }, [quoteContext])
  const quoteRequestId = useRef(0)
  const [quote, setQuote] = useState(null)
  const [serviceSelection, setServiceSelection] = useState({ context: '', id: '' })
  const [quoteRequest, setQuoteRequest] = useState(null)
  const [order, setOrder] = useState(null)
  const [paymentUrl, setPaymentUrl] = useState('')
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [returnMessage, setReturnMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const activeQuote = quote?.context === quoteContext ? quote : null
  const serviceId = serviceSelection.context === quoteContext ? serviceSelection.id : ''
  const loadingAddresses = Boolean(user && addressOwnerId !== user.id)
  const busy = submitting || quoteRequest?.context === quoteContext
  const returnOrderId = searchParams.get('order_id')
  const returnPaymentId = searchParams.get('payment_id')

  useEffect(() => {
    let active = true
    if (!user) return undefined
    listAddresses()
      .then(items => {
        if (!active) return
        setAddresses(items)
        setAddressOwnerId(user.id)
        setAddressId(items.find(item => item.principal)?.id || items[0]?.id || '')
      })
      .catch(addressError => {
        if (active) {
          setAddresses([])
          setAddressOwnerId(user.id)
          setAddressId('')
          setError(addressError.message)
        }
      })
    return () => { active = false }
  }, [user])

  useEffect(() => {
    if (!user || !ready || !returnOrderId) return undefined
    let active = true
    async function reconcileReturn() {
      try {
        const { order: returnedOrder } = await getOrder(returnOrderId)
        if (active) setOrder(returnedOrder)
        if (returnPaymentId) {
          const verification = await verifyOrderPayment(returnOrderId, returnPaymentId)
          const { order: verifiedOrder } = await getOrder(returnOrderId)
          if (active) {
            setOrder(verifiedOrder)
            setReturnMessage(verification.verified
              ? 'O estado foi consultado no Mercado Pago; o retorno do navegador não é confirmação de aprovação.'
              : 'O Mercado Pago não confirmou a correspondência deste pagamento. O status continua conforme o servidor.')
          }
        } else if (active) {
          setReturnMessage('O pedido foi recarregado do servidor. A aprovação só aparece após confirmação do Mercado Pago.')
        }
      } catch (returnError) {
        if (active) setError(returnError.message)
      }
    }
    reconcileReturn()
    return () => { active = false }
  }, [user, ready, returnOrderId, returnPaymentId])

  async function calculateShipping() {
    const requestId = ++quoteRequestId.current
    if (!review.canCheckout || !user) return
    const requestedContext = quoteContext
    setQuoteRequest({ context: requestedContext, id: requestId })
    setError('')
    try {
      const fresh = await review.refresh()
      assertCartReady(fresh)
      if (fresh.fingerprint !== review.data?.fingerprint) throw new Error('Os dados do carrinho mudaram. Revise os valores e calcule o frete novamente.')
      const result = await requestShippingQuote({ addressId: selectedAddressId, items: cart.items })
      if (requestId === quoteRequestId.current && requestedContext === quoteContextRef.current) {
        setQuote({ ...result, context: requestedContext })
        if (!result.services.length) setError('O Melhor Envio não retornou serviços para este endereço e carrinho.')
      }
    } catch (quoteError) {
      if (requestId === quoteRequestId.current && requestedContext === quoteContextRef.current) {
        setError(quoteError.message)
      }
    } finally {
      setQuoteRequest(current => current?.id === requestId ? null : current)
    }
  }

  async function finishOrder() {
    if (!user) {
      navigate('/login', { state: { from: '/checkout' } })
      return
    }
    if (!review.canCheckout || !activeQuote?.quoteId || !serviceId || !selectedAddressId) return
    setSubmitting(true)
    setError('')
    try {
      const fresh = await review.refresh()
      assertCartReady(fresh)
      if (fresh.fingerprint !== review.data?.fingerprint) throw new Error('Os dados do carrinho mudaram. Revise os valores e calcule o frete novamente.')
      const result = await submitCheckout({
        items: cart.items,
        addressId: selectedAddressId,
        quoteId: activeQuote.quoteId,
        checkoutKey: getCheckoutKey({ userId: user.id, itemsKey, addressId: selectedAddressId, couponCode: cart.couponCode, serviceId }),
        serviceId,
        couponCode: cart.couponCode,
      })
      setOrder(result.order)
      clearCheckoutKey()
      clearCart()
    } catch (orderError) {
      setError(orderError.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function startSandboxPayment() {
    if (!order?.id) return
    setPaymentBusy(true)
    setError('')
    try {
      const { payment } = await createOrderCheckout(order.id)
      const checkoutUrl = new URL(payment.checkoutUrl)
      const sandboxHosts = new Set(['sandbox.mercadopago.com.br', 'sandbox.mercadopago.com'])
      if (checkoutUrl.protocol !== 'https:' || !sandboxHosts.has(checkoutUrl.hostname)) {
        throw new Error('O gateway não retornou um endereço de checkout sandbox válido.')
      }
      setPaymentUrl(checkoutUrl.toString())
      window.location.assign(checkoutUrl.toString())
    } catch (paymentError) {
      setError(paymentError.message)
    } finally {
      setPaymentBusy(false)
    }
  }

  const chosenService = activeQuote?.services.find(service => service.id === serviceId)
  const subtotal = summary?.subtotalCentavos ?? 0
  const discount = summary?.discountCentavos ?? 0
  const freight = chosenService?.priceCentavos ?? 0

  if (order) return <section className="page checkout-page">
    {order.status === 'aguardando_pagamento' && <SavedCardPayment orderId={order.id} onPaid={async () => setOrder((await getOrder(order.id)).order)} />}
    <header className="page-header"><p className="eyebrow">Pedido registrado</p><h1>Obrigado pela sua compra</h1><p className="page-header__subtitle">Pedido {order.id} · {order.status.replaceAll('_', ' ')}.</p></header>
    <section className="card checkout-confirmation"><h2>{order.status === 'pago' ? 'Pagamento aprovado' : order.status === 'cancelado' ? 'Pedido cancelado' : 'Entrega selecionada'}</h2><p>{order.shippingService}{order.shippingCompany ? ` · ${order.shippingCompany}` : ''}{order.deliveryDays ? ` · até ${order.deliveryDays} dias úteis` : ''}</p><p>Total do pedido: <strong>{formatPrice(order.totalCentavos)}</strong></p>
      {returnMessage ? <p className="form-success" role="status">{returnMessage}</p> : null}
      {order.status === 'aguardando_pagamento' ? <><p>O pedido está reservado até {order.paymentDeadlineAt ? new Date(order.paymentDeadlineAt).toLocaleTimeString('pt-BR') : 'o prazo informado'}. Use a conta e os cartões de teste no checkout do Mercado Pago. A FORMA não armazena dados de cartão; o status só muda após consulta validada ao gateway.</p><Button type="button" disabled={paymentBusy} onClick={startSandboxPayment}>{paymentBusy ? 'Preparando checkout...' : 'Pagar com Mercado Pago (teste)'}</Button></> : <p>Status confirmado pelo servidor: {order.status}.</p>}
      {error ? <p className="form-alert" role="alert">{error}</p> : null}
      {paymentUrl ? <p className="field__hint">Se o redirecionamento não abrir, <a href={paymentUrl}>continuar no checkout de teste</a>.</p> : null}
      <Button to="/minha-conta/pedidos" variant="ghost">Ver meus pedidos</Button></section>
  </section>

  return <section className="page checkout-page">
    <header className="page-header"><p className="eyebrow">Etapa final</p><h1>Finalize seu pedido</h1><p className="page-header__subtitle">Revise sua conta, endereço e pedido.</p></header>
    <div className="cart-layout">
      <div className="checkout-steps">
        <section className="card checkout-identification"><h2>01 Identificação</h2><div className="content-heading"><p>{user ? `Você está conectado como ${user.name}.` : 'Entre na sua conta ou cadastre-se para concluir o pedido.'}</p><Button to={user ? '/minha-conta/dados' : '/login'} state={user ? undefined : { from: '/checkout' }} variant="dark">{user ? 'Minha conta' : 'Entrar / criar'}</Button></div></section>
        <section className="card checkout-address"><h2>02 Endereço e entrega</h2>
          {!user ? <p>Entre na sua conta para selecionar um endereço salvo e calcular o frete.</p> : null}
          {user && loadingAddresses ? <p>Carregando endereços...</p> : null}
          {user && !loadingAddresses && !currentAddresses.length ? <><p>Nenhum endereço salvo para esta conta.</p><Button to="/minha-conta/enderecos" variant="ghost">Adicionar endereço →</Button></> : null}
          {currentAddresses.length ? <>
            <label htmlFor="checkout-address">Endereço de entrega</label>
            <select id="checkout-address" value={selectedAddressId} onChange={event => setAddressId(event.target.value)} disabled={submitting}>
              {currentAddresses.map(address => <option key={address.id} value={address.id}>{address.label} · {address.city}/{address.state}{address.principal ? ' · principal' : ''}</option>)}
            </select>
            <p className="field__hint">{formatAddress(currentAddresses.find(address => address.id === selectedAddressId) ?? currentAddresses[0])}</p>
            <Button type="button" variant="ghost" disabled={!selectedAddressId || !cart.items.length || busy || !review.canCheckout} onClick={calculateShipping}>{busy ? 'Consultando...' : 'Calcular frete'}</Button>
            {activeQuote?.services.length ? <fieldset className="shipping-options"><legend>Serviços disponíveis</legend>{activeQuote.services.map(service => <label className="shipping-option" key={service.id}>
              <input type="radio" name="shipping-service" value={service.id} checked={serviceId === service.id} onChange={() => setServiceSelection({ context: quoteContext, id: service.id })} />
              <span><strong>{service.name}</strong>{service.company ? ` · ${service.company}` : ''}<small>{service.deliveryDays ? `${service.deliveryDays} dias úteis` : 'Prazo não informado pelo serviço'}</small></span>
              <strong>{formatPrice(service.priceCentavos)}</strong>
            </label>)}</fieldset> : null}
          </> : null}
        </section>
        <section className="card"><h2>03 Pagamento</h2><p>Após confirmar, escolha um cartão salvo na FORMA ou o Checkout Pro do Mercado Pago.</p><div className="checkout-note">Use sua conta e seus cartões de teste. A FORMA não armazena dados de cartão, e o pagamento só é confirmado após consulta ao gateway.</div></section>
      </div>
      <aside className="card cart-summary">
        <h2>Seu pedido</h2>
        {!cart.items.length ? <p>Seu carrinho está vazio. Adicione peças antes de continuar.</p> : null}
        {summary?.cart.map(item => <div className="checkout-line" key={`${item.productId}:${item.size}`}><span>{item.quantity} × {item.name}{item.size ? ` · ${item.size}` : ''}</span><strong>{formatPrice(item.lineTotalCentavos)}</strong></div>)}
        <dl className="summary-values">
          <div><dt>Subtotal</dt><dd>{summary ? formatPrice(subtotal) : '—'}</dd></div>
          <div><dt>Frete</dt><dd>{chosenService ? formatPrice(freight) : 'A calcular'}</dd></div>
          <div><dt>Cupom</dt><dd>{discount ? `− ${formatPrice(discount)}` : cart.couponCode || '—'}</dd></div>
          <div><dt>Total</dt><dd>{summary && chosenService ? formatPrice(subtotal - discount + freight) : '—'}</dd></div>
        </dl>
        {summary?.coupon ? <p className="form-success">Cupom {cart.couponCode} aplicado.</p> : null}
        {review.error || error ? <p className="form-alert" role="alert">{review.error || error}</p> : null}
        {summary && !review.canCheckout ? <p className="form-alert" role="alert">{summary.priceChanges.length ? 'Os preços mudaram. Aceite os preços atualizados no carrinho.' : summary.couponError || 'O estoque ou a disponibilidade mudou. Revise o carrinho.'}</p> : null}
        {review.loading && cart.items.length ? <p role="status">Conferindo preços e estoque...</p> : null}
        <Button type="button" variant="ghost" disabled={busy || review.loading} onClick={() => review.refresh().catch(() => {})}>Atualizar pedido</Button>
        <Button type="button" disabled={busy || !review.canCheckout || !cart.items.length || !summary || !activeQuote?.quoteId || !serviceId} onClick={finishOrder}>{user ? 'Confirmar pedido →' : 'Entrar para concluir →'}</Button>
        <Button to="/carrinho" variant="ghost">Voltar ao carrinho</Button>
      </aside>
    </div>
    {!ready ? <p role="status">Verificando sua sessão...</p> : null}
  </section>
}
