import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import Button from '../components/Button'
import AdminOrders from './admin/AdminOrders'
import ProductImage from '../components/ProductImage'
import { formatPrice, sizeOrder } from '../services/products'
import { listAdminProducts } from '../services/adminProducts'

export default function Administration() {
  return <section className="page admin-page">
    <div className="admin-bar"><nav aria-label="Navegação administrativa">{[['', 'Visão geral'], ['produtos', 'Produtos'], ['promocoes', 'Promoções'], ['pedidos', 'Pedidos']].map(([path, label]) => <NavLink key={path} end={!path} to={`/administracao${path ? `/${path}` : ''}`}>{label}</NavLink>)}</nav><span className="admin-label">Administração</span></div>
    <p className="field__hint">Gerencie peças, preços, promoções, imagens e estoque. Alterações são validadas e salvas no servidor.</p>
    <Outlet />
  </section>
}

export function AdminOverview() {
  return <><header className="page-header"><p className="eyebrow">Painel administrativo</p><h1>Visão geral da loja</h1><p className="page-header__subtitle">Consulte o catálogo e a disponibilidade atual.</p></header><AdminProducts compact /></>
}

export function AdminProducts({ compact = false, promotionsOnly = false }) {
  const [state, setState] = useState({ products: [], loading: true, error: '' })
  const [status, setStatus] = useState('all')
  useEffect(() => {
    let active = true
    listAdminProducts().then(products => { if (active) setState({ products, loading: false, error: '' }) })
      .catch(error => { if (active) setState({ products: [], loading: false, error: error.message }) })
    return () => { active = false }
  }, [])
  const products = state.products.filter(p => (!promotionsOnly || p.promo_price_cents != null) && (status === 'all' || p.is_active === (status === 'active')))
  return <>{!compact && <header className="page-header"><p className="eyebrow">Painel administrativo</p><h1>{promotionsOnly ? 'Promoções' : 'Produtos'}</h1><p className="page-header__subtitle">Produtos ativos e inativos, preços e estoque por tamanho.</p></header>}
    <section className="card admin-products"><div className="content-heading"><h2>{promotionsOnly ? 'Promoções' : 'Produtos'} ({products.length})</h2><div className="account-form__actions"><Button to="/administracao/produtos/novo" size="small">Novo produto</Button><Button to="/catalogo" variant="ghost" size="small">Ver catálogo →</Button></div></div>
      <label className="catalog-field" htmlFor="admin-status-filter">Status<select id="admin-status-filter" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select></label>
      {state.error ? <p className="form-alert" role="alert">{state.error}</p> : state.loading ? <p role="status">Carregando catálogo...</p> : <div className="table-scroll"><table><thead><tr>{['Produto / status', 'Preço', 'Tamanhos / estoque', 'Promoção', 'Ação'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{products.length ? products.map(product => <tr key={product.id} data-product-id={product.id}><td><ProductImage product={product} className="admin-product-image" />{product.name}<br />{product.color} · {product.is_printed ? 'Estampada' : 'Lisa'}<br /><strong>{product.is_active ? 'Ativo' : 'Inativo'}</strong></td><td>{formatPrice(product.price_cents)}</td><td>{sizeOrder.map(size => { const variant = product.sizes.find(v => v.size === size); return variant?.is_active ? <div key={size}>{size}: {variant.stock}</div> : null })}</td><td>{product.promo_price_cents != null ? formatPrice(product.promo_price_cents) : '—'}</td><td><div className="admin-row-actions"><Button to={`/administracao/produtos/${product.id}/editar`} size="small">Editar produto</Button>{product.is_active ? <Button to={`/produto/${product.id}`} variant="ghost" size="small">Ver peça</Button> : null}</div></td></tr>) : <tr><td colSpan={5}>Nenhum produto cadastrado.</td></tr>}</tbody></table></div>}
    </section></>
}

export function AdminSection({ kind }) {
  const promotions = kind === 'promocoes'
  if (promotions) return <><p className="field__hint">Edite o preço promocional de uma peça para criar, alterar ou encerrar sua promoção.</p><AdminProducts key="promotions" promotionsOnly /></>
  return <AdminOrders />
}
