import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/authorize.js'
import { getOverview, listUsers } from './admin.service.js'

// Área administrativa: exige sessão válida E papel "administrador" (RNF08).
// O par requireAuth + requireRole é a autorização reutilizável do back-end;
// toda rota futura de /admin/* deve usá-la, nunca confiar no front.
export const adminRouter = Router()

adminRouter.use(requireAuth, requireRole('administrador'))

// GET /api/admin/visao-geral — totais para o painel (RF22, prévia desta etapa).
adminRouter.get('/visao-geral', async (_req, res) => {
  const overview = await getOverview()
  res.json({ overview })
})

// GET /api/admin/usuarios — lista de contas cadastradas (uso do painel).
adminRouter.get('/usuarios', async (_req, res) => {
  const users = await listUsers()
  res.json({ users })
})
