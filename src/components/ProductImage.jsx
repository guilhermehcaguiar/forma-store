import { useState } from 'react'
import { productImageUrl } from '../services/products'

export default function ProductImage({ product, image, className = '', eager = false }) {
  const selected = image ?? product.images?.find(entry => entry.main) ?? product.images?.[0]
  const src = productImageUrl(selected?.url)
  const [failedSrc, setFailedSrc] = useState('')
  return <div className={`product-image ${className}`}>
    {src && failedSrc !== src
      ? <img src={src} alt={`${product.name}${src.endsWith('.svg') ? ' — ilustração de demonstração, não é fotografia' : ''}`} loading={eager ? 'eager' : 'lazy'} width="480" height="560" onError={() => setFailedSrc(src)} />
      : <div className="product-image__fallback" role="img" aria-label={`${product.name} — foto não disponível`}><span>FORMA</span><p>Foto não disponível</p></div>}
  </div>
}
