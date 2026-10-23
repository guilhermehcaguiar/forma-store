import './scripts/carregar-env.js'
import { resolveDemoConfig, resolveDemoPaymentProvider } from './modules/demo/demo.config.js'

// Configuração central da API. Falha cedo com mensagem clara quando faltar
// alguma variável essencial, em vez de quebrar de forma silenciosa mais tarde.
const databaseUrl = process.env.DATABASE_URL
const demo = resolveDemoConfig()

if (!databaseUrl) {
  console.error(
    '[forma-api] DATABASE_URL não definida. Execute npm run api:setup na raiz para preparar o PostgreSQL local, ou configure server/.env com seu banco existente.',
  )
  process.exit(1)
}

export const config = {
  demo,
  paymentProvider: demo ? resolveDemoPaymentProvider() : 'mercadopago',
  host: process.env.FORMA_API_HOST ?? '127.0.0.1',
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3333),
  databaseUrl,
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 7),
}
