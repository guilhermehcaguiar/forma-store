import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import Button from '../components/Button'
import FormField from '../components/FormField'
import { useAuth } from '../context/useAuth'
import { emailExists } from '../services/auth'
import { validateLogin, validateRegister } from '../utils/validation'

function getRedirectTarget(from) {
  if (typeof from === 'string' && /^\/(?!\/)/.test(from) && !['/login', '/cadastro'].includes(from.split('?')[0])) {
    return from
  }

  return '/minha-conta'
}

function LoginForm() {
  const { login } = useAuth()
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleChange(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    const nextErrors = validateLogin(values)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setSubmitting(true)

    try {
      await login(values)
    } catch (error) {
      setFormError(error.message || 'Não foi possível entrar.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card auth-form" onSubmit={handleSubmit} noValidate>
      <h2>Entrar</h2>
      <p className="auth-form__intro">
        Acesse com o e-mail e a senha cadastrados.
      </p>

      {formError ? (
        <p className="form-alert" role="alert">
          {formError}
        </p>
      ) : null}

      <FormField
        id="login-email"
        label="E-mail"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="voce@exemplo.com"
        value={values.email}
        onChange={handleChange}
        error={errors.email}
      />

      <FormField
        id="login-password"
        label="Senha"
        type="password"
        name="password"
        autoComplete="current-password"
        placeholder="Sua senha"
        value={values.password}
        onChange={handleChange}
        error={errors.password}
      />

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Entrando...' : 'Entrar'}
      </Button>
    </form>
  )
}

function RegisterForm() {
  const { register } = useAuth()
  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    promo: false,
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleChange(event) {
    const { name, value, type, checked } = event.target
    setValues((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    const nextErrors = validateRegister(values)

    if (!nextErrors.email && emailExists(values.email)) {
      nextErrors.email = 'Este e-mail já está cadastrado.'
    }

    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setSubmitting(true)

    try {
      await register({
        name: values.name,
        email: values.email,
        password: values.password,
        promo: values.promo,
      })
    } catch (error) {
      setFormError(error.message || 'Não foi possível concluir o cadastro.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card auth-form" onSubmit={handleSubmit} noValidate>
      <h2>Criar conta</h2>
      <p className="auth-form__intro">
        Preencha os dados para criar sua conta na demonstração.
      </p>

      {formError ? (
        <p className="form-alert" role="alert">
          {formError}
        </p>
      ) : null}

      <FormField
        id="register-name"
        label="Nome completo"
        type="text"
        name="name"
        autoComplete="name"
        placeholder="Seu nome"
        value={values.name}
        onChange={handleChange}
        error={errors.name}
      />

      <FormField
        id="register-email"
        label="E-mail"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="voce@exemplo.com"
        value={values.email}
        onChange={handleChange}
        error={errors.email}
      />

      <FormField
        id="register-password"
        label="Senha"
        type="password"
        name="password"
        autoComplete="new-password"
        placeholder="Crie uma senha"
        value={values.password}
        onChange={handleChange}
        error={errors.password}
        hint="Use pelo menos 6 caracteres."
      />

      <FormField
        id="register-confirm-password"
        label="Confirmar senha"
        type="password"
        name="confirmPassword"
        autoComplete="new-password"
        placeholder="Repita a senha"
        value={values.confirmPassword}
        onChange={handleChange}
        error={errors.confirmPassword}
      />

      <label className="checkbox">
        <input
          type="checkbox"
          name="promo"
          checked={values.promo}
          onChange={handleChange}
        />
        <span>Quero receber promoções por e-mail.</span>
      </label>

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Cadastrando...' : 'Cadastrar'}
      </Button>
    </form>
  )
}

function Auth() {
  const { user } = useAuth()
  const location = useLocation()

  if (user) {
    return <Navigate to={getRedirectTarget(location.state?.from)} replace />
  }

  return (
    <section className="page auth-page">
      <header className="page-header">
        <p className="eyebrow">Seu espaço na FORMA</p>
        <h1>Minha conta</h1>
        <p className="page-header__subtitle">
          Entre na sua conta ou cadastre-se para continuar.
        </p>
      </header>

      <div className="auth-grid">
        <LoginForm />
        <RegisterForm />
      </div>

      <p className="auth-note">
        Demonstração acadêmica: os dados ficam apenas neste navegador. Não use
        senhas reais.
      </p>
    </section>
  )
}

export default Auth
