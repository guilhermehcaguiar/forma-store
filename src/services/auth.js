// Autenticação do FORMA via API local (server/).
//
// A partir desta etapa o cadastro, o login e a sessão vivem no servidor:
// senhas são verificadas lá com scrypt e a sessão é um token opaco guardado
// em `forma:apiToken`. Nenhuma credencial ou privilégio é lido/gravado no
// navegador além do token — os dados antigos de demonstração (`forma:users`,
// `forma:session`, `forma:account:*`) permanecem no navegador, intocados, mas
// não são mais usados nem migrados como dados confiáveis.
//
// Contratos em docs/forma/API_CONTRATOS.md. Erros chegam como `ApiError`
// (status, code, fields) e as telas continuam exibindo `error.message`.

import { api, ApiError, clearToken, getToken, setToken } from './api.js'

export { ApiError }

// Cria a conta (RF01) e já inicia a sessão. O papel é sempre decidido pelo
// servidor ("cliente"); o campo `role` do corpo é ignorado pela API.
export async function registerUser({ name, email, password, promo = false }) {
  const data = await api.post('/auth/registrar', { name, email, password, promo })
  setToken(data.token)
  return data.user
}

// Autentica credenciais (RF03) e guarda o token da sessão.
export async function loginUser({ email, password }) {
  const data = await api.post('/auth/entrar', { email, password })
  setToken(data.token)
  return data.user
}

// Encerra a sessão no servidor (RF03). Mesmo sem rede ou com sessão já
// inválida, o token local é removido: sair nunca deixa a tela travada.
export async function logoutUser() {
  try {
    await api.post('/auth/sair')
  } catch {
    // Falha de rede ou sessão já encerrada; o lado local é limpo abaixo.
  }
  clearToken()
}

// Valida a sessão atual no servidor (RF04). Sem token ou com sessão
// expirada/revogada devolve null (e limpa o token inválido). Erros de rede
// propagam para quem chamou decidir (a API pode estar desligada).
export async function fetchCurrentUser() {
  if (!getToken()) return null

  try {
    const data = await api.get('/auth/eu')
    return data.user
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearToken()
      return null
    }
    throw error
  }
}

// Edita nome e preferência promocional (RF02, RF04) na conta do servidor.
export async function updateUserProfile(data) {
  const result = await api.patch('/auth/eu', data)
  return result.user
}
