import { Link, useOutletContext } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { formatAddress } from '../../services/account'
import Button from '../../components/Button'

export default function Overview() {
  const { user } = useAuth()
  const { data } = useOutletContext()
  // Endereço principal é o explicitamente selecionado (RF05), não o primeiro.
  const address = data.addresses.find(item => item?.id && item.principal && item.street)
  const pad = value => String(value).padStart(2, '0')
  return (
    <>
      <div><h2>Olá, {user.name.split(' ')[0]}</h2><p className="page-header__subtitle">Aqui está um resumo da sua conta.</p></div>
      <div className="account-stats">
        {/* Pedidos seguem vazios até o bloco de pedidos (Lucas). */}
        {[['00', 'Pedidos', 'pedidos'], [pad(data.favorites.length), 'Favoritos', 'favoritos'], [pad(data.lists.filter(item => item?.id && item.name).length), 'Listas', 'listas']].map(([value, label, path]) => (
          <Link className="account-stat" key={path} to={`/minha-conta/${path}`}><strong>{value}</strong><span>{label}</span></Link>
        ))}
      </div>
      <div className="account-overview-grid">
        <section className="card overview-order"><p className="eyebrow">Pedido mais recente</p><h3>Nenhum pedido por enquanto</h3><p>Seus pedidos aparecerão aqui após uma compra.</p><Button to="/minha-conta/pedidos" variant="ghost" size="small">Ver pedidos →</Button></section>
        <section className="card overview-favorites"><h3>Meus favoritos</h3><p>Peças que têm a sua cara.</p><Button to="/minha-conta/favoritos" variant="ghost" size="small">Ver favoritos →</Button></section>
      </div>
      <section className="card overview-address"><div><h3>Endereço principal</h3><p>{address ? formatAddress(address) : 'Você ainda não tem um endereço principal salvo.'}</p></div><Button to="/minha-conta/enderecos" variant="ghost" size="small">{address ? 'Editar' : 'Adicionar'} →</Button></section>
    </>
  )
}
