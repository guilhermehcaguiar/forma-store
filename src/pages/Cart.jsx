import { useState } from 'react';
import api from '../services/api';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';

const emptyIcon = (
  <svg
    viewBox="0 0 24 24"
    width="40"
    height="40"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 6h15l-1.5 9h-12L6 6z" />
    <path d="M6 6L5 3H2" />
    <circle cx="9" cy="20" r="1" />
    <circle cx="18" cy="20" r="1" />
  </svg>
);

export default function Cart() {
  const [cartItems, setCartItems] = useState([
    { id: '1', name: 'Camisa Oversized Teste', price_cents: 7990, quantity: 1, color: 'preta' }
  ]);

  const [couponCode, setCouponCode] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [couponMessage, setCouponMessage] = useState('');
  const [loadingCoupon, setLoadingCoupon] = useState(false);

  const formatPrice = (cents) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;

  const subtotalCents = cartItems.reduce((acc, item) => acc + (item.price_cents * item.quantity), 0);
  const discountCents = Math.round((subtotalCents * discountPercentage) / 100);
  const totalCents = subtotalCents - discountCents;

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    setLoadingCoupon(true);
    setCouponMessage('');

    try {
      const { data } = await api.post('/cart/cupom', { code: couponCode });
      setDiscountPercentage(data.discountPercentage);
      setCouponMessage(`Cupom de ${data.discountPercentage}% aplicado com sucesso!`);
    } catch (error) {
      setDiscountPercentage(0);
      setCouponMessage('Cupom inválido ou expirado.');
    } finally {
      setLoadingCoupon(false);
    }
  };

  return (
    <section className="page cart-page">
      <header className="page-header">
        <p className="eyebrow">Sua seleção</p>
        <h1>Seu carrinho</h1>
        <p className="page-header__subtitle">
          Gerencie os itens escolhidos e aplique seus cupons de desconto.
        </p>
      </header>

      <div className="cart-layout">
        {cartItems.length === 0 ? (
          <div>
            <EmptyState
              icon={emptyIcon}
              title="Seu carrinho está vazio"
              description="Explore o catálogo e adicione as peças que você gostar."
              action={<Button to="/catalogo">Ir para o catálogo</Button>}
            />
            <Button to="/catalogo" variant="ghost">← Continuar comprando</Button>
          </div>
        ) : (
          <div className="cart-items-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {cartItems.map((item) => (
              <div key={item.id} className="cart-item-card card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4>{item.name}</h4>
                  <p>Cor: {item.color}</p>
                  <p className="item-price" style={{ fontWeight: 'bold', marginTop: '4px' }}>{formatPrice(item.price_cents)}</p>
                </div>
                <div>
                  <span>Qtd: {item.quantity}</span>
                </div>
              </div>
            ))}
            <Button to="/catalogo" variant="ghost">← Continuar comprando</Button>
          </div>
        )}

        <aside className="cart-summary card">
          <h2>Resumo do pedido</h2>
          
          <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 0' }}>
            <span>Subtotal</span>
            <span>{formatPrice(subtotalCents)}</span>
          </div>

          {discountPercentage > 0 && (
            <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 0', color: '#2E7D32', fontWeight: 'bold' }}>
              <span>Desconto ({discountPercentage}%)</span>
              <span>- {formatPrice(discountCents)}</span>
            </div>
          )}

          <div className="summary-row total" style={{ display: 'flex', justifyContent: 'space-between', margin: '16px 0', fontWeight: 'bold', fontSize: '18px', borderTop: '1px solid #eee', paddingTop: '12px' }}>
            <span>Total</span>
            <span>{formatPrice(totalCents)}</span>
          </div>

          <form onSubmit={handleApplyCoupon} style={{ margin: '16px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: '600' }}>Cupom de desconto</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                placeholder="Ex: FORMA10" 
                value={couponCode} 
                onChange={(e) => setCouponCode(e.target.value)}
                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc', textTransform: 'uppercase' }}
              />
              <button type="submit" disabled={loadingCoupon} style={{ padding: '8px 12px', background: '#102430', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                {loadingCoupon ? '...' : 'Aplicar'}
              </button>
            </div>
            {couponMessage && (
              <small style={{ color: discountPercentage > 0 ? '#2E7D32' : '#d32f2f' }}>{couponMessage}</small>
            )}
          </form>

          <div className="cart-summary__note">Insira seu cupom para garantir o desconto.</div>
          <Button to="/checkout" variant="ghost" style={{ width: '100%', marginTop: '12px', textAlign: 'center' }}>Ver etapas da compra →</Button>
        </aside>
      </div>
    </section>
  );
}