import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import Button from '../../components/Button'
import { useAuth } from '../../context/useAuth'
import useAccountData from '../../context/useAccountData'

const sections = [
  ['', 'Visão geral'], ['pedidos', 'Meus pedidos'], ['favoritos', 'Favoritos'],
  ['listas', 'Lista de compras'], ['enderecos', 'Endereços'],
  ['cartoes', 'Cartões salvos'], ['dados', 'Dados pessoais'],
]

export default function AccountLayout() {
  const { user } = useAuth()
  return <AccountNavigation key={user.id} />
}

function AccountNavigation() {
  const { user, logout } = useAuth()
  const account = useAccountData(user.id)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  function handleLogout() {
    try { logout(); navigate('/login', { replace: true }) }
    catch (error) { setError(error.message) }
  }
  return (
    <section className="page account-page">
      <header className="page-header">
        <p className="eyebrow">Bem-vindo de volta</p>
        <h1>Minha conta</h1>
        <p className="page-header__subtitle">Gerencie seus dados e acompanhe suas escolhas.</p>
      </header>
      <div className="account-grid">
        <nav className="account-sidebar" aria-label="Menu da conta">
          {sections.map(([path, label]) => <NavLink key={path} to={`/minha-conta${path ? `/${path}` : ''}`} end={!path}>{label}</NavLink>)}
          <Button type="button" variant="logout" onClick={handleLogout}>Sair da conta</Button>
        </nav>
        <div className="account-content">
          {error || account.error ? <p className="form-alert" role="alert">{error || account.error}</p> : null}
          <Outlet context={account} />
        </div>
      </div>
    </section>
  )
}
