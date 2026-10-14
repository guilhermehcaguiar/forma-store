import express from 'express'
import { cors } from './middleware/cors.js'
import { errorHandler, notFoundHandler } from './middleware/errors.js'
import { healthRouter } from './modules/health/health.routes.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { contaRouter } from './modules/conta/conta.routes.js'

// Fábrica da aplicação Express, separada da escuta (index.js) para facilitar testes.
export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(cors)
  app.use(express.json({ limit: '100kb' }))

  app.use('/api/health', healthRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/conta', contaRouter)

  // Qualquer rota não mapeada e todos os erros caem nos handlers padronizados.
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
