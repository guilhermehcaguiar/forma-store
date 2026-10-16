import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import ProductImage from '../components/ProductImage'
import { listProducts, formatPrice, sizeOrder } from '../services/products'

export default function Administration() {
  return <section className="page admin-page">
    <div className="admin-bar"><nav aria-label="Navegação administrativa">{[['', 'Visão geral'], ['produtos', 'Produtos'], ['promocoes', 'Promoções'], ['pedidos', 'Pedidos']].map(([path, label]) => <NavLink key={path} end={!path} to={`/administracao${path ? `/${path}` : ''}`}>{label}</NavLink>)}</nav><span className="admin-label">Demonstração</span></div>
    <p className="field__hint">Catálogo e estoque consultados na API. Edição de produtos e campanhas ainda não está habilitada.</p>
    <Outlet />
  </section>
}

export function AdminOverview() {
  return <><header className="page-header"><p className="eyebrow">Painel administrativo</p><h1>Visão geral da loja</h1><p className="page-header__subtitle">Consulte o catálogo e a disponibilidade atual.</p></header><AdminProducts compact /></>
}

export function AdminProducts({ compact = false, promotionsOnly = false }) {
  const [state, setState] = useState({ products: [], loading: true, error: '' })
  useEffect(() => {
    let active = true
    listProducts(promotionsOnly ? { promo: 'true' } : {}).then(products => { if (active) setState({ products, loading: false, error: '' }) })
      .catch(error => { if (active) setState({ products: [], loading: false, error: error.message }) })
    return () => { active = false }
  }, [promotionsOnly])
  return <>{!compact && <header className="page-header"><p className="eyebrow">Painel administrativo</p><h1>{promotionsOnly ? 'Promoções' : 'Produtos'}</h1><p className="page-header__subtitle">Catálogo ativo, preços e estoque por tamanho.</p></header>}
    <section className="card admin-products"><div className="content-heading"><h2>{promotionsOnly ? 'Promoções' : 'Produtos'} ({state.products.length})</h2><Button to="/catalogo" variant="ghost" size="small">Ver catálogo →</Button></div>
      {state.error ? <p className="form-alert" role="alert">{state.error}</p> : state.loading ? <p role="status">Carregando catálogo...</p> : <div className="table-scroll"><table><thead><tr>{['Produto', 'Preço', 'Tamanhos / estoque', 'Promoção', 'Ação'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{state.products.length ? state.products.map(product => <tr key={product.id} data-product-id={product.id}><td><ProductImage product={product} className="admin-product-image" />{product.name}<br />{product.color} · {product.is_printed ? 'Estampada' : 'Lisa'}</td><td>{formatPrice(product.price_centavos)}</td><td>{sizeOrder.map(size => { const variant = product.sizes.find(v => v.size === size); return variant ? <div key={size}>{size}: {variant.stock}</div> : null })}</td><td>{product.promo_price_centavos != null ? formatPrice(product.promo_price_centavos) : '—'}</td><td><Button to={`/produto/${product.id}`} variant="ghost" size="small">Ver peça</Button></td></tr>) : <tr><td colSpan={5}>Nenhum produto cadastrado.</td></tr>}</tbody></table></div>}
    </section></>
}

export function AdminSection({ kind }) {
  const promotions = kind === 'promocoes'
  if (promotions) return <><p className="field__hint">Consulta de promoções atuais. Criar e editar campanhas continua pendente.</p><AdminProducts key="promotions" promotionsOnly /></>
  return <><header className="page-header"><p className="eyebrow">Painel administrativo</p><h1>Pedidos</h1><p className="page-header__subtitle">Acompanhe os pedidos da loja.</p></header><EmptyState title="Nenhum pedido recebido" description="Os pedidos aparecerão aqui quando as compras estiverem habilitadas." action={<Button to="/administracao">Voltar para a visão geral</Button>} /></>
}
