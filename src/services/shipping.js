import { api } from './api.js'

export async function requestShippingQuote({ addressId, items }) {
  return api.post('/frete/cotacoes', { addressId, items })
}

export async function submitCheckout(data) {
  return api.post('/checkout', data)
}
