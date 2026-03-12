import { useContext } from 'react'
import { SiteSettingsContext } from '../context/site-settings-context'

export const useSiteSettings = () => {
  const context = useContext(SiteSettingsContext)

  if (!context) {
    throw new Error('useSiteSettings must be used within a SiteSettingsProvider.')
  }

  return context
}
