import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { SiteSettingsContext } from './site-settings-context'

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

    const load = async () => {
      setLoading(true)

      try {
        const response = await api.getPublicSettings()

        if (!ignore) {
          setPublicSettings({
            ...fallbackSettings,
            ...(response.settings || {}),
          })
        }
      } catch {
        if (!ignore) {
          setPublicSettings(fallbackSettings)
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      ignore = true
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
