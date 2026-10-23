import { api } from './api.js'

const CHECKOUT_KEY = 'forma:checkoutAttempt'

export function usesLocalDemoPayment(order) {
  return (order.paymentProvider ?? (order.transactionMode === 'demo' ? 'forma_demo' : 'mercadopago')) === 'forma_demo'
}

export function getTestCheckoutUrl(payment) {
  let url
  try { url = new URL(payment?.checkoutUrl) } catch { throw new Error('O gateway não retornou um endereço de checkout de teste válido.') }
  if (url.protocol !== 'https:' || url.username || url.password ||
      !['sandbox.mercadopago.com.br', 'sandbox.mercadopago.com', 'www.mercadopago.com.br', 'www.mercadopago.com'].includes(url.hostname)) {
    throw new Error('O gateway não retornou um endereço de checkout de teste válido.')
  }
  return url.href
}

function makeKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  throw new Error('Este navegador não oferece uma chave segura para confirmar o pedido.')
}

export function getCheckoutKey(context) {
  const serializedContext = JSON.stringify(context)
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(CHECKOUT_KEY) ?? 'null')
    if (saved?.context === serializedContext && typeof saved.key === 'string') return saved.key
    const key = makeKey()
    window.sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify({ context: serializedContext, key }))
    return key
  } catch {
    return makeKey()
  }
}

export function clearCheckoutKey() {
  try {
    window.sessionStorage.removeItem(CHECKOUT_KEY)
  } catch {
    return false
  }
  return true
}

export async function createOrderCheckout(orderId) {
  return api.post(`/pagamentos/pedidos/${orderId}/preferencia`, {})
}

export async function verifyOrderPayment(orderId, paymentId) {
  return api.post(`/pagamentos/pedidos/${orderId}/verificar`, { paymentId })
}

export async function getOrder(orderId) {
  return api.get(`/conta/pedidos/${orderId}`)
}
