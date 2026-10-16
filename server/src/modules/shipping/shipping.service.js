import { randomUUID } from 'node:crypto'
import { pool, query } from '../../db/pool.js'
import { badRequest, notFound } from '../../utils/httpError.js'
import { readCart } from '../cart/cart.service.js'
import { addressFingerprint, buildQuotePayload, cartFingerprint, mapProviderServices, requestProviderQuote } from './shipping.provider.js'

const QUOTE_TTL_MINUTES = 20

export async function getOwnedAddress(userId, addressId, db = pool) {
  const { rows } = await db.query(
    `SELECT id, label, recipient, street, number, complement, district, city, state, cep, principal
       FROM addresses WHERE id = $1 AND user_id = $2`,
    [addressId, userId],
  )
  if (!rows[0]) throw notFound('Endereço não encontrado para esta conta.')
  if (!/^\d{8}$/.test(String(rows[0].cep ?? '').replace(/\D/g, ''))) {
    throw badRequest('cep_invalido', 'O CEP do endereço selecionado precisa ter 8 dígitos.')
  }
  return rows[0]
}

export async function createShippingQuote(userId, addressId, inputItems) {
  const address = await getOwnedAddress(userId, addressId)
  const cart = await readCart(inputItems, pool, { validateStock: true })
  const payload = buildQuotePayload(process.env.MELHOR_ENVIO_ORIGIN_CEP, address.cep, cart.items)
  const providerResponse = await requestProviderQuote(payload)
  const services = mapProviderServices(providerResponse)
  if (!services.length) return { quoteId: null, services: [], expiresAt: null }

  const id = randomUUID()
  const expiresAt = new Date(Date.now() + QUOTE_TTL_MINUTES * 60 * 1000)
  const addressHash = addressFingerprint(address)
  await query(
    `DELETE FROM shipping_quotes WHERE user_id = $1 AND expires_at <= now()`
      , [userId],
  )
  await query(
    `INSERT INTO shipping_quotes (id, user_id, address_id, address_fingerprint, cart_fingerprint, services, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [id, userId, addressId, addressHash, cartFingerprint(cart.items), JSON.stringify(services), expiresAt],
  )
  return { quoteId: id, services, expiresAt: expiresAt.toISOString() }
}
