import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const buildSignInPath = (email = '', verified = false) => {
  const params = new URLSearchParams()

  params.set('tab', 'account')
  params.set('mode', 'signin')

  if (email) {
    params.set('email', email)
  }

  if (verified) {
    params.set('verified', '1')
  }

  return `/?${params.toString()}`
}

export function VerifyEmailPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = String(searchParams.get('token') || '').trim()
  const email = String(searchParams.get('email') || '').trim().toLowerCase()
  const previewUrl = String(searchParams.get('preview') || '').trim()
  const mailMode = String(searchParams.get('mailMode') || '').trim()
  const delivery = String(searchParams.get('delivery') || '').trim()
  const fromSignup = searchParams.get('sent') === '1' || Boolean(!token && email)
  const { resendVerification, signOut, verifyEmail } = useAuth()
  const [state, setState] = useState(() => ({
    message: token
      ? 'Verifying your email now...'
      : fromSignup
        ? `Congratulations. Your account has been created. Check ${email} for the verification link before signing in.`
        : 'Verification token is missing or invalid.',
    status: token ? 'loading' : fromSignup ? 'waiting' : 'error',
  }))
  const [resendState, setResendState] = useState({
    message: '',
    previewUrl,
    submitting: false,
    tone: delivery === 'warning' ? 'warning' : 'success',
  })

  useEffect(() => {
    if (!token) {
      return
    }

    let ignore = false
    let redirectTimer

    const runVerification = async () => {
      try {
        const response = await verifyEmail(token)
        const verifiedEmail = response.user?.email || email

        signOut()

        if (!ignore) {
          setState({
            message:
              'Email verified successfully. Redirecting you to sign in so you can continue to your dashboard.',
            status: 'success',
          })

          redirectTimer = window.setTimeout(() => {
            navigate(buildSignInPath(verifiedEmail, true), {
              replace: true,
            })
          }, 2400)
        }
      } catch (error) {
        if (!ignore) {
          setState({
            message: error.message || 'Unable to verify this email.',
            status: 'error',
          })
        }
      }
    }

    runVerification()

    return () => {
      ignore = true

      if (redirectTimer) {
        window.clearTimeout(redirectTimer)
      }
    }
  }, [email, navigate, signOut, token, verifyEmail])

  const handleResend = async () => {
    if (!email) {
      return
    }

    setResendState({
      message: '',
      previewUrl: '',
      submitting: true,
      tone: 'success',
    })

    try {
      const response = await resendVerification(email)

      setResendState({
        message: response.message || 'A fresh verification email is ready.',
        previewUrl: response.verificationPreviewUrl || '',
        submitting: false,
        tone: response.mailDelivered === false ? 'warning' : 'success',
      })
    } catch (error) {
      setResendState({
        message: error.message || 'Unable to resend verification right now.',
        previewUrl: '',
        submitting: false,
        tone: 'warning',
      })
    }
  }

  const isPreviewMode = Boolean(mailMode && mailMode !== 'smtp')
  const signInPath = buildSignInPath(email, state.status === 'success')

  return (
    <main className="go-verify-shell">
      <section className="go-verify-card go-verify-card--expanded">
        <div className="go-verify-icon">
          <i
            aria-hidden="true"
            className={`bi ${
              state.status === 'success'
                ? 'bi-patch-check-fill'
                : state.status === 'loading'
                  ? 'bi-arrow-repeat animate-spin'
                  : state.status === 'waiting'
                    ? 'bi-envelope-check-fill'
                    : 'bi-exclamation-octagon-fill'
            }`}
          />
        </div>

        <p className="go-verify-label">
          {token ? 'Email verification' : 'Verification centre'}
        </p>
        <h1>{token ? 'Account confirmation' : 'Congratulations'}</h1>
        <p className="go-verify-copy">{state.message}</p>

        {!token && email && (
          <div className="go-verify-email-chip">
            <i aria-hidden="true" className="bi bi-envelope-paper-heart" />
            <span>{email}</span>
          </div>
        )}

        {!token && (
          <div className="go-verify-note">
            <strong>What happens next</strong>
            <p>
              Open the verification email sent to your inbox. Once the link is clicked, the
              store will confirm the address, show a success message, and send you back to
              sign in before opening your dashboard.
            </p>
          </div>
        )}

        {(previewUrl || resendState.message) && (
          <div className={`go-inline-message ${resendState.tone}`}>
            {resendState.message && <p>{resendState.message}</p>}
            {previewUrl && !resendState.message && (
              <p>
                {isPreviewMode
                  ? 'This environment is using preview email. Open the verification link below.'
                  : 'Your verification email is ready.'}
              </p>
            )}
            {(resendState.previewUrl || previewUrl) && (
              <a
                href={resendState.previewUrl || previewUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open verification link
              </a>
            )}
          </div>
        )}

        <div className="go-verify-actions">
          {!token && email && (
            <button
              className="go-primary-btn"
              disabled={resendState.submitting}
              onClick={handleResend}
              type="button"
            >
              {resendState.submitting ? 'Sending...' : 'Resend verification'}
            </button>
          )}

          <Link
            className={token || email ? 'go-secondary-btn' : 'go-primary-btn'}
            to={signInPath}
          >
            Go to sign in
          </Link>

          <Link className="go-secondary-btn" to="/">
            Back home
          </Link>
        </div>
      </section>
    </main>
  )
}
