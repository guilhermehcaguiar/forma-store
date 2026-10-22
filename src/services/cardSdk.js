let sdkPromise
export function loadCardSdk(publicKey) {
  if (!publicKey) return Promise.reject(new Error('Cartões aguardam configuração das credenciais sandbox do Mercado Pago.'))
  if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
    if (window.MercadoPago) return resolve()
    const script = document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.onload = resolve
    script.onerror = () => { sdkPromise = null; reject(new Error('Não foi possível carregar o SDK do Mercado Pago.')) }
    document.head.appendChild(script)
  })
  return sdkPromise.then(() => new window.MercadoPago(publicKey, { locale: 'pt-BR' }))
}
