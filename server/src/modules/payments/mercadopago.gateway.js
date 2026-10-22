import { MercadoPagoConfig, Payment, Preference, Customer, CustomerCard, CardToken } from 'mercadopago'
import { HttpError } from '../../utils/httpError.js'
import { isConfiguredCredential, safeHttpUrl, mercadoPagoPublicKey } from '../../utils/credentials.js'

function getClients() {
  if (process.env.MERCADOPAGO_MODE !== 'sandbox' || !isConfiguredCredential(process.env.MERCADOPAGO_TEST_ACCESS_TOKEN)) {
    throw new HttpError(503, 'mercado_pago_nao_configurado', 'Configure um Access Token de teste do Mercado Pago e mantenha MERCADOPAGO_MODE=sandbox.')
  }
  const config = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_TEST_ACCESS_TOKEN,
    options: { timeout: 15000, maxRetries: 1 },
  })
  return { preferences: new Preference(config), payments: new Payment(config), customers: new Customer(config), cards: new CustomerCard(config), tokens: new CardToken(config) }
}

// A mesma disponibilidade governa API de carteira e início da cobrança direta.
// Nunca devolve segredo, token privado ou valor incorreto de configuração.
export function resolveSavedCardConfig({ optional = false } = {}) {
  let code, message
  const callback = safeHttpUrl(process.env.MERCADOPAGO_PUBLIC_URL, { externalHttps: true })
  const publicKey = mercadoPagoPublicKey()
  if (process.env.MERCADOPAGO_MODE !== 'sandbox' || !isConfiguredCredential(process.env.MERCADOPAGO_TEST_ACCESS_TOKEN) || !publicKey) {
    code = 'mercado_pago_nao_configurado'
    message = 'Configure Access Token e Public Key de teste do Mercado Pago no servidor e mantenha sandbox.'
  } else if (!callback) {
    code = 'mercado_pago_callback_nao_configurado'
    message = 'Configure MERCADOPAGO_PUBLIC_URL com o túnel HTTPS público da API, sem credenciais, query ou fragmento.'
  } else if (!isConfiguredCredential(process.env.MERCADOPAGO_WEBHOOK_SECRET)) {
    code = 'webhook_nao_configurado'
    message = 'Configure MERCADOPAGO_WEBHOOK_SECRET com a assinatura do webhook de pagamentos de teste no servidor.'
  }
  if (code) { if (optional) return null; throw new HttpError(503, code, message) }
  return { publicKey, notificationUrl: new URL('/api/pagamentos/webhook', callback).href }
}

// Erros do SDK podem conter o corpo da requisição: nunca propagar/logar esse objeto.
async function safeCardCall(operation) {
  try { return await operation(getClients()) } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(503, 'cartao_gateway_indisponivel', 'Não foi possível concluir a operação de cartão no Mercado Pago. Consulte o pedido antes de tentar novamente.')
  }
}

export const cardGateway = {
  createCustomer: (user) => safeCardCall(c => c.customers.create({ body: { email: user.email, first_name: user.name }, requestOptions: { idempotencyKey: `forma-customer-${user.id}` } })),
  addCard: (customerId, token) => safeCardCall(c => c.cards.create({ customerId, body: { token } })),
  removeCard: (customerId, cardId) => safeCardCall(c => c.cards.remove({ customerId, cardId })),
  getToken: (id) => safeCardCall(c => c.tokens.get({ id })),
  pay: (body, key) => safeCardCall(c => c.payments.create({ body, requestOptions: { idempotencyKey: key, maxRetries: 0 } })),
}

export async function createSandboxPreference(order) {
  const clients = getClients()
  const publicUrl = process.env.MERCADOPAGO_PUBLIC_URL
  if (!publicUrl || !/^https:\/\//i.test(publicUrl)) {
    throw new HttpError(503, 'mercado_pago_callback_nao_configurado', 'Configure uma URL HTTPS temporária em MERCADOPAGO_PUBLIC_URL para retorno e webhook.')
  }

  const callbackUrl = safeHttpUrl(publicUrl, { externalHttps: true })
  if (!callbackUrl) throw new HttpError(503, 'mercado_pago_callback_nao_configurado', 'MERCADOPAGO_PUBLIC_URL deve ser HTTPS pública, sem credenciais, query ou fragmento.')
  callbackUrl.pathname = `${callbackUrl.pathname.replace(/\/$/, '')}/api/pagamentos/retorno`
  callbackUrl.search = new URLSearchParams({ order_id: order.id }).toString()
  const webhookUrl = new URL('/api/pagamentos/webhook', publicUrl)

  try {
    const preference = await clients.preferences.create({
      body: {
        items: [{
          id: order.id,
          title: `Pedido FORMA ${order.id}`,
          description: 'Pedido de camisas oversized FORMA',
          quantity: 1,
          currency_id: 'BRL',
          unit_price: order.totalCentavos / 100,
        }],
        external_reference: order.id,
        metadata: { forma_order_id: order.id },
        back_urls: {
          success: callbackUrl.toString(),
          pending: callbackUrl.toString(),
          failure: callbackUrl.toString(),
        },
        auto_return: 'approved',
        notification_url: webhookUrl.toString(),
        expires: true,
        expiration_date_from: new Date(order.createdAt).toISOString(),
        expiration_date_to: order.paymentDeadlineAt,
        statement_descriptor: 'FORMA',
      },
      requestOptions: { idempotencyKey: `forma-order-${order.id}` },
    })

    if (!preference.id || !preference.sandbox_init_point || preference.external_reference !== order.id) {
      throw new HttpError(502, 'preferencia_teste_invalida', 'Mercado Pago não retornou uma preferência válida de teste.')
    }
    return {
      preferenceId: preference.id,
      sandboxCheckoutUrl: preference.sandbox_init_point,
      liveMode: false,
    }
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(503, 'mercado_pago_indisponivel', 'Não foi possível criar o checkout de teste no Mercado Pago.')
  }
}

export async function fetchMercadoPagoPayment(paymentId) {
  const { payments } = getClients()
  try {
    return await payments.get({ id: paymentId, requestOptions: { timeout: 9000, maxRetries: 0 } })
  } catch {
    throw new HttpError(503, 'mercado_pago_indisponivel', 'Não foi possível consultar o pagamento no Mercado Pago.')
  }
}
