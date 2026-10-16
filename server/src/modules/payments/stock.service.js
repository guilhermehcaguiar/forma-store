import { inTransaction } from '../../db/pool.js'
import { enqueueOrderEmail } from '../notifications/email.service.js'

export async function releaseOrderReservations(client, orderId) {
  const { rows } = await client.query(
    `SELECT id, product_size_id AS "productSizeId", quantity
       FROM stock_reservations
      WHERE order_id = $1 AND status = 'reservado'
      ORDER BY product_size_id
      FOR UPDATE`,
    [orderId],
  )

  for (const reservation of rows) {
    await client.query(
      'UPDATE product_sizes SET stock = stock + $2 WHERE id = $1',
      [reservation.productSizeId, reservation.quantity],
    )
  }

  if (rows.length) {
    await client.query(
      `UPDATE stock_reservations SET status = 'liberado', updated_at = now()
        WHERE order_id = $1 AND status = 'reservado'`,
      [orderId],
    )
  }
  return rows.length
}

export async function consumeOrderReservations(client, orderId) {
  const [reservationResult, itemResult] = await Promise.all([
    client.query(
      `SELECT sr.id, ps.product_id AS "productId", ps.size, sr.quantity, oi.quantity AS "itemQuantity"
         FROM stock_reservations sr
         JOIN product_sizes ps ON ps.id = sr.product_size_id
         JOIN order_items oi ON oi.order_id = sr.order_id AND oi.product_id = ps.product_id AND oi.size = ps.size
        WHERE sr.order_id = $1 AND sr.status = 'reservado' AND sr.expires_at > now()
        FOR UPDATE OF sr`,
      [orderId],
    ),
    client.query('SELECT count(*)::int AS total FROM order_items WHERE order_id = $1', [orderId]),
  ])
  const rows = reservationResult.rows
  if (!rows.length || rows.length !== itemResult.rows[0].total ||
      rows.some(row => Number(row.quantity) !== Number(row.itemQuantity))) return false

  await client.query(
    `UPDATE stock_reservations SET status = 'consumido', updated_at = now()
      WHERE order_id = $1 AND status = 'reservado'`,
    [orderId],
  )
  return true
}

export async function expirePendingOrders(limit = 50) {
  return inTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id FROM orders
        WHERE status = 'aguardando_pagamento' AND payment_deadline_at <= now()
        ORDER BY payment_deadline_at
        LIMIT $1
        FOR UPDATE SKIP LOCKED`,
      [limit],
    )

    for (const { id } of rows) {
      await releaseOrderReservations(client, id)
      await client.query(
        `UPDATE orders SET status = 'cancelado' WHERE id = $1 AND status = 'aguardando_pagamento'`,
        [id],
      )
      await client.query(
        `UPDATE payment_attempts
            SET status = 'cancelada', updated_at = now()
          WHERE order_id = $1 AND status IN ('criada', 'pendente', 'em_processamento')`,
        [id],
      )
      await enqueueOrderEmail(client, id, 'order_status', 'cancelado')
    }
    return rows.length
  })
}
