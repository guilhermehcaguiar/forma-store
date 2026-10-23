import { useEffect, useState } from 'react'
import { DemoNotice } from '../../components/DemoPayment'
import { api } from '../../services/api'
import { formatPrice } from '../../services/products'

const orderLabels = { aguardando_pagamento: 'Aguardando pagamento', pago: 'Pagamento confirmado', cancelado: 'Cancelado', revisao_manual: 'Em revisão manual' }
const paymentLabels = { criada: 'Criado', pendente: 'Pendente', em_processamento: 'Em processamento', aprovada: 'Aprovado', recusada: 'Recusado', cancelada: 'Cancelado', reembolsada: 'Reembolsado', revisao_manual: 'Em revisão manual' }

export default function AdminOrders() {
  const [orders, setOrders] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  useEffect(() => {
    let active = true
    api.get('/admin/pedidos').then(data => { if (active) setOrders(data.orders) }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  return <><header className="page-header"><p className="eyebrow">Administração</p><h1>Pedidos</h1><p>Últimos 200 pedidos. Estados registrados pelo servidor; pedidos demonstrativos são identificados.</p></header>
    <label className="catalog-field" htmlFor="orders-status">Estado<select id="orders-status" value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos</option>{Object.entries(orderLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {error && <p className="form-alert" role="alert">{error}</p>}{loading && <p>Carregando pedidos...</p>}
    {!loading && !error && orders.length === 0 && <p>Nenhum pedido registrado.</p>}
    {orders.filter(o => !status || o.status === status).map(order => <article className="card" key={order.id}><h2 className="order-id">Pedido {order.id}</h2>{order.transactionMode === 'demo' && <DemoNotice />}<p>{order.customerName} · {new Date(order.createdAt).toLocaleString('pt-BR')}</p><p>Pedido: <strong>{orderLabels[order.status] ?? order.status}</strong> · Pagamento: {paymentLabels[order.paymentStatus] ?? 'Não iniciado'} {order.paymentKind ? `(${order.paymentKind === 'demo' ? 'Demonstração local' : order.paymentKind === 'card_saved' ? 'Cartão salvo' : 'Checkout Pro'})` : ''}</p><p>{order.shippingService} · Total {formatPrice(Number(order.totalCentavos))}</p><details><summary>Itens registrados no pedido</summary>{order.items.map((item, index) => <p key={index}>{item.quantity} × {item.name} · {item.size} · {formatPrice(Number(item.unitPriceCentavos))} por unidade</p>)}</details></article>)}
  </>
}
