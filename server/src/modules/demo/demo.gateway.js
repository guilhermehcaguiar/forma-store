import { DEMO_NOTICE } from './demo.config.js'

// Fixtures locais explícitas. Não imitam IDs/respostas do Mercado Pago.
export function demoShippingServices() {
  return [{ id: 'forma-demo', name: DEMO_NOTICE, company: 'Frete demonstrativo local',
    priceCentavos: 1000, deliveryDays: 3 }]
}

export function demoPaymentResult(attemptId) {
  return { paymentId: `demo:${attemptId}`, status: 'aprovada',
    providerStatus: 'demo_approved', statusDetail: DEMO_NOTICE }
}
