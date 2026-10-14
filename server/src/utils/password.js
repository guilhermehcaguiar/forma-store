import { promisify } from 'node:util'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'

// Hash de senha com scrypt (nativo do Node, sem dependências externas).
// Formato armazenado: "scrypt:<salt em hex>:<chave derivada em hex>".
// Nunca armazenamos a senha em texto puro (RNF06).
const scrypt = promisify(scryptCallback)
const SALT_BYTES = 16
const KEY_LENGTH = 64

export async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES).toString('hex')
  const derived = await scrypt(password, salt, KEY_LENGTH)
  return `scrypt:${salt}:${derived.toString('hex')}`
}

export async function verifyPassword(password, stored) {
  const [scheme, salt, expectedHex] = String(stored ?? '').split(':')
  if (scheme !== 'scrypt' || !salt || !expectedHex) return false

  const expected = Buffer.from(expectedHex, 'hex')
  const derived = await scrypt(password, salt, KEY_LENGTH)

  // timingSafeEqual evita comparar por tempo de execução; tamanhos diferentes
  // já significam senha incorreta, mas a comparação continua em tempo constante.
  return expected.length === derived.length && timingSafeEqual(derived, expected)
}
