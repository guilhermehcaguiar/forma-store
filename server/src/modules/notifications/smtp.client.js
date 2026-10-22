// Cliente SMTP mínimo da FORMA, sem dependências externas (node:net/node:tls).
//
// Escopo: envio transacional de texto puro UTF-8 para um servidor SMTP local
// de desenvolvimento (ex.: Mailpit em 127.0.0.1:1025, sem TLS/AUTH) ou para
// provedores externos com TLS (FORMA_SMTP_SECURE=starttls|ssl) e autenticação
// AUTH PLAIN/LOGIN. Não há suporte a OAuth2/CRAM-MD5 nem a HTML; entrega
// externa real permanece homologação manual, não automática.
//
// Segurança: recusa quebras de linha em endereços/assunto (injeção de
// cabeçalho), recusa credenciais em plaintext fora do loopback, exige STARTTLS
// anunciado pelo servidor quando solicitado e valida certificados TLS.

import { once } from 'node:events'
import net from 'node:net'
import { randomUUID } from 'node:crypto'
import tls from 'node:tls'

const EHLO_HOSTNAME = 'forma.local'
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])
const SUPPORTED_SECURE_MODES = new Set(['none', 'starttls', 'ssl'])

function isLoopback(host) {
  return LOOPBACK_HOSTS.has(String(host).toLowerCase().replace(/^\[|\]$/g, ''))
}

function assertAddress(value, label) {
  const address = String(value ?? '').trim()
  // Endereços precisam ser ASCII: o cliente não implementa SMTPUTF8, e bytes
  // não-ASCII no envelope/DATA sem negociação corromperiam o diálogo.
  if (!address || /[\r\n\s<>,;:]/.test(address) || !/^[\x21-\x7E]+$/.test(address) || !/^[^@\s]+@[^@\s]+$/.test(address)) {
    throw new Error(`Endereço de e-mail inválido para ${label} (apenas ASCII é suportado).`)
  }
  return address
}

function sanitizeSubject(value) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim()
}

// Remove caracteres de controle vindos de respostas de servidores externos,
// sem usar regex de controle (mantém o lint sem avisos). Respostas brutas
// ficam somente no diálogo; erros públicos/persistidos usam comando e código.
export function stripControlChars(value) {
  let out = ''
  for (const char of String(value)) {
    const code = char.codePointAt(0)
    out += (code >= 32 && code !== 127) ? char : ' '
  }
  return out
}

// Monta a mensagem MIME de texto puro com dot-stuffing do corpo. Função pura,
// exportada para testes unitários sem rede.
export function composeMimeMessage({ from, to, subject, text }) {
  const safeFrom = assertAddress(from, 'remetente (MAIL FROM)')
  const safeTo = assertAddress(to, 'destinatário (RCPT TO)')
  const safeSubject = sanitizeSubject(subject)
  const messageId = `<${randomUUID()}@forma.local>`
  const bodyLines = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => (line.startsWith('.') ? `.${line}` : line))
  const data = [
    `From: ${safeFrom}`,
    `To: ${safeTo}`,
    `Subject: ${safeSubject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    ...bodyLines,
    '',
  ].join('\r\n')
  return { messageId, data }
}

// Lê respostas SMTP (multilinha "250-..." até a linha final "250 ...") e
// decodifica UTF-8 manualmente para não alterar o modo do socket — o upgrade
// STARTTLS precisa dos bytes brutos.
class SmtpDialog {
  constructor(socket) {
    this.socket = socket
    this.decoder = new TextDecoder('utf-8')
    this.buffer = ''
    this.lines = []
    this.waiters = []
    this.failure = null
    this.onData = (chunk) => {
      this.buffer += this.decoder.decode(chunk, { stream: true })
      let index = this.buffer.indexOf('\n')
      while (index !== -1) {
        const raw = this.buffer.slice(0, index)
        this.buffer = this.buffer.slice(index + 1)
        const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw
        const waiter = this.waiters.shift()
        if (waiter) waiter.resolve(line)
        else this.lines.push(line)
        index = this.buffer.indexOf('\n')
      }
    }
    this.onTimeout = () => {
      this.fail(new Error('Tempo limite excedido aguardando resposta do servidor SMTP.'))
      this.socket.destroy()
    }
    this.onError = () => {
      this.fail(new Error('Falha de conexão SMTP.'))
    }
    this.onClose = () => {
      this.fail(new Error('Conexão SMTP encerrada pelo servidor antes da resposta esperada.'))
    }
    socket.on('data', this.onData)
    socket.on('timeout', this.onTimeout)
    socket.on('error', this.onError)
    socket.on('close', this.onClose)
  }

  detach() {
    this.socket.off('data', this.onData)
    this.socket.off('timeout', this.onTimeout)
    this.socket.off('error', this.onError)
    this.socket.off('close', this.onClose)
  }

  fail(error) {
    if (this.failure) return
    this.failure = error
    while (this.waiters.length) this.waiters.shift().reject(error)
  }

  readLine() {
    if (this.failure) return Promise.reject(this.failure)
    const line = this.lines.shift()
    if (line !== undefined) return Promise.resolve(line)
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }))
  }

  async readReply() {
    const lines = []
    for (;;) {
      const line = await this.readLine()
      lines.push(line)
      if (/^\d{3} /.test(line)) {
        // O texto serve somente à leitura das capacidades; nunca é logado
        // nem incluído em erros persistidos.
        const text = stripControlChars(lines.join(' '))
        return { code: Number(line.slice(0, 3)), lines, text }
      }
      if (!/^\d{3}-/.test(line)) {
        throw new Error('Resposta SMTP fora do formato esperado.')
      }
    }
  }

  async expect(command, { acceptedCode } = {}) {
    const reply = await this.readReply()
    if (reply.code >= 400) {
      throw new Error(`SMTP recusou ${command}: ${reply.code}`)
    }
    if (acceptedCode !== undefined && reply.code !== acceptedCode) {
      throw new Error(`SMTP respondeu ${reply.code} a ${command} (esperado ${acceptedCode}).`)
    }
    return reply
  }

  write(line) {
    this.socket.write(`${line}\r\n`)
  }
}

// Capacidades anunciadas nas linhas do EHLO (código "250-" removido).
function parseEhlo(reply) {
  const capabilities = new Set()
  const authMechanisms = []
  for (const rawLine of reply.lines) {
    const line = rawLine.slice(4)
    const [keyword, ...rest] = line.split(/ +/)
    if (!keyword) continue
    capabilities.add(keyword.toUpperCase())
    if (keyword.toUpperCase() === 'AUTH') {
      for (const mechanism of rest) authMechanisms.push(mechanism.toUpperCase())
    }
  }
  return { capabilities, authMechanisms }
}

async function authenticate(dialog, mechanisms, { user, password }) {
  if (!mechanisms.length) {
    throw new Error('Servidor SMTP não ofereceu mecanismos de autenticação (AUTH) no EHLO.')
  }
  const encode = (value) => Buffer.from(value, 'utf8').toString('base64')
  if (mechanisms.includes('PLAIN')) {
    dialog.write('AUTH PLAIN')
    await dialog.expect('AUTH PLAIN', { acceptedCode: 334 })
    dialog.write(encode(`\0${user}\0${password}`))
    await dialog.expect('AUTH PLAIN (senha)')
    return
  }
  if (mechanisms.includes('LOGIN')) {
    dialog.write('AUTH LOGIN')
    await dialog.expect('AUTH LOGIN', { acceptedCode: 334 })
    dialog.write(encode(user))
    await dialog.expect('AUTH LOGIN (usuário)', { acceptedCode: 334 })
    dialog.write(encode(password))
    await dialog.expect('AUTH LOGIN (senha)')
    return
  }
  throw new Error('Mecanismos de autenticação SMTP não suportados.')
}

async function awaitConnection(socket, event, timeoutMs) {
  const timer = setTimeout(() => {
    socket.destroy(new Error('tempo limite de conexão excedido'))
  }, timeoutMs)
  try {
    await once(socket, event)
  } catch {
    throw new Error('Não foi possível conectar ao servidor SMTP.')
  } finally {
    clearTimeout(timer)
  }
}

// Envia um e-mail transacional e resolve com { messageId, response }.
// Qualquer falha lança Error com mensagem clara (guardada em last_error).
export async function sendSmtpEmail({
  host, port, secure = 'none', user, password, from, to, subject, text, timeoutMs = 10_000,
}) {
  const serverHost = String(host ?? '').trim()
  if (!serverHost) throw new Error('Host SMTP não configurado.')
  const serverPort = Number(port)
  if (!Number.isInteger(serverPort) || serverPort < 1 || serverPort > 65535) {
    throw new Error('Porta SMTP inválida.')
  }
  const secureMode = String(secure ?? 'none').toLowerCase()
  if (!SUPPORTED_SECURE_MODES.has(secureMode)) {
    throw new Error('FORMA_SMTP_SECURE inválido (use none, starttls ou ssl).')
  }
  const hasCredentials = Boolean(user && password)
  // Defesa duplicada da de resolveEmailConfig: nenhum envio em plaintext fora
  // do loopback, com ou sem credenciais (a mensagem do pedido vai no corpo).
  if (secureMode === 'none' && !isLoopback(serverHost)) {
    throw new Error('Envio SMTP em plaintext só é aceito para 127.0.0.1/localhost; configure FORMA_SMTP_SECURE=starttls ou ssl.')
  }

  const socket = secureMode === 'ssl'
    ? tls.connect({ host: serverHost, port: serverPort, servername: serverHost, rejectUnauthorized: true })
    : net.connect({ host: serverHost, port: serverPort })
  let activeSocket = socket
  let dialog = null
  try {
    await awaitConnection(socket, secureMode === 'ssl' ? 'secureConnect' : 'connect', timeoutMs)
    socket.setTimeout(timeoutMs)
    dialog = new SmtpDialog(socket)
    await dialog.expect('greeting', { acceptedCode: 220 })
    dialog.write(`EHLO ${EHLO_HOSTNAME}`)
    let { capabilities, authMechanisms } = parseEhlo(await dialog.expect('EHLO'))

    if (secureMode === 'starttls') {
      if (!capabilities.has('STARTTLS')) {
        throw new Error('FORMA_SMTP_SECURE=starttls, mas o servidor não anunciou STARTTLS no EHLO. Recusado enviar em plaintext.')
      }
      dialog.write('STARTTLS')
      await dialog.expect('STARTTLS', { acceptedCode: 220 })
      dialog.detach()
      const upgraded = tls.connect({ socket, servername: serverHost, rejectUnauthorized: true })
      activeSocket = upgraded
      // O detach() removeu o tratador de erro do socket pai; sem um listener,
      // um 'error' durante ou após o handshake seria um evento não tratado
      // (crash do processo). Erros do pai são canalizados para o TLSSocket,
      // que o novo SmtpDialog passa a tratar.
      const onParentError = (error) => {
        if (!upgraded.destroyed) upgraded.destroy(error)
      }
      socket.on('error', onParentError)
      try {
        await awaitConnection(upgraded, 'secureConnect', timeoutMs)
      } catch (error) {
        throw new Error(`Handshake STARTTLS falhou: ${error.message}`)
      }
      upgraded.setTimeout(timeoutMs)
      dialog = new SmtpDialog(upgraded)
      dialog.write(`EHLO ${EHLO_HOSTNAME}`)
      ;({ capabilities, authMechanisms } = parseEhlo(await dialog.expect('EHLO')))
    }

    if (hasCredentials) {
      await authenticate(dialog, authMechanisms, { user, password })
    }

    dialog.write(`MAIL FROM:<${assertAddress(from, 'remetente (MAIL FROM)')}>`)
    await dialog.expect('MAIL FROM')
    dialog.write(`RCPT TO:<${assertAddress(to, 'destinatário (RCPT TO)')}>`)
    await dialog.expect('RCPT TO')

    const { messageId, data } = composeMimeMessage({ from, to, subject, text })
    dialog.write('DATA')
    await dialog.expect('DATA', { acceptedCode: 354 })
    dialog.write(`${data}.`)
    const reply = await dialog.expect('DATA (conteúdo)')

    dialog.write('QUIT')
    try {
      await dialog.expect('QUIT')
    } catch {
      // Encerramento best-effort: a entrega já foi aceita pelo servidor.
    }
    return { messageId, response: String(reply.code) }
  } finally {
    activeSocket.destroy()
  }
}
