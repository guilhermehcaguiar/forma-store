import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { registerUser, loginUser, logoutUser, getCurrentUser, updateUserProfile } from '../src/services/auth.js'
import { readJSON } from '../src/services/storage.js'
import { validateRegister, validateLogin } from '../src/utils/validation.js'

let data
let failWrites
beforeEach(() => {
  data = new Map()
  failWrites = false
  globalThis.window = {
    crypto: webcrypto,
    localStorage: {
      getItem: key => data.get(key) ?? null,
      setItem(key, value) { if (failWrites) throw new Error('Quota'); data.set(key, value) },
      removeItem(key) { if (failWrites) throw new Error('Blocked'); data.delete(key) },
    },
  }
})

const account = { name: 'Aluno Teste', email: 'ALUNO@example.com', password: 'teste123' }

test('cadastro, PBKDF2, sessão, perfil, logout e novo login', async () => {
  const user = await registerUser(account)
  assert.equal(user.email, 'aluno@example.com')
  assert.equal(user.promo, false)
  const stored = JSON.parse(data.get('forma:users'))[0]
  assert.ok(stored.salt && stored.passwordHash)
  assert.equal(stored.password, undefined)
  assert.ok(!data.get('forma:users').includes(account.password))
  assert.equal(getCurrentUser().id, user.id)
  updateUserProfile(user.id, { name: 'Novo Nome', promo: true })
  assert.equal(getCurrentUser().name, 'Novo Nome')
  assert.equal(getCurrentUser().promo, true)
  logoutUser()
  assert.equal(getCurrentUser(), null)
  await assert.rejects(loginUser({ ...account, password: 'errada' }), /inválidos/)
  assert.equal((await loginUser(account)).id, user.id)
  await assert.rejects(registerUser({ ...account, email: ' aluno@example.com ' }), /já está cadastrado/)
})

test('salt diferente por usuário e preservação de registros existentes', async () => {
  const first = await registerUser(account)
  const unknownRecord = { id: 'registro-legado', custom: 'preservar' }
  const original = JSON.parse(data.get('forma:users'))
  data.set('forma:users', JSON.stringify([...original, unknownRecord]))
  await registerUser({ ...account, email: 'outro@example.com' })
  updateUserProfile(first.id, { name: 'Editado', promo: false })
  const users = JSON.parse(data.get('forma:users'))
  assert.deepEqual(users[1], unknownRecord)
  assert.notEqual(users[0].salt, users[2].salt)
  assert.notEqual(users[0].passwordHash, users[2].passwordHash)
})

test('JSON corrompido não quebra leitura nem é sobrescrito', async () => {
  data.set('forma:users', '{inválido')
  assert.equal(getCurrentUser(), null)
  assert.deepEqual(readJSON('forma:users', []), [])
  await assert.rejects(registerUser(account), /preservado/)
  assert.equal(data.get('forma:users'), '{inválido')
  data.set('forma:users', '{}')
  await assert.rejects(registerUser(account), /preservados/)
  assert.equal(data.get('forma:users'), '{}')
})

test('falha de gravação de perfil e logout não aparenta sucesso', async () => {
  const user = await registerUser(account)
  const original = data.get('forma:users')
  failWrites = true
  assert.throws(() => updateUserProfile(user.id, { name: 'Não salvo' }), /salvar o perfil/)
  assert.equal(data.get('forma:users'), original)
  assert.throws(logoutUser, /encerrar a sessão/)
  await assert.rejects(loginUser(account), /salvar a sessão/)
  await assert.rejects(registerUser({ ...account, email: 'novo@example.com' }), /salvar o cadastro/)
})

test('validação de campos, e-mail e confirmação de senha', () => {
  const errors = validateRegister({ name: '', email: 'errado', password: '123', confirmPassword: '456' })
  assert.deepEqual(Object.keys(errors), ['name', 'email', 'password', 'confirmPassword'])
  assert.deepEqual(validateLogin({ email: '', password: '' }), { email: 'Informe o e-mail.', password: 'Informe a senha.' })
})
