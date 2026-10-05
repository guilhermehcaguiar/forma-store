import { useEffect, useState } from 'react'
import { accountKey, readAccount } from '../services/account'

function load(userId) {
  try { return { data: readAccount(userId), error: '' } }
  catch (error) { return { data: { addresses: [], lists: [] }, error: error.message } }
}

export default function useAccountData(userId) {
  const [state, setState] = useState(() => load(userId))
  useEffect(() => {
    const refresh = event => {
      if (event.key === accountKey(userId) || event.key === null) setState(load(userId))
    }
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [userId])
  return { ...state, setData: data => setState({ data, error: '' }) }
}
