import { useState } from 'react';
import api from '../../services/api';

export default function AdminProducts() {
  const [form, setForm] = useState({
    name: '', description: '', color: 'preta', is_printed: false,
    price_cents: '', promo_price_cents: '', weight_g: '450',
    length_cm: '30', width_cm: '20', height_cm: '5',
    sizes: { P: '0', M: '0', G: '0', GG: '0' },
  });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const data = new FormData();
    
    Object.entries(form).filter(([key]) => key !== 'sizes').forEach(([key, value]) => data.append(key, value));
    data.append('sizes', JSON.stringify(Object.entries(form.sizes).map(([size, stock]) => ({ size, stock: Number(stock) }))));
    Array.from(images).forEach(file => data.append('images', file));

    try {
      await api.post('/admin/produtos', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Produto cadastrado com sucesso!');
    } catch {
      alert('Erro ao cadastrar. Verifique se você é um administrador.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-page">
      <h2>Painel Administrativo - Novo Produto</h2>
      <form onSubmit={handleSubmit} className="admin-form">
        <input type="text" placeholder="Nome da Camisa" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
        <textarea placeholder="Descrição" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        <input type="text" placeholder="Cor (ex: preta)" value={form.color} onChange={e => setForm({...form, color: e.target.value})} required />
        <input type="number" placeholder="Preço em centavos (ex: 4990)" value={form.price_cents} onChange={e => setForm({...form, price_cents: e.target.value})} required />
        <input type="number" placeholder="Peso em gramas (ex: 450)" value={form.weight_g} onChange={e => setForm({...form, weight_g: e.target.value})} required />
        <input type="number" placeholder="Comprimento (cm)" value={form.length_cm} onChange={e => setForm({...form, length_cm: e.target.value})} min="1" required />
        <input type="number" placeholder="Largura (cm)" value={form.width_cm} onChange={e => setForm({...form, width_cm: e.target.value})} min="1" required />
        <input type="number" placeholder="Altura (cm)" value={form.height_cm} onChange={e => setForm({...form, height_cm: e.target.value})} min="1" required />

        <fieldset className="admin-stock-grid"><legend>Estoque por tamanho</legend>
          {Object.entries(form.sizes).map(([size, stock]) => <label key={size}>{size}
            <input type="number" min="0" step="1" value={stock} onChange={e => setForm({ ...form, sizes: { ...form.sizes, [size]: e.target.value } })} />
          </label>)}
        </fieldset>
        
        <label>Imagens do Produto:</label>
        <input type="file" multiple accept="image/*" onChange={e => setImages(e.target.files)} />

        <button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Cadastrar Produto'}</button>
      </form>
    </div>
  );
}