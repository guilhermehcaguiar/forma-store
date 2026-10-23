import { createApp } from './app.js'
import { config } from './config.js'
import { pool } from './db/pool.js'
import { runOrderExpirySweep } from './modules/payments/payments.service.js'
import { describeEmailMode, runEmailOutboxSweep } from './modules/notifications/email.service.js'
import { DEMO_NOTICE } from './modules/demo/demo.config.js'

// Valida o peer e a identidade do PostgreSQL antes de abrir a API demonstrativa.
if (config.demo) {
  await pool.query('SELECT 1')
  console.log(`[forma-api] ${DEMO_NOTICE}`)
}
const app = createApp()
const server = app.listen(config.port, config.host, () => {
  console.log(`[forma-api] ouvindo em http://localhost:${config.port} (ambiente: ${config.env})`)
  console.log('[forma-api] saúde do serviço: http://localhost:%d/api/health', config.port)
})

// Deixa explícito na inicialização se os e-mails são entregues de verdade ou
// apenas prévias locais, e falha com mensagem clara quando a configuração de
// e-mail for inválida (sem interromper a API).
try {
  console.log(describeEmailMode())
} catch {
  console.error('[forma-api] configuração de e-mail inválida — nenhum e-mail será processado. Confira as variáveis FORMA_EMAIL/SMTP no servidor.')
}

const reservationSweep = setInterval(() => {
  runOrderExpirySweep().catch(() => {
    console.error('[forma-api] não foi possível liberar reservas expiradas:')
  })
  runEmailOutboxSweep().catch(() => {
    console.error('[forma-api] não foi possível processar o outbox de e-mail:')
  })
}, 60_000)
reservationSweep.unref()
runOrderExpirySweep().catch(() => {
  console.error('[forma-api] não foi possível limpar reservas expiradas na inicialização:')
})
runEmailOutboxSweep().catch(() => {
  console.error('[forma-api] não foi possível inicializar o outbox de e-mail:')
})

// Encerramento gentil: para aceitar conexões e fecha o pool do PostgreSQL.
async function shutdown(signal) {
  console.log(`[forma-api] encerrando (${signal})...`)
  clearInterval(reservationSweep)
  server.close()
  await pool.end()
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
