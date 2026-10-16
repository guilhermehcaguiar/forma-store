import { MercadoPagoConfig, Payment, Preference } from 'mercadopago'
import { HttpError } from '../../utils/httpError.js'

function getClients() {
  if (process.env.MERCADOPAGO_MODE !== 'sandbox' || !process.env.MERCADOPAGO_TEST_ACCESS_TOKEN) {
    throw new HttpError(503, 'mercado_pago_nao_configurado', 'Configure um Access Token de teste do Mercado Pago e mantenha MERCADOPAGO_MODE=sandbox.')
  }
  const config = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_TEST_ACCESS_TOKEN,
    options: { timeout: 15000, maxRetries: 1 },
  })
  return { preferences: new Preference(config), payments: new Payment(config) }
}

export async function createSandboxPreference(order) {
  const clients = getClients()
  const publicUrl = process.env.MERCADOPAGO_PUBLIC_URL
  if (!publicUrl || !/^https:\/\//i.test(publicUrl)) {
    throw new HttpError(503, 'mercado_pago_callback_nao_configurado', 'Configure uma URL HTTPS temporária em MERCADOPAGO_PUBLIC_URL para retorno e webhook.')
  }

  let callbackUrl
  try {
    callbackUrl = new URL(publicUrl)
    if (callbackUrl.hostname === 'localhost' || callbackUrl.hostname === '127.0.0.1') throw new Error('local callback')
  } catch {
    throw new HttpError(503, 'mercado_pago_callback_nao_configurado', 'MERCADOPAGO_PUBLIC_URL deve ser a URL HTTPS pública do túnel temporário.')
  }
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
