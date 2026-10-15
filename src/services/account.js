// Endereços (RF05) e listas de compras (RF20) via API local.
//
// As validações do formulário continuam no cliente com as mesmas mensagens
// das telas aprovadas; o servidor repete as regras e filtra tudo por conta
// (user_id da sessão). Nenhum dado é gravado mais no `localStorage` — os
// arquivos antigos (`forma:account:*`) continuam no navegador, preservados,
// mas não são lidos nem apagados por este serviço.

import { api, ApiError } from './api.js'

const text = value => String(value ?? '').trim()
const states = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '))

export function formatAddress(address) {
  return `${address.street}, ${address.number}${address.complement ? ` · ${address.complement}` : ''} · ${address.district} · ${address.city}, ${address.state} · CEP ${address.cep?.replace(/^(\d{5})(\d{3})$/, '$1-$2')}`
}

// O servidor devolve erros por campo; as telas exibem uma mensagem por vez,
// então o primeiro campo inválido vira o texto do alerta.
function messageFrom(error, fallback) {
  const fieldMessage = error instanceof ApiError ? Object.values(error.fields ?? {}).find(Boolean) : null
  return fieldMessage || error?.message || fallback
}

function normalizeAddress(values) {
  const address = Object.fromEntries(['label', 'recipient', 'street', 'number', 'complement', 'district', 'city', 'state', 'cep'].map(field => [field, text(values[field])]))
  address.cep = address.cep.replace(/\D/g, '')
  address.state = address.state.toUpperCase()
  return address
}

function assertAddress(address) {
  if (['label', 'recipient', 'street', 'number', 'district', 'city'].some(field => !address[field])) {
    throw new Error('Preencha todos os campos obrigatórios do endereço.')
  }
  if (!/^\d{8}$/.test(address.cep)) throw new Error('Informe um CEP com 8 dígitos.')
  if (!states.has(address.state)) throw new Error('Informe uma UF válida, como SP ou PE.')
}

export async function listAddresses() {
  const data = await api.get('/conta/enderecos')
  return data.addresses
}

export async function saveAddress(values) {
  const address = normalizeAddress(values)
  assertAddress(address)

  try {
    const data = values.id
      ? await api.put(`/conta/enderecos/${values.id}`, address)
      : await api.post('/conta/enderecos', address)
    return data.address
  } catch (error) {
    throw new Error(messageFrom(error, 'Não foi possível salvar o endereço.'))
  }
}

export async function removeAddress(id) {
  try {
    await api.delete(`/conta/enderecos/${id}`)
  } catch (error) {
    throw new Error(messageFrom(error, 'Não foi possível remover o endereço.'))
  }
}

export async function listLists() {
  const data = await api.get('/conta/listas')
  return data.lists
}

export async function saveList(values) {
  const name = text(values.name)
  if (!name || name.length > 80) throw new Error('Informe um nome de até 80 caracteres para a lista.')

  try {
    const data = values.id
      ? await api.put(`/conta/listas/${values.id}`, { name })
      : await api.post('/conta/listas', { name })
    return data.list
  } catch (error) {
    throw new Error(messageFrom(error, 'Não foi possível salvar a lista.'))
  }
}

export async function removeList(id) {
  try {
    await api.delete(`/conta/listas/${id}`)
  } catch (error) {
    throw new Error(messageFrom(error, 'Não foi possível remover a lista.'))
  }
}
