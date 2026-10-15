// Resolução de produtos conforme o contrato combinado para o bloco de
// catálogo (docs/forma/API_CONTRATOS.md): id UUID, name, slug, description,
// price_centavos (inteiro), promo_price_centavos (inteiro anulável), pattern
// ("lisa"/"estampada"), color, active e sizes.
//
// O catálogo em si é outro bloco (Gabriel): por enquanto as peças vivem em
// `src/data/products.js` (vazio) e qualquer id desconhecido é exibido como
// "Produto indisponível", igual ao estado aprovado da tela de produto. Quando
// o catálogo conectar (API ou dados), este módulo é o único ponto a mudar.

import products from '../data/products'

const byId = new Map(products.map((product) => [product.id, product]))

export function findProduct(productId) {
  return byId.get(productId) ?? null
}

// Dinheiro em centavos (inteiro), exibido como moeda local — mesmo padrão do
// servidor (server/src/utils/money.js).
export function formatPrice(centavos) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function displayPrice(product) {
  if (!product) return null
  const price = product.promo_price_centavos ?? product.price_centavos
  return typeof price === 'number' ? formatPrice(price) : null
}
