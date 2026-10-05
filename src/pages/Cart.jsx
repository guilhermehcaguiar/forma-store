import Button from '../components/Button'
import EmptyState from '../components/EmptyState'

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
    <path d="M6 6h15l-1.5 9h-12L6 6z" />
    <path d="M6 6L5 3H2" />
    <circle cx="9" cy="20" r="1" />
    <circle cx="18" cy="20" r="1" />
  </svg>
)

function Cart() {
  return (
    <section className="page cart-page">
      <header className="page-header">
        <p className="eyebrow">Sua seleção</p>
        <h1>Seu carrinho</h1>
        <p className="page-header__subtitle">
          Os itens escolhidos aparecerão nesta página.
        </p>
      </header>

      <div className="cart-layout">
        <div>
          <EmptyState
            icon={emptyIcon}
            title="Seu carrinho está vazio"
            description="Explore o catálogo e adicione as peças que você gostar."
            action={<Button to="/catalogo">Ir para o catálogo</Button>}
          />
          <Button to="/catalogo" variant="ghost">← Continuar comprando</Button>
        </div>
        <aside className="cart-summary card">
          <h2>Resumo do pedido</h2>
          <p>Seu resumo aparecerá aqui quando houver peças no carrinho.</p>
          <div className="cart-summary__note">Escolha suas peças para começar.</div>
          <Button to="/checkout" variant="ghost">Ver etapas da compra →</Button>
        </aside>
      </div>
    </section>
  )
}

export default Cart
