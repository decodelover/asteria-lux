const SESSION_STORAGE_KEY = 'luxury-store-session-id'

const createSessionId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `session-${Date.now()}`
}

export const getOrCreateSessionId = () => {
  const existingSessionId = window.localStorage.getItem(SESSION_STORAGE_KEY)

  if (existingSessionId) {
    return existingSessionId
  }

  const nextSessionId = createSessionId()
  window.localStorage.setItem(SESSION_STORAGE_KEY, nextSessionId)
  return nextSessionId
}
