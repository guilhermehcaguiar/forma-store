import { badRequest } from '../utils/httpError.js'

const forbidden = new Set(['pan', 'cardnumber', 'cvv', 'cvc', 'securitycode'])
export function rejectRawCardData(req, _res, next) {
  const queue = [req.body]
  while (queue.length) {
    const value = queue.pop()
    if (!value || typeof value !== 'object') continue
    for (const [key, nested] of Object.entries(value)) {
      if (forbidden.has(key.toLowerCase().replace(/[_-]/g, ''))) {
        throw badRequest('dados_cartao_proibidos', 'Dados completos de cartão não são aceitos pela FORMA. Use os campos seguros do Mercado Pago.')
      }
      if (nested && typeof nested === 'object') queue.push(nested)
    }
  }
  next()
}
