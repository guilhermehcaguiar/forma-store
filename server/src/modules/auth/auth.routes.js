import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { parseLogin, parseProfile, parseRegister, parseEmailChange, parsePasswordChange } from './auth.schemas.js'
import {
  createSession,
  loginWithSession,
  changeCredentials,
  logoutSession,
  registerUser,
  updateUser,
} from './auth.service.js'

export const authRouter = Router()

// POST /api/auth/registrar — cria a conta (RF01) e já inicia a sessão.
authRouter.post('/registrar', async (req, res) => {
  const data = parseRegister(req.body)
  const user = await registerUser(data)
  const session = await createSession(user.id)
  res.status(201).json({ token: session.token, expiresAt: session.expiresAt, user })
})

// POST /api/auth/entrar — autentica credenciais (RF03) e inicia a sessão.
authRouter.post('/entrar', async (req, res) => {
  const data = parseLogin(req.body)
  res.json(await loginWithSession(data))
})

// POST /api/auth/sair — encerra a sessão atual (RF03).
authRouter.post('/sair', requireAuth, async (req, res) => {
  await logoutSession(req.tokenHash)
  res.status(204).send()
})

// GET /api/auth/eu — dados do usuário autenticado (RF04).
authRouter.get('/eu', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

// PATCH /api/auth/eu — edita nome e preferência promocional (RF02, RF04).
authRouter.patch('/eu', requireAuth, async (req, res) => {
  const data = parseProfile(req.body)
  const user = await updateUser(req.user.id, data, req.tokenHash)
  res.json({ user })
})

authRouter.put('/eu/email', requireAuth, async (req, res) => {
  const user = await changeCredentials(req.user.id, parseEmailChange(req.body), req.tokenHash, 'email')
  res.json({ user })
})
authRouter.put('/eu/senha', requireAuth, async (req, res) => {
  const user = await changeCredentials(req.user.id, parsePasswordChange(req.body), req.tokenHash, 'password')
  res.json({ user })
})
