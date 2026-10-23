import { assertLocalDatabaseUrl } from '../../db/local-database.js'

export const DEMO_NOTICE = 'DEMONSTRAÇÃO — sem cobrança ou envio real'
export const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1'])

// Sem fallback implícito: NODE_ENV precisa ser declarado para habilitar a demo.
// Validação ocorre antes de abrir banco/socket e novamente nas operações demo.
export function resolveDemoConfig(env = process.env) {
  if (!env.FORMA_DEMO_MODE || env.FORMA_DEMO_MODE === 'false') return false
  if (env.FORMA_DEMO_MODE !== 'true' || !['development', 'test'].includes(env.NODE_ENV) ||
      !LOOPBACK_HOSTS.has(env.FORMA_API_HOST ?? '127.0.0.1')) {
    throw new Error('Demonstração exige FORMA_DEMO_MODE=true, development/test e API em loopback; produção é recusada.')
  }
  assertLocalDatabaseUrl(env.DATABASE_URL, { environment: env })
  resolveDemoPaymentProvider(env)
  const mode = env.FORMA_EMAIL_MODE ?? 'mock'
  if (mode !== 'mock' && (mode !== 'smtp' || !LOOPBACK_HOSTS.has(env.FORMA_SMTP_HOST))) {
    throw new Error('Demonstração permite somente e-mail mock ou SMTP em IP de loopback.')
  }
  return true
}

export function resolveDemoPaymentProvider(env = process.env) {
  const provider = env.FORMA_DEMO_PAYMENT_PROVIDER ?? 'forma_demo'
  if (!['forma_demo', 'mercadopago'].includes(provider)) {
    throw new Error('FORMA_DEMO_PAYMENT_PROVIDER deve ser forma_demo ou mercadopago.')
  }
  if (provider === 'mercadopago' && env.MERCADOPAGO_MODE !== 'sandbox') {
    throw new Error('Mercado Pago na demonstração exige MERCADOPAGO_MODE=sandbox.')
  }
  return provider
}
