import pg from 'pg'

const hosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
const refusal = () => new Error('Permitido somente PostgreSQL local em loopback, sem query, fragmento ou configuração indireta PG*.')
const loopbackAddress = value => ['127.0.0.1', '::1'].includes(String(value).replace(/^::ffff:/, ''))

// Uma única política para admin demo, runners, pools e testes diretos.
// URL completa é obrigatória; qualquer query pode alterar a interpretação do driver.
export function assertLocalDatabaseUrl(value, { testOnly = false, environment = process.env } = {}) {
  let url
  try { url = new URL(value) } catch { throw refusal() }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !hosts.has(url.hostname) ||
      url.search || url.hash || !url.pathname.slice(1) ||
      Object.entries(environment).some(([key, value]) => /^PG[A-Z_]+$/.test(key) && value)) throw refusal()
  if (testOnly && !/test|audit/i.test(decodeURIComponent(url.pathname))) {
    throw new Error('Use somente banco local descartável com test ou audit no nome.')
  }
  return url
}

export async function assertLocalConnection(client, { testOnly = false } = {}) {
  // Confira o peer TCP antes até mesmo da consulta de identidade: DNS/host efetivo
  // remoto não pode receber comandos SQL. Sockets Unix/configuração implícita recusados.
  if (!hosts.has(client.connectionParameters?.host) ||
      !loopbackAddress(client.connection?.stream?.remoteAddress)) throw refusal()
  const { rows } = await client.query('SELECT host(inet_server_addr()) AS address, current_database() AS database')
  if (!loopbackAddress(rows[0]?.address) || rows[0]?.database !== client.connectionParameters.database ||
      (testOnly && !/test|audit/i.test(rows[0]?.database))) {
    throw new Error('Conexão PostgreSQL não confirmou servidor loopback e banco esperado; escrita recusada.')
  }
}

export async function connectLocalDatabase(value, policy = {}) {
  const url = assertLocalDatabaseUrl(value, policy)
  // localhost é fixado em IPv4 loopback; não depende de DNS/hosts do ambiente.
  if (url.hostname === 'localhost') url.hostname = '127.0.0.1'
  const client = new pg.Client({ connectionString: url.href })
  try {
    await client.connect()
    await assertLocalConnection(client, policy)
    return client
  } catch (error) { await client.end().catch(() => {}); throw error }
}

// pool.query e transações passam por connect; cada checkout é validado no MESMO
// cliente antes que qualquer SQL do chamador (inclusive BEGIN) seja executado.
export function createLocalPool(value, policy = {}) {
  const url = assertLocalDatabaseUrl(value, policy)
  if (url.hostname === 'localhost') url.hostname = '127.0.0.1'
  return new class extends pg.Pool {
    connect(callback) {
      const work = async () => {
        assertLocalDatabaseUrl(this.options.connectionString, policy)
        const client = await super.connect()
        try { await assertLocalConnection(client, policy); return client }
        catch (error) { client.release(true); throw error }
      }
      const result = work()
      if (callback) { result.then(client => callback(null, client, client.release), error => callback(error)); return }
      return result
    }
  }({ connectionString: url.href, max: 10 })
}
