import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import { addFavorite, addListItem, listFavorites, listLists, removeFavorite } from '../services/account'
import { displayPrice, findProduct } from '../services/products'

// Tela de produto conforme o contrato do catálogo (docs/forma/API_CONTRATOS.md).
// Enquanto o catálogo está vazio (bloco de produtos), qualquer endereço mostra
// o estado aprovado de indisponível — as ações de favorito e lista entram em
// cena quando houver peças com o id informado.
export default function Product() {
  const { id } = useParams()
  const product = id ? findProduct(id) : null

  if (!product) {
    return <UnavailableProduct />
  }
  return <AvailableProduct product={product} />
}

function UnavailableProduct() {
  return <section className="page product-page">
    <nav className="breadcrumb" aria-label="Localização"><Link to="/">Início</Link><span>/</span><Link to="/catalogo">Camisetas</Link><span>/</span><span>Produto</span></nav>
    <div className="product-layout">
      <EmptyState title="Nenhuma peça disponível" description="As imagens da peça aparecerão aqui quando ela estiver no catálogo." />
      <div className="product-info"><p className="eyebrow">Coleção FORMA</p><h1>Produto indisponível</h1><p>O catálogo está vazio. Ainda não há uma peça para exibir neste endereço.</p><section className="product-options"><h2>Cor e tamanho</h2><p>As opções e medidas serão informadas para cada peça disponível.</p><Button type="button" disabled>Adicionar ao carrinho →</Button></section><div className="checkout-note"><h2>Entrega</h2><p>As opções de entrega ficarão disponíveis em uma próxima etapa.</p></div><Button to="/catalogo" variant="ghost">← Voltar para o catálogo</Button></div>
    </div>
  </section>
}

function AvailableProduct({ product }) {
  const { user } = useAuth()
  const [lists, setLists] = useState([])
  const [listId, setListId] = useState('')
  const [saved, setSaved] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Sessão existente: carrega listas e estado atual de favoritos.
  useEffect(() => {
    if (!user) return
    let active = true
    listLists().then(all => { if (active) setLists(all) }).catch(() => {})
    listFavorites().then(ids => { if (active) setFavorited(ids.includes(product.id)) }).catch(() => {})
    return () => { active = false }
  }, [user, product.id])

  async function saveFavorite() {
    setError('')
    setBusy(true)
    try {
      if (favorited) {
        await removeFavorite(product.id)
        setFavorited(false)
      } else {
        await addFavorite(product.id)
        setFavorited(true)
      }
    } catch (favoriteError) {
      setError(favoriteError.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveToList(event) {
    event.preventDefault()
    setError('')
    if (!listId) {
      setError('Escolha uma lista para salvar a peça.')
      return
    }
    setBusy(true)
    try {
      await addListItem(listId, product.id)
      setSaved(true)
    } catch (listError) {
      setError(listError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="page product-page">
      <nav className="breadcrumb" aria-label="Localização"><Link to="/">Início</Link><span>/</span><Link to="/catalogo">Camisetas</Link><span>/</span><span>{product.name}</span></nav>
      <div className="product-layout">
        <EmptyState title={product.name} description={product.description || 'As imagens da peça aparecerão aqui quando ela estiver no catálogo.'} />
        <div className="product-info">
          <p className="eyebrow">Coleção FORMA</p>
          <h1>{product.name}</h1>
          {displayPrice(product) ? <p>{displayPrice(product)}</p> : null}
          <section className="product-options">
            <h2>Cor e tamanho</h2>
            <p>{product.color ? `Cor: ${product.color}.` : 'As opções e medidas serão informadas para cada peça disponível.'}</p>
            {user ? (
              <>
                {error ? <p className="form-alert" role="alert">{error}</p> : null}
                {saved ? <p className="form-success" role="status">Peça salva na lista.</p> : null}
                <Button type="button" variant={favorited ? 'primary' : 'ghost'} disabled={busy} onClick={saveFavorite}>
                  {favorited ? 'Salva nos favoritos ♥' : 'Salvar nos favoritos ♥'}
                </Button>
                {lists.length ? (
                  <form onSubmit={saveToList}>
                    <label htmlFor="product-list">Salvar em uma lista</label>
                    <select id="product-list" value={listId} onChange={event => setListId(event.target.value)}>
                      <option value="">Escolha uma lista</option>
                      {lists.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}
                    </select>
                    <Button type="submit" disabled={busy}>Salvar na lista</Button>
                  </form>
                ) : (
                  <p className="field__hint">Crie uma lista em Minha Conta para organizar suas escolhas.</p>
                )}
              </>
            ) : (
              <p className="field__hint">Entre na sua conta para salvar esta peça nos favoritos ou em uma lista.</p>
            )}
            <Button type="button" disabled>Adicionar ao carrinho →</Button>
          </section>
          <div className="checkout-note"><h2>Entrega</h2><p>As opções de entrega ficarão disponíveis em uma próxima etapa.</p></div>
          <Button to="/catalogo" variant="ghost">← Voltar para o catálogo</Button>
        </div>
      </div>
    </section>
  )
}
