const STORE_CURRENCY = (import.meta.env.VITE_STORE_CURRENCY || 'NGN').trim().toUpperCase()
const STORE_LOCALE = (import.meta.env.VITE_STORE_LOCALE || 'en-NG').trim()

export const formatCurrency = (value) =>
  new Intl.NumberFormat(STORE_LOCALE, {
    currency: STORE_CURRENCY,
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Number(value || 0))

export const formatNumber = (value) =>
  new Intl.NumberFormat(STORE_LOCALE).format(Number(value || 0))

export const formatShortDate = (value) =>
  new Intl.DateTimeFormat(STORE_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
