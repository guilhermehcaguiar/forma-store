import { createApp } from './app.js'
import { config } from './config.js'
import { pool } from './db/pool.js'
import { runOrderExpirySweep } from './modules/payments/payments.service.js'

const app = createApp()
const server = app.listen(config.port, () => {
  console.log(`[forma-api] ouvindo em http://localhost:${config.port} (ambiente: ${config.env})`)
  console.log('[forma-api] saúde do serviço: http://localhost:%d/api/health', config.port)
})

const reservationSweep = setInterval(() => {
  runOrderExpirySweep().catch((error) => {
    console.error('[forma-api] não foi possível liberar reservas expiradas:', error.message)
  })
}, 60_000)
reservationSweep.unref()
runOrderExpirySweep().catch((error) => {
  console.error('[forma-api] não foi possível limpar reservas expiradas na inicialização:', error.message)
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
