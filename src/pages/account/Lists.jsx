import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import Button from '../../components/Button'
import EmptyState from '../../components/EmptyState'
import FormField from '../../components/FormField'
import { saveList, removeList } from '../../services/account'
import { ListItems } from './Collections'

export default function Lists() {
  const { data, reload } = useOutletContext()
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [removing, setRemoving] = useState(null)
  const [busy, setBusy] = useState(false)
  async function save(event) {
    event.preventDefault()
    setBusy(true)
    try {
      await saveList(draft)
      setDraft(null)
      setError('')
      setFeedback('Lista salva.')
      await reload()
    } catch (saveError) {
      setError(saveError.message)
      setFeedback('')
    } finally {
      setBusy(false)
    }
  }
  async function remove(id) {
    setBusy(true)
    try {
      await removeList(id)
      setRemoving(null)
      setError('')
      setFeedback('Lista removida.')
      if (draft?.id === id) setDraft(null)
      await reload()
    } catch (removeError) {
      setError(removeError.message)
      setFeedback('')
    } finally {
      setBusy(false)
    }
  }
  const lists = data.lists.filter(item => item?.id && item.name)
  return <>
    <div className="content-heading"><div><h2>Lista de compras</h2><p className="page-header__subtitle">Organize suas próximas escolhas.</p></div><Button type="button" onClick={() => { setDraft({ name: '' }); setError(''); setFeedback('') }}>Nova lista</Button></div>
    {error && <p className="form-alert" role="alert">{error}</p>}{feedback && <p className="form-success" role="status">{feedback}</p>}
    {draft && <form className="card account-form" onSubmit={save}><h3>{draft.id ? 'Renomear lista' : 'Nova lista'}</h3><FormField id="list-name" label="Nome da lista" required maxLength={80} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /><div className="account-form__actions"><Button type="submit" disabled={busy}>Salvar lista</Button><Button type="button" variant="ghost" onClick={() => { setDraft(null); setError('') }}>Cancelar</Button></div></form>}
    {!lists.length && !draft ? <EmptyState title="Suas listas começam aqui" description="Crie uma lista e organize as peças que deseja encontrar." /> : null}
    {lists.map(list => <article className="card saved-item" key={list.id}><div><h3><Link to={`/minha-conta/listas/${list.id}`}>{list.name}</Link></h3><p>{list.productIds.length} peça(s) nesta lista.</p></div><div className="account-form__actions">{removing === list.id ? <><span>Remover esta lista?</span><Button type="button" size="small" disabled={busy} onClick={() => remove(list.id)}>Confirmar remoção</Button><Button type="button" size="small" variant="ghost" onClick={() => setRemoving(null)}>Cancelar</Button></> : <><Button to={`/minha-conta/listas/${list.id}`} size="small">Abrir lista</Button><Button type="button" size="small" variant="ghost" onClick={() => { setDraft({ id: list.id, name: list.name }); setError(''); setFeedback('') }}>Renomear</Button><Button type="button" size="small" variant="ghost" onClick={() => setRemoving(list.id)}>Remover</Button></>}</div></article>)}
  </>
}

export function ListDetail() {
  const { id } = useParams()
  const { data, reload } = useOutletContext()
  const list = data.lists.find(item => item?.id === id)
  if (!list) return <EmptyState title="Lista não encontrada" action={<Button to="/minha-conta/listas">Voltar para as listas</Button>} />
  return <><div><p className="eyebrow">Lista de compras</p><h2>{list.name}</h2></div><ListItems list={list} reload={reload} /><Button to="/minha-conta/listas" variant="ghost">← Voltar para as listas</Button></>
}
