import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './authContext'
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  updateUserProfile,
} from '../services/auth'

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getCurrentUser())

  useEffect(() => {
    function syncUser(event) {
      if (event.key === null || ['forma:users', 'forma:session'].includes(event.key)) {
        setUser(getCurrentUser())
      }
    }
    window.addEventListener('storage', syncUser)
    return () => window.removeEventListener('storage', syncUser)
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

  const logout = useCallback(() => {
    logoutUser()
    setUser(null)
  }, [])

  const updateProfile = useCallback((data) => {
    const currentUser = getCurrentUser()

    if (!currentUser) {
      throw new Error('É necessário estar logado para editar o perfil.')
    }

    const updatedUser = updateUserProfile(currentUser.id, data)
    setUser(updatedUser)
    return updatedUser
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      register,
      login,
      logout,
      updateProfile,
    }),
    [user, register, login, logout, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
