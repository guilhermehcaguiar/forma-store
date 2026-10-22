import { useEffect, useState } from 'react'
import Button from '../../components/Button'
import { api } from '../../services/api'
import { loadCardSdk } from '../../services/cardSdk'

function AddCard({ publicKey, onSaved }) {
  const [sdk, setSdk] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => {
    let active = true, fields = []
    loadCardSdk(publicKey).then(mp => {
      if (!active) return
      fields = ['cardNumber', 'expirationDate', 'securityCode'].map(type => mp.fields.create(type, { placeholder: { cardNumber: 'Número do cartão de teste', expirationDate: 'MM/AA', securityCode: 'CVV' }[type] }).mount(`mp-add-${type}`))
      setSdk(mp)
    }).catch(e => { if (active) setError(e.message) })
    return () => { active = false; fields.forEach(field => field.unmount()) }
  }, [publicKey])
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('')
    const form = new FormData(event.currentTarget)
    try {
      const token = await sdk.fields.createCardToken({ cardholderName: form.get('holder'), identificationType: 'CPF', identificationNumber: form.get('document') })
      await api.post('/conta/cartoes', { token: token.id })
      await onSaved()
    } catch { setError('Não foi possível salvar o cartão de teste. Confira os dados ou a configuração do sandbox.') }
    finally { setBusy(false) }
  }
  return <form className="card account-form" onSubmit={save}><h3>Adicionar cartão de teste</h3>
    <p>Número, validade e CVV são preenchidos nos campos seguros do Mercado Pago.</p>
    <label>Nome do titular<input name="holder" autoComplete="cc-name" required maxLength={120} /></label>
    <label>CPF do titular de teste<input name="document" inputMode="numeric" required pattern="[0-9]{11}" maxLength={11} /></label>
    <div className="mp-field" id="mp-add-cardNumber" aria-label="Número do cartão no Mercado Pago" />
    <div className="mp-field" id="mp-add-expirationDate" aria-label="Validade no Mercado Pago" />
    <div className="mp-field" id="mp-add-securityCode" aria-label="CVV no Mercado Pago" />
    {error && <p role="alert" className="form-alert">{error}</p>}
    <Button type="submit" disabled={!sdk || busy}>{busy ? 'Salvando...' : 'Salvar cartão'}</Button></form>
}

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
      {adding && <AddCard publicKey={data.publicKey} onSaved={async () => { setAdding(false); await reload() }} />}
    </>}</>
}
