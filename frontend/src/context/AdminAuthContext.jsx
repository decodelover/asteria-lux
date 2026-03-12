import { useEffect, useEffectEvent, useState } from 'react'
import { api } from '../lib/api'
import {
  clearAdminAuthToken,
  getAdminAuthToken,
  setAdminAuthToken,
} from '../lib/adminAuthStorage'
import { AdminAuthContext } from './admin-auth-context'

export function AdminAuthProvider({ children }) {
  const [token, setToken] = useState(() => getAdminAuthToken())
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(Boolean(getAdminAuthToken()))

  const refreshAdmin = async (tokenOverride = token) => {
    if (!tokenOverride) {
      setAdmin(null)
      setLoading(false)
      return null
    }

    setLoading(true)

    try {
      const response = await api.adminMe(tokenOverride)
      setAdmin(response.admin)
      return response
    } catch (error) {
      clearAdminAuthToken()
      setToken('')
      setAdmin(null)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const syncAdmin = useEffectEvent(async (tokenOverride) => {
    await refreshAdmin(tokenOverride)
  })

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    syncAdmin(token).catch(() => {})
  }, [token])

  const signIn = async (payload) => {
    const response = await api.adminLogin(payload)
    setAdminAuthToken(response.token)
    setToken(response.token)
    setAdmin(response.admin)
    return response
  }

  const signOut = () => {
    clearAdminAuthToken()
    setToken('')
    setAdmin(null)
  }

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        loading,
        refreshAdmin,
        signIn,
        signOut,
        token,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  )
}
