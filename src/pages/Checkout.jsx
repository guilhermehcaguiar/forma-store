import { useAuth } from '../context/useAuth'
import Button from '../components/Button'

export default function Checkout() {
  const { user } = useAuth()
  return <section className="page checkout-page">
    <header className="page-header"><p className="eyebrow">Etapa final</p><h1>Finalize seu pedido</h1><p className="page-header__subtitle">Revise sua conta, endereço e pedido.</p></header>
    <div className="cart-layout">
      <div className="checkout-steps">
        <section className="card checkout-identification"><h2>01 Identificação</h2><div className="content-heading"><p>{user ? `Você está conectado como ${user.name}.` : 'Entre na sua conta ou cadastre-se para continuar.'}</p><Button to={user ? '/minha-conta/dados' : '/login'} state={user ? undefined : { from: '/checkout' }} variant="dark">{user ? 'Minha conta' : 'Entrar / criar'}</Button></div></section>
        <section className="card"><h2>02 Endereço e entrega</h2><p>Consulte seus endereços salvos ou adicione um novo.</p><Button to="/minha-conta/enderecos" variant="ghost">Gerenciar endereços →</Button><p className="field__hint">A seleção de entrega ficará disponível quando houver itens no carrinho.</p></section>
        <section className="card"><h2>03 Pagamento</h2><p>O pagamento ainda não está disponível.</p><div className="checkout-note">Escolha suas peças antes de finalizar o pedido.</div></section>
      </div>
      <aside className="card cart-summary"><h2>Seu pedido</h2><p>Seu carrinho está vazio. Os itens e valores aparecerão aqui quando houver peças selecionadas.</p><dl className="summary-values"><div><dt>Subtotal</dt><dd>—</dd></div><div><dt>Frete</dt><dd>—</dd></div><div><dt>Cupom</dt><dd>—</dd></div><div><dt>Total</dt><dd>—</dd></div></dl><Button type="button" disabled>Finalizar pedido →</Button><Button to="/catalogo" variant="ghost">Explorar peças</Button></aside>
    </div>
  </section>
}
