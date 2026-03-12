import { useEffect, useEffectEvent, useState } from 'react'
import { api } from '../lib/api'
import { clearAuthToken, getAuthToken, setAuthToken } from '../lib/authStorage'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getAuthToken())
  const [user, setUser] = useState(null)
  const [orders, setOrders] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(Boolean(getAuthToken()))

  const refreshProfile = async (tokenOverride = token) => {
    if (!tokenOverride) {
      setUser(null)
      setOrders([])
      setDashboard(null)
      setLoading(false)
      return null
    }

    setLoading(true)

    try {
      const response = await api.getProfile(tokenOverride)
      setUser(response.user)
      setOrders(response.orders || [])
      setDashboard(response.dashboard || null)
      return response
    } catch (error) {
      clearAuthToken()
      setToken(null)
      setUser(null)
      setOrders([])
      setDashboard(null)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const syncProfile = useEffectEvent(async (tokenOverride) => {
    await refreshProfile(tokenOverride)
  })

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    syncProfile(token).catch(() => {})
  }, [token])

  const signIn = async (payload) => {
    const response = await api.login(payload)
    setAuthToken(response.token)
    setToken(response.token)
    setUser(response.user)
    await refreshProfile(response.token)
    return response
  }

  const signUp = async (payload) => {
    return api.signUp(payload)
  }

  const signOut = () => {
    clearAuthToken()
    setToken(null)
    setUser(null)
    setOrders([])
    setDashboard(null)
  }

  const updateSettings = async (payload) => {
    const nextToken = token || getAuthToken()

    if (!nextToken) {
      throw new Error('Authentication required.')
    }

    const response = await api.updateSettings(payload, nextToken)
    setUser(response.user)
    setOrders(response.orders || [])
    setDashboard(response.dashboard || null)
    return response
  }

  const resendVerification = (email) =>
    api.resendVerification({
      email,
      token,
    })

  const verifyEmail = async (verificationToken) => {
    const response = await api.verifyEmail(verificationToken)

    if (token) {
      await refreshProfile(token).catch(() => {})
    }

    return response
  }

  return (
    <AuthContext.Provider
      value={{
        dashboard,
        loading,
        orders,
        refreshProfile,
        resendVerification,
        signIn,
        signOut,
        signUp,
        token,
        updateSettings,
        user,
        verifyEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
