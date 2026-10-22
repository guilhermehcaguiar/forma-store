import './carregar-env.js'
import { isConfiguredCredential } from '../utils/credentials.js'
import { randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdir, rename, writeFile } from 'node:fs/promises'

const baseUrl = 'https://sandbox.melhorenvio.com.br'
const clientId = process.env.MELHOR_ENVIO_CLIENT_ID
const clientSecret = process.env.MELHOR_ENVIO_CLIENT_SECRET
const redirectUri = process.env.MELHOR_ENVIO_REDIRECT_URI

if (!isConfiguredCredential(clientId) || !isConfiguredCredential(clientSecret) || !redirectUri) {
  console.error('[forma-api] Configure MELHOR_ENVIO_CLIENT_ID, MELHOR_ENVIO_CLIENT_SECRET e MELHOR_ENVIO_REDIRECT_URI em server/.env.')
  process.exit(1)
}

const state = randomBytes(24).toString('hex')
const authorizeUrl = new URL('/oauth/authorize', baseUrl)
authorizeUrl.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: 'code',
  scope: 'shipping-calculate',
  state,
}).toString()

const prompt = createInterface({ input: stdin, output: stdout })
try {
  console.log('Abra esta URL, autorize o aplicativo e cole a URL completa para a qual o navegador retornou:')
  console.log(authorizeUrl.toString())
  const callbackUrl = await prompt.question('URL de retorno: ')
  const callback = new URL(callbackUrl)
  const code = callback.searchParams.get('code')
  if (!code || callback.searchParams.get('state') !== state || callback.origin + callback.pathname !== redirectUri) {
    throw new Error('Retorno OAuth inválido: confira callback e state.')
  }

  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': process.env.MELHOR_ENVIO_USER_AGENT ?? 'FORMA (suporte@forma.local)',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
    signal: AbortSignal.timeout(15000),
  })
  const tokens = await response.json().catch(() => null)
  if (!response.ok || !tokens?.access_token || !tokens?.refresh_token) {
    throw new Error('O Melhor Envio não autorizou o aplicativo. Confira sandbox, callback e credenciais.')
  }

  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const tokenPath = join(scriptDir, '../../.local/melhor-envio-tokens.json')
  await mkdir(dirname(tokenPath), { recursive: true })
  const temporaryPath = `${tokenPath}.${process.pid}.tmp`
  await writeFile(temporaryPath, JSON.stringify({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token }), { encoding: 'utf8', mode: 0o600 })
  await rename(temporaryPath, tokenPath)
  console.log('Autorização sandbox salva em server/.local, fora do Git. Nenhum token foi exibido.')
} catch {
  console.error('[forma-api] Autorização sandbox não concluída. Confira callback, credenciais e conexão; detalhes privados omitidos.')
  process.exitCode = 1
} finally {
  prompt.close()
}
