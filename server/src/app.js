import express from 'express'
import { cors } from './middleware/cors.js'
import { errorHandler, notFoundHandler } from './middleware/errors.js'
import { healthRouter } from './modules/health/health.routes.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { contaRouter } from './modules/conta/conta.routes.js'
import { adminRouter } from './modules/admin/admin.routes.js'
import { cartRouter } from './modules/cart/cart.routes.js'
import { shippingRouter } from './modules/shipping/shipping.routes.js'
import { checkoutRouter } from './modules/checkout/checkout.routes.js'
import productRouter from './routes/productRoutes.js'
import { pedidosRouter } from './modules/conta/pedidos.routes.js'

// Fábrica da aplicação Express, separada da escuta (index.js) para facilitar testes.
export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(cors)
  app.use(express.json({ limit: '100kb' }))

  app.use('/api/health', healthRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/conta', contaRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api/cart', cartRouter)
  app.use('/api/produtos', productRouter)
  app.use('/api/frete', shippingRouter)
  app.use('/api/checkout', checkoutRouter)
  app.use('/api/conta/pedidos', pedidosRouter)

  // Qualquer rota não mapeada e todos os erros caem nos handlers padronizados.
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
