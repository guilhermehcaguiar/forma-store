import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { listAddresses, saveAddress, setPrincipalAddress, removeAddress, saveList, removeList, addFavorite, removeFavorite, addListItem, removeListItem } from '../src/services/account.js'

// Endereços e listas agora vivem no servidor; os testes simulam o `fetch`
// e conferem que o cliente continua normalizando CEP/UF e mostrando as
// mesmas mensagens. Nada é gravado no localStorage.

let storage
let calls

beforeEach(() => {
  storage = new Map()
  calls = []
  globalThis.window = {
    localStorage: {
      getItem: key => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
  }
})

function stubFetch(handler) {
  globalThis.fetch = async (url, options) => {
    const request = { url: new URL(url), options }
    calls.push(request)
    return handler(request)
  }
}

const respond = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

const address = { label: 'Casa', recipient: 'Aluno', street: 'Rua teste', number: '1', district: 'Centro', city: 'Recife', state: 'pe', cep: '50000-000' }
const savedAddress = { id: 'a-1', ...address, state: 'PE', cep: '50000000', complement: '', createdAt: null, updatedAt: null }

test('endereços são lidos, criados e atualizados na API com normalização', async () => {
  stubFetch(request => {
    assert.equal(request.url.pathname, '/api/conta/enderecos')
    return respond(200, { addresses: [savedAddress] })
  })
  assert.deepEqual(await listAddresses(), [savedAddress])

  stubFetch(request => {
    assert.equal(request.options.method, 'POST')
    const body = JSON.parse(request.options.body)
    assert.equal(body.cep, '50000000')
    assert.equal(body.state, 'PE')
    return respond(201, { address: savedAddress })
  })
  assert.equal((await saveAddress(address)).id, 'a-1')

  stubFetch(request => {
    assert.equal(request.options.method, 'PUT')
    assert.equal(request.url.pathname, '/api/conta/enderecos/a-1')
    assert.equal(JSON.parse(request.options.body).number, '2')
    return respond(200, { address: { ...savedAddress, number: '2' } })
  })
  assert.equal((await saveAddress({ ...address, id: 'a-1', number: '2' })).number, '2')
})

test('validações do formulário continuam no cliente, sem chamar a API', async () => {
  globalThis.fetch = () => assert.fail('validação falha não deve chegar ao servidor')

  await assert.rejects(saveAddress({ ...address, cep: '123' }), /8 dígitos/)
  await assert.rejects(saveAddress({ ...address, state: 'XX' }), /UF válida/)
  await assert.rejects(saveAddress({ ...address, label: '' }), /campos obrigatórios/)

  await assert.rejects(saveList({ name: '' }), /até 80 caracteres/)
  await assert.rejects(saveList({ name: 'x'.repeat(81) }), /até 80 caracteres/)

  assert.equal(calls.length, 0)
  assert.equal(storage.size, 0, 'nenhum dado de conta é gravado no navegador')
})

test('remoções usam DELETE e erros do servidor viram mensagens das telas', async () => {
  stubFetch(request => {
    assert.equal(request.options.method, 'DELETE')
    assert.equal(request.url.pathname, '/api/conta/enderecos/a-1')
    return respond(204)
  })
  await removeAddress('a-1')

  stubFetch(request => {
    assert.equal(request.url.pathname, '/api/conta/listas/l-1')
    return respond(204)
  })
  await removeList('l-1')

  stubFetch(() => respond(400, {
    error: { code: 'validacao', message: 'Verifique os campos informados.', fields: { cep: 'Informe um CEP com 8 dígitos.' } },
  }))
  await assert.rejects(saveAddress({ ...address, cep: '123456789' }), /8 dígitos/)
})

test('listas: criar, renomear e respeitar unicidade no servidor', async () => {
  stubFetch(request => {
    assert.equal(request.options.method, 'POST')
    assert.deepEqual(JSON.parse(request.options.body), { name: 'Minha seleção' })
    return respond(201, { list: { id: 'l-1', name: 'Minha seleção', productIds: [] } })
  })
  assert.deepEqual(await saveList({ name: 'Minha seleção' }), { id: 'l-1', name: 'Minha seleção', productIds: [] })

  stubFetch(request => {
    assert.equal(request.options.method, 'PUT')
    assert.equal(request.url.pathname, '/api/conta/listas/l-1')
    return respond(200, { list: { id: 'l-1', name: 'Nova seleção', productIds: [] } })
  })
  assert.equal((await saveList({ id: 'l-1', name: 'Nova seleção' })).name, 'Nova seleção')

  stubFetch(() => respond(409, { error: { code: 'nome_em_uso', message: 'Já existe uma lista com esse nome.' } }))
  await assert.rejects(saveList({ name: 'minha seleção' }), /Já existe/)
})

test('endereço principal é uma seleção explícita na API', async () => {
  stubFetch(request => {
    assert.equal(request.options.method, 'PUT')
    assert.equal(request.url.pathname, '/api/conta/enderecos/a-2/principal')
    return respond(200, { address: { id: 'a-2', principal: true } })
  })
  assert.equal((await setPrincipalAddress('a-2')).principal, true)

  stubFetch(() => respond(404, { error: { code: 'nao_encontrado', message: 'Endereço não encontrado.' } }))
  await assert.rejects(setPrincipalAddress('de-outro'), /não encontrado/)
})

test('favoritos: adicionar, duplicado e remover via API', async () => {
  const productId = '6f1e1a44-9c2b-4c58-9d0e-4b0f2a1c3d5e'

  stubFetch(request => {
    assert.equal(request.options.method, 'POST')
    assert.equal(request.url.pathname, '/api/conta/favoritos')
    assert.deepEqual(JSON.parse(request.options.body), { productId })
    return respond(201, { productIds: [productId] })
  })
  assert.deepEqual(await addFavorite(productId), [productId])

  stubFetch(() => respond(409, { error: { code: 'favorito_duplicado', message: 'Esta peça já está nos seus favoritos.' } }))
  await assert.rejects(addFavorite(productId), /já está nos seus favoritos/)

  stubFetch(request => {
    assert.equal(request.options.method, 'DELETE')
    assert.equal(request.url.pathname, `/api/conta/favoritos/${productId}`)
    return respond(204)
  })
  await removeFavorite(productId)
})

test('itens de lista: adicionar, duplicado e remover via API', async () => {
  const productId = '6f1e1a44-9c2b-4c58-9d0e-4b0f2a1c3d5e'

  stubFetch(request => {
    assert.equal(request.options.method, 'POST')
    assert.equal(request.url.pathname, '/api/conta/listas/l-1/itens')
    assert.deepEqual(JSON.parse(request.options.body), { productId })
    return respond(201, { list: { id: 'l-1', name: 'Minha seleção', productIds: [productId] } })
  })
  assert.deepEqual(await addListItem('l-1', productId), { id: 'l-1', name: 'Minha seleção', productIds: [productId] })

  stubFetch(() => respond(409, { error: { code: 'produto_na_lista', message: 'Esta peça já está na lista.' } }))
  await assert.rejects(addListItem('l-1', productId), /já está na lista/)

  stubFetch(request => {
    assert.equal(request.options.method, 'DELETE')
    assert.equal(request.url.pathname, `/api/conta/listas/l-1/itens/${productId}`)
    return respond(204)
  })
  await removeListItem('l-1', productId)

  stubFetch(() => respond(404, { error: { code: 'nao_encontrado', message: 'Lista não encontrada.' } }))
  await assert.rejects(addListItem('de-outro', productId), /não encontrada/)
})
