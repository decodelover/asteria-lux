import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

export function Footer() {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [message, setMessage] = useState('')
  const [mailDelivered, setMailDelivered] = useState(true)
  const [previewUrl, setPreviewUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')
    setPreviewUrl('')

    try {
      const response = await api.subscribeToNewsletter({ email, fullName })
      setMessage(response.message)
      setMailDelivered(response.mailDelivered !== false)
      setPreviewUrl(response.mailPreviewUrl || '')
      setEmail('')
      setFullName('')
    } catch (error) {
      setMessage(error.message || 'Unable to subscribe right now.')
      setMailDelivered(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <footer className="mt-12">
      <div className="mx-auto w-full max-w-[1480px] px-4 pb-8 sm:px-6 lg:px-8">
        <div className="panel-dark rounded-[34px] px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-[#d8bf98]">
                <i className="bi bi-envelope-paper" aria-hidden="true" />
                Receive updates
              </div>
              <h2 className="font-display text-5xl leading-none text-[#fff6ea] sm:text-6xl">
                Stay close to launches, private releases, and order notices.
              </h2>
              <p className="max-w-xl text-sm leading-7 text-[#d7ccbd]">
                Join the list for new arrivals, collection notes, and client communication
                from Asteria Luxury House.
              </p>

              <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={handleSubmit}>
                <input
                  className="rounded-full border border-white/10 bg-white/8 px-4 py-3 text-sm text-white outline-none placeholder:text-[#b6a794]"
                  placeholder="Your name"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
                <input
                  className="rounded-full border border-white/10 bg-white/8 px-4 py-3 text-sm text-white outline-none placeholder:text-[#b6a794]"
                  placeholder="Email address"
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <button
                  className="button-primary disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting ? 'Joining' : 'Subscribe'}
                </button>
              </form>

              {message && (
                <div
                  className={`space-y-2 rounded-[22px] border px-4 py-4 text-sm ${
                    mailDelivered
                      ? 'border-white/10 bg-white/6 text-[#e8dccd]'
                      : 'border-[#7c613c] bg-[rgba(53,38,26,0.72)] text-[#f3dfc4]'
                  }`}
                >
                  <p>{message}</p>
                  {previewUrl && (
                    <a
                      className="link-accent text-sm font-semibold"
                      href={previewUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open email preview
                    </a>
                  )}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['Notes', 'Launches and private release updates'],
                  ['Service', 'Order and contact communication'],
                  ['Tone', 'A considered luxury storefront experience'],
                ].map(([title, copy]) => (
                  <div key={title} className="metric-card">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#caab7c]">
                      {title}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[#efe3d2]">{copy}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-[26px] border border-white/8 bg-white/6 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b98b46]">
                  Visit the store
                </p>
                <div className="mt-4 space-y-3 text-sm leading-7 text-[#efe3d2]">
                  <p>Asteria Luxury House</p>
                  <p>Fifth Avenue showroom standard, built for online conversion.</p>
                  <p>Support desk: support@asterialuxury.test</p>
                  <p>Concierge line: +1 (555) 010-2026</p>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[26px] border border-white/8 bg-white/6 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b98b46]">
                    Navigate
                  </p>
                  <div className="mt-4 flex flex-col gap-2 text-sm text-[#efe3d2]">
                    <Link className="transition hover:text-white" to="/">
                      Home
                    </Link>
                    <Link className="transition hover:text-white" to="/shop">
                      Shop
                    </Link>
                    <Link className="transition hover:text-white" to="/about">
                      About
                    </Link>
                    <Link className="transition hover:text-white" to="/contact">
                      Contact
                    </Link>
                  </div>
                </div>

                <div className="rounded-[26px] border border-white/8 bg-white/6 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b98b46]">
                    Account
                  </p>
                  <div className="mt-4 flex flex-col gap-2 text-sm text-[#efe3d2]">
                    <Link className="transition hover:text-white" to="/auth">
                      Sign in / Sign up
                    </Link>
                    <Link className="transition hover:text-white" to="/account">
                      Account
                    </Link>
                    <Link className="transition hover:text-white" to="/verify-email">
                      Verify email
                    </Link>
                    <a
                      className="transition hover:text-white"
                      href="mailto:support@asterialuxury.test"
                    >
                      support@asterialuxury.test
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
