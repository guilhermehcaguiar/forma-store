import { Link } from 'react-router-dom'

const currentYear = new Date().getFullYear()

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <span className="footer__logo">FORMA</span>
          <p>Camisas oversized masculinas com caimento amplo e design direto.</p>
        </div>

        <nav className="footer__nav" aria-label="Links do rodapé">
          <Link to="/catalogo">Catálogo</Link>
          <Link to="/sobre">Sobre Nós</Link>
          <Link to="/carrinho">Carrinho</Link>
          <Link to="/favoritos">Favoritos</Link>
          <Link to="/minha-conta">Minha conta</Link>
        </nav>

        <p className="footer__copy">
          © {currentYear} FORMA — Todos os direitos reservados.
        </p>
      </div>
    </footer>
  )
}

export default Footer
