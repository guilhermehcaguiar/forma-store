// Uma allowlist explícita impede expor uma credencial por erro de prefixo VITE_.
export function validateFrontendEnv(env) {
  const forbidden = Object.keys(env).filter(key => key.startsWith('VITE_') && key !== 'VITE_API_URL')
  if (forbidden.length) throw new Error('Frontend aceita somente VITE_API_URL. Remova outras variáveis VITE_*; segredos pertencem ao servidor.')
  const value = env.VITE_API_URL ?? 'http://localhost:3333/api'
  let url
  try { url = new URL(value) } catch { throw new Error('VITE_API_URL deve ser uma URL HTTP(S) válida, sem credenciais.') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('VITE_API_URL deve ser uma URL HTTP(S) sem credenciais, query ou fragmento.')
  }
  return value
}

// Nega também imports de URL (?import), antes dos middlewares de transformação.
export function isPrivateDevPath(requestUrl = '') {
  let path
  try { path = decodeURIComponent(requestUrl.split('?')[0]).replaceAll('\\', '/') } catch { return true }
  return /(?:^|\/)(?:\.env(?:\.[^/]*)?|\.git|\.local|\.tmp|\.aws|\.ssh|\.codex|\.agents|server)(?:\/|$)/i.test(path) || /\.(?:pem|key|p12|pfx|crt)$/i.test(path)
}

export function privateFilesGuard() {
  return { name: 'forma-private-files', configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!isPrivateDevPath(req.url)) return next()
      res.statusCode = 403
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Arquivo privado indisponível.')
    })
  } }
}
