import { Link } from 'react-router-dom'
import ProductImage from '../../components/ProductImage'
import SavedCardPayment from '../../components/SavedCardPayment'
import { useEffect, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import Button from '../../components/Button'
import EmptyState from '../../components/EmptyState'
import useAccountData from '../../context/useAccountData'
import { removeFavorite, removeListItem } from '../../services/account'
import { displayPrice, getProduct } from '../../services/products'
import { api } from '../../services/api'
import { createOrderCheckout } from '../../services/payments'

const productHint = 'Esta peça não está disponível no catálogo atual.'

// Card de um produto salvo (favorito ou item de lista). Enquanto o catálogo
// do bloco de produtos não existe, o id resolvido como desconhecido é exibido
// como "Produto indisponível" — o mesmo estado aprovado da tela de produto.
function SavedProduct({ eyebrow, title, productId, emptyDescription, onRemove, busy }) {
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getProduct(productId).then(p => { if (active) setProduct(p) }).catch(e => { if (active && e.status !== 404) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [productId])
  return (
    <article className="card saved-item">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h3>{loading ? 'Carregando peça...' : product ? <Link to={`/produto/${product.id}`}>{product.name}</Link> : title}</h3>
        {product && <ProductImage product={product} className="admin-product-image" />}
        {error && <p className="form-alert" role="alert">{error}</p>}
        <p>{product ? product.description || productHint : emptyDescription}</p>
        {displayPrice(product) ? <p>{displayPrice(product)}</p> : null}
      </div>
      <div className="account-form__actions">
        <Button type="button" size="small" variant="ghost" disabled={busy} onClick={onRemove}>Remover</Button>
      </div>
    </article>
  )
}

// Favoritos dentro de Minha Conta (dados chegam do layout da conta).
export function Favorites() {
  const { data, reload } = useOutletContext()
  return <FavoritesContent data={data} reload={reload} heading />
}

export function FavoritesPage() {
  const account = useAccountData()
  return (
    <section className="page favorites-page">
      <header className="page-header"><p className="eyebrow">Sua seleção</p><h1>Favoritos</h1><p className="page-header__subtitle">Guarde as peças que têm a sua cara.</p></header>
      {account.error ? <p className="form-alert" role="alert">{account.error}</p> : null}
      {account.loading ? <p className="page-header__subtitle">Carregando seus favoritos...</p> : <FavoritesContent data={account.data} reload={account.reload} />}
    </section>
  )
}

function FavoritesContent({ data, reload, heading = false }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const favorites = data.favorites.filter(Boolean)

  async function remove(productId) {
    setError('')
    setBusy(true)
    try {
      await removeFavorite(productId)
      await reload()
    } catch (removeError) {
      setError(removeError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {heading ? <div><h2>Favoritos</h2><p className="page-header__subtitle">Guarde as peças que têm a sua cara.</p></div> : null}
      {error && <p className="form-alert" role="alert">{error}</p>}
      {!favorites.length ? (
        <EmptyState title="Seus favoritos estão vazios" description="Explore o catálogo e salve suas peças favoritas." action={<Button to="/catalogo">Explorar peças</Button>} />
      ) : (
        favorites.map(productId => (
          <SavedProduct
            key={productId}
            eyebrow="Favorito salvo"
            title="Produto indisponível"
            productId={productId}
            emptyDescription={productHint}
            busy={busy}
            onRemove={() => remove(productId)}
          />
        ))
      )}
    </>
  )
}

export function Orders() {
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    api.get('/conta/pedidos')
      .then(data => { if (active) setOrders(data.orders) })
      .catch(loadError => { if (active) setError(loadError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  return <><div><h2>Meus pedidos</h2><p className="page-header__subtitle">Acompanhe suas compras em um só lugar.</p></div>
    {error ? <p className="form-alert" role="alert">{error}</p> : null}
    {loading ? <p>Carregando pedidos...</p> : !orders.length ? <EmptyState title="Você ainda não fez um pedido" description="Após uma compra, os itens e o andamento da entrega aparecerão aqui." action={<Button to="/catalogo">Explorar peças</Button>} /> : orders.map(order => <article className="card saved-item" key={order.id}><div><p className="eyebrow">Pedido {order.id}</p><h3>{orderStatusLabel(order.status)}</h3><p>{order.shippingService}{order.deliveryDays ? ` · até ${order.deliveryDays} dias úteis` : ''}</p><p>{new Date(order.createdAt).toLocaleDateString('pt-BR')}</p><Button to={`/minha-conta/pedidos/${order.id}`} size="small" variant="ghost">Detalhes →</Button></div><strong>{formatOrderPrice(order.totalCentavos)}</strong></article>)}
  </>
}

function formatOrderPrice(centavos) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function orderStatusLabel(status) {
  return {
    aguardando_pagamento: 'Aguardando pagamento',
    pago: 'Pagamento confirmado',
    cancelado: 'Cancelado',
    revisao_manual: 'Em revisão manual',
  }[status] ?? 'Status indisponível'
}

export function OrderDetail() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    api.get(`/conta/pedidos/${id}`)
      .then(data => { if (active) setOrder(data.order) })
      .catch(loadError => { if (active) setError(loadError.message) })
    return () => { active = false }
  }, [id])

  async function resumeTestPayment() {
    setBusy(true)
    setError('')
    try {
      const { payment } = await createOrderCheckout(id)
      const checkoutUrl = new URL(payment.checkoutUrl)
      if (checkoutUrl.protocol !== 'https:' || !['sandbox.mercadopago.com.br', 'sandbox.mercadopago.com'].includes(checkoutUrl.hostname)) {
        throw new Error('O gateway não retornou um endereço de checkout sandbox válido.')
      }
      window.location.assign(checkoutUrl.toString())
    } catch (paymentError) {
      setError(paymentError.message)
    } finally {
      setBusy(false)
    }
  }

  if (!order) return error
    ? <EmptyState title="Pedido não encontrado" description={error} action={<Button to="/minha-conta/pedidos">Voltar para meus pedidos</Button>} />
    : <p>Carregando pedido...</p>

  const address = order.addressSnapshot
  return <section className="order-detail">
    <div className="content-heading"><div><p className="eyebrow">Pedido</p><h2>{order.id}</h2><p>{orderStatusLabel(order.status)}{order.status === 'pago' ? ' pelo servidor.' : '.'}</p></div><Button to="/minha-conta/pedidos" variant="ghost">Voltar aos pedidos</Button></div>
    {error ? <p className="form-alert" role="alert">{error}</p> : null}
    {order.status === 'aguardando_pagamento' ? <div className="order-detail__payment"><p>Escolha o Checkout Pro ou pague com um cartão salvo na sua conta FORMA.</p><Button type="button" disabled={busy} onClick={resumeTestPayment}>{busy ? 'Abrindo...' : 'Pagar no Mercado Pago (teste)'}</Button></div> : null}
    {order.status === 'aguardando_pagamento' && <SavedCardPayment orderId={id} onPaid={async () => setOrder((await api.get(`/conta/pedidos/${id}`)).order)} />}
    <section className="card order-detail__section"><h3>Itens</h3>{order.items.map(item => <div className="checkout-line" key={`${item.productId}:${item.size}`}><span>{item.quantity} × {item.name}{item.size ? ` · ${item.size}` : ''} · {item.color}</span><strong>{formatOrderPrice(Number(item.lineTotalCentavos))}</strong></div>)}</section>
    <section className="card order-detail__section"><h3>Entrega</h3><p>{order.shippingService}{order.shippingCompany ? ` · ${order.shippingCompany}` : ''}{order.deliveryDays ? ` · até ${order.deliveryDays} dias úteis` : ''}</p>{address ? <p>{address.recipient}<br />{address.street}, {address.number}{address.complement ? ` · ${address.complement}` : ''}<br />{address.district}, {address.city}/{address.state} · CEP {address.cep}</p> : null}</section>
    <dl className="summary-values order-detail__totals"><div><dt>Subtotal</dt><dd>{formatOrderPrice(Number(order.subtotalCentavos))}</dd></div><div><dt>Desconto</dt><dd>{formatOrderPrice(Number(order.discountCentavos))}</dd></div><div><dt>Frete</dt><dd>{formatOrderPrice(Number(order.shippingCentavos))}</dd></div><div><dt>Total</dt><dd>{formatOrderPrice(Number(order.totalCentavos))}</dd></div></dl>
  </section>
}

// Itens de uma lista de compras (RF20): consultar, remover; adicionar acontece
// na tela de produto quando o catálogo existir.
export function ListItems({ list, reload }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const items = list.productIds.filter(Boolean)

  async function remove(productId) {
    setError('')
    setBusy(true)
    try {
      await removeListItem(list.id, productId)
      await reload()
    } catch (removeError) {
      setError(removeError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {error && <p className="form-alert" role="alert">{error}</p>}
      {!items.length ? (
        <EmptyState title="Esta lista ainda está vazia" description="Quando houver peças disponíveis, elas poderão fazer parte das suas escolhas." action={<Button to="/catalogo">Explorar peças</Button>} />
      ) : (
        items.map(productId => (
          <SavedProduct
            key={productId}
            eyebrow="Peça na lista"
            title="Produto indisponível"
            productId={productId}
            emptyDescription={productHint}
            busy={busy}
            onRemove={() => remove(productId)}
          />
        ))
      )}
    </>
  )
}
