import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { resolveDemoConfig, resolveDemoPaymentProvider } from '../src/modules/demo/demo.config.js'

const local = { FORMA_DEMO_MODE: 'true', NODE_ENV: 'test', DATABASE_URL: 'postgresql://forma@127.0.0.1:55435/forma_test' }

test('demo Mercado Pago é explícita e exige sandbox; produção continua recusada', () => {
  assert.equal(resolveDemoPaymentProvider({}), 'forma_demo')
  assert.equal(resolveDemoConfig({ ...local, FORMA_DEMO_PAYMENT_PROVIDER: 'mercadopago', MERCADOPAGO_MODE: 'sandbox' }), true)
  assert.throws(() => resolveDemoConfig({ ...local, FORMA_DEMO_PAYMENT_PROVIDER: 'mercadopago' }), /sandbox/)
  assert.throws(() => resolveDemoConfig({ ...local, FORMA_DEMO_PAYMENT_PROVIDER: 'mercadopago', MERCADOPAGO_MODE: 'production' }), /sandbox/)
  assert.throws(() => resolveDemoConfig({ ...local, FORMA_DEMO_PAYMENT_PROVIDER: 'outro' }), /PAYMENT_PROVIDER/)
  assert.throws(() => resolveDemoConfig({ ...local, NODE_ENV: 'production', FORMA_DEMO_PAYMENT_PROVIDER: 'mercadopago', MERCADOPAGO_MODE: 'sandbox' }), /produção/)
})

test('atalho de demonstração Mercado Pago recusa NODE_ENV=production antes de carregar configuração', () => {
  const result = spawnSync(process.execPath, ['server/src/scripts/demo-mercadopago.js'], {
    cwd: new URL('../../', import.meta.url), encoding: 'utf8', timeout: 15000,
    env: { ...process.env, NODE_ENV: 'production' },
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /recusada em produção/)
  assert.doesNotMatch(result.stdout, /ouvindo em/)
})

test('demo é explícita, local e recusa produção, banco remoto, overrides e SMTP externo', () => {
  assert.equal(resolveDemoConfig({}), false)
  assert.equal(resolveDemoConfig({ ...local, FORMA_DEMO_MODE: 'false', NODE_ENV: 'production' }), false)
  assert.equal(resolveDemoConfig(local), true)
  assert.equal(resolveDemoConfig({ ...local, FORMA_EMAIL_MODE: 'smtp', FORMA_SMTP_HOST: '127.0.0.1' }), true)
  for (const change of [
    { NODE_ENV: 'production' }, { NODE_ENV: undefined }, { FORMA_DEMO_MODE: 'yes' },
    { DATABASE_URL: 'postgresql://forma@remote.example.invalid/forma_test' },
    { DATABASE_URL: local.DATABASE_URL + '?host=remote.example.invalid' },
    { DATABASE_URL: local.DATABASE_URL + '#fragment' }, { PGHOST: 'remote.example.invalid' },
    { PGSERVICE: 'remote' }, { FORMA_API_HOST: '0.0.0.0' }, { FORMA_API_HOST: '192.0.2.1' },
    { FORMA_EMAIL_MODE: 'smtp', FORMA_SMTP_HOST: 'smtp.example.invalid' },
    { FORMA_EMAIL_MODE: 'smtp', FORMA_SMTP_HOST: 'localhost' }, { FORMA_EMAIL_MODE: 'invalid' },
  ]) assert.throws(() => resolveDemoConfig({ ...local, ...change }))
})

test('entrypoint recusa demo insegura antes de abrir servidor ou conectar ao banco', () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG[A-Z_]+$/.test(key)))
  for (const change of [
    { NODE_ENV: 'production' },
    { DATABASE_URL: 'postgresql://forma@remote.example.invalid/forma_test' },
    { DATABASE_URL: local.DATABASE_URL + '?host=remote.example.invalid' },
    { FORMA_API_HOST: '0.0.0.0' },
    { FORMA_EMAIL_MODE: 'smtp', FORMA_SMTP_HOST: 'smtp.example.invalid' },
  ]) {
    const result = spawnSync(process.execPath, ['server/src/index.js'], {
      cwd: new URL('../../', import.meta.url), encoding: 'utf8', timeout: 15000,
      env: { ...env, ...local, FORMA_API_HOST: '127.0.0.1', FORMA_EMAIL_MODE: 'mock', ...change },
    })
    assert.equal(result.error, undefined)
    assert.notEqual(result.status, 0)
    assert.doesNotMatch(result.stdout, /ouvindo em/)
    assert.match(result.stderr, /Demonstração|somente PostgreSQL/)
  }
})
