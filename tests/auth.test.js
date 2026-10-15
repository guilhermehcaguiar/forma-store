import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { registerUser, loginUser, logoutUser, fetchCurrentUser, updateUserProfile, ApiError } from '../src/services/auth.js'
import { validateRegister, validateLogin } from '../src/utils/validation.js'

// Os serviços de autenticação falam com a API local; aqui o `fetch` global é
// simulado para verificar contrato, token e mensagens sem servidor nem banco.

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

// Resposta simulada; o handler registra a requisição em `calls`.
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

const apiError = (status, code, message) => respond(status, { error: { code, message } })

const account = { name: 'Aluno Teste', email: 'ALUNO@example.com', password: 'teste123' }
const publicUser = { id: 'u-1', name: 'Aluno Teste', email: 'aluno@example.com', promo: false, role: 'cliente', createdAt: '2026-10-15T00:00:00.000Z' }

function lastCall() {
  return calls[calls.length - 1]
}

test('cadastro via API inicia sessão, guarda só o token e não vaza a senha', async () => {
  stubFetch(request => {
    assert.equal(request.url.pathname, '/api/auth/registrar')
    return respond(201, { token: 'token-registro', expiresAt: '2026-10-22T00:00:00.000Z', user: publicUser })
  })

  const user = await registerUser(account)
  assert.equal(user.role, 'cliente', 'toda conta nova nasce cliente')
  assert.equal(user.promo, false)
  assert.equal(user.password, undefined)
  assert.equal(lastCall().options.body.includes('"promo":false'), true, 'consentimento promocional desmarcado por padrão')
  assert.equal(storage.get('forma:apiToken'), 'token-registro')
  for (const value of storage.values()) {
    assert.equal(value.includes(account.password), false)
  }
})

test('sessão é validada no servidor; 401 limpa o token e devolve visitante', async () => {
  storage.set('forma:apiToken', 'token-valido')
  stubFetch(request => {
    assert.equal(request.url.pathname, '/api/auth/eu')
    assert.equal(request.options.headers.Authorization, 'Bearer token-valido')
    return respond(200, { user: publicUser })
  })

  const user = await fetchCurrentUser()
  assert.equal(user.id, publicUser.id)

  stubFetch(() => apiError(401, 'sessao_invalida', 'Sessão inválida ou expirada. Entre novamente.'))
  assert.equal(await fetchCurrentUser(), null)
  assert.equal(storage.has('forma:apiToken'), false)

  storage.delete('forma:apiToken')
  globalThis.fetch = () => assert.fail('não deve chamar a API sem token')
  assert.equal(await fetchCurrentUser(), null)
})

test('login guarda o token e credenciais erradas viram erro tratável', async () => {
  stubFetch(request => {
    assert.equal(request.url.pathname, '/api/auth/entrar')
    return respond(200, { token: 'token-login', expiresAt: '2026-10-22T00:00:00.000Z', user: publicUser })
  })

  const user = await loginUser(account)
  assert.equal(user.email, publicUser.email)
  assert.equal(storage.get('forma:apiToken'), 'token-login')

  stubFetch(() => apiError(401, 'credenciais_invalidas', 'E-mail ou senha inválidos.'))
  const error = await loginUser({ ...account, password: 'errada' }).then(() => null, caught => caught)
  assert.ok(error instanceof ApiError)
  assert.equal(error.status, 401)
  assert.equal(error.code, 'credenciais_invalidas')
  assert.equal(error.message, 'E-mail ou senha inválidos.')
  assert.equal(storage.get('forma:apiToken'), 'token-login', 'token anterior permanece')
})

test('e-mail duplicado e API desligada produzem erros com código estável', async () => {
  stubFetch(() => apiError(409, 'email_ja_cadastrado', 'Este e-mail já está cadastrado.'))
  const duplicated = await registerUser(account).then(() => null, caught => caught)
  assert.ok(duplicated instanceof ApiError)
  assert.equal(duplicated.status, 409)
  assert.equal(duplicated.code, 'email_ja_cadastrado')

  globalThis.fetch = async () => {
    throw new TypeError('fetch failed')
  }
  const offline = await loginUser(account).then(() => null, caught => caught)
  assert.ok(offline instanceof ApiError)
  assert.equal(offline.status, 0)
  assert.equal(offline.code, 'rede_indisponivel')
})

test('logout encerra no servidor e limpa o token mesmo sem rede', async () => {
  storage.set('forma:apiToken', 'token-sair')
  stubFetch(request => {
    assert.equal(request.url.pathname, '/api/auth/sair')
    assert.equal(request.options.headers.Authorization, 'Bearer token-sair')
    return respond(204)
  })

  await logoutUser()
  assert.equal(storage.has('forma:apiToken'), false)

  storage.set('forma:apiToken', 'token-sair')
  globalThis.fetch = async () => {
    throw new TypeError('fetch failed')
  }
  await logoutUser()
  assert.equal(storage.has('forma:apiToken'), false, 'sair funciona mesmo com a API fora')
})

test('perfil é atualizado no servidor com PATCH autenticado', async () => {
  storage.set('forma:apiToken', 'token-perfil')
  const updated = { ...publicUser, name: 'Novo Nome', promo: true }
  stubFetch(request => {
    assert.equal(request.url.pathname, '/api/auth/eu')
    assert.equal(request.options.headers.Authorization, 'Bearer token-perfil')
    assert.deepEqual(JSON.parse(request.options.body), { name: 'Novo Nome', promo: true })
    return respond(200, { user: updated })
  })

  const user = await updateUserProfile({ name: 'Novo Nome', promo: true })
  assert.equal(user.name, 'Novo Nome')
})

test('validação de campos, e-mail e confirmação de senha continua no cliente', () => {
  const errors = validateRegister({ name: '', email: 'errado', password: '123', confirmPassword: '456' })
  assert.deepEqual(Object.keys(errors), ['name', 'email', 'password', 'confirmPassword'])
  assert.deepEqual(validateLogin({ email: '', password: '' }), { email: 'Informe o e-mail.', password: 'Informe a senha.' })
})
