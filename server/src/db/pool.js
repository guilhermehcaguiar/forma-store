import pg from 'pg'
import { config } from '../config.js'

// Pool único de conexões com o PostgreSQL local.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
})

// Sem este handler, um erro de conexão ociosa encerraria o processo sem aviso.
pool.on('error', (error) => {
  console.error('[forma-api] erro inesperado no pool do PostgreSQL:', error.message)
})

export function query(text, params) {
  return pool.query(text, params)
}

// Usado pelo endpoint de saúde para conferir a conexão com o banco.
export async function checkConnection() {
  const result = await query('SELECT 1 AS ok')
  return result.rows[0]?.ok === 1
}

// Executa `work(client)` dentro de uma transação: COMMIT em caso de sucesso,
// ROLLBACK em qualquer erro (que é relançado). Para operações multi-passo
// que precisam ser atômicas (ex.: trocar o endereço principal).
export async function inTransaction(work) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
