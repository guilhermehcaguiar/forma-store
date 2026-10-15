import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Button from '../../components/Button'
import EmptyState from '../../components/EmptyState'
import useAccountData from '../../context/useAccountData'
import { removeFavorite, removeListItem } from '../../services/account'
import { displayPrice, findProduct } from '../../services/products'

const productHint = 'Os dados da peça aparecerão aqui quando o catálogo estiver disponível.'

// Card de um produto salvo (favorito ou item de lista). Enquanto o catálogo
// do bloco de produtos não existe, o id resolvido como desconhecido é exibido
// como "Produto indisponível" — o mesmo estado aprovado da tela de produto.
function SavedProduct({ eyebrow, title, product, emptyDescription, onRemove, busy }) {
  return (
    <article className="card saved-item">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h3>{product ? product.name : title}</h3>
        <p>{product ? product.description || productHint : emptyDescription}</p>
        {displayPrice(product) ? <p>{displayPrice(product)}</p> : null}
      </div>
      <div className="account-form__actions">
        <Button type="button" size="small" variant="ghost" disabled={busy} onClick={onRemove}>Remover</Button>
      </div>
    </article>
  )
}

// Favoritos dentro de Minha Conta (dados chegam do layout da conta).
export function Favorites() {
  const { data, reload } = useOutletContext()
  return <FavoritesContent data={data} reload={reload} heading />
}

export function FavoritesPage() {
  const account = useAccountData()
  return (
    <section className="page favorites-page">
      <header className="page-header"><p className="eyebrow">Sua seleção</p><h1>Favoritos</h1><p className="page-header__subtitle">Guarde as peças que têm a sua cara.</p></header>
      {account.error ? <p className="form-alert" role="alert">{account.error}</p> : null}
      {account.loading ? <p className="page-header__subtitle">Carregando seus favoritos...</p> : <FavoritesContent data={account.data} reload={account.reload} />}
    </section>
  )
}

function FavoritesContent({ data, reload, heading = false }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const favorites = data.favorites.filter(Boolean)

  async function remove(productId) {
    setError('')
    setBusy(true)
    try {
      await removeFavorite(productId)
      await reload()
    } catch (removeError) {
      setError(removeError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {heading ? <div><h2>Favoritos</h2><p className="page-header__subtitle">Guarde as peças que têm a sua cara.</p></div> : null}
      {error && <p className="form-alert" role="alert">{error}</p>}
      {!favorites.length ? (
        <EmptyState title="Seus favoritos estão vazios" description="Quando houver peças no catálogo, você poderá salvar suas favoritas aqui." action={<Button to="/catalogo">Explorar peças</Button>} />
      ) : (
        favorites.map(productId => (
          <SavedProduct
            key={productId}
            eyebrow="Favorito salvo"
            title="Produto indisponível"
            product={findProduct(productId)}
            emptyDescription={productHint}
            busy={busy}
            onRemove={() => remove(productId)}
          />
        ))
      )}
    </>
  )
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

// Itens de uma lista de compras (RF20): consultar, remover; adicionar acontece
// na tela de produto quando o catálogo existir.
export function ListItems({ list, reload }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const items = list.productIds.filter(Boolean)

  async function remove(productId) {
    setError('')
    setBusy(true)
    try {
      await removeListItem(list.id, productId)
      await reload()
    } catch (removeError) {
      setError(removeError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {error && <p className="form-alert" role="alert">{error}</p>}
      {!items.length ? (
        <EmptyState title="Esta lista ainda está vazia" description="Quando houver peças disponíveis, elas poderão fazer parte das suas escolhas." action={<Button to="/catalogo">Explorar peças</Button>} />
      ) : (
        items.map(productId => (
          <SavedProduct
            key={productId}
            eyebrow="Peça na lista"
            title="Produto indisponível"
            product={findProduct(productId)}
            emptyDescription={productHint}
            busy={busy}
            onRemove={() => remove(productId)}
          />
        ))
      )}
    </>
  )
}
