import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assertGramas, assertCentimetros, DIMENSION_UNIT, WEIGHT_UNIT } from '../src/utils/units.js'

describe('units — padrões de peso e dimensões', () => {
  it('define gramas e centímetros como unidades oficiais', () => {
    assert.equal(WEIGHT_UNIT, 'g')
    assert.equal(DIMENSION_UNIT, 'cm')
  })

  it('aceita inteiros não negativos', () => {
    assert.doesNotThrow(() => assertGramas(450))
    assert.doesNotThrow(() => assertCentimetros(0))
  })

  it('rejeita valores fora do padrão', () => {
    assert.throws(() => assertGramas(0.45), TypeError) // deve ser inteiro, em gramas
    assert.throws(() => assertCentimetros(-1), TypeError)
  })
})
