import { useCallback, useEffect, useState } from 'react'
import { listAddresses, listFavorites, listLists } from '../services/account'

const emptyAccount = { addresses: [], lists: [], favorites: [] }

// Carrega endereços, listas e favoritos da API (conta autenticada) e expõe
// `reload` para as telas atualizarem após salvar ou remover. Erros aparecem
// no alerta do layout da conta, como antes com os dados locais.
export default function useAccountData() {
  const [state, setState] = useState({ data: emptyAccount, error: '', loading: true })

  const reload = useCallback(
    () =>
      Promise.all([listAddresses(), listLists(), listFavorites()])
        .then(([addresses, lists, favorites]) =>
          setState({ data: { addresses, lists, favorites }, error: '', loading: false }))
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
