import Button from '../components/Button'

function Home() {
  return (
    <section className="page home">
      <h1>FORMA</h1>
      <p>Camisas oversized masculinas com caimento amplo e design direto.</p>
      <p>Uma base simples para evoluir durante as aulas.</p>
      <Button to="/catalogo">Ver catálogo</Button>
    </section>
  )
}

export default Home
