import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { badRequest } from '../../utils/httpError.js'
import { parseAddress } from './enderecos.schemas.js'
import {
  createAddress,
  deleteAddress,
  listAddresses,
  setPrincipalAddress,
  updateAddress,
} from './enderecos.service.js'
import { parseProductId } from './produto.schemas.js'
import { addFavorite, listFavorites, removeFavorite } from './favoritos.service.js'
import { parseList } from './listas.schemas.js'
import {
  addListItem,
  createList,
  deleteList,
  getList,
  listLists,
  removeListItem,
  updateList,
} from './listas.service.js'

export const contaRouter = Router()

// Toda a área de conta exige sessão válida (RF04, RF05, RF19, RF20).
contaRouter.use(requireAuth)
for (const name of ['id', 'productId']) {
  contaRouter.param(name, (req, _res, next, value) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      throw badRequest('identificador_invalido', 'Identificador inválido.')
    }
    req.params[name] = value.toLowerCase()
    next()
  })
}

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

// Seleção explícita do endereço principal (RF05).
contaRouter.put('/enderecos/:id/principal', async (req, res) => {
  const address = await setPrincipalAddress(req.user.id, req.params.id)
  res.json({ address })
})

contaRouter.delete('/enderecos/:id', async (req, res) => {
  await deleteAddress(req.user.id, req.params.id)
  res.status(204).send()
})

// ── Favoritos (RF19) — produtos referenciados pelo contrato do catálogo ─────
contaRouter.get('/favoritos', async (req, res) => {
  const productIds = await listFavorites(req.user.id)
  res.json({ productIds })
})

contaRouter.post('/favoritos', async (req, res) => {
  const { productId } = parseProductId(req.body)
  await addFavorite(req.user.id, productId)
  const productIds = await listFavorites(req.user.id)
  res.status(201).json({ productIds })
})

contaRouter.delete('/favoritos/:productId', async (req, res) => {
  await removeFavorite(req.user.id, req.params.productId)
  res.status(204).send()
})

// ── Listas de compras (RF20) ────────────────────────────────────────────────
contaRouter.get('/listas', async (req, res) => {
  const lists = await listLists(req.user.id)
  res.json({ lists })
})

contaRouter.get('/listas/:id', async (req, res) => {
  const list = await getList(req.user.id, req.params.id)
  res.json({ list })
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

// Adiciona um produto à lista (contrato do catálogo: productId UUID).
contaRouter.post('/listas/:id/itens', async (req, res) => {
  const { productId } = parseProductId(req.body)
  const list = await addListItem(req.user.id, req.params.id, productId)
  res.status(201).json({ list })
})

contaRouter.delete('/listas/:id/itens/:productId', async (req, res) => {
  await removeListItem(req.user.id, req.params.id, req.params.productId)
  res.status(204).send()
})

contaRouter.delete('/listas/:id', async (req, res) => {
  await deleteList(req.user.id, req.params.id)
  res.status(204).send()
})
