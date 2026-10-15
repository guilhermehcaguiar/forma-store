// Cliente HTTP reutilizável da API local do FORMA.
//
// Uso básico:
//   import { api, ApiError, setToken, clearToken } from '../services/api'
//   const { token, user } = await api.post('/auth/registrar', { name, email, password, promo })
//   setToken(token)
//   const { addresses } = await api.get('/conta/enderecos')
//
// O cliente anexa automaticamente o token salvo no `localStorage` (chave
// `forma:apiToken`), converte erros da API em `ApiError` (com `status`, `code`
// e `fields`) e converte respostas 204 em `null`. O contrato completo está em
// docs/forma/API_CONTRATOS.md.

const BASE_URL = import.meta.env?.VITE_API_URL ?? 'http://localhost:3333/api'
const TOKEN_KEY = 'forma:apiToken'

// Erro padronizado para falhas de requisição. `status` 0 significa que a API
// não foi alcançada (servidor desligado, rede local indisponível etc.).
export class ApiError extends Error {
  constructor(status, code, message, fields, cause) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields ?? null
    this.cause = cause
  }
}

export function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_KEY, token)
    } else {
      window.localStorage.removeItem(TOKEN_KEY)
    }
    return true
  } catch {
    return false
  }
}

export function clearToken() {
  return setToken(null)
}

export async function apiFetch(path, { method = 'GET', body, signal } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (cause) {
    if (cause?.name === 'AbortError') throw cause
    throw new ApiError(
      0,
      'rede_indisponivel',
      'Não foi possível conectar à API. Verifique se ela está em execução (npm run api).',
      null,
      cause,
    )
  }

  if (response.status === 204) return null

  let data = null
  try {
    data = await response.json()
  } catch {
    // Resposta sem corpo JSON; tratada abaixo conforme o status.
  }

  if (!response.ok) {
    const erro = data?.error ?? {}
    throw new ApiError(
      response.status,
      erro.code ?? 'erro_desconhecido',
      erro.message ?? `A requisição falhou (HTTP ${response.status}).`,
      erro.fields,
    )
  }

  return data
}

export const api = {
  get: (path, options) => apiFetch(path, { ...options, method: 'GET' }),
  post: (path, body, options) => apiFetch(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => apiFetch(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => apiFetch(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => apiFetch(path, { ...options, method: 'DELETE' }),
}

export default api;