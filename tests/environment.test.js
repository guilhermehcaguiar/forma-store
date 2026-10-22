import test from 'node:test'
import assert from 'node:assert/strict'
import { validateFrontendEnv, isPrivateDevPath } from '../scripts/frontend-env.mjs'
import { isConfiguredCredential, mercadoPagoPublicKey, safeHttpUrl } from '../server/src/utils/credentials.js'

test('frontend aceita só URL pública; recusa prefixos privados e URL com credenciais', () => {
  assert.equal(validateFrontendEnv({}), 'http://localhost:3333/api')
  assert.equal(validateFrontendEnv({VITE_API_URL:'http://127.0.0.1:3333/api',DATABASE_URL:'valor-privado'}), 'http://127.0.0.1:3333/api')
  for (const key of ['VITE_SECRET','VITE_MERCADOPAGO_ACCESS_TOKEN','VITE_SMTP_PASS','VITE_SESSION_SECRET']) {
    assert.throws(()=>validateFrontendEnv({[key]:'CANARIO_PRIVADO'}), error=>!error.message.includes('CANARIO_PRIVADO'))
  }
  for (const value of ['postgres://local/db','http://user:CANARIO_PRIVADO@localhost/api','http://localhost/api?token=CANARIO_PRIVADO','http://localhost/#CANARIO_PRIVADO','invalida']) {
    assert.throws(()=>validateFrontendEnv({VITE_API_URL:value}),error=>!error.message.includes('CANARIO_PRIVADO'))
  }
})

test('exemplos não habilitam integrações e Access Token não vira Public Key', () => {
  for (const value of ['',undefined,'TEST-ACCESS-TOKEN-FICTICIO-TROQUE','placeholder','change-me']) assert.equal(isConfiguredCredential(value), false)
  assert.equal(mercadoPagoPublicKey('TEST-12345678-1234-1234-1234-123456789abc'), 'TEST-12345678-1234-1234-1234-123456789abc')
  assert.equal(mercadoPagoPublicKey('TEST-ACCESS-TOKEN-FICTICIO-TROQUE'), null)
})


test('fronteira Vite cobre arquivos privados, imports e caminhos codificados', () => {
  for (const path of ['/.env','/.env.production?raw','/server/.env?import','/@fs//project/.local/postgres-password','/%2elocal/password','/.aws/credentials','/.git/config','/secret.pem','/%ZZ']) assert.equal(isPrivateDevPath(path),true,path)
  for (const path of ['/src/App.jsx','/src/pages/admin/AdminProducts.jsx','/@vite/client','/products/demo-2.webp','/node_modules/.vite/deps/react.js']) assert.equal(isPrivateDevPath(path),false,path)
})


test('URLs de callback e retorno não transportam credenciais', () => {
  assert.ok(safeHttpUrl('http://localhost:5173'))
  assert.ok(safeHttpUrl('https://tunnel.example.test',{externalHttps:true}))
  assert.ok(safeHttpUrl('https://8.8.8.8',{externalHttps:true}))
  assert.ok(safeHttpUrl('https://[2001:4860:4860::8888]',{externalHttps:true}))
  for (const value of ['https://user:PRIVATE_MARKER@tunnel.example.test','https://tunnel.example.test?token=PRIVATE_MARKER','https://tunnel.example.test/#PRIVATE_MARKER','ftp://tunnel.example.test']) assert.equal(safeHttpUrl(value),null)
  for (const value of ['http://tunnel.example.test','https://localhost','https://127.0.0.1','https://forma.example.invalid','https://192.168.1.2','https://[::1]','https://loja.local','https://loja.localhost','https://[::ffff:127.0.0.1]','https://169.254.169.254','https://10.0.0.1','https://[fc00::1]']) assert.equal(safeHttpUrl(value,{externalHttps:true}),null)
})
