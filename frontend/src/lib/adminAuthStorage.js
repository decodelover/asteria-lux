const ADMIN_AUTH_TOKEN_KEY = 'luxury-store-admin-token'

export const getAdminAuthToken = () => window.localStorage.getItem(ADMIN_AUTH_TOKEN_KEY) || ''

export const setAdminAuthToken = (token) => {
  window.localStorage.setItem(ADMIN_AUTH_TOKEN_KEY, token)
}

export const clearAdminAuthToken = () => {
  window.localStorage.removeItem(ADMIN_AUTH_TOKEN_KEY)
}
