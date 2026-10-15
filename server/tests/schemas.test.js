import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseLogin, parseProfile, parseRegister } from '../src/modules/auth/auth.schemas.js'
import { parseAddress } from '../src/modules/conta/enderecos.schemas.js'
import { parseList } from '../src/modules/conta/listas.schemas.js'
import { parseProductId } from '../src/modules/conta/produto.schemas.js'
import { HttpError } from '../src/utils/httpError.js'

function fieldsOf(fn, body) {
  try {
    fn(body)
    return null
  } catch (error) {
    assert.ok(error instanceof HttpError)
    assert.equal(error.status, 400)
    assert.equal(error.code, 'validacao')
    return error.fields
  }
}

describe('schemas de autenticação', () => {
  it('aceita cadastro válido e normaliza e-mail', () => {
    const data = parseRegister({ name: '  Maria  ', email: ' Maria@Exemplo.COM ', password: 'abc123', promo: true })
    assert.deepEqual(data, { name: 'Maria', email: 'maria@exemplo.com', password: 'abc123', promo: true })
  })

  it('rejeita cadastro com erros por campo', () => {
    const fields = fieldsOf(parseRegister, { name: '', email: 'invalido', password: '123' })
    assert.equal(fields.name, 'Informe seu nome.')
    assert.equal(fields.email, 'Informe um e-mail válido.')
    assert.match(fields.password, /pelo menos 6/)
  })

  it('exige credenciais no login', () => {
    const fields = fieldsOf(parseLogin, {})
    assert.ok(fields.email)
    assert.ok(fields.password)
  })

  it('valida edição de perfil', () => {
    assert.deepEqual(parseProfile({ name: 'Ana', promo: false }), { name: 'Ana', promo: false })
    const fields = fieldsOf(parseProfile, { name: '' })
    assert.equal(fields.name, 'Informe seu nome.')
  })
})

describe('schemas de endereço', () => {
  const valid = {
    label: 'Casa', recipient: 'Maria', street: 'Av. Brasil', number: '100',
    complement: '', district: 'Centro', city: 'Recife', state: 'pe', cep: '50000-000',
  }

  it('normaliza CEP e UF', () => {
    const data = parseAddress(valid)
    assert.equal(data.cep, '50000000')
    assert.equal(data.state, 'PE')
  })

  it('rejeita CEP curto, UF inválida e campos vazios', () => {
    const fields = fieldsOf(parseAddress, { ...valid, cep: '123', state: 'XX', city: ' ' })
    assert.equal(fields.cep, 'Informe um CEP com 8 dígitos.')
    assert.match(fields.state, /UF válida/)
    assert.equal(fields.city, 'Campo obrigatório.')
  })
})

describe('schemas de listas', () => {
  it('aceita nome válido', () => {
    assert.deepEqual(parseList({ name: ' Presentes ' }), { name: 'Presentes' })
  })

  it('rejeita nome vazio ou longo demais', () => {
    assert.match(fieldsOf(parseList, { name: '' }).name, /Informe um nome/)
    assert.match(fieldsOf(parseList, { name: 'a'.repeat(81) }).name, /até 80/)
  })
})

describe('schemas de produto (favoritos e itens de lista)', () => {
  const uuid = '6f1e1a44-9c2b-4c58-9d0e-4b0f2a1c3d5e'

  it('aceita UUID e normaliza para minúsculas', () => {
    assert.deepEqual(parseProductId({ productId: uuid.toUpperCase() }), { productId: uuid })
  })

  it('rejeita ausente ou fora do formato do contrato', () => {
    assert.match(fieldsOf(parseProductId, {}).productId, /Informe o produto/)
    assert.match(fieldsOf(parseProductId, { productId: 'nao-e-uuid' }).productId, /Produto inválido/)
  })
})
