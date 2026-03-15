const rawApiBase = (import.meta.env.VITE_API_BASE_URL || '/api').trim()
const API_BASE = rawApiBase.endsWith('/') ? rawApiBase.slice(0, -1) : rawApiBase
const isAbsolute = /^https?:\/\//i.test(API_BASE)

const buildUrl = (path, query = {}) => {
  const base = isAbsolute
    ? new URL(`${API_BASE}/`)
    : new URL(`${API_BASE}/`, window.location.origin)
  const url = new URL(path.replace(/^\//, ''), base)

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  })

  return isAbsolute ? url.toString() : `${url.pathname}${url.search}`
}

const request = async (path, options = {}) => {
  const headers = new Headers(options.headers || {})
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData

  if (options.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  const response = await fetch(buildUrl(path, options.query), {
    ...options,
    headers,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(payload?.message || 'Request failed.')
  }

  return payload
}

export const api = {
  addToCart: (payload) =>
    request('/cart/items', {
      body: JSON.stringify(payload),
      method: 'POST',
    }),

  adminLogin: (payload) =>
    request('/admin/auth/login', {
      body: JSON.stringify(payload),
      method: 'POST',
    }),

  adminMe: (token) =>
    request('/admin/auth/me', {
      token,
    }),

  adminChangePassword: (payload, token) =>
    request('/admin/auth/change-password', {
      body: JSON.stringify(payload),
      method: 'POST',
      token,
    }),

  createAdminProduct: (payload, token) =>
    request('/admin/products', {
      body: JSON.stringify(payload),
      method: 'POST',
      token,
    }),

  createAdminAccount: (payload, token) =>
    request('/admin/admins', {
      body: JSON.stringify(payload),
      method: 'POST',
      token,
    }),

  deleteAdminProduct: (productId, token) =>
    request(`/admin/products/${productId}`, {
      method: 'DELETE',
      token,
    }),

  deleteAdminUser: (userId, token) =>
    request(`/admin/users/${userId}`, {
      method: 'DELETE',
      token,
    }),

  emailAdminOrderCustomer: ({ orderNumber, payload, token }) =>
    request(`/admin/orders/${orderNumber}/email`, {
      body: JSON.stringify(payload),
      method: 'POST',
      token,
    }),

  emailAdminUser: ({ payload, token, userId }) =>
    request(`/admin/users/${userId}/email`, {
      body: JSON.stringify(payload),
      method: 'POST',
      token,
    }),

  getAdminBootstrap: (token) =>
    request('/admin/bootstrap', {
      token,
    }),

  getAdminSettings: (token) =>
    request('/admin/settings', {
      token,
    }),

  testAdminEmailSettings: ({ payload, token }) =>
    request('/admin/settings/email/test', {
      body: JSON.stringify(payload),
      method: 'POST',
      token,
    }),

  checkout: (payload, token) =>
    request('/checkout', {
      body: JSON.stringify(payload),
      method: 'POST',
      token,
    }),

  getPaymentConfig: () => request('/payments/config'),

  clearCart: (sessionId) =>
    request('/cart', {
      method: 'DELETE',
      query: { sessionId },
    }),

  getHealth: () => request('/health'),

  getCart: (sessionId) =>
    request('/cart', {
      query: { sessionId },
    }),

  getCategories: () => request('/categories'),

  getPublicSettings: () => request('/settings/public'),

  getProducts: (query) =>
    request('/products', {
      query,
    }),

  getProduct: (productId) => request(`/products/${productId}`),

  getProfile: (token) =>
    request('/auth/me', {
      token,
    }),

  login: (payload) =>
    request('/auth/login', {
      body: JSON.stringify(payload),
      method: 'POST',
    }),

  resolveDeviceContext: (payload) =>
    request('/location/resolve', {
      body: JSON.stringify(payload),
      method: 'POST',
    }),

  initializePaystackPayment: (payload, token) =>
    request('/payments/paystack/initialize', {
      body: JSON.stringify(payload),
      method: 'POST',
      token,
    }),

  removeCartItem: (sessionId, productId) =>
    request(`/cart/items/${productId}`, {
      method: 'DELETE',
      query: { sessionId },
    }),

  resendVerification: ({ email, token }) =>
    request('/auth/resend-verification', {
      body: JSON.stringify(email ? { email } : {}),
      method: 'POST',
      token,
    }),

  signUp: (payload) =>
    request('/auth/signup', {
      body: JSON.stringify(payload),
      method: 'POST',
    }),

  submitContact: (payload) =>
    request('/contact', {
      body: JSON.stringify(payload),
      method: 'POST',
    }),

  subscribeToNewsletter: (payload) =>
    request('/newsletter/subscribe', {
      body: JSON.stringify(payload),
      method: 'POST',
    }),

  submitBankTransfer: (formData, token) =>
    request('/payments/bank-transfer/submit', {
      body: formData,
      method: 'POST',
      token,
    }),

  updateAdminOrder: ({ orderNumber, payload, token }) =>
    request(`/admin/orders/${orderNumber}`, {
      body: JSON.stringify(payload),
      method: 'PATCH',
      token,
    }),

  updateAdminProduct: ({ payload, productId, token }) =>
    request(`/admin/products/${productId}`, {
      body: JSON.stringify(payload),
      method: 'PATCH',
      token,
    }),

  updateAdminAccount: ({ adminId, payload, token }) =>
    request(`/admin/admins/${adminId}`, {
      body: JSON.stringify(payload),
      method: 'PATCH',
      token,
    }),

  updateAdminSettings: (payload, token) =>
    request('/admin/settings', {
      body: JSON.stringify(payload),
      method: 'PUT',
      token,
    }),

  updateAdminUser: ({ payload, token, userId }) =>
    request(`/admin/users/${userId}`, {
      body: JSON.stringify(payload),
      method: 'PATCH',
      token,
    }),

  uploadAdminProductImage: (formData, token) =>
    request('/admin/uploads/product-image', {
      body: formData,
      method: 'POST',
      token,
    }),

  updateSettings: (payload, token) =>
    request('/auth/settings', {
      body: JSON.stringify(payload),
      method: 'PATCH',
      token,
    }),

  updateCartItem: ({ productId, quantity, sessionId }) =>
    request(`/cart/items/${productId}`, {
      body: JSON.stringify({ quantity, sessionId }),
      method: 'PATCH',
    }),

  verifyPaystackPayment: ({ reference }, token) =>
    request('/payments/paystack/verify', {
      body: JSON.stringify({ reference }),
      method: 'POST',
      token,
    }),

  verifyEmail: (token) =>
    request('/auth/verify-email', {
      query: { token },
    }),
}


