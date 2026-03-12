const DEVICE_CONTEXT_STORAGE_KEY = 'luxury-store-device-context'

const normalizeText = (value) => {
  const normalized = String(value || '').trim()
  return normalized || ''
}

const normalizeNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeDeviceContext = (value = {}) => ({
  city: normalizeText(value.city),
  country: normalizeText(value.country),
  latitude: normalizeNumber(value.latitude),
  locationLabel: normalizeText(value.locationLabel),
  longitude: normalizeNumber(value.longitude),
  timezone: normalizeText(value.timezone),
})

export const getStoredDeviceContext = () => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DEVICE_CONTEXT_STORAGE_KEY) || '{}')
    return normalizeDeviceContext(parsed)
  } catch {
    return normalizeDeviceContext()
  }
}

export const setStoredDeviceContext = (value) => {
  const normalized = normalizeDeviceContext(value)
  window.localStorage.setItem(DEVICE_CONTEXT_STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}
