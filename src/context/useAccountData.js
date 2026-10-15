import { useCallback, useEffect, useState } from 'react'
import { listAddresses, listLists } from '../services/account'

const emptyAccount = { addresses: [], lists: [] }

// Carrega endereços e listas da API (conta autenticada) e expõe `reload`
// para as telas atualizarem após salvar ou remover. Erros aparecem no alerta
// do layout da conta, como antes com os dados locais.
export default function useAccountData() {
  const [state, setState] = useState({ data: emptyAccount, error: '', loading: true })

  const reload = useCallback(
    () =>
      Promise.all([listAddresses(), listLists()])
        .then(([addresses, lists]) => setState({ data: { addresses, lists }, error: '', loading: false }))
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
