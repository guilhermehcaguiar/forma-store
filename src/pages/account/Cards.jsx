import { useEffect, useState } from 'react'
import Button from '../../components/Button'
import { api } from '../../services/api'
import AddPaymentCard from '../../components/AddPaymentCard'

export default function Cards() {
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [adding, setAdding] = useState(false)
  const reload = () => api.get('/conta/cartoes').then(setData)
  useEffect(() => { let active = true; api.get('/conta/cartoes').then(d => { if (active) setData(d) }).catch(e => { if (active) setError(e.message) }); return () => { active = false } }, [])
  async function remove(id) {
    setBusy(true); setError('')
    try { await api.delete(`/conta/cartoes/${id}`); await reload() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <><h2>Cartões salvos</h2><p>Cartões tokenizados pelo Mercado Pago, disponíveis apenas na sua conta FORMA. Ambiente de teste.</p>
    {error && <p className="form-alert" role="alert">{error}</p>}
    {!data ? <p>Carregando cartões...</p> : <>
      {!data.publicKey && <p className="form-alert" role="status">Adicionar cartões e pagar com cartão salvo aguardam configuração do sandbox. Você pode consultar seus cartões cadastrados.</p>}
      {data.cards.length === 0 && <p>Você ainda não salvou cartões.</p>}
      {data.cards.map(card => <article className="card saved-item" key={card.id}><div><h3>{card.paymentMethodId} · final {card.lastFourDigits}</h3><p>{card.cardholderName} · {card.expirationMonth}/{card.expirationYear}</p></div><Button type="button" variant="ghost" disabled={busy} onClick={() => remove(card.id)}>Remover cartão</Button></article>)}
      <Button type="button" disabled={!data.publicKey || busy} onClick={() => setAdding(!adding)}>{adding ? 'Cancelar' : 'Adicionar cartão'}</Button>
      {adding && <AddPaymentCard publicKey={data.publicKey} onSaved={async () => { setAdding(false); await reload() }} />}
    </>}</>
}
