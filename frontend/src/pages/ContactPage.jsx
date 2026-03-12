import { useState } from 'react'
import { api } from '../lib/api'

const initialForm = {
  email: '',
  fullName: '',
  message: '',
  subject: '',
}

const contactDetails = [
  {
    icon: 'bi-envelope-open',
    text: 'support@asterialuxury.test',
    title: 'Email support',
  },
  {
    icon: 'bi-telephone',
    text: '+1 (555) 010-2026',
    title: 'Client concierge',
  },
  {
    icon: 'bi-clock-history',
    text: 'Monday to Saturday, 9:00 AM to 7:00 PM',
    title: 'Service hours',
  },
]

export function ContactPage() {
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [mailDelivered, setMailDelivered] = useState(true)
  const [previewUrl, setPreviewUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')
    setPreviewUrl('')

    try {
      const response = await api.submitContact(form)
      setMessage(response.message)
      setMailDelivered(response.mailDelivered !== false)
      setPreviewUrl(response.mailPreviewUrl || '')
      setForm(initialForm)
    } catch (error) {
      setMessage(error.message || 'Unable to send your message.')
      setMailDelivered(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="page-shell grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
      <section className="panel-dark rounded-[36px] p-6 sm:p-8">
        <div className="space-y-5">
          <div className="inline-tag border-white/10 bg-white/8 text-[#e2c392]">
            <i className="bi bi-headset" aria-hidden="true" />
            Contact the house
          </div>
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#caab7c]">
              Service, orders, and private client requests
            </p>
            <h1 className="font-display text-6xl leading-none text-white sm:text-7xl">
              Reach the store team directly.
            </h1>
            <p className="text-base leading-8 text-[#d8cfc2] sm:text-lg">
              Ask about a piece, request assistance with an order, or reach out for private
              client support. The store team can respond from a single, organized contact
              flow.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4">
          {contactDetails.map((item) => (
            <article key={item.title} className="metric-card">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/8 text-[#d8b57b]">
                  <i className={`bi ${item.icon}`} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#c9aa7c]">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#f0e4d3]">{item.text}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-[28px] border border-white/10 bg-white/6 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c9ab7c]">
            What to expect
          </p>
          <div className="mt-4 grid gap-3">
            {[
              'Questions about products, orders, and support move through one contact channel.',
              'Acknowledgement email can be sent through SMTP or local preview mode.',
              'The page is ready to serve as the live support entry point after launch.',
            ].map((item) => (
              <div
                key={item}
                className="rounded-[20px] border border-white/8 bg-black/12 px-4 py-4 text-sm leading-6 text-[#eee1d0]"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel rounded-[36px] px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8d6b41]">
              Contact form
            </p>
            <h2 className="mt-2 font-display text-5xl leading-none text-[#201713]">
              Send a message
            </h2>
          </div>
          <div className="rounded-full bg-[#f4eadb] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#8d6b41]">
            Private response
          </div>
        </div>

        <form className="mt-7 grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="field-shell">
              <span className="field-label">Full name</span>
              <div className="field-input-shell">
                <i className="bi bi-person text-[#8f714d]" aria-hidden="true" />
                <input
                  className="field-input"
                  name="fullName"
                  placeholder="Ada Obi"
                  required
                  type="text"
                  value={form.fullName}
                  onChange={handleChange}
                />
              </div>
            </label>

            <label className="field-shell">
              <span className="field-label">Email</span>
              <div className="field-input-shell">
                <i className="bi bi-envelope text-[#8f714d]" aria-hidden="true" />
                <input
                  className="field-input"
                  name="email"
                  placeholder="ada@example.com"
                  required
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>
            </label>
          </div>

          <label className="field-shell">
            <span className="field-label">Subject</span>
            <div className="field-input-shell">
              <i className="bi bi-chat-left-text text-[#8f714d]" aria-hidden="true" />
              <input
                className="field-input"
                name="subject"
                placeholder="Order issue, product request, or partnership"
                required
                type="text"
                value={form.subject}
                onChange={handleChange}
              />
            </div>
          </label>

          <label className="field-shell">
            <span className="field-label">Message</span>
            <div className="field-input-shell items-start">
              <i className="bi bi-pencil-square mt-1 text-[#8f714d]" aria-hidden="true" />
              <textarea
                className="field-input min-h-44 resize-y"
                name="message"
                placeholder="Tell the team what you need."
                required
                value={form.message}
                onChange={handleChange}
              />
            </div>
          </label>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              className="button-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              <i className={`bi ${submitting ? 'bi-arrow-repeat animate-spin' : 'bi-send'}`} aria-hidden="true" />
              {submitting ? 'Sending message' : 'Send message'}
            </button>
            <p className="text-sm text-[#6b5c51]">
              The message is captured immediately so the team has the full request on hand.
            </p>
          </div>

          {message && (
            <div
              className={`rounded-[24px] border px-5 py-4 text-sm leading-7 ${
                mailDelivered
                  ? 'border-[#d8e8d6] bg-[#f4fbf5] text-[#285e39]'
                  : 'border-[#e3cfa8] bg-[#fff8eb] text-[#7a5a29]'
              }`}
            >
              <p>{message}</p>
              {previewUrl && (
                <a
                  className="mt-2 inline-flex items-center gap-2 font-semibold text-current underline underline-offset-4"
                  href={previewUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
                  Open acknowledgement email preview
                </a>
              )}
            </div>
          )}
        </form>
      </section>
    </main>
  )
}
