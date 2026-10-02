import { Link } from 'react-router-dom'
import NavMenu from './NavMenu'

function Header() {
  return (
    <header className="header">
      <Link to="/" className="header__logo">
        FORMA
      </Link>
      <NavMenu />
    </header>
  )
}

export default Header
