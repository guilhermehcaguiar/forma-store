import { randomUUID } from 'node:crypto'
import { inTransaction, pool, query } from '../../db/pool.js'
import { config } from '../../config.js'
import { conflict, unauthorized, validationError } from '../../utils/httpError.js'
import { hashPassword, verifyPassword } from '../../utils/password.js'
import { createSessionToken } from '../../utils/token.js'

// Colunas públicas de usuário; password_hash e updated_at nunca saem da API.
// O papel (`role`) faz parte dos dados públicos: o front o usa para proteger
// rotas, mas a decisão final de autorização é sempre do servidor.
const USER_COLUMNS = 'id, name, email, promo, role, created_at AS "createdAt"'

function toPublicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    promo: row.promo,
    role: row.role,
    createdAt: row.createdAt?.toISOString() ?? null,
  }
}

export async function registerUser({ name, email, password, promo }) {
  const passwordHash = await hashPassword(password)

  try {
    // O papel nunca vem do corpo da requisição: toda conta criada via API é
    // "cliente". Administradores só existem pelo comando local `npm run admin`.
    const { rows } = await query(
      `INSERT INTO users (id, name, email, password_hash, promo, role)
       VALUES ($1, $2, $3, $4, $5, 'cliente')
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

export async function loginUser({ email, password }, db = pool) {
  const { rows } = await db.query(
    `SELECT id, name, email, promo, role, password_hash, created_at AS "createdAt"
       FROM users
      WHERE lower(email) = $1 FOR UPDATE`,
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

export async function createSession(userId, db = pool) {
  const { token, tokenHash } = createSessionToken()
  const expiresAt = new Date(Date.now() + config.sessionTtlDays * 24 * 60 * 60 * 1000)

  await db.query(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [tokenHash, userId, expiresAt],
  )

  return { token, expiresAt: expiresAt.toISOString() }
}

export async function logoutSession(tokenHash) {
  await query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash])
}

// Login e mudanças de credenciais compartilham o lock de usuário: uma senha
// antiga não pode abrir uma sessão depois de a troca já ter sido confirmada.
export async function loginWithSession(data) {
  return inTransaction(async client => {
    const user = await loginUser(data, client)
    const session = await createSession(user.id, client)
    return { user, ...session }
  })
}

async function lockSessionUser(client, userId, tokenHash) {
  const { rows } = await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [userId])
  const session = await client.query('SELECT 1 FROM sessions WHERE user_id=$1 AND token_hash=$2 AND expires_at>now()', [userId, tokenHash])
  if (!rows[0] || !session.rowCount) throw unauthorized('sessao_invalida', 'Sessão inválida ou expirada. Entre novamente.')
  return rows[0]
}

export async function updateUser(userId, { name, promo }, tokenHash) {
  return inTransaction(async client => {
    await lockSessionUser(client, userId, tokenHash)
    const { rows } = await client.query(`UPDATE users SET name=$2, promo=$3, updated_at=now() WHERE id=$1 RETURNING ${USER_COLUMNS}`, [userId, name, promo])
    return toPublicUser(rows[0])
  })
}

export async function changeCredentials(userId, data, tokenHash, kind) {
  try {
    return await inTransaction(async client => {
      const current = await lockSessionUser(client, userId, tokenHash)
      if (!await verifyPassword(data.currentPassword, current.password_hash)) throw validationError({ currentPassword: 'Senha atual incorreta.' })
      const value = kind === 'email' ? data.email : await hashPassword(data.newPassword)
      const column = kind === 'email' ? 'email' : 'password_hash'
      const { rows } = await client.query(`UPDATE users SET ${column}=$2, updated_at=now() WHERE id=$1 RETURNING ${USER_COLUMNS}`, [userId, value])
      // Mantém a sessão autenticada que efetuou a troca e revoga as demais.
      await client.query('DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2', [userId, tokenHash])
      return toPublicUser(rows[0])
    })
  } catch (error) {
    if (error.code === '23505') throw conflict('email_ja_cadastrado', 'Este e-mail já está cadastrado.')
    throw error
  }
}
