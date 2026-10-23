import { WebhookSignatureValidator } from 'mercadopago'
import { badRequest, HttpError } from '../../utils/httpError.js'
import { toCentavos } from '../../utils/money.js'
import { isConfiguredCredential } from '../../utils/credentials.js'

const PAYMENT_STATUS = new Map([
  ['pending', 'pendente'],
  ['in_process', 'em_processamento'],
  ['approved', 'aprovada'],
  ['rejected', 'recusada'],
  ['cancelled', 'cancelada'],
  ['refunded', 'reembolsada'],
  ['charged_back', 'revisao_manual'],
  ['in_mediation', 'revisao_manual'],
])

export async function assertDemoTestSeller(token, fetchUser) {
  if (typeof token !== 'string') throw new HttpError(503, 'credencial_teste_invalida', 'Use credenciais de teste do Mercado Pago.')
  if (token.startsWith('TEST-')) return
  if (!token.startsWith('APP_USR-')) throw new HttpError(503, 'credencial_teste_invalida', 'Use credenciais de teste do Mercado Pago.')
  let user
  try { user = await fetchUser() } catch { throw new HttpError(503, 'conta_teste_nao_verificada', 'Não foi possível verificar o vendedor de teste do Mercado Pago.') }
  if (!Array.isArray(user?.tags) || !user.tags.includes('test_user')) throw new HttpError(503, 'vendedor_nao_demonstrativo', 'A demonstração aceita somente credenciais de teste ou uma conta vendedora de teste do Mercado Pago.')
}

export function selectTestCheckoutUrl(preference, testSeller = false) {
  const value = testSeller ? preference.init_point : preference.sandbox_init_point
  let url
  try { url = new URL(value) } catch { throw new HttpError(502, 'preferencia_teste_invalida', 'Mercado Pago não retornou um endereço de teste válido.') }
  const hosts = new Set(['sandbox.mercadopago.com.br', 'sandbox.mercadopago.com'])
  if (testSeller) { hosts.add('www.mercadopago.com.br'); hosts.add('www.mercadopago.com') }
  if (url.protocol !== 'https:' || url.username || url.password || !hosts.has(url.hostname)) {
    throw new HttpError(502, 'preferencia_teste_invalida', 'Mercado Pago não retornou um endereço de teste válido.')
  }
  return url.href
}

export function verifyPaymentWebhookSignature({ signature, requestId, dataId, secret, now }) {
  if (!isConfiguredCredential(secret)) throw new HttpError(503, 'webhook_nao_configurado', 'Configure o segredo de assinatura do webhook do Mercado Pago.')
  if (!signature || !requestId || !dataId) {
    throw badRequest('webhook_invalido', 'Notificação de pagamento sem assinatura ou identificadores necessários.')
  }

  try {
    WebhookSignatureValidator.validate({
      xSignature: signature,
      xRequestId: requestId,
      dataId: String(dataId).toLowerCase(),
      secret,
      toleranceSeconds: 300,
      ...(now ? { now } : {}),
    })
  } catch {
    throw new HttpError(401, 'webhook_assinatura_invalida', 'Assinatura da notificação do Mercado Pago inválida ou expirada.')
  }
}

export function validateGatewayPayment(payment, expected) {
  let amountCentavos
  try {
    amountCentavos = toCentavos(Number(payment.transaction_amount), 'pagamento')
  } catch {
    throw badRequest('pagamento_inconsistente', 'O valor confirmado pelo gateway é inválido.')
  }

    if (String(payment.id) !== String(expected.paymentId) ||
      String(payment.external_reference) !== String(expected.orderId) ||
      (payment.preference_id != null && String(payment.preference_id) !== String(expected.preferenceId)) ||
      payment.currency_id !== 'BRL' ||
      payment.live_mode !== false ||
      amountCentavos !== expected.amountCentavos) {
    throw badRequest('pagamento_inconsistente', 'O pagamento do gateway não corresponde ao pedido, valor ou ambiente de teste.')
  }

  const status = PAYMENT_STATUS.get(payment.status)
  if (!status) throw badRequest('status_pagamento_desconhecido', 'O gateway retornou um status de pagamento não reconhecido.')

  return {
    paymentId: String(payment.id),
    status,
    providerStatus: payment.status,
    statusDetail: payment.status_detail ?? null,
    amountCentavos,
  }
}
