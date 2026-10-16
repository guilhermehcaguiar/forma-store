import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/Button'
import FormField from '../../components/FormField'
import ProductImage from '../../components/ProductImage'
import { sizeOrder } from '../../services/products'
import { getAdminProduct, reaisToCentavos, saveAdminProduct } from '../../services/adminProducts'

export default function AdminProductEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [state, setState] = useState({ id: '', product: null, error: '' })
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!id) return undefined
    let active = true
    getAdminProduct(id).then(product => { if (active) setState({ id, product, error: '' }) })
      .catch(error => { if (active) setState({ id, product: null, error: error.message }) })
    return () => { active = false }
  }, [id])
  function saved(product) {
    setNotice('Produto salvo. A vitrine já utiliza os dados atualizados.')
    setState({ id: product.id, product, error: '' })
    if (!id) navigate(`/administracao/produtos/${product.id}/editar`, { replace: true, state: { notice: 'Produto criado com sucesso.' } })
  }
  return <section className="admin-editor">
    <header className="page-header"><p className="eyebrow">Catálogo FORMA</p><h1>{id ? 'Editar produto' : 'Novo produto'}</h1><p className="page-header__subtitle">Cada peça tem uma cor e uma grade de tamanhos com estoque próprio.</p></header>
    <Button to="/administracao/produtos" variant="ghost">← Voltar aos produtos</Button>
    {notice || location.state?.notice ? <p className="form-success" role="status">{notice || location.state.notice}</p> : null}
    {id && state.id !== id ? <p role="status">Carregando produto...</p> : state.error ? <p className="form-alert" role="alert">{state.error}</p> : <ProductForm key={id && state.product ? `${state.product.id}:${state.product.admin_version}` : 'new'} product={id ? state.product : null} onSaved={saved} />}
  </section>
}

function ProductForm({ product, onSaved }) {
  const [draft, setDraft] = useState(() => ({
    name: product?.name ?? '', description: product?.description ?? '', color: product?.color ?? '',
    is_printed: product?.is_printed ?? false, is_active: product?.is_active ?? true,
    price: product ? (product.price_cents / 100).toFixed(2) : '',
    promo: product?.promo_price_cents != null ? (product.promo_price_cents / 100).toFixed(2) : '',
    weight_g: product?.weight_g ?? 250, length_cm: product?.length_cm ?? 30, width_cm: product?.width_cm ?? 25, height_cm: product?.height_cm ?? 3,
    sizes: Object.fromEntries(sizeOrder.map(size => { const entry = product?.sizes.find(s => s.size === size); return [size, { enabled: entry?.is_active ?? !product, stock: entry?.stock ?? 0, revision: entry?.revision ?? null, reserved: entry?.reserved ?? 0 }] })),
  }))
  const [kept, setKept] = useState(product?.images ?? [])
  const [files, setFiles] = useState([])
  const [main, setMain] = useState(product?.images.find(i => i.main)?.id ?? product?.images[0]?.id ?? '')
  const [error, setError] = useState('')
  const [fields, setFields] = useState({})
  const [busy, setBusy] = useState(false)
  useEffect(() => () => { files.forEach(entry => URL.revokeObjectURL(entry.preview)) }, [files])
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  function removeImage(id) {
    const next = kept.filter(image => image.id !== id)
    setKept(next)
    if (main === id) setMain(next[0]?.id ?? (files.length ? 'new:0' : ''))
  }
  function chooseFiles(event) {
    const selected = Array.from(event.target.files ?? [])
    if (selected.length + kept.length > 5 || selected.some(file => file.size > 5 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))) {
      setError('Use até cinco imagens no total, PNG/JPEG/WebP de até 5 MB cada.'); event.target.value = ''; return
    }
    setFiles(selected.map(file => ({ file, preview: URL.createObjectURL(file) })))
    if (!kept.some(image => image.id === main)) setMain(selected.length ? 'new:0' : kept[0]?.id ?? '')
  }
  async function submit(event) {
    event.preventDefault()
    setError(''); setFields({}); setBusy(true)
    try {
      const data = new FormData()
      for (const key of ['name', 'description', 'color', 'is_printed', 'is_active', 'weight_g', 'length_cm', 'width_cm', 'height_cm']) data.append(key, draft[key])
      data.append('price_cents', reaisToCentavos(draft.price))
      data.append('promo_price_cents', draft.promo.trim() ? reaisToCentavos(draft.promo) : '')
      if (product) data.append('version', product.admin_version)
      data.append('sizes', JSON.stringify(Object.entries(draft.sizes).filter(([, variant]) => variant.enabled).map(([size, variant]) => ({ size, stock: variant.stock, expected_revision: variant.revision }))))
      data.append('retained_images', JSON.stringify(kept.map(image => image.id)))
      data.append('main_image', main)
      files.forEach(entry => data.append('images', entry.file))
      onSaved(await saveAdminProduct(product?.id, data))
    } catch (failure) {
      setError(failure.message)
      setFields(failure.fields ?? {})
    } finally { setBusy(false) }
  }
  return <form className="card admin-form" onSubmit={submit}>
    {error ? <p className="form-alert" role="alert">{error}</p> : null}
    {Object.keys(fields).length ? <ul className="form-alert">{Object.entries(fields).map(([key, message]) => <li key={key}>{message}</li>)}</ul> : null}
    <fieldset disabled={busy} className="admin-form__fields"><legend>Informações da peça</legend>
      <FormField id="admin-name" label="Nome" required maxLength={255} value={draft.name} onChange={e => set('name', e.target.value)} />
      <label className="catalog-field" htmlFor="admin-description">Descrição<textarea id="admin-description" maxLength={10000} value={draft.description} onChange={e => set('description', e.target.value)} /></label>
      <FormField id="admin-color" label="Cor" hint="Uma cor por produto, conforme o catálogo atual." required maxLength={50} value={draft.color} onChange={e => set('color', e.target.value)} />
      <label className="checkbox"><input id="admin-printed" type="checkbox" checked={draft.is_printed} onChange={e => set('is_printed', e.target.checked)} /><span>Peça estampada</span></label>
      <label className="checkbox"><input id="admin-active" type="checkbox" checked={draft.is_active} onChange={e => set('is_active', e.target.checked)} /><span>Produto ativo na vitrine</span></label>
      <div className="form-grid"><FormField id="admin-price" label="Preço normal (R$)" required inputMode="decimal" placeholder="119,90" value={draft.price} onChange={e => set('price', e.target.value)} /><FormField id="admin-promo" label="Preço promocional (R$)" hint="Deixe vazio para remover a promoção." inputMode="decimal" value={draft.promo} onChange={e => set('promo', e.target.value)} /></div>
      <fieldset className="admin-stock-grid"><legend>Tamanhos e estoque disponível</legend>{sizeOrder.map(size => <div key={size}><label className="checkbox"><input id={`admin-size-${size}`} type="checkbox" checked={draft.sizes[size].enabled} onChange={e => set('sizes', { ...draft.sizes, [size]: { ...draft.sizes[size], enabled: e.target.checked } })} /><span>{size}</span></label><FormField id={`admin-stock-${size}`} label={`Estoque ${size}`} type="number" min="0" max="2147483647" step="1" required={draft.sizes[size].enabled} disabled={!draft.sizes[size].enabled} value={draft.sizes[size].stock} onChange={e => set('sizes', { ...draft.sizes, [size]: { ...draft.sizes[size], stock: e.target.value } })} /><small>{draft.sizes[size].reserved} unidade(s) reservada(s)</small></div>)}</fieldset>
      <p className="field__hint">Reservas já estão descontadas do estoque disponível. Desmarcar um tamanho retira-o da vitrine e preserva seu registro e estoque histórico. Reservas pendentes protegem preços, cor, entrega, status e tamanhos reservados.</p>
      <fieldset className="admin-form__fields"><legend>Peso e embalagem para frete</legend><div className="form-grid">{[['weight_g', 'Peso (g)'], ['length_cm', 'Comprimento (cm)'], ['width_cm', 'Largura (cm)'], ['height_cm', 'Altura (cm)']].map(([key, label]) => <FormField key={key} id={`admin-${key}`} label={label} type="number" min="1" max="2147483647" required value={draft[key]} onChange={e => set(key, e.target.value)} />)}</div></fieldset>
      <fieldset className="admin-form__fields"><legend>Imagens e imagem principal</legend><p>Até cinco imagens. Novos arquivos: PNG, JPEG ou WebP, até 5 MB. Arquivos antigos usados por pedidos são preservados.</p><div className="admin-image-grid">{kept.map(image => <article key={image.id}><ProductImage product={product} image={image} /><label><input type="radio" name="main-image" checked={main === image.id} onChange={() => setMain(image.id)} /> Principal</label><Button type="button" variant="ghost" onClick={() => removeImage(image.id)}>Remover imagem</Button></article>)}{files.map((entry, index) => <article key={entry.preview}><img src={entry.preview} alt={`Prévia da nova imagem ${index + 1}`} /><label><input type="radio" name="main-image" checked={main === `new:${index}`} onChange={() => setMain(`new:${index}`)} /> Principal</label></article>)}</div><FormField id="admin-images" label="Adicionar imagens" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={chooseFiles} /></fieldset>
      <div className="account-form__actions"><Button type="submit" disabled={busy}>{busy ? 'Salvando...' : product ? 'Salvar alterações' : 'Cadastrar produto'}</Button><Button to="/administracao/produtos" variant="ghost">Voltar à lista</Button></div>
    </fieldset>
    {error && product ? <Button type="button" variant="ghost" onClick={() => window.location.reload()}>Reabrir dados atuais do produto</Button> : null}
  </form>
}
