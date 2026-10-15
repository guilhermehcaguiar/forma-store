import { assertValid, bodyObject } from '../../utils/validate.js'

// Identificador de produto conforme o contrato do bloco de catálogo
// (docs/forma/API_CONTRATOS.md): UUID. A tabela de produtos em si pertence à
// migração do catálogo; aqui só validamos a referência.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseProductId(body) {
  const data = bodyObject(body)
  const errors = {}

  const productId = typeof data.productId === 'string' ? data.productId.trim().toLowerCase() : ''

  if (!productId) errors.productId = 'Informe o produto.'
  else if (!UUID_PATTERN.test(productId)) errors.productId = 'Produto inválido.'

  assertValid(errors)
  return { productId }
}
