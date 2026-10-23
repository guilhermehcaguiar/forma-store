import { useCallback, useEffect, useState } from 'react'
import { listAddresses, listFavorites, listLists } from '../services/account'
import { api } from '../services/api'

const emptyAccount = { addresses: [], lists: [], favorites: [], orders: [] }

// Carrega endereços, listas e favoritos da API (conta autenticada) e expõe
// `reload` para as telas atualizarem após salvar ou remover. Erros aparecem
// no alerta do layout da conta, como antes com os dados locais.
export default function useAccountData() {
  const [state, setState] = useState({ data: emptyAccount, error: '', loading: true })

  const reload = useCallback(
    () =>
      Promise.all([listAddresses(), listLists(), listFavorites(), api.get('/conta/pedidos')])
        .then(([addresses, lists, favorites, { orders }]) =>
          setState({ data: { addresses, lists, favorites, orders }, error: '', loading: false }))
        .catch(error =>
          setState({
            data: emptyAccount,
            error: error.message || 'Não foi possível carregar seus dados.',
            loading: false,
          })),
    [],
  )

  useEffect(() => {
    reload()
  }, [reload])

  return { ...state, reload }
}
