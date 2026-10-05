import { getCurrentUser } from './auth.js'
import { readJSONForUpdate, writeJSON } from './storage.js'

export const accountKey = userId => `forma:account:${userId}`
const emptyAccount = () => ({ version: 1, addresses: [], lists: [] })

export function readAccount(userId) {
  const data = readJSONForUpdate(accountKey(userId), emptyAccount())
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.version !== 1 ||
      !Array.isArray(data.addresses) || !Array.isArray(data.lists)) {
    throw new Error('Os dados desta conta estão inválidos e foram preservados.')
  }
  return data
}

function updateCollection(userId, collection, update) {
  if (getCurrentUser()?.id !== userId) throw new Error('Entre na sua conta para continuar.')
  const data = readAccount(userId)
  const next = { ...data, [collection]: update(data[collection]) }
  if (!writeJSON(accountKey(userId), next)) {
    throw new Error('Não foi possível salvar. Verifique o armazenamento do navegador.')
  }
  return next
}

const text = value => String(value ?? '').trim()
const states = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '))

export function saveAddress(userId, values) {
  const address = Object.fromEntries(['label', 'recipient', 'street', 'number', 'complement', 'district', 'city', 'state', 'cep'].map(field => [field, text(values[field])]))
  address.cep = address.cep.replace(/\D/g, '')
  address.state = address.state.toUpperCase()
  if (['label', 'recipient', 'street', 'number', 'district', 'city'].some(field => !address[field])) {
    throw new Error('Preencha todos os campos obrigatórios do endereço.')
  }
  if (!/^\d{8}$/.test(address.cep)) throw new Error('Informe um CEP com 8 dígitos.')
  if (!states.has(address.state)) throw new Error('Informe uma UF válida, como SP ou PE.')
  return updateCollection(userId, 'addresses', addresses => {
    if (values.id && !addresses.some(item => item?.id === values.id)) throw new Error('Endereço não encontrado.')
    const next = { ...address, id: values.id || window.crypto.randomUUID() }
    return values.id ? addresses.map(item => item?.id === values.id ? { ...item, ...next } : item) : [...addresses, next]
  })
}

export function saveList(userId, values) {
  const name = text(values.name)
  if (!name || name.length > 80) throw new Error('Informe um nome de até 80 caracteres para a lista.')
  return updateCollection(userId, 'lists', lists => {
    if (lists.some(item => item?.id !== values.id && text(item?.name).toLowerCase() === name.toLowerCase())) {
      throw new Error('Já existe uma lista com esse nome.')
    }
    if (values.id && !lists.some(item => item?.id === values.id)) throw new Error('Lista não encontrada.')
    return values.id ? lists.map(item => item?.id === values.id ? { ...item, name } : item) : [...lists, { id: window.crypto.randomUUID(), name, productIds: [] }]
  })
}

export function removeAccountItem(userId, collection, id) {
  if (!['addresses', 'lists'].includes(collection)) throw new Error('Seção inválida.')
  return updateCollection(userId, collection, items => items.filter(item => item?.id !== id))
}

export function formatAddress(address) {
  return `${address.street}, ${address.number}${address.complement ? ` · ${address.complement}` : ''} · ${address.district} · ${address.city}, ${address.state} · CEP ${address.cep?.replace(/^(\d{5})(\d{3})$/, '$1-$2')}`
}
