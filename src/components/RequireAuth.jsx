import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

function RequireAuth({ children }) {
  const { user, ready } = useAuth()
  const location = useLocation()

  // A sessão ainda está sendo validada no servidor (GET /auth/eu).
  if (!ready) {
    return (
      <section className="page">
        <p className="page-header__subtitle">Verificando sua sessão...</p>
      </section>
    )
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  return children
}

export default RequireAuth
