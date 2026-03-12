import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export function MailStatusBanner() {
  const [mailMode, setMailMode] = useState('')

  useEffect(() => {
    let ignore = false

    const loadHealth = async () => {
      const response = await api.getHealth()

      if (!ignore) {
        setMailMode(response.emailMode || '')
      }
    }

    loadHealth().catch(() => {})

    return () => {
      ignore = true
    }
  }, [])

  if (!mailMode || mailMode === 'smtp') {
    return null
  }

  const isDisabled = mailMode === 'disabled'

  return (
    <div className="go-mail-banner">
      <div className="go-mail-banner-inner">
        <i
          className={`bi ${isDisabled ? 'bi-envelope-slash' : 'bi-envelope-paper-heart'}`}
          aria-hidden="true"
        />
        <p>
          {isDisabled
            ? 'Email delivery is currently offline. Add SMTP settings in backend/.env before expecting real inbox delivery.'
            : 'Email is running in local preview mode. Open the verification or order preview links shown in the app unless SMTP is configured.'}
        </p>
      </div>
    </div>
  )
}
