import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import ProductCard from '../components/ProductCard'
import { getCatalog, sizeOrder } from '../services/products'

const sorts = [['name_asc', 'A–Z'], ['price_asc', 'Menor preço'], ['price_desc', 'Maior preço'], ['newest', 'Mais novos'], ['oldest', 'Mais antigos']]

export default function Catalog() {
  const [params, setParams] = useSearchParams()
  const query = params.toString()
  const [state, setState] = useState({ query: null, products: [], colors: [], error: '' })
  const loading = state.query !== query
  const error = loading ? '' : state.error
  useEffect(() => {
    let active = true
    getCatalog(Object.fromEntries(new URLSearchParams(query)))
      .then(data => { if (active) setState({ ...data, query, error: '' }) })
      .catch(error => { if (active) setState(previous => ({ ...previous, query, products: [], error: error.message })) })
    return () => { active = false }
  }, [query])

  function filter(key, value) {
    setParams(current => {
      const next = new URLSearchParams(current)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })
  }

  return <section className="page catalog-page">
    <header className="page-header"><p className="eyebrow">Camisetas / Todas as peças</p><h1>Encontre a sua próxima favorita.</h1><p className="page-header__subtitle">Peças feitas para vestir com liberdade.</p></header>
    <div className="catalog-layout">
      <aside className="catalog-filters" aria-label="Filtros do catálogo">
        <h2>Filtrar por</h2>
        <label className="catalog-field" htmlFor="catalog-color">Cor<select id="catalog-color" value={params.get('color') ?? ''} onChange={e => filter('color', e.target.value)}><option value="">Todas as cores</option>{state.colors.map(color => <option key={color} value={color}>{color}</option>)}</select></label>
        <label className="catalog-field" htmlFor="catalog-pattern">Estampa<select id="catalog-pattern" value={params.get('is_printed') ?? ''} onChange={e => filter('is_printed', e.target.value)}><option value="">Todas as estampas</option><option value="false">Lisas</option><option value="true">Estampadas</option></select></label>
        <label className="catalog-field" htmlFor="catalog-size">Tamanho<select id="catalog-size" value={params.get('size') ?? ''} onChange={e => filter('size', e.target.value)}><option value="">Todos os tamanhos</option>{sizeOrder.map(size => <option key={size}>{size}</option>)}</select></label>
        <label className="checkbox"><input id="promo-checkbox" type="checkbox" checked={params.get('promo') === 'true'} onChange={e => filter('promo', e.target.checked ? 'true' : '')} /><span>Somente promoções</span></label>
        <Button type="button" variant="ghost" onClick={() => setParams({})}>Limpar filtros</Button>
      </aside>
      <div className="catalog-results" aria-busy={loading} data-query={query}>
        <div className="catalog-toolbar"><p role="status">{loading ? 'Carregando peças...' : error ? 'Catálogo indisponível no momento' : `${state.products.length} peça(s) encontrada(s)`}</p><label className="catalog-sort" htmlFor="catalog-sort">Ordenar por<select id="catalog-sort" value={params.get('sort') ?? 'name_asc'} onChange={e => filter('sort', e.target.value)}>{sorts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        {error ? <p className="form-alert" role="alert">{error}</p> : loading ? <p>Carregando catálogo...</p> : !state.products.length ? <EmptyState title="Nenhum produto encontrado" description="Tente ajustar os filtros para encontrar sua peça." /> : <div className="product-grid">{state.products.map(product => <ProductCard key={product.id} product={product} />)}</div>}
      </div>
    </div>
  </section>
}
