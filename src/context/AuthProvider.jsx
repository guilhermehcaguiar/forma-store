import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './authContext'
import {
  fetchCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  updateUserProfile,
} from '../services/auth'

const TOKEN_KEY = 'forma:apiToken'

function AuthProvider({ children }) {
  // `ready` indica que a sessão já foi validada no servidor; enquanto isso,
  // as rotas protegidas mostram um estado de verificação em vez de expulsar
  // o usuário com uma sessão ainda válida.
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  // Na abertura do app, valida a sessão guardada no servidor (GET /auth/eu).
  // Só existe sessão se a API confirmar o token: nada é confiado ao
  // armazenamento local além do token opaco.
  useEffect(() => {
    let active = true
    fetchCurrentUser()
      .then((restored) => {
        if (active) setUser(restored)
      })
      .catch(() => {
        // API desligada: segue como visitante; as telas de conta avisam ao
        // tentar carregar dados. Nova validação ocorre ao entrar novamente.
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [])

  // Compatível com o comportamento aprovado: entrar/sair em outra aba atualiza
  // esta (o navegador dispara `storage` para a chave do token).
  useEffect(() => {
    function syncToken(event) {
      if (event.key !== TOKEN_KEY && event.key !== null) return
      setReady(false)
      fetchCurrentUser()
        .then((restored) => setUser(restored))
        .catch(() => setUser(null))
        .finally(() => setReady(true))
    }
    window.addEventListener('storage', syncToken)
    return () => window.removeEventListener('storage', syncToken)
  }, [])

  const register = useCallback(async (data) => {
    const createdUser = await registerUser(data)
    setUser(createdUser)
    return createdUser
  }, [])

  const login = useCallback(async (data) => {
    const loggedUser = await loginUser(data)
    setUser(loggedUser)
    return loggedUser
  }, [])

  // Nunca lança: o logout limpa o token local mesmo se a API estiver fora.
  const logout = useCallback(async () => {
    await logoutUser()
    setUser(null)
  }, [])

  const updateProfile = useCallback(async (data) => {
    const updatedUser = await updateUserProfile(data)
    setUser(updatedUser)
    return updatedUser
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      // Papel decidido pelo servidor; o front usa apenas para esconder rotas.
      isAdmin: user?.role === 'administrador',
      ready,
      register,
      login,
      logout,
      updateProfile,
    }),
    [user, ready, register, login, logout, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
