// Teste de migração (opt-in) da 0011_cartoes_salvos — RF06 etapa 1.
//
// Executa somente com FORMA_TEST_DATABASE_URL apontando para um PostgreSQL
// descartável LOCAL (mesma guarda dos outros testes de integração). Valida o
// schema após a 0011: ausência de colunas de PAN/CVV/token, cliente Mercado
// Pago 1:1 por usuário, múltiplos cartões por cliente com unicidade e
// metadados seguros, isolamento por usuário, remoção em cascata e a
// compatibilidade das tentativas de pagamento antigas com os dois tipos
// (checkout_pro / card_saved). Nenhuma chamada externa: só SQL.

import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const url = process.env.FORMA_TEST_DATABASE_URL
test('migração 0011 — cartões salvos: schema, constraints e compatibilidade', { skip: !url }, async t => {
  const target = new URL(url)
  assert.ok(['localhost', '127.0.0.1'].includes(target.hostname) && /test|audit/.test(target.pathname))
  process.env.DATABASE_URL = url
  const { pool } = await import('../src/db/pool.js')

  const insertUser = (id, email) => pool.query(
    `INSERT INTO users (id, name, email, password_hash, promo)
     VALUES ($1, 'Teste cartões', $2, 'scrypt:fixture:fixture', false)`,
    [id, email],
  )
  const insertOrder = (userId) => pool.query(
    `INSERT INTO orders (id, user_id, address_snapshot, status, subtotal_centavos,
                         discount_centavos, shipping_centavos, total_centavos,
                         shipping_service_id, shipping_service_name,
                         checkout_key, checkout_fingerprint, checkout_payload_fingerprint)
     VALUES ($1, $2, '{}'::jsonb, 'aguardando_pagamento', 20000, 0, 1000, 21000,
             'fixture', 'Frete simulado', gen_random_uuid(), gen_random_uuid()::text, gen_random_uuid()::text)
     RETURNING id`,
    [randomUUID(), userId],
  )
  const insertCard = (customerId, mpCardId, method, lastFour, holder, month, year) => pool.query(
    `INSERT INTO payment_cards (id, payment_customer_id, mp_card_id, payment_method_id,
                                last_four_digits, cardholder_name, expiration_month, expiration_year)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [randomUUID(), customerId, mpCardId, method, lastFour, holder, month, year],
  )
  const insertAttempt = (orderId, { provider = 'mercadopago', preferenceId = null, url = null, kind } = {}) =>
    kind === undefined
      ? pool.query(
          `INSERT INTO payment_attempts (id, order_id, provider, preference_id, status,
                                         amount_centavos, sandbox_checkout_url)
           VALUES ($1, $2, $3, $4, 'criada', 21000, $5)
           RETURNING payment_kind`,
          [randomUUID(), orderId, provider, preferenceId, url],
        )
      : pool.query(
          `INSERT INTO payment_attempts (id, order_id, provider, preference_id, status,
                                         amount_centavos, sandbox_checkout_url, payment_kind)
           VALUES ($1, $2, $3, $4, 'criada', 21000, $5, $6)
           RETURNING payment_kind`,
          [randomUUID(), orderId, provider, preferenceId, url, kind],
        )
  const cardsOfUser = async (userId) => (await pool.query(
    `SELECT c.mp_card_id FROM payment_cards c
       JOIN payment_customers pc ON pc.id = c.payment_customer_id
      WHERE pc.user_id = $1 ORDER BY c.mp_card_id`,
    [userId],
  )).rows.map((row) => row.mp_card_id)

  const userA = randomUUID()
  const userB = randomUUID()
  try {
    await insertUser(userA, `cards-a-${randomUUID()}@example.test`)
    await insertUser(userB, `cards-b-${randomUUID()}@example.test`)

    await t.test('schema não possui colunas de PAN, CVV ou token temporário', async () => {
      const { rows } = await pool.query(
        `SELECT table_name, column_name FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name IN ('payment_cards', 'payment_customers')
          ORDER BY table_name, column_name`,
      )
      assert.ok(rows.length >= 10, 'tabelas presentes')
      for (const row of rows) {
        assert.ok(
          !/pan|cvv|cvc|token|security|number/i.test(row.column_name),
          `coluna proibida no schema: ${row.table_name}.${row.column_name}`,
        )
      }
    })

    let customerA
    let customerB
    await t.test('cliente do provedor é 1:1 com o usuário e único globalmente', async () => {
      customerA = randomUUID()
      customerB = randomUUID()
      const mpCustomerA = `mpcust-${randomUUID()}`
      await pool.query(
        'INSERT INTO payment_customers (id, user_id, mp_customer_id) VALUES ($1, $2, $3)',
        [customerA, userA, mpCustomerA],
      )
      await pool.query(
        'INSERT INTO payment_customers (id, user_id, mp_customer_id) VALUES ($1, $2, $3)',
        [customerB, userB, `mpcust-${randomUUID()}`],
      )
      // Um usuário não pode ter um segundo cliente do provedor.
      await assert.rejects(
        pool.query('INSERT INTO payment_customers (id, user_id, mp_customer_id) VALUES ($1, $2, $3)',
          [randomUUID(), userA, `mpcust-${randomUUID()}`]),
        /payment_customers_user_id_key/,
      )
      // O identificador do provedor não pode ser reatribuído a outra conta:
      // usa um usuário ainda sem cliente, para isolar a restrição global.
      const userC = randomUUID()
      await insertUser(userC, `cards-c-${randomUUID()}@example.test`)
      await assert.rejects(
        pool.query('INSERT INTO payment_customers (id, user_id, mp_customer_id) VALUES ($1, $2, $3)',
          [randomUUID(), userC, mpCustomerA]),
        /payment_customers_mp_customer_id_key/,
      )
    })

    let cardOfB
    await t.test('múltiplos cartões por cliente com unicidade e metadados validados', async () => {
      await insertCard(customerA, `mpcard-${randomUUID()}`, 'master', '6351', 'Titular A', 12, 2030)
      const duplicated = await pool.query(
        'INSERT INTO payment_cards (id, payment_customer_id, mp_card_id, payment_method_id, last_four_digits, cardholder_name, expiration_month, expiration_year) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [randomUUID(), customerA, `mpcard-${randomUUID()}`, 'visa', '4242', 'Titular A', 11, 2028],
      )
      assert.equal(duplicated.rowCount, 1, 'segundo cartão do mesmo cliente é aceito')
      const sameMpCard = (await pool.query(
        'SELECT mp_card_id FROM payment_cards WHERE payment_customer_id = $1 ORDER BY created_at LIMIT 1', [customerA],
      )).rows[0].mp_card_id
      await assert.rejects(
        insertCard(customerA, sameMpCard, 'master', '6351', 'Titular A', 12, 2030),
        /payment_cards_payment_customer_id_mp_card_id_key/,
      )
      await assert.rejects(insertCard(customerA, `mpcard-${randomUUID()}`, 'master', '12ab', 'X', 12, 2030), /payment_cards_last_four_digits_check/)
      await assert.rejects(insertCard(customerA, `mpcard-${randomUUID()}`, 'master', '123', 'X', 12, 2030), /payment_cards_last_four_digits_check/)
      await assert.rejects(insertCard(customerA, `mpcard-${randomUUID()}`, 'master', '6351', 'X', 13, 2030), /payment_cards_expiration_month_check/)
      await assert.rejects(insertCard(customerA, `mpcard-${randomUUID()}`, 'master', '6351', 'X', 12, 1999), /payment_cards_expiration_year_check/)
      await assert.rejects(insertCard(randomUUID(), `mpcard-${randomUUID()}`, 'master', '6351', 'X', 12, 2030), /foreign key/)
    })

    await t.test('isolamento por usuário: cartão de outra conta não aparece na lista', async () => {
      cardOfB = `mpcard-${randomUUID()}`
      await insertCard(customerB, cardOfB, 'visa', '1111', 'Titular B', 1, 2029)
      const cardsA = await cardsOfUser(userA)
      const cardsB = await cardsOfUser(userB)
      assert.equal(cardsA.length, 2)
      assert.equal(cardsB.length, 1)
      assert.ok(!cardsA.includes(cardOfB), 'cartão de B não é listado para A')
      assert.deepEqual(cardsB, [cardOfB])
    })

    await t.test('remoção da conta remove cliente e cartões em cascata', async () => {
      await pool.query('DELETE FROM users WHERE id = $1', [userB])
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM payment_customers WHERE user_id = $1', [userB])).rows[0].n, 0)
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM payment_cards WHERE payment_customer_id = $1', [customerB])).rows[0].n, 0)
      assert.equal((await cardsOfUser(userA)).length, 2, 'cartões de A permanecem')
    })

    await t.test('tentativas antigas continuam válidas e os dois tipos ficam distinguíveis', async () => {
      // INSERT no formato anterior à 0011 (sem payment_kind): default checkout_pro + URL.
      const legacyOrder = (await insertOrder(userA)).rows[0].id
      const legacy = await insertAttempt(legacyOrder, { preferenceId: `pref-${randomUUID()}`, url: 'https://sandbox.example.test/checkout' })
      assert.equal(legacy.rows[0].payment_kind, 'checkout_pro')

      // Novo tipo: pagamento direto com cartão salvo, sem preferência e sem URL.
      const directOrder = (await insertOrder(userA)).rows[0].id
      const direct = await insertAttempt(directOrder, { kind: 'card_saved' })
      assert.equal(direct.rows[0].payment_kind, 'card_saved')

      // Combinações inválidas e o CHECK original do provider continuam valendo.
      const withUrlOrder = (await insertOrder(userA)).rows[0].id
      await assert.rejects(insertAttempt(withUrlOrder, { kind: 'card_saved', url: 'https://sandbox.example.test/checkout' }), /payment_attempts_payment_kind_url_check/)
      const noUrlOrder = (await insertOrder(userA)).rows[0].id
      await assert.rejects(insertAttempt(noUrlOrder, { kind: 'checkout_pro', url: null }), /payment_attempts_payment_kind_url_check/)
      const badKindOrder = (await insertOrder(userA)).rows[0].id
      await assert.rejects(insertAttempt(badKindOrder, { kind: 'pix', url: null }), /payment_attempts_payment_kind_check/)
      const badProviderOrder = (await insertOrder(userA)).rows[0].id
      await assert.rejects(insertAttempt(badProviderOrder, { provider: 'stripe', kind: 'card_saved', url: null }), /payment_attempts_provider_check/)

      const { rows: constraints } = await pool.query(
        `SELECT conname FROM pg_constraint WHERE conrelid = 'payment_attempts'::regclass AND contype = 'c' ORDER BY conname`,
      )
      const names = constraints.map((row) => row.conname)
      assert.ok(names.includes('payment_attempts_payment_kind_url_check'), 'restrição composta presente')
      assert.ok(names.includes('payment_attempts_provider_check'), 'CHECK original do provider preservado')
    })
  } finally {
    await pool.end()
  }
})
