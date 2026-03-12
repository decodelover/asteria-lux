import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const signInDefaults = {
  email: '',
  password: '',
}

const signUpDefaults = {
  email: '',
  fullName: '',
  newsletterOptIn: true,
  password: '',
}

const accountBenefits = [
  'Keep orders attached to your client profile.',
  'Confirm your email and protect your account access.',
  'Receive launch, contact, and order communication in one place.',
]

export function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const defaultMode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin'
  const [mode, setMode] = useState(defaultMode)
  const [signInForm, setSignInForm] = useState(signInDefaults)
  const [signUpForm, setSignUpForm] = useState(signUpDefaults)
  const [message, setMessage] = useState('')
  const [mailDelivered, setMailDelivered] = useState(true)
  const [previewUrl, setPreviewUrl] = useState('')
  const [mailMode, setMailMode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { resendVerification, signIn, signOut, signUp, user } = useAuth()

  const activeTitle = useMemo(
    () => (mode === 'signin' ? 'Sign in to your account' : 'Create your customer account'),
    [mode],
  )

  const updateMode = (nextMode) => {
    setMode(nextMode)
    setSearchParams(nextMode === 'signup' ? { mode: 'signup' } : {})
    setMessage('')
    setPreviewUrl('')
    setMailMode('')
    setMailDelivered(true)
  }

  const handleSignInChange = (event) => {
    const { name, value } = event.target
    setSignInForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSignUpChange = (event) => {
    const { checked, name, type, value } = event.target
    setSignUpForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')
    setPreviewUrl('')

    try {
      if (mode === 'signin') {
        const response = await signIn(signInForm)
        setMessage(response.message)
        setMailDelivered(true)
        setMailMode('')
      } else {
        const response = await signUp(signUpForm)
        setMessage(response.message)
        setPreviewUrl(response.verificationPreviewUrl || '')
        setMailMode(response.mailMode || '')
        setMailDelivered(response.mailDelivered !== false)
      }
    } catch (error) {
      setMessage(error.message || 'Unable to continue.')
      setMailDelivered(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    setSubmitting(true)
    setMessage('')
    setPreviewUrl('')
    setMailMode('')

    try {
      const response = await resendVerification(mode === 'signin' ? signInForm.email : signUpForm.email)
      setMessage(response.message)
      setPreviewUrl(response.verificationPreviewUrl || '')
      setMailMode(response.mailMode || '')
      setMailDelivered(response.mailDelivered !== false)
    } catch (error) {
      setMessage(error.message || 'Unable to resend verification.')
      setMailDelivered(false)
    } finally {
      setSubmitting(false)
    }
  }

  const isPreviewMode = Boolean(mailMode && mailMode !== 'smtp')

  return (
    <main className="page-shell grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="panel-dark rounded-[36px] p-6 sm:p-8">
        <div className="space-y-5">
          <div className="inline-tag border-white/10 bg-white/8 text-[#e2c392]">
            <i className="bi bi-person-vcard" aria-hidden="true" />
            Customer access
          </div>
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#caab7c]">
              Private client sign-in
            </p>
            <h1 className="font-display text-6xl leading-none text-white sm:text-7xl">
              Sign up, verify, and manage your orders in one place.
            </h1>
            <p className="text-base leading-8 text-[#d8cfc2] sm:text-lg">
              Create a personal account to keep your order history, save your contact
              identity, and stay connected to updates from the house with less friction.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-[28px] border border-white/10 bg-white/6 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d0b388]">
            Account benefits
          </p>
          <div className="mt-4 grid gap-3">
            {accountBenefits.map((item) => (
              <div
                key={item}
                className="rounded-[20px] border border-white/8 bg-black/12 px-4 py-4 text-sm leading-6 text-[#ede1cf]"
              >
                <i className="bi bi-check2-circle mr-2 text-[#ddb97b]" aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="metric-card">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#caab7c]">
              Mail status
            </p>
            <p className="mt-3 text-sm leading-6 text-[#efe3d2]">
              {mailMode === 'smtp'
                ? 'Real inbox delivery is connected.'
                : 'If inbox delivery is not connected yet, the interface shows preview links instead of pretending the email arrived.'}
            </p>
          </div>
          <div className="metric-card">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#caab7c]">
              Session state
            </p>
            <p className="mt-3 text-sm leading-6 text-[#efe3d2]">
              {user
                ? `Signed in as ${user.email}.`
                : 'No active account session in this browser right now.'}
            </p>
          </div>
        </div>
      </section>

      <section className="panel rounded-[36px] px-6 py-8 sm:px-8">
        <div className="flex flex-wrap gap-2 rounded-full bg-[#efe5d7] p-1.5">
          <button
            className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
              mode === 'signin' ? 'bg-[#1f1713] text-white' : 'text-[#69584d]'
            }`}
            onClick={() => updateMode('signin')}
            type="button"
          >
            Sign in
          </button>
          <button
            className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
              mode === 'signup' ? 'bg-[#1f1713] text-white' : 'text-[#69584d]'
            }`}
            onClick={() => updateMode('signup')}
            type="button"
          >
            Sign up
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8d6b41]">
              Account entry
            </p>
            <h2 className="mt-2 font-display text-5xl leading-none text-[#201713]">
              {activeTitle}
            </h2>
          </div>
          <div className="rounded-full bg-[#f5eadd] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#8d6b41]">
            Private access
          </div>
        </div>

        {user && (
          <div className="mt-6 rounded-[24px] border border-[#e6d8c5] bg-[#fcfaf6] px-5 py-4 text-sm leading-7 text-[#5d5147]">
            Signed in as <strong>{user.email}</strong>. Visit{' '}
            <Link className="font-semibold text-[#8d6b41]" to="/account">
              your account
            </Link>{' '}
            or{' '}
            <button className="font-semibold text-[#8d6b41]" onClick={signOut} type="button">
              sign out
            </button>
            .
          </div>
        )}

        <form className="mt-7 grid gap-4" onSubmit={handleSubmit}>
          {mode === 'signup' && (
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
                  value={signUpForm.fullName}
                  onChange={handleSignUpChange}
                />
              </div>
            </label>
          )}

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
                value={mode === 'signin' ? signInForm.email : signUpForm.email}
                onChange={mode === 'signin' ? handleSignInChange : handleSignUpChange}
              />
            </div>
          </label>

          <label className="field-shell">
            <span className="field-label">Password</span>
            <div className="field-input-shell">
              <i className="bi bi-lock text-[#8f714d]" aria-hidden="true" />
              <input
                className="field-input"
                name="password"
                placeholder="At least 8 characters"
                required
                type="password"
                value={mode === 'signin' ? signInForm.password : signUpForm.password}
                onChange={mode === 'signin' ? handleSignInChange : handleSignUpChange}
              />
            </div>
          </label>

          {mode === 'signup' && (
            <label className="flex items-center gap-3 rounded-[22px] border border-[#e4d6c2] bg-white px-4 py-3 text-sm text-[#5d5147]">
              <input
                checked={signUpForm.newsletterOptIn}
                className="h-4 w-4 accent-[#1f1713]"
                name="newsletterOptIn"
                type="checkbox"
                onChange={handleSignUpChange}
              />
              Send me product launches and store updates
            </label>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              className="button-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              <i
                className={`bi ${
                  submitting
                    ? 'bi-arrow-repeat animate-spin'
                    : mode === 'signin'
                      ? 'bi-box-arrow-in-right'
                      : 'bi-person-plus'
                }`}
                aria-hidden="true"
              />
              {submitting ? 'Working' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
            <button
              className="button-secondary disabled:cursor-not-allowed disabled:opacity-50"
              disabled={submitting}
              onClick={handleResend}
              type="button"
            >
              <i className="bi bi-envelope-arrow-up" aria-hidden="true" />
              Resend verification
            </button>
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
                  {isPreviewMode ? 'Open verification link' : 'Open verification preview'}
                </a>
              )}
              {isPreviewMode && (
                <p className="mt-2 text-xs uppercase tracking-[0.18em] opacity-75">
                  SMTP is not connected, so this is a local verification path instead of a
                  real inbox delivery.
                </p>
              )}
            </div>
          )}
        </form>
      </section>
    </main>
  )
}
