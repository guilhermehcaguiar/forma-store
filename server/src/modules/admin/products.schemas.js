import { validationError } from '../../utils/httpError.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_INT = 2147483647
const text = value => typeof value === 'string' ? value.trim() : ''
const integer = value => ['number', 'string'].includes(typeof value) && /^(0|[1-9]\d*)$/.test(String(value)) && Number(value) <= MAX_INT ? Number(value) : NaN
const bool = value => value === true || value === 'true' ? true : value === false || value === 'false' ? false : null

export function parseAdminProduct(body = {}, { updating = false, fileCount = 0 } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw validationError({ body: 'Envie os campos do produto.' })
  const errors = {}
  const data = {
    name: text(body.name), description: text(body.description), color: text(body.color).toLowerCase(),
    is_printed: bool(body.is_printed), is_active: bool(body.is_active ?? true),
    price_cents: integer(body.price_cents),
    promo_price_cents: body.promo_price_cents == null || body.promo_price_cents === '' ? null : integer(body.promo_price_cents),
    weight_g: integer(body.weight_g), length_cm: integer(body.length_cm), width_cm: integer(body.width_cm), height_cm: integer(body.height_cm),
    version: integer(body.version), main_image: text(body.main_image),
  }
  if (!data.name || data.name.length > 255) errors.name = 'Informe um nome com até 255 caracteres.'
  if (data.description.length > 10000) errors.description = 'A descrição deve ter até 10000 caracteres.'
  if (body.description != null && typeof body.description !== 'string') errors.description = 'A descrição deve ser texto.'
  if (!data.color || data.color.length > 50) errors.color = 'Informe uma cor com até 50 caracteres.'
  if (data.is_printed === null) errors.is_printed = 'Informe se a peça é estampada.'
  if (data.is_active === null) errors.is_active = 'Informe o status ativo.'
  if (!Number.isInteger(data.price_cents) || data.price_cents < 1) errors.price_cents = 'Informe um preço positivo em centavos.'
  if (data.promo_price_cents !== null && (!Number.isInteger(data.promo_price_cents) || data.promo_price_cents < 1 || data.promo_price_cents >= data.price_cents)) errors.promo_price_cents = 'A promoção deve ser positiva e menor que o preço normal.'
  for (const key of ['weight_g', 'length_cm', 'width_cm', 'height_cm']) if (!Number.isInteger(data[key]) || data[key] < 1) errors[key] = 'Informe um inteiro positivo.'
  if (updating && (!Number.isInteger(data.version) || data.version < 1)) errors.version = 'Reabra a peça para obter sua versão atual.'
  function json(key, fallback) {
    try { return typeof body[key] === 'string' ? JSON.parse(body[key]) : body[key] ?? fallback }
    catch { errors[key] = 'Formato inválido.'; return fallback }
  }
  data.sizes = json('sizes', [])
  if (!Array.isArray(data.sizes) || !data.sizes.length || data.sizes.length > 4) {
    errors.sizes = 'Informe ao menos um tamanho entre P, M, G e GG.'
    data.sizes = []
  }
  const seen = new Set()
  data.sizes = data.sizes.map(entry => {
    const size = text(entry?.size), stock = integer(entry?.stock)
    const revision = entry?.expected_revision == null ? null : integer(entry.expected_revision)
    if (!['P', 'M', 'G', 'GG'].includes(size) || seen.has(size) || !Number.isInteger(stock) || stock < 0 || (revision !== null && (!Number.isInteger(revision) || revision < 1))) errors.sizes = 'Use tamanhos únicos P/M/G/GG e estoques inteiros não negativos.'
    seen.add(size)
    return { size, stock, expected_revision: revision }
  })
  data.retained_images = json('retained_images', [])
  if (!Array.isArray(data.retained_images) || data.retained_images.some(id => typeof id !== 'string' || !UUID.test(id)) || new Set(data.retained_images).size !== data.retained_images.length) {
    errors.retained_images = 'Selecione imagens existentes desta peça.'
    data.retained_images = []
  }
  if (!updating && data.retained_images.length) errors.retained_images = 'Uma nova peça só pode receber novos arquivos.'
  if (data.retained_images.length + fileCount > 5) errors.images = 'Cada peça pode ter até cinco imagens.'
  if (data.main_image && !data.retained_images.includes(data.main_image) && !Array.from({ length: fileCount }, (_, i) => `new:${i}`).includes(data.main_image)) errors.main_image = 'Escolha uma imagem principal presente na galeria.'
  if (Object.keys(errors).length) throw validationError(errors)
  return data
}
