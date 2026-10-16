import test from 'node:test'
import assert from 'node:assert/strict'
import { reaisToCentavos } from '../src/services/adminProducts.js'
import { apiFetch } from '../src/services/api.js'

test('formulário converte reais sem truncar casas ou aceitar preço inválido', () => {
  assert.equal(reaisToCentavos('119,90'), 11990)
  assert.equal(reaisToCentavos('0.01'), 1)
  assert.equal(reaisToCentavos('99'), 9900)
  for (const value of ['', '-1', '1.005', 'R$ 10,00', '1.000,00', 'abc', '21474836.48']) assert.throws(() => reaisToCentavos(value))
})
test('FormData preserva arquivo e deixa o browser criar boundary, mantendo autenticação', async () => {
  const previousFetch = globalThis.fetch, previousWindow = globalThis.window
  try {
    globalThis.window = { localStorage: { getItem: () => 'token-ficticio' } }
    const form = new FormData(); form.append('name', 'Teste')
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.body, form)
      assert.equal(options.headers.Authorization, 'Bearer token-ficticio')
      assert.equal(Object.keys(options.headers).some(key => key.toLowerCase() === 'content-type'), false)
      return Response.json({ ok: true })
    }
    await apiFetch('/admin/produtos', { method: 'POST', body: form, headers: { 'Content-Type': 'multipart/form-data' } })
  } finally { globalThis.fetch = previousFetch; globalThis.window = previousWindow }
})
