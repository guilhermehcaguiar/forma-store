import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatBRL, fromCentavos, toCentavos } from '../src/utils/money.js'

describe('money — padrão em centavos', () => {
  it('converte número para centavos', () => {
    assert.equal(toCentavos(49.9), 4990)
    assert.equal(toCentavos(10), 1000)
    assert.equal(toCentavos(0), 0)
  })

  it('converte textos com vírgula, ponto e cifrão', () => {
    assert.equal(toCentavos('49,90'), 4990)
    assert.equal(toCentavos('49.90'), 4990)
    assert.equal(toCentavos('R$ 49,90'), 4990)
    assert.equal(toCentavos('49,5'), 4950)
    assert.equal(toCentavos('49'), 4900)
  })

  it('mantém exatidão sem ponto flutuante', () => {
    assert.equal(toCentavos('0.1'), 10) // 0.1 * 100 em float daria 10.000000000000002
    assert.equal(fromCentavos(1050), '10.50')
    assert.equal(fromCentavos(5), '0.05')
    assert.equal(fromCentavos(0), '0.00')
  })

  it('formata para exibição em BRL', () => {
    assert.equal(formatBRL(4990), 'R$ 49,90')
  })

  it('rejeita valores inválidos', () => {
    assert.throws(() => toCentavos('1.090,50'), TypeError) // dois separadores
    assert.throws(() => toCentavos('abc'), TypeError)
    assert.throws(() => toCentavos(-5), TypeError)
    assert.throws(() => toCentavos(Number.NaN), TypeError)
    assert.throws(() => fromCentavos(10.5), TypeError) // centavos devem ser inteiros
    assert.throws(() => fromCentavos(-1), TypeError)
  })
})
