import { badRequest } from './httpError.js'

// Mesma regra adotada no front-end (src/utils/validation.js).
export const PASSWORD_MIN_LENGTH = 6

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function str(value) {
  if (typeof value === 'string') return value.trim()
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export function normalizeEmail(value) {
  return str(value).toLowerCase()
}

export function isEmail(value) {
  return EMAIL_PATTERN.test(value)
}

// Valores do corpo da requisição; nunca assume que o JSON chegou como objeto.
export function bodyObject(body) {
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {}
}

export function boolean(value) {
  return value === true || value === 'true'
}

// Lança 400 com o mapa de erros por campo quando houver alguma inconsistência.
export function assertValid(errors) {
  if (Object.keys(errors).length > 0) {
    throw badRequest('validacao', 'Verifique os campos informados.', errors)
  }
}
