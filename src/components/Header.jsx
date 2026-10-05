import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import NavMenu from './NavMenu'
import Icon from './Icon'
import Button from './Button'
import { useAuth } from '../context/useAuth'

function Header() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  function handleLogout() {
    setMenuOpen(false)
    try {
      logout()
      setError('')
      navigate('/login', { replace: true })
    } catch (logoutError) {
      setError(logoutError.message)
    }
  }

  return (
    <header className="header">
      <div className="header__inner container">
        <Link to="/" className="header__logo" onClick={() => setMenuOpen(false)}>
          FORMA
        </Link>

        <button
          type="button"
          className="header__toggle"
          aria-expanded={menuOpen}
          aria-controls="header-navigation"
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span className="header__toggle-bar" />
          <span className="header__toggle-bar" />
          <span className="header__toggle-bar" />
        </button>

        <div
          id="header-navigation"
          className={`header__content${menuOpen ? ' header__content--open' : ''}`}
        >
          <NavMenu onNavigate={() => setMenuOpen(false)} />

          <div className="header__account">
            <Link to="/catalogo" className="header__icon-link" aria-label="Explorar catálogo" title="Explorar catálogo" onClick={() => setMenuOpen(false)}>
              <Icon name="search" />
            </Link>
            <Link to="/favoritos" className="header__icon-link" aria-label="Favoritos" title="Favoritos" onClick={() => setMenuOpen(false)}>
              <Icon name="heart" />
            </Link>
            {user ? (
              <>
                <Link
                  to="/minha-conta"
                  className="header__account-link"
                  aria-label={`Minha conta de ${user.name}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon name="account" /><span className="header__user-name">Olá, {user.name.split(' ')[0]}</span>
                </Link>
                <Button
                  type="button"
                  variant="logout"
                  size="small"
                  onClick={handleLogout}
                >
                  Sair
                </Button>
              </>
            ) : (
              <Link
                to="/login"
                className="header__account-link"
                onClick={() => setMenuOpen(false)}
              >
                <Icon name="account" /><span className="visually-hidden">Entrar</span>
              </Link>
            )}
            <Link to="/carrinho" className="header__icon-link" aria-label="Carrinho" title="Carrinho" onClick={() => setMenuOpen(false)}>
              <Icon name="bag" />
            </Link>
          </div>
        </div>
      </div>
      {error ? <p className="form-alert" role="alert">{error}</p> : null}
    </header>
  )
}

export default Header
