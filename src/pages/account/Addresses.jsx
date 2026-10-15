import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import Button from '../../components/Button'
import EmptyState from '../../components/EmptyState'
import FormField from '../../components/FormField'
import { saveAddress, setPrincipalAddress, removeAddress, formatAddress } from '../../services/account'

const blank = { label: '', recipient: '', cep: '', street: '', number: '', complement: '', district: '', city: '', state: '' }
const fields = [['label', 'Nome do endereço', 'Casa ou trabalho'], ['recipient', 'Destinatário'], ['cep', 'CEP', '00000-000'], ['street', 'Rua'], ['number', 'Número'], ['complement', 'Complemento (opcional)'], ['district', 'Bairro'], ['city', 'Cidade'], ['state', 'UF', 'SP']]

export default function Addresses() {
  const { user } = useAuth()
  const { data, reload } = useOutletContext()
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [removing, setRemoving] = useState(null)
  const [busy, setBusy] = useState(false)
  const addresses = data.addresses.filter(item => item?.id && item.street)
  async function save(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await saveAddress(draft)
      setDraft(null)
      setFeedback('Endereço salvo.')
      await reload()
    } catch (saveError) {
      setError(saveError.message)
      setFeedback('')
    } finally {
      setBusy(false)
    }
  }
  async function remove(id) {
    setError('')
    setBusy(true)
    try {
      await removeAddress(id)
      setRemoving(null)
      setFeedback('Endereço removido.')
      if (draft?.id === id) setDraft(null)
      await reload()
    } catch (removeError) {
      setError(removeError.message)
      setFeedback('')
    } finally {
      setBusy(false)
    }
  }
  // Seleção explícita do endereço principal (RF05).
  async function definePrincipal(id) {
    setError('')
    setBusy(true)
    try {
      await setPrincipalAddress(id)
      setFeedback('Endereço principal atualizado.')
      await reload()
    } catch (principalError) {
      setError(principalError.message)
      setFeedback('')
    } finally {
      setBusy(false)
    }
  }
  return <>
    <div className="content-heading"><div><h2>Endereços</h2><p className="page-header__subtitle">Organize seus endereços de entrega.</p></div><Button type="button" onClick={() => { setDraft({ ...blank, recipient: user.name }); setError(''); setFeedback('') }}>Novo endereço</Button></div>
    {error && <p className="form-alert" role="alert">{error}</p>}
    {feedback && <p className="form-success" role="status">{feedback}</p>}
    {draft && <form className="card account-form" onSubmit={save}>
      <h3>{draft.id ? 'Editar endereço' : 'Novo endereço'}</h3>
      <div className="form-grid">{fields.map(([field, label, placeholder]) => <FormField key={field} id={`address-${field}`} label={label} placeholder={placeholder} value={draft[field]} required={field !== 'complement'} maxLength={field === 'state' ? 2 : field === 'cep' ? 9 : 120} inputMode={field === 'cep' ? 'numeric' : undefined} onChange={event => setDraft({ ...draft, [field]: event.target.value })} />)}</div>
      <div className="account-form__actions"><Button type="submit" disabled={busy}>Salvar endereço</Button><Button type="button" variant="ghost" onClick={() => { setDraft(null); setError('') }}>Cancelar</Button></div>
    </form>}
    {!addresses.length && !draft ? <EmptyState title="Nenhum endereço salvo" description="Adicione um endereço para encontrá-lo aqui quando precisar." /> : null}
    {addresses.map(address => <article className="card saved-item" key={address.id}>
      <div><p className="eyebrow">{address.principal ? 'Endereço principal' : 'Endereço salvo'}</p><h3>{address.label}</h3><p>{address.recipient}</p><p>{formatAddress(address)}</p></div>
      <div className="account-form__actions">{removing === address.id ? <><span>Remover este endereço?</span><Button type="button" size="small" disabled={busy} onClick={() => remove(address.id)}>Confirmar remoção</Button><Button type="button" size="small" variant="ghost" onClick={() => setRemoving(null)}>Cancelar</Button></> : <><Button type="button" size="small" variant="ghost" onClick={() => { setDraft({ ...blank, ...address }); setFeedback(''); setError('') }}>Editar</Button>{!address.principal && <Button type="button" size="small" variant="ghost" disabled={busy} onClick={() => definePrincipal(address.id)}>Definir como principal</Button>}<Button type="button" size="small" variant="ghost" onClick={() => setRemoving(address.id)}>Remover</Button></>}</div>
    </article>)}
  </>
}
