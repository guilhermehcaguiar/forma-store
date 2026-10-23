import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/useAuth'


const links = [
  { to: '/', label: 'Novidades', end: true },
  { to: '/catalogo', label: 'Camisetas' },
  { to: '/sobre', label: 'Sobre Nós' },
]

function NavMenu({ onNavigate }) {
  const { user } = useAuth()
  return (
    <nav className="nav-menu" aria-label="Menu principal">
      <ul>
        {links.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              end={link.end}
              onClick={onNavigate}
              className={({ isActive }) => (isActive ? 'is-active' : undefined)}
            >
              {link.label}
            </NavLink>
          </li>
        ))}

        {user && user.role === 'administrador' && (
          <li>
            <NavLink
              to="/administracao"
              onClick={onNavigate}
              className={({ isActive }) => (isActive ? 'is-active' : undefined)}
            >
              Painel Admin
            </NavLink>
          </li>
        )}
      </ul>
    </nav>
  )
}

export default NavMenu
