import { readJSON, readJSONForUpdate, removeItem, writeJSON } from './storage.js'

const USERS_KEY = 'forma:users'
const SESSION_KEY = 'forma:session'
const PBKDF2_ITERATIONS = 100000
const HASH_LENGTH = 32
const SALT_LENGTH = 16

export class AuthError extends Error {
  constructor(message, code = 'auth_error') {
    super(message)
    this.name = 'AuthError'
    this.code = code
  }
}

function getCrypto() {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    return window.crypto
  }

  return null
}

function bytesToBase64(bytes) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function base64ToBytes(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function generateSalt() {
  const cryptoObj = getCrypto()
  const bytes = new Uint8Array(SALT_LENGTH)

  if (!cryptoObj) {
    throw new AuthError('Use um navegador com Web Crypto em localhost ou HTTPS.', 'crypto_unavailable')
  }
  cryptoObj.getRandomValues(bytes)

  return bytesToBase64(bytes)
}

function generateId() {
  const cryptoObj = getCrypto()

  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID()
  }

  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

async function deriveHash(password, saltBase64) {
  const cryptoObj = getCrypto()

  if (!cryptoObj) {
    throw new AuthError(
      'A Web Crypto API não está disponível neste navegador.',
      'crypto_unavailable',
    )
  }

  const encoder = new TextEncoder()
  const keyMaterial = await cryptoObj.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  const derivedBits = await cryptoObj.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: base64ToBytes(saltBase64),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    HASH_LENGTH * 8,
  )

  return bytesToBase64(new Uint8Array(derivedBits))
}

function timingSafeEqual(valueA, valueB) {
  if (typeof valueA !== 'string' || typeof valueB !== 'string') {
    return false
  }

  if (valueA.length !== valueB.length) {
    return false
  }

  let result = 0
  for (let index = 0; index < valueA.length; index += 1) {
    result |= valueA.charCodeAt(index) ^ valueB.charCodeAt(index)
  }

  return result === 0
}

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

function isValidUser(user) {
  return (
    user &&
    typeof user === 'object' &&
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    typeof user.name === 'string' &&
    typeof user.passwordHash === 'string' &&
    typeof user.salt === 'string'
  )
}

function getUsers(forUpdate = false) {
  const stored = forUpdate ? readJSONForUpdate(USERS_KEY, []) : readJSON(USERS_KEY, [])

  if (!Array.isArray(stored)) {
    if (forUpdate) throw new AuthError('Os dados locais estão inválidos e foram preservados.', 'storage_error')
    return []
  }

  if (forUpdate) return stored
  return stored.filter(isValidUser)
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    promo: Boolean(user.promo),
    createdAt: user.createdAt ?? null,
  }
}

function setSession(userId) {
  if (!writeJSON(SESSION_KEY, { userId, createdAt: new Date().toISOString() })) {
    throw new AuthError('Não foi possível salvar a sessão. Verifique o armazenamento do navegador e tente entrar novamente.', 'storage_error')
  }
}

export function clearSession() {
  if (!removeItem(SESSION_KEY)) {
    throw new AuthError('Não foi possível encerrar a sessão no navegador. Tente novamente.', 'storage_error')
  }
}

export function emailExists(email) {
  const normalized = normalizeEmail(email)
  return getUsers().some((user) => normalizeEmail(user.email) === normalized)
}

export function getCurrentUser() {
  const session = readJSON(SESSION_KEY, null)

  if (!session || typeof session.userId !== 'string') {
    return null
  }

  const user = getUsers().find((item) => item.id === session.userId)

  if (!user) {
    return null
  }

  return toPublicUser(user)
}

export async function registerUser({ name, email, password, promo = false }) {
  const normalized = normalizeEmail(email)
  const users = getUsers(true)

  if (users.some((user) => normalizeEmail(user?.email) === normalized)) {
    throw new AuthError('Este e-mail já está cadastrado.', 'email_taken')
  }

  const salt = generateSalt()
  const passwordHash = await deriveHash(password, salt)

  const user = {
    id: generateId(),
    name: String(name).trim(),
    email: normalized,
    passwordHash,
    salt,
    promo: Boolean(promo),
    createdAt: new Date().toISOString(),
  }

  // Lê novamente após PBKDF2 para preservar cadastros feitos durante a espera.
  const latestUsers = getUsers(true)
  if (latestUsers.some((item) => normalizeEmail(item?.email) === normalized)) {
    throw new AuthError('Este e-mail já está cadastrado.', 'email_taken')
  }
  const saved = writeJSON(USERS_KEY, [...latestUsers, user])

  if (!saved) {
    throw new AuthError('Não foi possível salvar o cadastro.', 'storage_error')
  }

  setSession(user.id)
  return toPublicUser(user)
}

export async function loginUser({ email, password }) {
  const normalized = normalizeEmail(email)
  const user = getUsers().find((item) => normalizeEmail(item.email) === normalized)

  const invalidCredentials = () => {
    throw new AuthError('E-mail ou senha inválidos.', 'invalid_credentials')
  }

  if (!user) {
    invalidCredentials()
  }

  let hash
  try {
    hash = await deriveHash(password, user.salt)
  } catch (error) {
    if (error.code === 'crypto_unavailable') throw error
    throw new AuthError('Os dados desta conta estão inválidos e foram preservados.', 'storage_error')
  }

  if (!timingSafeEqual(hash, user.passwordHash)) {
    invalidCredentials()
  }

  setSession(user.id)
  return toPublicUser(user)
}

export function updateUserProfile(userId, { name, promo }) {
  const users = getUsers(true)
  const index = users.findIndex((user) => isValidUser(user) && user.id === userId)

  if (index === -1) {
    throw new AuthError('Usuário não encontrado.', 'user_not_found')
  }

  const updated = {
    ...users[index],
    name: String(name).trim(),
    promo: Boolean(promo),
  }

  users[index] = updated
  if (!writeJSON(USERS_KEY, users)) {
    throw new AuthError('Não foi possível salvar o perfil. Tente novamente.', 'storage_error')
  }

  return toPublicUser(updated)
}

export function logoutUser() {
  clearSession()
}
