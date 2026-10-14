import { createHash, randomBytes } from 'node:crypto'

// Token de sessão opaco. O token em si volta para o cliente; no banco fica
// apenas o SHA-256, então um vazamento do banco não expõe sessões válidas.
export function createSessionToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashToken(token) }
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}
