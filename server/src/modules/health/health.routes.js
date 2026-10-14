import { Router } from 'express'
import { checkConnection } from '../../db/pool.js'

export const healthRouter = Router()

// GET /api/health — confirma que o processo responde e verifica o PostgreSQL.
// 200 com status "ok" quando tudo está bem; 503 com o motivo quando o banco
// não está acessível (útil para conferir a instalação local).
healthRouter.get('/', async (_req, res) => {
  const timestamp = new Date().toISOString()

  try {
    await checkConnection()
    res.json({ status: 'ok', database: { status: 'ok' }, timestamp })
  } catch (error) {
    res.status(503).json({
      status: 'degradado',
      database: { status: 'indisponivel', motivo: error.code ?? error.message },
      timestamp,
    })
  }
})
