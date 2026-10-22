// Comando local para criar (ou promover) um administrador do FORMA.
//
// Uso (a partir de server/, ou da raiz com `npm run api:admin -- ...`):
//   node src/scripts/criar-admin.js --email admin@forma.local --nome "Administrador FORMA"
//   node src/scripts/criar-admin.js --email antigo@forma.local --promover
//
// A senha NUNCA fica no código: quando não informada em ADMIN_PASSWORD (uso
// não interativo, ex.: scripts de ambiente), é lida pelo terminal com eco
// oculto e pedida duas vezes. O papel "administrador" só pode ser concedido
// por este comando executado na máquina do responsável — nenhuma rota da API
// cria ou altera papéis.
//
// Flags:
//   --email <endereço>  e-mail da conta (obrigatório)
//   --nome <texto>      nome exibido (padrão: "Administrador FORMA")
//   --promover          se o e-mail já existir, concede o papel sem trocar a senha
//   --help              mostra este texto

import './carregar-env.js'
import { randomUUID } from 'node:crypto'
import { stdin as input, stdout as output } from 'node:process'
import readline from 'node:readline/promises'
import { pool, query } from '../db/pool.js'
import { hashPassword } from '../utils/password.js'
import { PASSWORD_MIN_LENGTH, isEmail, normalizeEmail, str } from '../utils/validate.js'

function parseArgs(argv) {
  const args = { email: '', nome: '', promover: false, help: false }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag === '--promover') args.promover = true
    else if (flag === '--help' || flag === '-h') args.help = true
    else if (flag === '--email') args.email = str(argv[(index += 1)])
    else if (flag === '--nome') args.nome = str(argv[(index += 1)])
    else {
      throw new Error(`Argumento desconhecido: ${flag}. Use --help para ver o uso.`)
    }
  }
  return args
}

function showHelp() {
  console.log(`Uso: node src/scripts/criar-admin.js --email <endereço> [--nome <texto>] [--promover]

A senha é solicitada no terminal (entrada oculta) ou lida de ADMIN_PASSWORD.`)
}

// Receita da documentação do Node para entrada oculta com readline:
// o que o usuário digita é redesenhado como "*", sem eco da senha.
function hiddenQuestion(rl, question) {
  const originalWrite = rl._writeToOutput.bind(rl)
  return new Promise((resolve) => {
    rl._writeToOutput = function writeHidden(string) {
      originalWrite(string.includes(question) ? question : '*')
    }
    rl.question(question, (answer) => {
      rl._writeToOutput = originalWrite
      resolve(answer)
    })
  })
}

async function askCredentials(args) {
  const rl = readline.createInterface({ input, output })

  // Em scripts/ambientes sem terminal interativo, nada pode ficar esperando
  // digitação: exige flags e ADMIN_PASSWORD com orientação clara.
  function requireInteractive() {
    if (!input.isTTY) {
      throw new Error('Terminal não interativo: informe --email (e --nome, se for criar conta) e a senha em ADMIN_PASSWORD.')
    }
  }

  try {
    let email = normalizeEmail(args.email)
    if (!isEmail(email)) {
      requireInteractive()
      while (!isEmail(email)) {
        email = normalizeEmail(await rl.question('E-mail do administrador: '))
        if (!isEmail(email)) console.log('  Informe um e-mail válido, como admin@forma.local.')
      }
    }

    // --promover não altera o nome da conta existente.
    let nome = args.nome
    if (!nome && !args.promover) {
      requireInteractive()
      nome = (await rl.question('Nome exibido (Enter para "Administrador FORMA"): ')) || 'Administrador FORMA'
    }
    nome = nome || 'Administrador FORMA'

    // Promover preserva a senha atual; criar conta exige senha nova.
    let password = ''
    if (!args.promover) {
      password = process.env.ADMIN_PASSWORD ?? ''
      if (!password) {
        requireInteractive()
        password = await hiddenQuestion(rl, 'Senha: ')
        const confirmation = await hiddenQuestion(rl, 'Confirmar senha: ')
        if (password !== confirmation) {
          throw new Error('As senhas não coincidem. Nada foi alterado.')
        }
      }
    }

    return { email, nome, password }
  } finally {
    rl.close()
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    showHelp()
    return
  }

  const { email, nome, password } = await askCredentials(args)

  if (!args.promover && password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres. Nada foi alterado.`)
  }

  const { rows } = await query('SELECT id, role FROM users WHERE lower(email) = $1', [email])
  const existing = rows[0]

  if (existing && args.promover) {
    await query(`UPDATE users SET role = 'administrador', updated_at = now() WHERE id = $1`, [existing.id])
    console.log(`[forma-api] conta ${email} promovida a administradora (senha preservada).`)
    return
  }

  if (existing) {
    throw new Error(`O e-mail ${email} já está cadastrado. Use --promover para conceder o papel sem trocar a senha.`)
  }

  const passwordHash = await hashPassword(password)
  await query(
    `INSERT INTO users (id, name, email, password_hash, promo, role)
     VALUES ($1, $2, $3, $4, false, 'administrador')`,
    [randomUUID(), nome, email, passwordHash],
  )

  console.log(`[forma-api] administrador criado: ${email} (${nome}).`)
  console.log('[forma-api] Guarde a senha em local seguro; ela não pode ser recuperada.')
}

try {
  await main()
} catch {
  console.error('[forma-api] Não foi possível provisionar o administrador. Confira argumentos e conexão; detalhes privados omitidos.')
  process.exitCode = 1
} finally {
  await pool.end()
}
