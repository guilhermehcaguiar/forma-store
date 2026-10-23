// Notificações transacionais da FORMA (outbox + entrega).
//
// Fluxo: os e-mails transacionais são enfileirados por enqueueOrderEmail na
// MESMA transação do evento que os origina (criação de pedido, pagamento
// aprovado, cancelamento...), com event_key determinística. A UNIQUE de
// event_key absorve webhook repetido, reconciliação repetida e qualquer
// reprocessamento: um mesmo evento só produz uma linha no outbox.
//
// Entrega: dispatchEmailOutbox reivindica linhas ("claim") em transação curta
// (status 'sending' + next_attempt_at como lease), envia FORA de transação e
// finaliza com guarda por attempts. Falhas ficam registradas em last_error com
// nova tentativa em backoff exponencial; o pedido nunca é afetado pelo envio.
//
// Modos (FORMA_EMAIL_MODE):
//   mock — modo EXPLÍCITO de desenvolvimento/teste: nenhuma entrega acontece;
//          as linhas viram prévias ('mocked') em mock_message, com aviso no texto.
//   smtp — entrega transacional real por SMTP configurável (smtp.client.js).
// Sem a variável, o padrão é mock e a inicialização registra o aviso.

import { randomUUID } from 'node:crypto'
import { query } from '../../db/pool.js'
import { HttpError } from '../../utils/httpError.js'
import { sendSmtpEmail, stripControlChars } from './smtp.client.js'
import { DEMO_NOTICE, LOOPBACK_HOSTS as DEMO_SMTP_HOSTS } from '../demo/demo.config.js'

const DEFAULT_FROM = 'no-reply@forma.local'
const DEFAULT_MAX_ATTEMPTS = 5
const DEFAULT_SMTP_PORT = 1025
const CLAIM_LEASE_SECONDS = 120
const SMTP_TIMEOUT_MS = 10_000
const SUPPORTED_MODES = new Set(['mock', 'smtp'])
const SUPPORTED_SECURE_MODES = new Set(['none', 'starttls', 'ssl'])
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

// Templates transacionais permitidos no enqueue. E-mails PROMOCIONAIS não
// existem e não podem usar este funil: quando existirem, devem respeitar o
// opt-in users.promo em um caminho separado. A confirmação de compra é
// transacional e NÃO consulta users.promo — desmarcar promoções não impede o
// envio da confirmação do pedido pago.
const TRANSACTIONAL_TEMPLATES = new Set(['order_confirmation', 'order_status', 'purchase_confirmation'])

function formatPrice(centavos) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(centavos) / 100)
}

function formatCep(cep) {
  const digits = String(cep ?? '').replace(/\D/g, '')
  return /^\d{8}$/.test(digits) ? `${digits.slice(0, 5)}-${digits.slice(5)}` : String(cep ?? '')
}

function buildSubject(template, orderId) {
  if (template === 'order_confirmation') return `Pedido FORMA ${orderId} recebido`
  if (template === 'purchase_confirmation') return `Compra FORMA ${orderId} confirmada`
  return `Atualização do pedido FORMA ${orderId}`
}

// Configuração lida no momento de cada varredura (facilita testes e evita
// capturar segredos em módulos). Modo/valor inválido falha antes de reivindicar
// qualquer linha do outbox: nada é perdido nem marcado sem necessidade.
export function resolveEmailConfig() {
  const mode = process.env.FORMA_EMAIL_MODE ?? 'mock'
  if (!SUPPORTED_MODES.has(mode)) {
    throw new HttpError(503, 'email_mode_invalido', 'FORMA_EMAIL_MODE deve ser "mock" ou "smtp".')
  }
  const from = process.env.FORMA_EMAIL_FROM ?? DEFAULT_FROM
  if (/[\r\n]/.test(from) || !/^[^@\s]+@[^@\s]+$/.test(from.trim()) || from.trim() !== from) {
    throw new HttpError(503, 'email_remetente_invalido', `FORMA_EMAIL_FROM deve ser um endereço de e-mail simples (ex.: ${DEFAULT_FROM}).`)
  }
  const maxAttempts = Number(process.env.FORMA_EMAIL_MAX_ATTEMPTS ?? DEFAULT_MAX_ATTEMPTS)
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 100) {
    throw new HttpError(503, 'email_tentativas_invalido', 'FORMA_EMAIL_MAX_ATTEMPTS deve ser um inteiro entre 1 e 100.')
  }
  if (mode === 'mock') return { mode, from, maxAttempts }

  const host = process.env.FORMA_SMTP_HOST ?? ''
  if (!host.trim()) {
    throw new HttpError(503, 'email_smtp_nao_configurado', 'FORMA_EMAIL_MODE=smtp exige FORMA_SMTP_HOST (para o Mailpit local, use 127.0.0.1).')
  }
  const port = Number(process.env.FORMA_SMTP_PORT ?? DEFAULT_SMTP_PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new HttpError(503, 'email_smtp_porta_invalida', 'FORMA_SMTP_PORT deve ser um inteiro entre 1 e 65535.')
  }
  const secure = process.env.FORMA_SMTP_SECURE ?? 'none'
  if (!SUPPORTED_SECURE_MODES.has(secure)) {
    throw new HttpError(503, 'email_smtp_tls_invalido', 'FORMA_SMTP_SECURE deve ser none (apenas loopback), starttls ou ssl.')
  }
  const user = process.env.FORMA_SMTP_USER?.trim() || undefined
  const password = process.env.FORMA_SMTP_PASS || undefined
  if ([user, password].some(value => value && /fictici|placeholder|troque/i.test(value))) {
    throw new HttpError(503, 'email_smtp_credencial_ficticia', 'Remova os exemplos fictícios de FORMA_SMTP_USER/PASS; para captura local, deixe ambos vazios.')
  }
  if ((user && !password) || (password && !user)) {
    throw new HttpError(503, 'email_smtp_credenciais_incompletas', 'FORMA_SMTP_USER e FORMA_SMTP_PASS devem ser configurados juntos.')
  }
  // Envio em plaintext só é aceito em loopback (alvo homologado: Mailpit/
  // servidor local de captura). Host externo exige starttls ou ssl, com ou
  // sem credenciais — a mensagem do pedido viaja no corpo.
  if (secure === 'none' && !LOOPBACK_HOSTS.has(host.toLowerCase())) {
    throw new HttpError(503, 'email_smtp_tls_obrigatorio', 'FORMA_SMTP_SECURE=none só é aceito para 127.0.0.1/localhost; para servidor externo use starttls ou ssl.')
  }
  return {
    mode,
    from,
    maxAttempts,
    smtp: { host, port, secure, user, password, timeoutMs: SMTP_TIMEOUT_MS },
  }
}

// Aviso de inicialização; nunca imprime credenciais.
export function describeEmailMode() {
  const config = resolveEmailConfig()
  if (config.mode === 'mock') {
    return '[forma-api] FORMA_EMAIL_MODE=mock — modo de desenvolvimento/teste: NENHUM e-mail é entregue; as mensagens ficam como prévias locais em email_outbox (mock_message). Para entrega, configure FORMA_EMAIL_MODE=smtp e FORMA_SMTP_HOST.'
  }
  return '[forma-api] FORMA_EMAIL_MODE=smtp — transporte SMTP configurado; dados de conexão omitidos.'
}

// Backoff exponencial com teto de 60 minutos (2, 4, 8, 16, 32...).
export function computeRetryDelayMinutes(attempts) {
  return Math.min(2 ** Number(attempts), 60)
}

export async function enqueueOrderEmail(client, orderId, template, statusKey = '') {
  if (!TRANSACTIONAL_TEMPLATES.has(template)) {
    throw new HttpError(400, 'email_template_invalido', `Template de e-mail transacional desconhecido: ${template}. E-mails promocionais não usam este fluxo.`)
  }
  const { rows } = await client.query(
    `SELECT o.id, o.user_id AS "userId", o.status, o.transaction_mode AS "transactionMode", o.payment_provider AS "paymentProvider", o.created_at AS "createdAt",
            o.subtotal_centavos AS "subtotalCentavos", o.discount_centavos AS "discountCentavos",
            o.shipping_centavos AS "shippingCentavos", o.total_centavos AS "totalCentavos",
            o.coupon_code AS "couponCode", o.shipping_service_name AS "shippingService",
            o.shipping_company_name AS "shippingCompany", o.shipping_delivery_days AS "deliveryDays",
            o.payment_deadline_at AS "paymentDeadlineAt", o.address_snapshot AS "addressSnapshot",
            u.email
       FROM orders o JOIN users u ON u.id = o.user_id
      WHERE o.id = $1`,
    [orderId],
  )
  const order = rows[0]
  if (!order) return false

  let items = null
  if (template === 'purchase_confirmation') {
    const itemResult = await client.query(
      `SELECT product_name AS name, color, size, quantity,
              unit_price_centavos AS "unitPriceCentavos", line_total_centavos AS "lineTotalCentavos"
         FROM order_items
        WHERE order_id = $1
        ORDER BY product_name, size`,
      [orderId],
    )
    items = itemResult.rows.map((item) => ({
      name: item.name,
      color: item.color,
      size: item.size,
      quantity: Number(item.quantity),
      unitPriceCentavos: Number(item.unitPriceCentavos),
      lineTotalCentavos: Number(item.lineTotalCentavos),
    }))
  }

  const eventKey = statusKey
    ? `order:${orderId}:status:${statusKey}`
    : `order:${orderId}:${template}`
  const subject = (order.transactionMode === 'demo' ? `${DEMO_NOTICE} · ` : '') + buildSubject(template, orderId)
  const payload = template === 'purchase_confirmation'
    ? {
        orderId,
        status: statusKey || order.status,
        createdAt: order.createdAt?.toISOString?.() ?? order.createdAt,
        subtotalCentavos: Number(order.subtotalCentavos),
        discountCentavos: Number(order.discountCentavos),
        shippingCentavos: Number(order.shippingCentavos),
        totalCentavos: Number(order.totalCentavos),
        couponCode: order.couponCode,
        shippingService: order.shippingService,
        shippingCompany: order.shippingCompany,
        deliveryDays: order.deliveryDays,
        items,
        address: order.addressSnapshot ?? null,
      }
    : {
        orderId,
        status: statusKey || order.status,
        totalCentavos: Number(order.totalCentavos),
        paymentDeadlineAt: order.paymentDeadlineAt?.toISOString?.() ?? order.paymentDeadlineAt,
        shippingService: order.shippingService,
        deliveryDays: order.deliveryDays,
      }

  payload.transactionMode = order.transactionMode ?? 'gateway'
  payload.paymentProvider = order.paymentProvider
  const result = await client.query(
    `INSERT INTO email_outbox (id, order_id, user_id, event_key, recipient_email, template, subject, payload, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'queued')
     ON CONFLICT (event_key) DO NOTHING
     RETURNING id`,
    [randomUUID(), orderId, order.userId, eventKey, order.email, template, subject, JSON.stringify(payload)],
  )
  return Boolean(result.rows[0])
}

function renderOrderNotice(payload) {
  const statusText = {
    aguardando_pagamento: 'aguardando pagamento',
    pago: 'pagamento confirmado',
    cancelado: 'cancelado; eventual reserva de estoque foi liberada',
    revisao_manual: 'em revisão manual; não realize o envio automaticamente',
  }[payload.status] ?? payload.status
  const lines = [
    'Olá! Aqui é a FORMA.',
    `Pedido: ${payload.orderId}`,
    `Status: ${statusText}`,
    `Total: ${formatPrice(payload.totalCentavos)}`,
  ]
  if (payload.shippingService) lines.push(`Frete: ${payload.shippingService}${payload.deliveryDays ? ` (${payload.deliveryDays} dias úteis)` : ''}`)
  if (payload.paymentDeadlineAt && payload.status === 'aguardando_pagamento') {
    lines.push(`Reserva de estoque até: ${new Date(payload.paymentDeadlineAt).toLocaleString('pt-BR')}`)
  }
  return lines.join('\n')
}

function renderPurchaseConfirmation(payload) {
  const address = payload.address ?? {}
  const lines = [
    'Olá!',
    '',
    'Sua compra na FORMA foi confirmada. Obrigado por comprar com a gente.',
    '',
    `Pedido: ${payload.orderId}`,
  ]
  if (payload.createdAt) lines.push(`Data do pedido: ${new Date(payload.createdAt).toLocaleString('pt-BR')}`)
  lines.push('', 'Itens:')
  for (const item of payload.items ?? []) {
    lines.push(`- ${item.name} — cor: ${item.color}, tamanho: ${item.size}, quantidade: ${item.quantity}`)
    lines.push(`  ${formatPrice(item.unitPriceCentavos)} por unidade — total do item: ${formatPrice(item.lineTotalCentavos)}`)
  }
  lines.push(
    '',
    `Subtotal: ${formatPrice(payload.subtotalCentavos)}`,
  )
  if (Number(payload.discountCentavos) > 0) {
    lines.push(`Desconto: ${formatPrice(payload.discountCentavos)}${payload.couponCode ? ` (cupom ${payload.couponCode})` : ''}`)
  }
  const shippingDetail = [
    payload.shippingService,
    payload.shippingCompany,
    payload.deliveryDays ? `${payload.deliveryDays} dias úteis` : null,
  ].filter(Boolean).join(' — ')
  lines.push(
    `Frete: ${shippingDetail ? `${shippingDetail} — ` : ''}${formatPrice(payload.shippingCentavos)}`,
    `Total: ${formatPrice(payload.totalCentavos)}`,
    '',
    'Endereço de entrega:',
    address.recipient ?? '',
    [address.street, address.number].filter(Boolean).join(', ') + (address.complement ? ` — ${address.complement}` : ''),
    [address.district, [address.city, address.state].filter(Boolean).join('/')].filter(Boolean).join(' — ') + (address.cep ? ` — CEP ${formatCep(address.cep)}` : ''),
    '',
    `Esta mensagem confirma a aprovação do pagamento do pedido ${payload.orderId}. Por segurança, a FORMA não envia dados de pagamento por e-mail.`,
    '',
    'FORMA — camisas oversized masculinas',
  )
  return lines.join('\n')
}

// Conteúdo real da mensagem por template. O assunto gravado no enqueue é a
// fonte da verdade; o texto é derivado do payload.
export function renderEmailContent(row) {
  const payload = row.payload ?? {}
  const text = row.template === 'purchase_confirmation'
    ? renderPurchaseConfirmation(payload)
    : renderOrderNotice(payload)
  return { to: row.recipient_email, subject: row.subject,
    text: payload.transactionMode === 'demo' ? `${DEMO_NOTICE}\n\n${text}` : text }
}

// Prévia do modo mock: mesmo conteúdo + aviso explícito de que nada foi
// entregue. Mantida para compatibilidade com as linhas legadas em 'mocked'.
export function renderMockEmail(row) {
  const content = renderEmailContent(row)
  return { ...content, text: `${content.text}\nModo mock: nenhuma mensagem foi enviada para um endereço externo.` }
}

function truncateError(error) {
  // Remove caracteres de controle antes de gravar: o texto vem de resposta de
  // servidor externo e não deve injetar escapes em logs/terminal.
  const message = stripControlChars(String(error?.message ?? error))
  return message.length > 480 ? `${message.slice(0, 477)}...` : message
}

// Reivindica linhas em transação curta (statement único, auto-commit). Em modo
// mock, 'failed' nunca é reivindicado (não mascara falha real de SMTP), mas
// uma reivindicação interrompida ('sending' com lease vencido) é recuperada
// para não deixar a linha presa para sempre no modo padrão.
async function claimOutboxRows(config, limit) {
  const eligibility = config.mode === 'mock'
    ? `status = 'queued'
            OR (status = 'sending' AND next_attempt_at IS NOT NULL AND next_attempt_at <= now())`
    : `status = 'queued'
            OR (status IN ('failed', 'sending') AND next_attempt_at IS NOT NULL AND next_attempt_at <= now())`
  const { rows } = await query(
    `UPDATE email_outbox
        SET status = 'sending', attempts = attempts + 1,
            next_attempt_at = now() + ($2::int * interval '1 second')
      WHERE id IN (
        SELECT id
          FROM email_outbox
         WHERE ${eligibility}
         ORDER BY created_at
         LIMIT $1
           FOR UPDATE SKIP LOCKED
      )
      RETURNING id, recipient_email, template, subject, payload, attempts`,
    [limit, CLAIM_LEASE_SECONDS],
  )
  return rows
}

async function finalizeMockedEmail(row) {
  const message = renderMockEmail(row)
  await query(
    `UPDATE email_outbox
        SET status = 'mocked', mock_message = $2::jsonb, processed_at = now(),
            next_attempt_at = NULL, last_error = NULL
      WHERE id = $1 AND status = 'sending' AND attempts = $3`,
    [row.id, JSON.stringify(message), row.attempts],
  )
}

// Envia por SMTP e finaliza.
//
// Duas guardas de concorrência: (a) antes de enviar, confirma que a linha
// ainda pertence a ESTA reivindicação (attempts) — se o lease venceu e outro
// worker reivindicou, este worker não envia nem finaliza, evitando entrega
// duplicada em lotes lentos; (b) as gravações finais também conferem
// `attempts`, impedindo que um worker antigo sobrescreva resultado de outro.
//
// Uma falha do banco ao gravar o sucesso NÃO é tratada como falha de entrega:
// a mensagem já pode ter sido aceita pelo servidor, e marcá-la como 'failed'
// provocaria reenvio de algo já entregue (duplicata) com estado falso. A
// exceção propaga e a linha volta a ser elegível pelo lease — o worker é
// at-least-once e esse residual é documentado na auditoria.
async function deliverSmtpEmail(row, config) {
  // Renova o lease com a mesma guarda de propriedade (`attempts`): se a linha
  // foi reivindicada por outro worker (lease vencido durante um lote lento),
  // a renovação não afeta nenhuma linha e este worker não envia; se ainda é
  // nossa, o lease passa a contar de agora, fechando a janela entre a
  // conferência e o envio e impedindo que lotes longos percam a posse.
  const renewed = await query(
    `UPDATE email_outbox
        SET next_attempt_at = now() + ($3::int * interval '1 second')
      WHERE id = $1 AND status = 'sending' AND attempts = $2`,
    [row.id, row.attempts, CLAIM_LEASE_SECONDS],
  )
  if (!renewed.rowCount) return

  const content = renderEmailContent(row)
  let deliveryError = null
  try {
    // A marca persistida continua protegendo e-mails demo após desligar a demo.
    if (row.payload?.transactionMode === 'demo' && !DEMO_SMTP_HOSTS.has(config.smtp.host)) {
      throw new Error('E-mail demonstrativo permite somente SMTP em IP de loopback.')
    }
    await sendSmtpEmail({
      ...config.smtp,
      from: config.from,
      to: content.to,
      subject: content.subject,
      text: content.text,
    })
  } catch (error) {
    deliveryError = error
  }

  if (!deliveryError) {
    await query(
      `UPDATE email_outbox
          SET status = 'sent', sent_at = now(), processed_at = now(),
              next_attempt_at = NULL, last_error = NULL
        WHERE id = $1 AND status = 'sending' AND attempts = $2`,
      [row.id, row.attempts],
    )
    return
  }

  const exhausted = row.attempts >= config.maxAttempts
  const nextAttemptAt = exhausted
    ? null
    : new Date(Date.now() + computeRetryDelayMinutes(row.attempts) * 60_000)
  await query(
    `UPDATE email_outbox
        SET status = 'failed', next_attempt_at = $2, last_error = $3
      WHERE id = $1 AND status = 'sending' AND attempts = $4`,
    [row.id, nextAttemptAt, truncateError(deliveryError), row.attempts],
  )
}

export async function dispatchEmailOutbox(limit = 50) {
  const config = resolveEmailConfig()
  const claimed = await claimOutboxRows(config, limit)
  for (const row of claimed) {
    if (config.mode === 'mock') await finalizeMockedEmail(row)
    else await deliverSmtpEmail(row, config)
  }
  return claimed.length
}

// Varredura com guarda de reentrância: o setInterval de 60 s não acumula
// varreduras sobrepostas no mesmo processo — lotes longos de SMTP não
// concorrem consigo mesmos (a proteção entre processos é o SKIP LOCKED).
let sweepRunning = false
export async function runEmailOutboxSweep() {
  if (sweepRunning) return 0
  sweepRunning = true
  try {
    return await dispatchEmailOutbox()
  } finally {
    sweepRunning = false
  }
}
