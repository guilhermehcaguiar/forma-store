import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import FormField from '../components/FormField'
import { useAuth } from '../context/useAuth'

function Account() {
  const { user, updateProfile, logout } = useAuth()
  const navigate = useNavigate()
  const [draft, setDraft] = useState({})
  const name = draft.name ?? user.name
  const promo = draft.promo ?? user.promo
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setFeedback('')

    if (!name.trim()) {
      setError('Informe seu nome.')
      return
    }

    try {
      updateProfile({ name, promo })
      setDraft({})
      setFeedback('Dados atualizados com sucesso.')
    } catch (updateError) {
      setError(updateError.message || 'Não foi possível salvar as alterações.')
    }
  }

  function handleLogout() {
    try {
      logout()
      navigate('/login', { replace: true })
    } catch (logoutError) {
      setError(logoutError.message)
    }
  }

  return (
    <>
          <div><h2>Dados pessoais</h2><p className="page-header__subtitle">Seu perfil e suas preferências, em um só lugar.</p></div>
          <form id="account-profile" className="card account-form" onSubmit={handleSubmit} noValidate>
            <h2>Dados pessoais</h2>

            {error ? (
              <p className="form-alert" role="alert">
                {error}
              </p>
            ) : null}

            {feedback ? (
              <p className="form-success" role="status">
                {feedback}
              </p>
            ) : null}

            <FormField
              id="account-name"
              label="Nome completo"
              type="text"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setDraft(current => ({ ...current, name: event.target.value }))}
            />

            <FormField id="account-email" label="E-mail" type="email" value={user.email} readOnly hint="O e-mail não pode ser alterado." />

            <label className="checkbox">
              <input
                type="checkbox"
                checked={promo}
                onChange={(event) => setDraft(current => ({ ...current, promo: event.target.checked }))}
              />
              <span>Quero receber promoções por e-mail.</span>
            </label>

            <div className="account-form__actions">
              <Button type="submit">Salvar alterações</Button>
              <Button type="button" variant="logout" onClick={handleLogout}>
                Sair da conta
              </Button>
            </div>
          </form>

          <aside className="card account-summary">
            <h2>Resumo</h2>
            <p>
              <span className="account-summary__label">Nome</span>
              <span className="account-summary__value">{user.name}</span>
            </p>
            <p>
              <span className="account-summary__label">E-mail</span>
              <span className="account-summary__value">{user.email}</span>
            </p>
            <p>
              <span className="account-summary__label">Promoções</span>
              <span className="account-summary__value">
                {user.promo ? 'Ativadas' : 'Desativadas'}
              </span>
            </p>
          </aside>
    </>
  )
}

export default Account
