import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { registerUser, loginUser } from '../src/services/auth.js'
import { accountKey, readAccount, saveAddress, saveList, removeAccountItem } from '../src/services/account.js'

let storage
let failWrites
beforeEach(() => {
  storage = new Map()
  failWrites = false
  globalThis.window = { crypto: webcrypto, localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem(key, value) { if (failWrites) throw new Error('Quota'); storage.set(key, value) },
    removeItem: key => storage.delete(key),
  } }
})
const user = { name: 'Aluno', email: 'aluno@example.com', password: 'teste123' }
const address = { label: 'Casa', recipient: 'Aluno', street: 'Rua teste', number: '1', district: 'Centro', city: 'Recife', state: 'pe', cep: '50000-000' }

test('endereços e listas persistem por conta, com edição, exclusão e validação', async () => {
  const first = await registerUser(user)
  assert.deepEqual(readAccount(first.id).addresses, [])
  let data = saveAddress(first.id, address)
  const id = data.addresses[0].id
  assert.equal(data.addresses[0].cep, '50000000')
  assert.equal(data.addresses[0].state, 'PE')
  saveAddress(first.id, { ...address, id, number: '2' })
  assert.equal(readAccount(first.id).addresses[0].number, '2')
  assert.throws(() => saveAddress(first.id, { ...address, cep: '123' }), /8 dígitos/)
  assert.throws(() => saveAddress(first.id, { ...address, state: 'XX' }), /UF válida/)
  data = saveList(first.id, { name: 'Minha seleção' })
  const listId = data.lists[0].id
  assert.throws(() => saveList(first.id, { name: ' minha seleção ' }), /Já existe/)
  saveList(first.id, { id: listId, name: 'Nova seleção' })
  const second = await registerUser({ ...user, email: 'outro@example.com' })
  assert.deepEqual(readAccount(second.id).lists, [])
  assert.throws(() => saveList(first.id, { name: 'Sem acesso' }), /Entre na sua conta/)
  await loginUser(user)
  assert.equal(readAccount(first.id).lists[0].name, 'Nova seleção')
  removeAccountItem(first.id, 'lists', listId)
  removeAccountItem(first.id, 'addresses', id)
  assert.deepEqual(readAccount(first.id).lists, [])
  assert.deepEqual(readAccount(first.id).addresses, [])
})

test('dados desconhecidos e credenciais são preservados; falhas e corrupção não sobrescrevem dados', async () => {
  const first = await registerUser(user)
  const credentials = storage.get('forma:users')
  const key = accountKey(first.id)
  storage.set(key, JSON.stringify({ version: 1, addresses: [{ custom: 'legado' }], lists: [], extra: 'preservar' }))
  const next = saveAddress(first.id, address)
  assert.equal(next.extra, 'preservar')
  assert.deepEqual(next.addresses[0], { custom: 'legado' })
  assert.equal(storage.get('forma:users'), credentials)
  const original = storage.get(key)
  failWrites = true
  assert.throws(() => saveList(first.id, { name: 'Não salva' }), /Não foi possível salvar/)
  assert.equal(storage.get(key), original)
  failWrites = false
  for (const raw of ['{inválido', '{}', '{"version":2,"addresses":[],"lists":[]}']) {
    storage.set(key, raw)
    assert.throws(() => saveList(first.id, { name: 'Não sobrescrever' }), /preservado/)
    assert.equal(storage.get(key), raw)
  }
})
