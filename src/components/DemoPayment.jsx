import { useState } from 'react'
import Button from './Button'
import { api } from '../services/api'

export const DEMO_NOTICE = 'DEMONSTRAÇÃO — sem cobrança ou envio real'

export function DemoNotice() {
  return <p className="checkout-note" role="note"><strong>{DEMO_NOTICE}</strong></p>
}

export default function DemoPayment({ order, onPaid }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function pay() {
    setBusy(true)
    setError('')
    try {
      // Nenhum valor, status ou identificador de provedor vem do navegador.
      await api.post(`/demonstracao/pedidos/${order.id}/pagar`, {})
      await onPaid()
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }
  return <section className="card order-detail__payment">
    <DemoNotice />
    <p>Pagamento demonstrativo local. Nenhum cartão é solicitado. A aprovação
      simulada mantém o pedido, a reserva de estoque e o recibo no ambiente local.</p>
    {!order.demoPaymentAvailable && <p>Este pedido usa aprovação local simulada. Para concluí-lo, ative a demonstração com provedor forma_demo. Para pagar pelo Mercado Pago, inicie uma nova compra no modo sandbox.</p>}
    <Button type="button" disabled={busy || !order.demoPaymentAvailable} onClick={pay}>
      {busy ? 'Confirmando demonstração...' : 'Confirmar pagamento demonstrativo'}
    </Button>
    {error && <p className="form-alert" role="alert">{error}</p>}
  </section>
}
