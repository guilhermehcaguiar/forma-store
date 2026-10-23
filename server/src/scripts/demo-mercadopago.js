// Opção explícita: frete demo local e pagamento Mercado Pago de teste.
if (process.env.NODE_ENV === 'production') {
  throw new Error('Demonstração Mercado Pago recusada em produção.')
}
Object.assign(process.env, {
  NODE_ENV: 'development', FORMA_API_HOST: '127.0.0.1', FORMA_DEMO_MODE: 'true',
  FORMA_DEMO_PAYMENT_PROVIDER: 'mercadopago', MERCADOPAGO_MODE: 'sandbox',
  FORMA_EMAIL_MODE: 'mock', CORS_ORIGIN: 'http://localhost:5173',
})
await import('../index.js')
