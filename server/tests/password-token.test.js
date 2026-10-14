import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hashPassword, verifyPassword } from '../src/utils/password.js'
import { createSessionToken, hashToken } from '../src/utils/token.js'

describe('password — hash com scrypt', () => {
  it('gera hash verificável e diferente do texto puro', async () => {
    const hash = await hashPassword('senhaFicticia123')
    assert.match(hash, /^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/)
    assert.ok(!hash.includes('senhaFicticia123'))
    assert.equal(await verifyPassword('senhaFicticia123', hash), true)
  })

  it('rejeita senha errada e hash corrompido', async () => {
    const hash = await hashPassword('senhaFicticia123')
    assert.equal(await verifyPassword('outraSenha', hash), false)
    assert.equal(await verifyPassword('senhaFicticia123', 'md5:abc'), false)
    assert.equal(await verifyPassword('senhaFicticia123', ''), false)
  })

  it('gera salt diferente a cada hash', async () => {
    const hashA = await hashPassword('mesmaSenha')
    const hashB = await hashPassword('mesmaSenha')
    assert.notEqual(hashA, hashB)
  })
})

describe('token — sessão opaca', () => {
  it('token e hash são determinísticos entre si', () => {
    const { token, tokenHash } = createSessionToken()
    assert.match(token, /^[A-Za-z0-9_-]{43}$/) // 32 bytes em base64url
    assert.equal(tokenHash, hashToken(token))
    assert.notEqual(token, tokenHash) // o banco guarda só o hash
  })

  it('tokens distintos produzem hashes distintos', () => {
    const a = createSessionToken()
    const b = createSessionToken()
    assert.notEqual(a.token, b.token)
    assert.notEqual(a.tokenHash, b.tokenHash)
  })
})
