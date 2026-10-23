import { useEffect, useState } from 'react'
import Button from './Button'
import { api } from '../services/api'
import { loadCardSdk } from '../services/cardSdk'
import AddPaymentCard from './AddPaymentCard'

function PayCard({ card, publicKey, orderId, onPaid }) {
  const [sdk, setSdk] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true, field
    loadCardSdk(publicKey).then(mp => {
      if (!active) return
      field = mp.fields.create('securityCode', { placeholder: 'CVV do cartão de teste' }).mount('mp-saved-cvv')
      setSdk(mp)
    }).catch(e => { if (active) setError(e.message) })
    return () => { active = false; field?.unmount() }
  }, [publicKey, card.id])
  async function pay(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const token = await sdk.fields.createCardToken({ cardId: card.providerCardId })
      await api.post(`/conta/cartoes/${card.id}/pagar`, { orderId, token: token.id })
      await onPaid()
    } catch (e) { setError(e.message || 'Não foi possível concluir. Consulte o pedido antes de tentar novamente.') }
    finally { setBusy(false) }
  }
  return <form onSubmit={pay} className="account-form"><p>Pagamento em 1 parcela. Confirme o CVV no campo seguro do Mercado Pago.</p><div className="mp-field" id="mp-saved-cvv" role="group" aria-label="Código de segurança do cartão salvo" />{error && <p className="form-alert" role="alert">{error}</p>}<Button type="submit" disabled={!sdk || busy}>{busy ? 'Consultando...' : 'Pagar com cartão salvo (teste)'}</Button></form>
}
export default function SavedCardPayment({ orderId, onPaid }) {
  const [data, setData] = useState(null), [selected, setSelected] = useState(''), [error, setError] = useState(''), [adding, setAdding] = useState(false)
  useEffect(() => { let active = true; api.get('/conta/cartoes').then(d => { if (active) setData(d) }).catch(e => { if (active) setError(e.message) }); return () => { active = false } }, [])
  const card = data?.cards.find(c => c.id === selected)
  async function reconcile() {
    setError('')
    try { await api.post(`/pagamentos/pedidos/${orderId}/reconciliar`, {}); await onPaid() } catch (e) { setError(e.message) }
  }
  const showAdd = adding || data?.cards.length === 0
  return <section className="card"><h3>Cartão de teste · Mercado Pago</h3>{error && <p className="form-alert" role="alert">{error}</p>}
    {data && !data.publicKey ? <p role="status">Os campos seguros de cartão aguardam a configuração do sandbox: Access Token, Public Key, URL HTTPS da API e segredo do webhook.</p> : data && <>
      {data.cards.length > 0 && <><label htmlFor="saved-card">Escolha seu cartão<select id="saved-card" value={selected} onChange={e => setSelected(e.target.value)} disabled={adding}><option value="">Selecione</option>{data.cards.map(c => <option key={c.id} value={c.id}>{c.paymentMethodId} · final {c.lastFourDigits}</option>)}</select></label><Button type="button" variant="ghost" onClick={() => setAdding(!adding)}>{adding ? 'Cancelar novo cartão' : 'Adicionar outro cartão de teste'}</Button></>}
      {showAdd ? <AddPaymentCard publicKey={data.publicKey} onSaved={async () => {
        const fresh = await api.get('/conta/cartoes')
        setData(fresh); setSelected(fresh.cards[0]?.id ?? ''); setAdding(false)
      }} /> : card && <PayCard key={card.id} card={card} publicKey={data.publicKey} orderId={orderId} onPaid={onPaid} />}
    </>}<Button type="button" onClick={reconcile} variant="ghost" size="small">Consultar pagamento solicitado</Button><Button to="/minha-conta/cartoes" variant="ghost" size="small">Gerenciar cartões</Button></section>
}
