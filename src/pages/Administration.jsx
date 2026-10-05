import { NavLink, Outlet, Link } from 'react-router-dom'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'

export default function Administration() {
  return <section className="page admin-page">
    <div className="admin-bar"><nav aria-label="Navegação administrativa">{[['', 'Visão geral'], ['produtos', 'Produtos'], ['promocoes', 'Promoções'], ['pedidos', 'Pedidos']].map(([path, label]) => <NavLink key={path} end={!path} to={`/administracao${path ? `/${path}` : ''}`}>{label}</NavLink>)}</nav><span className="admin-label">Demonstração</span></div>
    <p className="field__hint">Prévia visual do painel. O gerenciamento da loja ainda não está habilitado.</p>
    <Outlet />
  </section>
}

export function AdminOverview() {
  return <><header className="page-header"><p className="eyebrow">Painel administrativo</p><h1>Visão geral da loja</h1><p className="page-header__subtitle">Catálogo, estoque, preços e campanhas em um só lugar.</p></header><div className="account-stats admin-stats">{[['00', 'Produtos ativos', 'produtos'], ['00', 'Promoções', 'promocoes'], ['00', 'Pedidos novos', 'pedidos']].map(([count, label, path]) => <Link className="account-stat" to={`/administracao/${path}`} key={path}><strong>{count}</strong><span>{label}</span></Link>)}</div><AdminProducts compact /></>
}

export function AdminProducts({ compact = false }) {
  return <>{!compact && <header className="page-header"><p className="eyebrow">Painel administrativo</p><h1>Produtos</h1><p className="page-header__subtitle">Organize as peças do catálogo.</p></header>}<section className="card admin-products"><div className="content-heading"><h2>Produtos</h2><Button to="/catalogo" variant="ghost" size="small">Ver catálogo →</Button></div><div className="table-scroll"><table><thead><tr>{['Produto', 'Preço', 'Tamanhos', 'Promoção', 'Ação'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody><tr><td colSpan={5}>Nenhum produto cadastrado. O gerenciamento será habilitado em uma próxima etapa.</td></tr></tbody></table></div></section></>
}

export function AdminSection({ kind }) {
  const promotions = kind === 'promocoes'
  return <><header className="page-header"><p className="eyebrow">Painel administrativo</p><h1>{promotions ? 'Promoções' : 'Pedidos'}</h1><p className="page-header__subtitle">{promotions ? 'Acompanhe as campanhas da loja.' : 'Acompanhe os pedidos da loja.'}</p></header><EmptyState title={promotions ? 'Nenhuma promoção cadastrada' : 'Nenhum pedido recebido'} description={promotions ? 'As campanhas aparecerão aqui quando estiverem disponíveis.' : 'Os pedidos aparecerão aqui quando as compras estiverem habilitadas.'} action={<Button to="/administracao">Voltar para a visão geral</Button>} /></>
}
