import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { cartKey, readCart, rememberCartPrices } from './cart.js'

export function priceChanges(cart, lines) {
  return lines.filter(line => line.available && cart.items.some(item => item.productId === line.productId && item.size === line.size && Number.isInteger(item.priceCentavos) && item.priceCentavos !== line.priceCentavos))
}
export async function reviewCart(cart) {
  const data = await api.post('/cart/resumo', { items: cart.items, couponCode: cart.couponCode })
  return { ...data, priceChanges: priceChanges(cart, data.cart) }
}
export function assertCartReady(data) {
  if (!data) throw new Error('Seu carrinho está vazio. Adicione uma peça antes de continuar.')
  if (data.priceChanges.length) throw new Error('Os preços mudaram. Volte ao carrinho e aceite os preços atualizados antes de continuar.')
  if (!data.canCheckout) throw new Error(data.couponError || 'O estoque ou a disponibilidade mudou. Revise os itens no carrinho antes de continuar.')
}

export function useCartReview(cart) {
  const key = cartKey(cart)
  const [state, setState] = useState({ key: '', data: null, error: '', loading: true })
  const sequence = useRef(0)
  const refresh = useCallback(async () => {
    const current = readCart(), requestKey = cartKey(current), requestId = ++sequence.current
    setState(previous => ({ ...previous, key: requestKey, error: '', loading: true }))
    if (!current.items.length) {
      setState({ key: requestKey, data: null, error: '', loading: false }); return null
    }
    try {
      const data = await reviewCart(current)
      if (requestId !== sequence.current || requestKey !== cartKey(readCart())) throw new Error('O carrinho mudou durante a atualização. Revise-o novamente.')
      setState({ key: requestKey, data, error: '', loading: false })
      rememberCartPrices(data.cart, requestKey)
      return data
    } catch (error) {
      if (requestId === sequence.current) setState(previous => ({ ...previous, key: requestKey, error: error.message, loading: false }))
      throw error
    }
  }, [])
  const cancel = useCallback(() => { sequence.current += 1 }, [])
  useEffect(() => {
    const reload = () => { refresh().catch(() => {}) }
    const visible = () => { if (document.visibilityState === 'visible') reload() }
    reload()
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', visible)
    return () => { cancel(); window.removeEventListener('focus', reload); document.removeEventListener('visibilitychange', visible) }
  }, [key, refresh, cancel])
  const data = state.key === key ? state.data : null
  const loading = state.loading || state.key !== key
  return { data, error: state.key === key ? state.error : '', loading, refresh,
    canCheckout: Boolean(data?.canCheckout && !data.priceChanges.length && !loading && !state.error), key }
}
