import { Link } from 'react-router-dom'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'

export default function Product() {
  return <section className="page product-page">
    <nav className="breadcrumb" aria-label="Localização"><Link to="/">Início</Link><span>/</span><Link to="/catalogo">Camisetas</Link><span>/</span><span>Produto</span></nav>
    <div className="product-layout">
      <EmptyState title="Nenhuma peça disponível" description="As imagens da peça aparecerão aqui quando ela estiver no catálogo." />
      <div className="product-info"><p className="eyebrow">Coleção FORMA</p><h1>Produto indisponível</h1><p>O catálogo está vazio. Ainda não há uma peça para exibir neste endereço.</p><section className="product-options"><h2>Cor e tamanho</h2><p>As opções e medidas serão informadas para cada peça disponível.</p><Button type="button" disabled>Adicionar ao carrinho →</Button></section><div className="checkout-note"><h2>Entrega</h2><p>As opções de entrega ficarão disponíveis em uma próxima etapa.</p></div><Button to="/catalogo" variant="ghost">← Voltar para o catálogo</Button></div>
    </div>
  </section>
}
