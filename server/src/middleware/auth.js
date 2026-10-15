import { query } from '../db/pool.js'
import { hashToken } from '../utils/token.js'
import { unauthorized } from '../utils/httpError.js'

// Middleware que exige uma sessão válida no cabeçalho Authorization: Bearer <token>.
// Em caso de sucesso anexa req.user (dados públicos, incluindo o papel) e
// req.tokenHash (para logout). A autorização por papel fica em authorize.js.
export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization ?? ''
  const [scheme, token] = header.split(' ')

  if (scheme !== 'Bearer' || !token) {
    throw unauthorized('sessao_ausente', 'Envie o token de acesso no cabeçalho Authorization.')
  }

  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.promo, u.role, u.created_at AS "createdAt",
            s.token_hash AS "tokenHash"
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  )

  const row = rows[0]
  if (!row) {
    throw unauthorized('sessao_invalida', 'Sessão inválida ou expirada. Entre novamente.')
  }

  req.user = {
    id: row.id,
    name: row.name,
    email: row.email,
    promo: row.promo,
    role: row.role,
    createdAt: row.createdAt?.toISOString() ?? null,
  }
  req.tokenHash = row.tokenHash
  next()
}
