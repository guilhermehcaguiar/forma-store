// PostgreSQL é a fonte de verdade. O mapa é apenas cache de navegação;
// listagem e abertura direta do detalhe sempre consultam a API.

import { api, BASE_URL } from './api.js'

const byId = new Map()

function remember(items) {
  for (const product of items) byId.set(product.id, product)
  return items
}

export async function listProducts(filters = {}) {
  return (await getCatalog(filters)).products
}

export async function getCatalog(filters = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== '' && value != null && !(key === 'promo' && value === false)) params.set(key, String(value))
  }
  const query = params.toString()
  const data = await api.get(`/produtos${query ? `?${query}` : ''}`)
  return { products: remember(data.products ?? []), colors: data.filters?.colors ?? [] }
}

export async function getProduct(productId) {
  const data = await api.get(`/produtos/${productId}`)
  byId.set(data.product.id, data.product)
  return data.product
}

export function findProduct(productId) {
  return byId.get(productId) ?? null
}

export function productImageUrl(url) {
  if (typeof url !== 'string') return ''
  if (/^\/products\/[a-z0-9.-]+$/i.test(url)) return url
  if (/^\/?uploads\/[a-z0-9.-]+$/i.test(url)) return new URL(`/${url.replace(/^\//, '')}`, BASE_URL).href
  return ''
}

export function productInStock(product) {
  return (product.sizes ?? []).some(variant => Number(variant.stock) > 0)
}

export const sizeOrder = ['P', 'M', 'G', 'GG']

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
