import { createApp } from './app.js'
import { config } from './config.js'
import { pool } from './db/pool.js'

const app = createApp()
const server = app.listen(config.port, () => {
  console.log(`[forma-api] ouvindo em http://localhost:${config.port} (ambiente: ${config.env})`)
  console.log('[forma-api] saúde do serviço: http://localhost:%d/api/health', config.port)
})

// Encerramento gentil: para aceitar conexões e fecha o pool do PostgreSQL.
async function shutdown(signal) {
  console.log(`[forma-api] encerrando (${signal})...`)
  server.close()
  await pool.end()
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
