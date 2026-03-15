import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../hooks/useAdminAuth'

const INPUT_CLASS =
  'h-12 rounded-2xl border border-[#eadcf7] bg-white px-4 text-sm text-slate-900 shadow-[0_18px_48px_rgba(114,73,151,0.08)] outline-none transition placeholder:text-slate-400 focus:border-[#7c3aed] focus:ring-4 focus:ring-[#7c3aed]/15'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAdminAuth()
  const [form, setForm] = useState({
    email: '',
    password: '',
  })
  const [message, setMessage] = useState('')
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

    try {
      await signIn(form)
      navigate('/admin', { replace: true })
    } catch (error) {
      setMessage(error.message || 'Unable to sign in to admin.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f3fb] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative overflow-hidden rounded-[34px] bg-[#2d123f] px-6 py-10 text-white shadow-[0_36px_120px_rgba(76,24,109,0.3)] sm:px-8 lg:px-10">
          <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_center,_rgba(194,149,255,0.3),_transparent_68%)]" />
          <div className="relative max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#d8b7ff]">
              Admin control room
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              Run the store from a separate workspace.
            </h1>
            <p className="mt-4 text-base leading-7 text-white/72">
              Manage products, users, orders, tracking, payments, settings, and live storefront
              updates from a dedicated admin session.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <article className="rounded-[24px] border border-white/10 bg-white/8 p-4 backdrop-blur">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-lg">
                  <i aria-hidden="true" className="bi bi-box-seam" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">Catalog control</h2>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  Product edits, image uploads, and featured catalog updates.
                </p>
              </article>

              <article className="rounded-[24px] border border-white/10 bg-white/8 p-4 backdrop-blur">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-lg">
                  <i aria-hidden="true" className="bi bi-truck" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">Order operations</h2>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  Payment review, tracking updates, and direct customer email handling.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="rounded-[34px] border border-white/70 bg-white/92 p-6 shadow-[0_36px_120px_rgba(84,35,122,0.14)] backdrop-blur sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#7d668d]">
                Admin sign in
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#2c1639]">
                Open dashboard
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Use your separate admin credentials to access the operations dashboard.
              </p>
            </div>
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-[22px] bg-[#f3ebff] text-2xl text-[#5b1793]">
              <i aria-hidden="true" className="bi bi-shield-lock" />
            </span>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7d668d]">
                Admin email
              </span>
              <input
                autoComplete="username"
                className={INPUT_CLASS}
                name="email"
                placeholder="name@yourstore.com"
                required
                type="email"
                value={form.email}
                onChange={handleChange}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7d668d]">
                Password
              </span>
              <input
                autoComplete="current-password"
                className={INPUT_CLASS}
                name="password"
                placeholder="Enter your password"
                required
                type="password"
                value={form.password}
                onChange={handleChange}
              />
            </label>

            {message ? (
              <div className="rounded-[22px] border border-[#f3d8b7] bg-[#fff7ed] px-4 py-3 text-sm text-[#8d6112]">
                {message}
              </div>
            ) : null}

            <button
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#5b1793] px-5 text-sm font-semibold text-white shadow-[0_22px_44px_rgba(91,23,147,0.3)] transition hover:-translate-y-0.5 hover:bg-[#4d1281] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              <i
                aria-hidden="true"
                className={`bi ${submitting ? 'bi-arrow-repeat animate-spin' : 'bi-box-arrow-in-right'}`}
              />
              <span>{submitting ? 'Signing in...' : 'Open dashboard'}</span>
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
