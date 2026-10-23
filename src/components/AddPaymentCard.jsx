import { useEffect, useState } from 'react'
import Button from './Button'
import { api } from '../services/api'
import { loadCardSdk } from '../services/cardSdk'

export default function AddPaymentCard({ publicKey, onSaved }) {
  const [sdk, setSdk] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => {
    let active = true, fields = []
    loadCardSdk(publicKey).then(mp => {
      if (!active) return
      fields = ['cardNumber', 'expirationDate', 'securityCode'].map(type => mp.fields.create(type, {
        placeholder: { cardNumber: 'Número do cartão de teste', expirationDate: 'MM/AA', securityCode: 'CVV' }[type],
      }).mount(`mp-add-${type}`))
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
    <p>Número, validade e CVV são preenchidos nos campos seguros do Mercado Pago. Use somente cartões de teste.</p>
    <label>Nome do titular<input className="field__input" name="holder" autoComplete="cc-name" required maxLength={120} /></label>
    <label>CPF do titular de teste<input className="field__input" name="document" inputMode="numeric" required pattern="[0-9]{11}" maxLength={11} /></label>
    {[['cardNumber', 'Número do cartão de teste'], ['expirationDate', 'Validade (MM/AA)'], ['securityCode', 'Código de segurança (CVV)']].map(([type, label]) => <div className="field" key={type}><span className="field__label" id={`mp-label-${type}`}>{label}</span><div className="mp-field" id={`mp-add-${type}`} role="group" aria-labelledby={`mp-label-${type}`} /></div>)}
    {error && <p role="alert" className="form-alert">{error}</p>}
    <Button type="submit" disabled={!sdk || busy}>{busy ? 'Salvando...' : 'Salvar cartão'}</Button></form>
}
