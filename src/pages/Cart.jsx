import { Link } from 'react-router-dom'

function Cart() {
  return (
    <section className="page">
      <h1>Carrinho</h1>
      <p className="empty-message">Seu carrinho está vazio.</p>
      <Link to="/catalogo">Voltar ao catálogo</Link>
    </section>
  )
}

export default Cart
