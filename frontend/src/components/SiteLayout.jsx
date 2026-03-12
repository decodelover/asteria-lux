import { Outlet } from 'react-router-dom'
import { useSiteSettings } from '../hooks/useSiteSettings'

export function SiteLayout() {
  const { publicSettings } = useSiteSettings()
  const rawWhatsappNumber = String(
    publicSettings.whatsappNumber || import.meta.env.VITE_WHATSAPP_NUMBER || '2348000000000',
  ).replace(/\D/g, '')
  const whatsappNumber = rawWhatsappNumber.startsWith('0')
    ? `234${rawWhatsappNumber.slice(1)}`
    : rawWhatsappNumber
  const whatsappMessage = encodeURIComponent(
    import.meta.env.VITE_WHATSAPP_MESSAGE ||
      'Hello, I would like to make an enquiry about a product on Asteria Luxury House.',
  )
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`
    : null

  return (
    <div className="min-h-screen">
      <Outlet />
      {whatsappHref && (
        <a
          aria-label="Message us on WhatsApp"
          className="go-whatsapp-float"
          href={whatsappHref}
          rel="noreferrer"
          target="_blank"
        >
          <i aria-hidden="true" className="bi bi-whatsapp" />
        </a>
      )}
    </div>
  )
}
