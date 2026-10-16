import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/authorize.js'
import { productUpload, discardUploads } from '../../middleware/upload.js'
import { parseProductId } from '../conta/produto.schemas.js'
import { parseAdminProduct } from './products.schemas.js'
import { getAdminProduct, listAdminProducts, saveAdminProduct } from './products.service.js'
import { getOverview, listUsers } from './admin.service.js'

export const adminRouter = Router()
adminRouter.use(requireAuth, requireRole('administrador'))

adminRouter.get('/visao-geral', async (_req, res) => res.json({ overview: await getOverview() }))
adminRouter.get('/usuarios', async (_req, res) => res.json({ users: await listUsers() }))
adminRouter.get('/produtos', async (_req, res) => res.json({ products: await listAdminProducts() }))
adminRouter.get('/produtos/:id', async (req, res) => {
  const { productId } = parseProductId({ productId: req.params.id })
  res.json({ product: await getAdminProduct(productId) })
})

function save(updating) {
  return async (req, res) => {
    try {
      const id = updating ? parseProductId({ productId: req.params.id }).productId : null
      const data = parseAdminProduct(req.body, { updating, fileCount: req.files?.length ?? 0 })
      const product = await saveAdminProduct(id, data, req.files)
      res.status(updating ? 200 : 201).json({ product })
    } catch (error) { await discardUploads(req.files); throw error }
  }
}
adminRouter.post('/produtos', productUpload, save(false))
adminRouter.put('/produtos/:id', productUpload, save(true))
