import products from '../data/products'

function Catalog() {
  return (
    <section className="page">
      <h1>Catálogo</h1>

      {products.length === 0 ? (
        <p className="empty-message">Nenhum produto cadastrado ainda</p>
      ) : (
        <ul className="product-list">
          {products.map((product) => (
            <li key={product.id}>{product.name}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default Catalog
