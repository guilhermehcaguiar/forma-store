import Button from '../../components/Button'
import EmptyState from '../../components/EmptyState'

export function Favorites() {
  return <><div><h2>Favoritos</h2><p className="page-header__subtitle">Guarde as peças que têm a sua cara.</p></div><EmptyState title="Seus favoritos estão vazios" description="Quando houver peças no catálogo, você poderá salvar suas favoritas aqui." action={<Button to="/catalogo">Explorar peças</Button>} /></>
}

export function FavoritesPage() {
  return <section className="page favorites-page"><header className="page-header"><p className="eyebrow">Sua seleção</p><h1>Favoritos</h1><p className="page-header__subtitle">Guarde as peças que têm a sua cara.</p></header><EmptyState title="Seus favoritos estão vazios" description="Quando houver peças no catálogo, você poderá salvar suas favoritas aqui." action={<Button to="/catalogo">Explorar peças</Button>} /></section>
}

export function Orders() {
  return <><div><h2>Meus pedidos</h2><p className="page-header__subtitle">Acompanhe suas compras em um só lugar.</p></div><EmptyState title="Você ainda não fez um pedido" description="Após uma compra, os itens e o andamento da entrega aparecerão aqui." action={<Button to="/catalogo">Explorar peças</Button>} /></>
}

export function OrderDetail() {
  return <EmptyState title="Pedido não encontrado" description="Não há um pedido disponível para este endereço." action={<Button to="/minha-conta/pedidos">Voltar para meus pedidos</Button>} />
}

export function Cards() {
  return <><div><h2>Cartões salvos</h2><p className="page-header__subtitle">Suas formas de pagamento.</p></div><EmptyState title="Nenhum cartão salvo" description="O cadastro de cartões ficará disponível quando o pagamento estiver habilitado." action={<Button to="/minha-conta">Voltar para a visão geral</Button>} /></>
}
