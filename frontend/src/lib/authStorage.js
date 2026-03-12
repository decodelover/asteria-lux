const AUTH_STORAGE_KEY = 'luxury-store-auth-token'

export const clearAuthToken = () => {
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}

export const getAuthToken = () => window.localStorage.getItem(AUTH_STORAGE_KEY)

export const setAuthToken = (token) => {
  window.localStorage.setItem(AUTH_STORAGE_KEY, token)
}
