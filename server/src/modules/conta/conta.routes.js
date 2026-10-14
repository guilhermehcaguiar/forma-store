import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { parseAddress } from './enderecos.schemas.js'
import {
  createAddress,
  deleteAddress,
  listAddresses,
  updateAddress,
} from './enderecos.service.js'
import { parseList } from './listas.schemas.js'
import { createList, deleteList, listLists, updateList } from './listas.service.js'

export const contaRouter = Router()

// Toda a área de conta exige sessão válida (RF04, RF05, RF20).
contaRouter.use(requireAuth)

// ── Endereços (RF05) ────────────────────────────────────────────────────────
contaRouter.get('/enderecos', async (req, res) => {
  const addresses = await listAddresses(req.user.id)
  res.json({ addresses })
})

contaRouter.post('/enderecos', async (req, res) => {
  const values = parseAddress(req.body)
  const address = await createAddress(req.user.id, values)
  res.status(201).json({ address })
})

contaRouter.put('/enderecos/:id', async (req, res) => {
  const values = parseAddress(req.body)
  const address = await updateAddress(req.user.id, req.params.id, values)
  res.json({ address })
})

contaRouter.delete('/enderecos/:id', async (req, res) => {
  await deleteAddress(req.user.id, req.params.id)
  res.status(204).send()
})

// ── Listas de compras (RF20) ────────────────────────────────────────────────
contaRouter.get('/listas', async (req, res) => {
  const lists = await listLists(req.user.id)
  res.json({ lists })
})

contaRouter.post('/listas', async (req, res) => {
  const values = parseList(req.body)
  const list = await createList(req.user.id, values)
  res.status(201).json({ list })
})

contaRouter.put('/listas/:id', async (req, res) => {
  const values = parseList(req.body)
  const list = await updateList(req.user.id, req.params.id, values)
  res.json({ list })
})

contaRouter.delete('/listas/:id', async (req, res) => {
  await deleteList(req.user.id, req.params.id)
  res.status(204).send()
})
