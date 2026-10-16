import { Link } from 'react-router-dom'
import Button from './Button'
import ProductImage from './ProductImage'
import { formatPrice, productInStock, sizeOrder } from '../services/products'

export default function ProductCard({ product }) {
  const available = productInStock(product)
  return <article className="product-card" data-product-id={product.id}>
    <Link to={`/produto/${product.id}`} aria-label={`Ver ${product.name}`}><ProductImage product={product} /></Link>
    <div className="product-card__body">
      <p className="eyebrow">{product.is_printed ? 'Estampada' : 'Lisa'} · {product.color}</p>
      <h2><Link to={`/produto/${product.id}`}>{product.name}</Link></h2>
      <p className="product-card__sizes">{sizeOrder.filter(size => product.sizes?.some(v => v.size === size && Number(v.stock) > 0)).join(' · ') || 'Sem tamanhos disponíveis'}</p>
      <p className="product-price">{product.promo_price_centavos != null ? <><span className="visually-hidden">Preço anterior </span><del>{formatPrice(product.price_centavos)}</del> </> : null}<strong>{formatPrice(product.promo_price_centavos ?? product.price_centavos)}</strong></p>
      <p className="product-card__availability">{!available ? 'Esgotada' : product.promo_price_centavos != null ? 'Em promoção' : 'Disponível'}</p>
      <Button to={`/produto/${product.id}`} variant="ghost">Ver detalhes →</Button>
    </div>
  </article>
}
