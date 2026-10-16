import { useEffect, useState } from 'react';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import { formatPrice, listProducts } from '../services/products';

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
);

export default function Catalog() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ color: '', promo: false, sort: 'name_asc', is_printed: '', size: '' });

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      try {
        const products = await listProducts(filters);
        setProducts(products);
      } catch (error) {
        console.error("Erro ao carregar o catálogo:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, [filters]);

  return (
    <section className="page catalog-page" style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto' }}>
      <header className="page-header" style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', color: '#102430', fontWeight: 'bold' }}>Catálogo</h1>
      </header>

      <div className="catalog-container" style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
        
        <aside className="filters-sidebar" style={{ 
          width: '260px', 
          background: '#F6F8F9', 
          padding: '24px', 
          borderRadius: '8px',
          border: '1px solid #E4EBEE'
        }}>
          <h3 style={{ fontSize: '18px', color: '#102430', marginBottom: '20px', borderBottom: '1px solid #E4EBEE', paddingBottom: '10px' }}>
            Filtros
          </h3>
          
          <div className="filter-group" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: '#102430' }}>Cor</label>
            <select 
              value={filters.color} 
              onChange={e => setFilters({...filters, color: e.target.value})}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #73828A', background: '#FFFFFF', fontSize: '14px' }}
            >
              <option value="">Todas as Cores</option>
              <option value="preta">Preta</option>
              <option value="branca">Branca</option>
            </select>
          </div>

          <div className="filter-group" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: '#102430' }}>Estampa</label>
            <select 
              value={filters.is_printed} 
              onChange={e => setFilters({...filters, is_printed: e.target.value})}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #73828A', background: '#FFFFFF', fontSize: '14px' }}
            >
              <option value="">Todas as Estampas</option>
              <option value="true">Estampadas</option>
              <option value="false">Lisas</option>
            </select>
          </div>

          <div className="filter-group" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="checkbox" 
              id="promo-checkbox"
              checked={filters.promo} 
              onChange={e => setFilters({...filters, promo: e.target.checked})} 
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            /> 
            <label htmlFor="promo-checkbox" style={{ fontSize: '14px', fontWeight: '600', color: '#102430', cursor: 'pointer' }}>
              Em Promoção
            </label>
          </div>

          <div className="filter-group" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: '#102430' }}>Tamanho</label>
            <select value={filters.size} onChange={e => setFilters({...filters, size: e.target.value})}>
              <option value="">Todos os tamanhos</option>
              {['P', 'M', 'G', 'GG'].map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>

          <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: '#102430' }}>Ordenar por</label>
            <select 
              value={filters.sort} 
              onChange={e => setFilters({...filters, sort: e.target.value})}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #73828A', background: '#FFFFFF', fontSize: '14px' }}
            >
              <option value="name_asc">A-Z</option>
              <option value="price_asc">Menor Preço</option>
              <option value="price_desc">Maior Preço</option>
              <option value="newest">Mais Novos</option>
            </select>
          </div>
        </aside>

        <main className="products-grid" style={{ flex: 1 }}>
          {loading ? (
            <p>A carregar catálogo...</p>
          ) : products.length === 0 ? (
            <EmptyState 
              icon={emptyIcon} 
              title="Nenhum produto encontrado" 
              description="Tente ajustar os filtros na barra lateral para encontrar o que procura." 
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
              {products.map(p => (
                <div key={p.id} className="product-card" style={{ border: '1px solid #E4EBEE', borderRadius: '8px', padding: '16px', background: '#FFFFFF' }}>
                  <div className="product-info" style={{ marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '16px', color: '#102430', marginBottom: '8px' }}>{p.name}</h4>
                    <p style={{ fontSize: '15px', fontWeight: 'bold', color: '#00ABE4' }}>
                      {formatPrice(p.promo_price_centavos ?? p.price_centavos)}
                    </p>
                  </div>
                  <Button to={`/produto/${p.id}`}>Ver detalhes</Button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </section>
  );
}