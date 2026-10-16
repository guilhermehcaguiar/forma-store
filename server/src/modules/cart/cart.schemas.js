import { validationError } from '../../utils/httpError.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseCartItems(body) {
  const items = Array.isArray(body?.items) ? body.items : []
  const errors = {}
  const normalized = []

  if (!items.length) errors.items = 'Adicione ao menos um produto ao carrinho.'
  if (items.length > 50) errors.items = 'O carrinho excede o limite de itens.'

  for (const [index, item] of items.entries()) {
    const productId = typeof item?.productId === 'string' ? item.productId.trim().toLowerCase() : ''
    const quantity = ['number', 'string'].includes(typeof item?.quantity) && /^(?:[1-9]|1\d|20)$/.test(String(item.quantity).trim()) ? Number(item.quantity) : NaN
    const size = typeof item?.size === 'string' ? item.size.trim() : ''

    if (!UUID_PATTERN.test(productId)) errors[`items.${index}.productId`] = 'Produto inválido.'
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) {
      errors[`items.${index}.quantity`] = 'A quantidade deve ser um inteiro entre 1 e 20.'
    }
    if (size.length > 10) errors[`items.${index}.size`] = 'Tamanho inválido.'
    if (normalized.some((entry) => entry.productId === productId && entry.size === size)) {
      errors[`items.${index}`] = 'Produto e tamanho já informados.'
    }
    normalized.push({ productId, quantity, size })
  }

  if (Object.keys(errors).length) throw validationError(errors)
  return normalized
}
