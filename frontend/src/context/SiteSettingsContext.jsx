import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { SiteSettingsContext } from './site-settings-context'

const SETTINGS_REFRESH_INTERVAL_MS = 15000

const fallbackSettings = {
  featuredVideos: [],
  heroHeadlines: [],
  storeName: 'Asteria Luxury House',
  supportEmail: '',
  supportPhone: '',
  whatsappNumber: '',
}

export function SiteSettingsProvider({ children }) {
  const [publicSettings, setPublicSettings] = useState(fallbackSettings)
  const [loading, setLoading] = useState(true)

  const refreshSettings = async () => {
    const response = await api.getPublicSettings()
    setPublicSettings({
      ...fallbackSettings,
      ...(response.settings || {}),
    })
    return response.settings || fallbackSettings
  }

  useEffect(() => {
    let ignore = false

    const load = async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true)
      }

      try {
        const response = await api.getPublicSettings()

        if (!ignore) {
          setPublicSettings({
            ...fallbackSettings,
            ...(response.settings || {}),
          })
        }
      } catch {
        if (!ignore && !silent) {
          setPublicSettings(fallbackSettings)
        }
      } finally {
        if (!ignore && !silent) {
          setLoading(false)
        }
      }
    }

    const refreshSilently = () => {
      if (document.hidden) {
        return
      }

      load({ silent: true }).catch(() => {})
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshSilently()
      }
    }

    load()
    const timer = window.setInterval(refreshSilently, SETTINGS_REFRESH_INTERVAL_MS)
    window.addEventListener('focus', refreshSilently)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      ignore = true
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshSilently)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return (
    <SiteSettingsContext.Provider
      value={{
        loading,
        publicSettings,
        refreshSettings,
      }}
    >
      {children}
    </SiteSettingsContext.Provider>
  )
}
