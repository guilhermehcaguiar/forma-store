import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { HttpError, badRequest } from '../../utils/httpError.js'
import { toCentavos } from '../../utils/money.js'
import { isConfiguredCredential } from '../../utils/credentials.js'

const TOKEN_FILE = join(dirname(fileURLToPath(import.meta.url)), '../../../.local/melhor-envio-tokens.json')
const SANDBOX_URL = 'https://sandbox.melhorenvio.com.br'
let currentTokens = null
let refreshInFlight = null

function userAgent() {
  return process.env.MELHOR_ENVIO_USER_AGENT ?? 'FORMA (suporte@forma.local)'
}

function normalizeCep(value) {
  return String(value ?? '').replace(/\D/g, '')
}

export function cartFingerprint(items) {
  const snapshot = items.map((item) => ({
    productId: item.productId,
    size: item.size,
    quantity: item.quantity,
    priceCentavos: item.priceCentavos,
    weightG: item.weightG,
    lengthCm: item.lengthCm,
    widthCm: item.widthCm,
    heightCm: item.heightCm,
  }))
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
}

export function addressFingerprint(address) {
  const snapshot = {
    recipient: address.recipient,
    street: address.street,
    number: address.number,
    complement: address.complement,
    district: address.district,
    city: address.city,
    state: address.state,
    cep: address.cep,
  }
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
}

export function buildQuotePayload(originCep, destinationCep, items) {
  const from = normalizeCep(originCep)
  const to = normalizeCep(destinationCep)
  if (!/^\d{8}$/.test(from)) throw new HttpError(503, 'frete_origem_invalida', 'Configure um CEP de origem válido no servidor.')
  if (!/^\d{8}$/.test(to)) throw badRequest('cep_invalido', 'O CEP do endereço de entrega deve conter 8 dígitos.')

  const products = items.map((item) => {
    for (const value of [item.weightG, item.lengthCm, item.widthCm, item.heightCm]) {
      if (!Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
        throw badRequest('produto_sem_dimensoes', `O produto ${item.name} não tem peso e dimensões válidos para cotação.`)
      }
    }
    return {
      id: item.productId,
      width: Number(item.widthCm),
      height: Number(item.heightCm),
      length: Number(item.lengthCm),
      weight: Number(item.weightG) / 1000,
      insurance_value: Number((item.priceCentavos / 100).toFixed(2)),
      quantity: item.quantity,
    }
  })

  return { from: { postal_code: from }, to: { postal_code: to }, products, options: { receipt: false, own_hand: false } }
}

export function mapProviderServices(response) {
  if (!Array.isArray(response)) throw new HttpError(502, 'resposta_frete_invalida', 'O Melhor Envio retornou uma resposta de cotação inválida.')
  return response
    .filter((service) => service.id != null && !service.error && (service.custom_price ?? service.price) != null)
    .map((service) => {
      let priceCentavos
      try {
        priceCentavos = toCentavos(String(service.custom_price ?? service.price), 'frete')
      } catch {
        return null
      }
      const deliveryDays = Number(service.custom_delivery_time ?? service.delivery_time)
      return {
        id: String(service.id),
        name: String(service.name ?? ''),
        company: String(service.company?.name ?? ''),
        priceCentavos,
        deliveryDays: Number.isInteger(deliveryDays) && deliveryDays > 0 ? deliveryDays : null,
      }
    })
    .filter((service) => service && service.id && service.name)
}

async function readTokenFile() {
  if (currentTokens?.accessToken) return currentTokens
  try {
    currentTokens = JSON.parse(await readFile(TOKEN_FILE, 'utf8'))
    return currentTokens
  } catch (error) {
    if (error.code !== 'ENOENT') throw new HttpError(503, 'credencial_frete_indisponivel', 'Não foi possível ler as credenciais locais do Melhor Envio.')
  }
  const configuredTokens = {
    accessToken: isConfiguredCredential(process.env.MELHOR_ENVIO_ACCESS_TOKEN) ? process.env.MELHOR_ENVIO_ACCESS_TOKEN : '',
    refreshToken: isConfiguredCredential(process.env.MELHOR_ENVIO_REFRESH_TOKEN) ? process.env.MELHOR_ENVIO_REFRESH_TOKEN : '',
  }
  if (configuredTokens.accessToken || configuredTokens.refreshToken) currentTokens = configuredTokens
  return configuredTokens
}

async function persistTokens(tokens) {
  const directory = dirname(TOKEN_FILE)
  await mkdir(directory, { recursive: true })
  const temporary = `${TOKEN_FILE}.${process.pid}.tmp`
  await writeFile(temporary, JSON.stringify(tokens), { encoding: 'utf8', mode: 0o600 })
  await rename(temporary, TOKEN_FILE)
  currentTokens = tokens
}

async function refreshAccessToken(fetchImpl) {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const tokens = await readTokenFile()
      const clientId = process.env.MELHOR_ENVIO_CLIENT_ID
      const clientSecret = process.env.MELHOR_ENVIO_CLIENT_SECRET
      const redirectUri = process.env.MELHOR_ENVIO_REDIRECT_URI
      if (!tokens.refreshToken || !isConfiguredCredential(clientId) || !isConfiguredCredential(clientSecret) || !redirectUri) {
        throw new HttpError(503, 'credencial_frete_expirada', 'Configure client ID, secret e refresh token do sandbox no servidor.')
      }

      let response
      try {
        const body = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokens.refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        })
        response = await fetchImpl(`${SANDBOX_URL}/oauth/token`, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': userAgent() },
          body,
          signal: AbortSignal.timeout(10000),
        })
      } catch {
        throw new HttpError(503, 'melhor_envio_indisponivel', 'Não foi possível renovar a autorização do Melhor Envio.')
      }

      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.access_token || !result?.refresh_token) {
        throw new HttpError(503, 'credencial_frete_expirada', 'A autorização do Melhor Envio expirou. Refaça a autorização do aplicativo sandbox.')
      }
      await persistTokens({ accessToken: result.access_token, refreshToken: result.refresh_token })
      return currentTokens.accessToken
    })().finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
}

export async function requestProviderQuote(payload, fetchImpl = fetch) {
  const tokens = await readTokenFile()
  if (!tokens.accessToken) throw new HttpError(503, 'frete_nao_configurado', 'Configure as credenciais do Melhor Envio sandbox no servidor.')

  let response
  try {
    response = await fetchImpl(`${SANDBOX_URL}/api/v2/me/shipment/calculate`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.accessToken}`,
        'User-Agent': userAgent(),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    throw new HttpError(503, 'melhor_envio_indisponivel', 'O serviço de cotação do Melhor Envio está indisponível. Tente novamente.')
  }

  if (response.status === 401) {
    await refreshAccessToken(fetchImpl)
    return retryQuote(payload, fetchImpl)
  }

  const data = await response.json().catch(() => null)
  if (response.status === 422) {
    throw badRequest('cotacao_recusada', 'O Melhor Envio não aceitou os CEPs ou os dados dos produtos para cotação.')
  }
  if (!response.ok) {
    throw new HttpError(503, 'melhor_envio_indisponivel', 'O Melhor Envio não conseguiu concluir a cotação. Tente novamente.')
  }
  return data
}

async function retryQuote(payload, fetchImpl) {
  const tokens = await readTokenFile()
  try {
    const response = await fetchImpl(`${SANDBOX_URL}/api/v2/me/shipment/calculate`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.accessToken}`,
        'User-Agent': userAgent(),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    })
    const data = await response.json().catch(() => null)
    if (response.status === 422) throw badRequest('cotacao_recusada', 'O Melhor Envio não aceitou os CEPs ou os dados dos produtos para cotação.')
    if (!response.ok) throw new HttpError(503, 'melhor_envio_indisponivel', 'O Melhor Envio não conseguiu concluir a cotação. Tente novamente.')
    return data
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(503, 'melhor_envio_indisponivel', 'O serviço de cotação do Melhor Envio está indisponível. Tente novamente.')
  }
}
