import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'

const buildSignInPath = (email = '', reset = false) => {
  const params = new URLSearchParams()

  params.set('tab', 'account')
  params.set('mode', 'signin')

  if (email) {
    params.set('email', email)
  }

  if (reset) {
    params.set('reset', '1')
  }

  return `/?${params.toString()}`
}

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = String(searchParams.get('token') || '').trim()
  const initialEmail = String(searchParams.get('email') || '').trim().toLowerCase()
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [state, setState] = useState(() => ({
    message: token
      ? 'Create a new password for your account to continue back to your dashboard.'
      : 'Enter the email address on your account and we will send you a secure password reset link.',
    status: token ? 'ready' : 'idle',
    tone: 'info',
  }))

  useEffect(() => {
    setEmail(initialEmail)
  }, [initialEmail])

  useEffect(() => {
    if (!token || state.status !== 'success') {
      return undefined
    }

    const timer = window.setTimeout(() => {
      navigate(buildSignInPath(initialEmail || email, true), {
        replace: true,
      })
    }, 2200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [email, initialEmail, navigate, state.status, token])

  const handleRequestSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)

    try {
      const response = await api.forgotPassword({ email })
      setState({
        message:
          response.message ||
          'If an account exists for that email address, a password reset link has been sent.',
        status: 'sent',
        tone: 'success',
      })
    } catch (error) {
      setState({
        message: error.message || 'Unable to send a password reset link right now.',
        status: 'error',
        tone: 'warning',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetSubmit = async (event) => {
    event.preventDefault()

    if (password !== confirmPassword) {
      setState({
        message: 'Your passwords do not match yet.',
        status: 'error',
        tone: 'warning',
      })
      return
    }

    setSubmitting(true)

    try {
      const response = await api.resetPassword({
        password,
        token,
      })

      setState({
        message:
          response.message ||
          'Your password has been updated. Redirecting you to sign in now.',
        status: 'success',
        tone: 'success',
      })
    } catch (error) {
      setState({
        message: error.message || 'Unable to update your password right now.',
        status: 'error',
        tone: 'warning',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="go-verify-shell">
      <section className="go-verify-card go-verify-card--expanded">
        <div className="go-verify-icon">
          <i
            aria-hidden="true"
            className={`bi ${
              token
                ? state.status === 'success'
                  ? 'bi-shield-check'
                  : 'bi-key-fill'
                : 'bi-envelope-paper-heart'
            }`}
          />
        </div>

        <p className="go-verify-label">{token ? 'Reset password' : 'Password help'}</p>
        <h1>{token ? 'Create a new password' : 'Forgot your password?'}</h1>
        <p className="go-verify-copy">{state.message}</p>

        {!token && (
          <form className="go-auth-form go-auth-form--plain go-reset-form" onSubmit={handleRequestSubmit}>
            <label className="go-field">
              <span>Email address</span>
              <div className="go-auth-input-wrap">
                <i aria-hidden="true" className="bi bi-envelope-fill go-auth-input-icon" />
                <input
                  autoComplete="email"
                  name="email"
                  placeholder="Enter your email"
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </label>

            <div className="go-verify-actions go-reset-actions">
              <button className="go-primary-btn" disabled={submitting} type="submit">
                {submitting ? 'Sending...' : 'Send reset link'}
              </button>
              <Link className="go-secondary-btn" to={buildSignInPath(email)}>
                Back to sign in
              </Link>
            </div>
          </form>
        )}

        {token && (
          <form className="go-auth-form go-auth-form--plain go-reset-form" onSubmit={handleResetSubmit}>
            <label className="go-field">
              <span>New password</span>
              <div className="go-auth-input-wrap">
                <i aria-hidden="true" className="bi bi-lock-fill go-auth-input-icon" />
                <input
                  autoComplete="new-password"
                  name="password"
                  placeholder="Enter your new password"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  className="go-auth-visibility-btn"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  <i
                    aria-hidden="true"
                    className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}
                  />
                </button>
              </div>
            </label>

            <label className="go-field">
              <span>Confirm password</span>
              <div className="go-auth-input-wrap">
                <i aria-hidden="true" className="bi bi-shield-lock-fill go-auth-input-icon" />
                <input
                  autoComplete="new-password"
                  name="confirmPassword"
                  placeholder="Confirm your new password"
                  required
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <button
                  className="go-auth-visibility-btn"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  type="button"
                >
                  <i
                    aria-hidden="true"
                    className={`bi ${showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'}`}
                  />
                </button>
              </div>
            </label>

            <p className="go-reset-note">
              Choose a new password with at least 8 characters. Once it is saved, you will head
              straight back to sign in.
            </p>

            <div className="go-verify-actions go-reset-actions">
              <button className="go-primary-btn" disabled={submitting} type="submit">
                {submitting ? 'Updating...' : 'Update password'}
              </button>
              <Link className="go-secondary-btn" to={buildSignInPath(initialEmail || email)}>
                Back to sign in
              </Link>
            </div>
          </form>
        )}

        {state.status !== 'ready' && state.status !== 'idle' && (
          <div className={`go-inline-message ${state.tone}`}>
            <p>{state.message}</p>
          </div>
        )}
      </section>
    </main>
  )
}
