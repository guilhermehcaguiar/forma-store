import { config } from '../config.js'

// CORS mínimo e explícito: só a origem do front configurada em CORS_ORIGIN
// tem acesso, evitando dependência de pacotes extras.
export function cors(req, res, next) {
  const origin = req.headers.origin

  if (origin && origin === config.corsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Max-Age', '86400')
    return res.sendStatus(204)
  }

  next()
}
