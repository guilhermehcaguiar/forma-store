import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import heroEditorial from '../assets/hero-editorial.webp'
import ProductCard from '../components/ProductCard'
import { listProducts, productInStock } from '../services/products'

function Home() {
  const [catalog, setCatalog] = useState({ products: [], loading: true, error: '' })
  useEffect(() => {
    let active = true
    listProducts({ sort: 'newest' })
      .then(products => { if (active) setCatalog({ products: products.filter(productInStock).slice(0, 4), loading: false, error: '' }) })
      .catch(error => { if (active) setCatalog({ products: [], loading: false, error: error.message }) })
    return () => { active = false }
  }, [])
  return (
    <div className="home">
      <section className="hero">
        <div className="hero__content">
          <p className="hero__eyebrow">Nova coleção / 2026</p>
          <h1 className="hero__title">O básico,<br />sem ser comum.</h1>
          <p className="hero__text">
            Oversized com caimento impecável e presença natural.
          </p>

          <div className="hero__actions">
            <Button to="/catalogo" variant="dark">Explorar peças</Button>
            <Button to="/sobre" variant="ghost">
              Conheça a FORMA →
            </Button>
          </div>
        </div>
        <div className="hero__media">
          <img
            className="hero__image"
            src={heroEditorial}
            alt="Modelo vestindo camisa oversized branca em um cenário de concreto iluminado pelo sol."
            width="1536"
            height="1024"
            fetchPriority="high"
          />
        </div>
      </section>
      <section aria-labelledby="home-highlights">
        <div className="section-heading">
          <h2 id="home-highlights">Destaques da coleção</h2>
          <Link to="/catalogo">Ver todos →</Link>
        </div>
        {catalog.error ? <p className="form-alert" role="alert">{catalog.error}</p> : catalog.loading ? <p role="status">Carregando destaques...</p> : catalog.products.length ? <div className="product-grid">{catalog.products.map(product => <ProductCard key={product.id} product={product} />)}</div> : <EmptyState
          title="A primeira coleção está chegando"
          description="As novas peças aparecerão aqui quando o catálogo estiver disponível."
        />}
      </section>

    </div>
  )
}

export default Home
