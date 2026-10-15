import test from 'node:test'
import assert from 'node:assert/strict'
import { requireRole } from '../src/middleware/authorize.js'
import { HttpError } from '../src/utils/httpError.js'

// Autorização por papel (RNF08): reutilizável em qualquer rota /admin/*.
// O requireAuth roda antes e preenche req.user; aqui testamos só o papel.

function run(middleware, user) {
  return new Promise((resolve, reject) => {
    const req = { user }
    middleware(req, {}, (error) => (error ? reject(error) : resolve(req)))
  })
}

test('cliente autenticado é bloqueado (403 acesso_negado) em rotas de administrador', async () => {
  const middleware = requireRole('administrador')

  const error = await run(middleware, { id: 'u1', role: 'cliente' }).then(
    () => null,
    (caught) => caught,
  )

  assert.ok(error instanceof HttpError)
  assert.equal(error.status, 403)
  assert.equal(error.code, 'acesso_negado')
})

test('administrador passa e mais de um papel pode ser aceito', async () => {
  const adminOnly = requireRole('administrador')
  const req = await run(adminOnly, { id: 'u2', role: 'administrador' })
  assert.equal(req.user.id, 'u2')

  const flexible = requireRole('cliente', 'administrador')
  await run(flexible, { id: 'u3', role: 'cliente' })
  await run(flexible, { id: 'u4', role: 'administrador' })
})

test('sem usuário autenticado o erro é de sessão (401), não de permissão', async () => {
  const middleware = requireRole('administrador')

  const error = await run(middleware, undefined).then(
    () => null,
    (caught) => caught,
  )

  assert.ok(error instanceof HttpError)
  assert.equal(error.status, 401)
  assert.equal(error.code, 'sessao_ausente')
})
