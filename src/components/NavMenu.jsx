import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Home' },
  { to: '/catalogo', label: 'Catálogo' },
  { to: '/sobre', label: 'Sobre Nós' },
  { to: '/carrinho', label: 'Carrinho' },
  { to: '/login', label: 'Login/Cadastro' },
]

function NavMenu() {
  return (
    <nav className="nav-menu" aria-label="Menu principal">
      <ul>
        {links.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default NavMenu
