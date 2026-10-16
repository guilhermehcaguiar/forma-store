import { bodyObject, assertValid } from '../../utils/validate.js'
import { validationError } from '../../utils/httpError.js'
import { parseCartItems } from '../cart/cart.schemas.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseShippingQuote(body) {
  const data = bodyObject(body)
  const errors = {}
  const addressId = typeof data.addressId === 'string' ? data.addressId.trim().toLowerCase() : ''
  if (!UUID_PATTERN.test(addressId)) errors.addressId = 'Selecione um endereço válido.'

  let items
  try {
    items = parseCartItems(data)
  } catch (error) {
    if (error.fields) Object.assign(errors, error.fields)
    else throw error
  }

  assertValid(errors)
  return { addressId, items }
}

export function parseCheckout(body) {
  const data = bodyObject(body)
  const errors = {}
  const addressId = typeof data.addressId === 'string' ? data.addressId.trim().toLowerCase() : ''
  const quoteId = typeof data.quoteId === 'string' ? data.quoteId.trim().toLowerCase() : ''
  const serviceId = typeof data.serviceId === 'string' || typeof data.serviceId === 'number' ? String(data.serviceId).trim() : ''
  const code = typeof data.couponCode === 'string' ? data.couponCode.trim().toUpperCase() : ''

  if (!UUID_PATTERN.test(addressId)) errors.addressId = 'Selecione um endereço válido.'
  if (!UUID_PATTERN.test(quoteId)) errors.quoteId = 'Solicite uma nova cotação de frete.'
  if (!serviceId || serviceId.length > 80) errors.serviceId = 'Selecione uma opção de frete.'
  if (code.length > 50) errors.couponCode = 'Cupom inválido.'

  let items
  try {
    items = parseCartItems(data)
  } catch (error) {
    if (error.fields) Object.assign(errors, error.fields)
    else throw error
  }

  if (Object.keys(errors).length) throw validationError(errors)
  return { addressId, quoteId, serviceId, couponCode: code, items }
}
