import { useEffect, useState } from 'react'

const CART_KEY = 'forma:cart'
const CHANGE_EVENT = 'forma:cart-change'

function emptyCart() {
  return { items: [], couponCode: '' }
}

export function readCart() {
  try {
    const data = JSON.parse(window.localStorage.getItem(CART_KEY) ?? 'null')
    if (!data || !Array.isArray(data.items)) return emptyCart()
    return {
      items: data.items.filter((item) => item && typeof item.productId === 'string' && Number.isInteger(item.quantity) && item.quantity > 0),
      couponCode: typeof data.couponCode === 'string' ? data.couponCode : '',
    }
  } catch {
    return emptyCart()
  }
}

function writeCart(cart) {
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(cart))
  } catch {
    throw new Error('Não foi possível salvar o carrinho neste navegador.')
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
  return cart
}

export function addCartItem(product, size = '') {
  const cart = readCart()
  const existing = cart.items.find((item) => item.productId === product.id && item.size === size)
  const stock = Number(product.sizes?.find(variant => variant.size === size)?.stock ?? 0)
  if (!Number.isInteger(stock) || stock <= 0) throw new Error('Este tamanho está esgotado ou não está disponível.')
  if ((existing?.quantity ?? 0) >= Math.min(20, stock)) throw new Error('Você já adicionou a quantidade disponível deste tamanho.')
  if (existing) existing.quantity = Math.min(20, existing.quantity + 1)
  else cart.items.push({ productId: product.id, size, quantity: 1, priceCentavos: product.promo_price_centavos ?? product.price_centavos,
    name: product.name, color: product.color, images: (product.images ?? []).map(image => ({ url: image.url, main: Boolean(image.main) })) })
  if (!cart.items.length) cart.couponCode = ''
  return writeCart(cart)
}

export function setCartQuantity(productId, size, quantity, stock) {
  const cart = readCart()
  const item = cart.items.find((entry) => entry.productId === productId && entry.size === size)
  if (!item) return cart
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error('Informe uma quantidade inteira válida.')
  if (quantity > 0 && (!Number.isInteger(stock) || quantity > Math.min(20, stock))) throw new Error('A quantidade excede o estoque disponível deste tamanho.')
  if (quantity < 1) cart.items = cart.items.filter((entry) => entry !== item)
  else item.quantity = Math.min(20, quantity)
  if (!cart.items.length) cart.couponCode = ''
  return writeCart(cart)
}

export function removeCartItem(productId, size) {
  const cart = readCart()
  cart.items = cart.items.filter((item) => item.productId !== productId || item.size !== size)
  if (!cart.items.length) cart.couponCode = ''
  return writeCart(cart)
}

export function setCartCoupon(couponCode) {
  const cart = readCart()
  cart.couponCode = couponCode
  return writeCart(cart)
}

export const cartKey = cart => JSON.stringify(cart)

// Só grava se o carrinho ainda corresponde à resposta revisada; evita perder
// alterações feitas em outra aba ou enquanto a API respondia.
export function rememberCartPrices(lines, expectedKey, acceptChanges = false) {
  const cart = readCart()
  if (cartKey(cart) !== expectedKey) throw new Error('O carrinho mudou. Aguarde a atualização antes de continuar.')
  let changed = false
  for (const item of cart.items) {
    const line = lines.find(entry => entry.productId === item.productId && entry.size === item.size)
    if (line?.available && typeof line.name === 'string') {
      const snapshot = { name: line.name, color: line.color, images: (line.images ?? []).map(image => ({ url: image.url, main: Boolean(image.main) })) }
      if (Object.entries(snapshot).some(([key, value]) => JSON.stringify(item[key]) !== JSON.stringify(value))) {
        Object.assign(item, snapshot); changed = true
      }
    }
    if (line?.available && Number.isInteger(line.priceCentavos) && (acceptChanges || !Number.isInteger(item.priceCentavos)) && item.priceCentavos !== line.priceCentavos) {
      item.priceCentavos = line.priceCentavos; changed = true
    }
  }
  if (changed) writeCart(cart)
}

export function clearCart() {
  writeCart(emptyCart())
}

export function useCart() {
  const [cart, setCart] = useState(readCart)
  useEffect(() => {
    const update = () => setCart(readCart())
    window.addEventListener(CHANGE_EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(CHANGE_EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [])
  return cart
}
