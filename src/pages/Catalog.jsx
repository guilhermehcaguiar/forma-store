import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import products from '../data/products'

const emptyIcon = (
  <svg
    viewBox="0 0 24 24"
    width="40"
    height="40"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 3l6 3 6-3 3 5-3 2v11H6V10L3 8l3-5z" />
    <path d="M9 21v-6h6v6" />
  </svg>
)

function Catalog() {
  return (
    <section className="page catalog-page">
      <header className="page-header">
        <p className="eyebrow">Camisetas / Todas as peças</p>
        <h1>Encontre a sua próxima favorita.</h1>
        <p className="page-header__subtitle">
          Peças feitas para vestir com liberdade.
        </p>
      </header>

      <div className="catalog-layout">
        <aside className="catalog-filters" aria-labelledby="filters-title">
          <h2 id="filters-title">Filtrar por</h2>
          <p className="field__hint">Disponível quando a coleção chegar.</p>
          <fieldset disabled>
            <legend>Cor</legend>
            <div className="color-options">
              {['Preto', 'Branco', 'Azul claro', 'Azul'].map((color, index) => (
                <label key={color} className={`color-option color-option--${index}`}>
                  <input type="checkbox" aria-label={color} />
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset disabled>
            <legend>Estilo</legend>
            <label className="checkbox"><input type="checkbox" /> Lisas</label>
            <label className="checkbox"><input type="checkbox" /> Estampadas</label>
          </fieldset>
          <fieldset disabled>
            <legend>Tamanho</legend>
            <div className="size-options">
              {['P', 'M', 'G', 'GG'].map(size => (
                <button key={size} type="button" disabled>{size}</button>
              ))}
            </div>
          </fieldset>
          <label className="checkbox">
            <input type="checkbox" disabled /> Somente promoções
          </label>
          <Button variant="soft" type="button" disabled>
            Limpar filtros
          </Button>
        </aside>
        <div className="catalog-results">
          <div className="catalog-toolbar">
            <p>{products.length} peças encontradas</p>
            <label className="catalog-sort">
              Ordenar:
              <select disabled defaultValue="newest" aria-label="Ordenar peças">
                <option value="newest">Novidades</option>
                <option>A–Z</option>
                <option>Menor preço</option>
                <option>Maior preço</option>
                <option>Mais antigas</option>
              </select>
            </label>
          </div>
          {products.length === 0 ? (
            <EmptyState
              icon={emptyIcon}
              title="Nenhum produto cadastrado ainda"
              description="Estamos preparando a primeira coleção. Volte em breve para conferir as novidades."
              action={<Button to="/">Voltar para a Home</Button>}
            />
          ) : (
            <ul className="product-list">
              {products.map((product) => (
                <li key={product.id}>{product.name}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

export default Catalog
