import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

// Proteção de área por papel. O papel real é validado pelo servidor em cada
// requisição (requireAuth + requireRole no back-end); aqui o papel apenas
// evita mostrar a rota a quem não tem permissão.
function RequireRole({ children }) {
  const { user, ready } = useAuth()
  const location = useLocation()

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

  // Conta comum tentando abrir uma área administrativa volta para a conta.
  if (user.role !== 'administrador') {
    return <Navigate to="/minha-conta" replace />
  }

  return children
}

export default RequireRole
