import { randomUUID } from 'node:crypto'
import { inTransaction, query } from '../../db/pool.js'
import { HttpError, notFound } from '../../utils/httpError.js'
import { cardGateway } from './mercadopago.gateway.js'

export function createCardService(gateway = cardGateway) {
  async function list(userId) {
    const { rows } = await query(`SELECT c.id, c.mp_card_id AS "providerCardId", c.payment_method_id AS "paymentMethodId",
      c.last_four_digits AS "lastFourDigits", c.cardholder_name AS "cardholderName",
      c.expiration_month AS "expirationMonth", c.expiration_year AS "expirationYear"
      FROM payment_cards c JOIN payment_customers pc ON pc.id = c.payment_customer_id
      WHERE pc.user_id = $1 ORDER BY c.created_at DESC`, [userId])
    return rows
  }
  async function owned(userId, id, client = { query }) {
    const { rows } = await client.query(`SELECT c.*, pc.mp_customer_id, u.email FROM payment_cards c
      JOIN payment_customers pc ON pc.id = c.payment_customer_id JOIN users u ON u.id = pc.user_id
      WHERE c.id = $1 AND pc.user_id = $2`, [id, userId])
    if (!rows[0]) throw notFound('Cartão não encontrado nesta conta.')
    return rows[0]
  }
  async function add(userId, token) {
    const customer = await inTransaction(async client => {
      // Serializa criação de cliente, inclusão e exclusão da carteira desta conta.
      const { rows: users } = await client.query('SELECT id, name, email FROM users WHERE id = $1 FOR UPDATE', [userId])
      const { rows } = await client.query('SELECT * FROM payment_customers WHERE user_id = $1', [userId])
      let customer = rows[0]
      if (!customer) {
        const remote = await gateway.createCustomer(users[0])
        if (!remote.id) throw new HttpError(502, 'cliente_gateway_invalido', 'Cliente de pagamento inválido.')
        customer = (await client.query(`INSERT INTO payment_customers (id, user_id, mp_customer_id) VALUES ($1,$2,$3) RETURNING *`, [randomUUID(), userId, String(remote.id)])).rows[0]
      }
      return customer
    })
    // O cliente remoto não é reversível: mantenha seu vínculo mesmo se o token do cartão falhar.
    return inTransaction(async client => {
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId])
      const card = await gateway.addCard(customer.mp_customer_id, token)
      if (card.live_mode !== false || !card.id || !card.payment_method?.id || !/^\d{4}$/.test(card.last_four_digits) ||
          !Number.isInteger(card.expiration_month) || card.expiration_month < 1 || card.expiration_month > 12 ||
          !Number.isInteger(card.expiration_year) || card.expiration_year < 2000 || card.expiration_year > 2100) {
        throw new HttpError(502, 'cartao_gateway_invalido', 'Metadados de cartão inválidos no gateway.')
      }
      await client.query(`INSERT INTO payment_cards (id, payment_customer_id, mp_card_id, payment_method_id, last_four_digits, cardholder_name, expiration_month, expiration_year)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (payment_customer_id, mp_card_id) DO NOTHING`,
      [randomUUID(), customer.id, String(card.id), card.payment_method.id, card.last_four_digits, card.cardholder?.name ?? '', card.expiration_month, card.expiration_year])
    })
  }
  async function remove(userId, id) {
    await inTransaction(async client => {
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId])
      const card = await owned(userId, id, client)
      await gateway.removeCard(card.mp_customer_id, card.mp_card_id)
      await client.query('DELETE FROM payment_cards WHERE id = $1', [id])
    })
  }
  return { list, add, remove, owned }
}
