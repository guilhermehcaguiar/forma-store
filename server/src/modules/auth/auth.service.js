import { randomUUID } from 'node:crypto'
import { query } from '../../db/pool.js'
import { config } from '../../config.js'
import { conflict, unauthorized } from '../../utils/httpError.js'
import { hashPassword, verifyPassword } from '../../utils/password.js'
import { createSessionToken } from '../../utils/token.js'

// Colunas públicas de usuário; password_hash e updated_at nunca saem da API.
const USER_COLUMNS = 'id, name, email, promo, created_at AS "createdAt"'

function toPublicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    promo: row.promo,
    createdAt: row.createdAt?.toISOString() ?? null,
  }
}

export async function registerUser({ name, email, password, promo }) {
  const passwordHash = await hashPassword(password)

  try {
    const { rows } = await query(
      `INSERT INTO users (id, name, email, password_hash, promo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${USER_COLUMNS}`,
      [randomUUID(), name, email, passwordHash, promo],
    )
    return toPublicUser(rows[0])
  } catch (error) {
    // Índice único users_email_unique_idx (e-mails duplicados).
    if (error.code === '23505') {
      throw conflict('email_ja_cadastrado', 'Este e-mail já está cadastrado.')
    }
    throw error
  }
}

export async function loginUser({ email, password }) {
  const { rows } = await query(
    `SELECT id, name, email, promo, password_hash, created_at
       FROM users
      WHERE lower(email) = $1`,
    [email],
  )

  const user = rows[0]

  // Mensagem única para e-mail inexistente e senha errada, sem revelar
  // quais e-mails estão cadastrados (RF03).
  if (!user) {
    throw unauthorized('credenciais_invalidas', 'E-mail ou senha inválidos.')
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    throw unauthorized('credenciais_invalidas', 'E-mail ou senha inválidos.')
  }

  return toPublicUser(user)
}

export async function createSession(userId) {
  const { token, tokenHash } = createSessionToken()
  const expiresAt = new Date(Date.now() + config.sessionTtlDays * 24 * 60 * 60 * 1000)

  await query(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [tokenHash, userId, expiresAt],
  )

  return { token, expiresAt: expiresAt.toISOString() }
}

export async function logoutSession(tokenHash) {
  await query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash])
}

export async function updateUser(userId, { name, promo }) {
  const { rows } = await query(
    `UPDATE users
        SET name = $2, promo = $3, updated_at = now()
      WHERE id = $1
      RETURNING ${USER_COLUMNS}`,
    [userId, name, promo],
  )

  if (!rows[0]) {
    throw unauthorized('sessao_invalida', 'Usuário da sessão não encontrado.')
  }
  return toPublicUser(rows[0])
}
