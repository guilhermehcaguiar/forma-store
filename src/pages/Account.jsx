import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import FormField from '../components/FormField'
import { useAuth } from '../context/useAuth'

function Account() {
  const { user, updateProfile, changeEmail, changePassword, logout } = useAuth()
  const navigate = useNavigate()
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const name = draft.name ?? user.name
  const promo = draft.promo ?? user.promo
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setFeedback('')

    if (!name.trim()) {
      setError('Informe seu nome.')
      return
    }

    setSaving(true)

    try {
      await updateProfile({ name, promo })
      setDraft({})
      setFeedback('Dados atualizados com sucesso.')
    } catch (updateError) {
      setError(updateError.fields?.name || updateError.message || 'Não foi possível salvar as alterações.')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    setError('')
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (logoutError) {
      setError(logoutError.message || 'Não foi possível sair.')
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

            <FormField id="account-profile-email" label="E-mail" type="email" value={user.email} readOnly hint="Altere o e-mail no formulário seguro abaixo." />

            <label className="checkbox">
              <input
                type="checkbox"
                checked={promo}
                onChange={(event) => setDraft(current => ({ ...current, promo: event.target.checked }))}
              />
              <span>Quero receber promoções por e-mail.</span>
            </label>

            <div className="account-form__actions">
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </Button>
              <Button type="button" variant="logout" onClick={handleLogout}>
                Sair da conta
              </Button>
            </div>
          </form>

          <CredentialForm kind="email" onSave={changeEmail} email={user.email} />
          <CredentialForm kind="password" onSave={changePassword} />

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

function CredentialForm({ kind, onSave, email }) {
  const isEmail = kind === 'email'
  const [values, setValues] = useState({ currentPassword: '', email: '', newPassword: '', confirmPassword: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState({})
  const [notice, setNotice] = useState('')
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setFields({}); setNotice('')
    try {
      const data = isEmail ? { email: values.email, currentPassword: values.currentPassword }
        : { currentPassword: values.currentPassword, newPassword: values.newPassword, confirmPassword: values.confirmPassword }
      await onSave(data)
      setValues({ currentPassword: '', email: '', newPassword: '', confirmPassword: '' })
      setNotice(`${isEmail ? 'E-mail alterado' : 'Senha alterada'} com sucesso. As outras sessões foram encerradas.`)
    } catch (failure) { setError(failure.message); setFields(failure.fields ?? {}) }
    finally { setBusy(false) }
  }
  const input = (key, label, autoComplete, type = 'password') => <FormField
    id={`account-${kind}-${key}`} key={key} label={label} type={type} autoComplete={autoComplete}
    value={values[key]} required maxLength={key === 'currentPassword' ? 1024 : key === 'email' ? 254 : 128}
    error={fields[key]} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} />
  return <form id={`account-${kind}`} className="card account-form" onSubmit={submit} noValidate>
    <h2>{isEmail ? 'Alterar e-mail' : 'Alterar senha'}</h2>
    <p>{isEmail ? `E-mail atual: ${email}.` : 'Use uma senha de 6 a 128 caracteres.'} Confirme sua senha atual para salvar. Sua sessão atual permanece conectada.</p>
    {error ? <p className="form-alert" role="alert">{error}</p> : null}
    {notice ? <p className="form-success" role="status">{notice}</p> : null}
    <fieldset className="profile-credentials" disabled={busy}><legend>{isEmail ? 'Novo e-mail' : 'Nova senha'}</legend>
      {isEmail ? input('email', 'Novo e-mail', 'email', 'email') : null}
      {input('currentPassword', 'Senha atual', 'current-password')}
      {!isEmail ? <>{input('newPassword', 'Nova senha', 'new-password')}{input('confirmPassword', 'Confirmar nova senha', 'new-password')}</> : null}
      <Button type="submit" disabled={busy}>{busy ? 'Salvando...' : isEmail ? 'Salvar e-mail' : 'Salvar senha'}</Button>
    </fieldset>
  </form>
}

export default Account
