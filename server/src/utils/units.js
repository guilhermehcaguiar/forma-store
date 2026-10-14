// Unidades-padrão do FORMA para os blocos de catálogo e pedidos:
// peso em GRAMAS (inteiro ≥ 0) e dimensões em CENTÍMETROS (inteiro ≥ 0).
// Documentado em docs/forma/API_CONTRATOS.md.

export const WEIGHT_UNIT = 'g'
export const DIMENSION_UNIT = 'cm'

function assertNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} deve ser um inteiro não negativo.`)
  }
}

export function assertGramas(value, label = 'peso') {
  assertNonNegativeInteger(value, label)
}

export function assertCentimetros(value, label = 'dimensão') {
  assertNonNegativeInteger(value, label)
}
