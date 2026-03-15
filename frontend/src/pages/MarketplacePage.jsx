import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AccountDashboard } from '../components/AccountDashboard'
import { useAuth } from '../hooks/useAuth'
import { useSiteSettings } from '../hooks/useSiteSettings'
import { useStore } from '../hooks/useStore'
import { api } from '../lib/api'
import { getStoredDeviceContext, setStoredDeviceContext } from '../lib/deviceContext'
import { formatCurrency } from '../utils/format'

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured first' },
  { value: 'price-asc', label: 'Price low to high' },
  { value: 'price-desc', label: 'Price high to low' },
  { value: 'name', label: 'Alphabetical' },
]

const TAB_ITEMS = [
  { icon: 'bi-house-door', label: 'Home', value: 'home' },
  { icon: 'bi-cart3', label: 'Cart', value: 'cart' },
  { icon: 'bi-bookmark-heart', label: 'Save', value: 'saved' },
  { icon: 'bi-person', label: 'Login/Sign up', value: 'account' },
]

const signInDefaults = {
  email: '',
  password: '',
}

const signUpDefaults = {
  email: '',
  fullName: '',
  acceptTerms: false,
  confirmPassword: '',
  newsletterOptIn: false,
  password: '',
  referralCode: '',
}

const TYPING_HEADLINES = [
  'What would you love to collect today?',
  'Discover signature watches, rings, and rare jewelry.',
  'Curated luxury pieces, delivered with a smoother experience.',
]
const FEATURED_VIDEO_ROTATION_MS = 5000
const PRODUCT_REFRESH_INTERVAL_MS = 15000

const CATEGORY_META = {
  All: {
    label: 'All categories',
  },
  Bangles: {
    label: 'Bangles',
  },
  Eyewear: {
    label: 'Eyewear',
  },
  Jewelry: {
    label: 'Jewelry',
  },
  Rings: {
    label: 'Rings',
  },
  Watches: {
    label: 'Watches',
  },
}

const createEmptyDeviceContext = () => ({
  city: '',
  country: '',
  latitude: null,
  locationLabel: '',
  longitude: null,
  timezone: '',
})

const getCategoryMeta = (category) =>
  CATEGORY_META[category] || {
    label: category,
  }

const normalizeReferralCodeInput = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16)

const getProductSnippet = (description, maxLength = 96) => {
  const normalized = String(description || '').trim()

  if (!normalized) {
    return 'A closer look at this collectible is available inside the product details.'
  }

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`
}

const getFeaturedVideoTitle = (video, index) =>
  String(video?.title || `Featured film ${index + 1}`).trim() || `Featured film ${index + 1}`

const handleInteractiveCardKeyDown = (event, onActivate) => {
  if (event.target !== event.currentTarget) {
    return
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onActivate()
  }
}

function CategoryIcon({ category }) {
  const strokeProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
  }

  if (category === 'All') {
    return (
      <svg aria-hidden="true" className="go-category-icon" viewBox="0 0 24 24">
        <rect {...strokeProps} height="6" rx="1.5" width="6" x="4" y="4" />
        <rect {...strokeProps} height="6" rx="1.5" width="6" x="14" y="4" />
        <rect {...strokeProps} height="6" rx="1.5" width="6" x="4" y="14" />
        <rect {...strokeProps} height="6" rx="1.5" width="6" x="14" y="14" />
      </svg>
    )
  }

  if (category === 'Bangles') {
    return (
      <svg aria-hidden="true" className="go-category-icon" viewBox="0 0 24 24">
        <circle {...strokeProps} cx="9.2" cy="10.6" r="4.4" />
        <circle {...strokeProps} cx="14.8" cy="13.4" r="4.4" />
        <circle cx="17.9" cy="7.8" fill="currentColor" r="1.1" stroke="none" />
      </svg>
    )
  }

  if (category === 'Eyewear') {
    return (
      <svg aria-hidden="true" className="go-category-icon" viewBox="0 0 24 24">
        <circle {...strokeProps} cx="8" cy="13" r="3.2" />
        <circle {...strokeProps} cx="16" cy="13" r="3.2" />
        <path {...strokeProps} d="M4.8 13H4l-1.2-2.2M19.2 13H20l1.2-2.2M11.2 13h1.6" />
      </svg>
    )
  }

  if (category === 'Jewelry') {
    return (
      <svg aria-hidden="true" className="go-category-icon" viewBox="0 0 24 24">
        <path {...strokeProps} d="M9 5h6l3 4-6 10L6 9l3-4Z" />
        <path {...strokeProps} d="M9 5l3 4 3-4M6 9h12" />
      </svg>
    )
  }

  if (category === 'Rings') {
    return (
      <svg aria-hidden="true" className="go-category-icon" viewBox="0 0 24 24">
        <circle {...strokeProps} cx="12" cy="14.4" r="4.6" />
        <path {...strokeProps} d="M12 5.2 14 7.2 12 9.2 10 7.2 12 5.2Z" />
        <path {...strokeProps} d="M12 9.2v1.6" />
      </svg>
    )
  }

  if (category === 'Watches') {
    return (
      <svg aria-hidden="true" className="go-category-icon" viewBox="0 0 24 24">
        <rect {...strokeProps} height="10" rx="4" width="8.6" x="7.7" y="7" />
        <path {...strokeProps} d="M10 7V4.6c0-.9.7-1.6 1.6-1.6h.8c.9 0 1.6.7 1.6 1.6V7" />
        <path {...strokeProps} d="M10 17v2.4c0 .9.7 1.6 1.6 1.6h.8c.9 0 1.6-.7 1.6-1.6V17" />
        <path {...strokeProps} d="M12 10v2.4l1.8 1.2" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" className="go-category-icon" viewBox="0 0 24 24">
      <path {...strokeProps} d="m12 4 2 4 4 .5-3 2.8.8 4.2-3.8-2.1L8.2 15.5 9 11.3 6 8.5 10 8l2-4Z" />
    </svg>
  )
}

const getBrowserTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

const getGreetingForTimezone = (timezone, timeValue = Date.now()) => {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone || getBrowserTimezone(),
    }).format(new Date(timeValue)),
  )

  if (hour < 12) {
    return 'Good morning'
  }

  if (hour < 18) {
    return 'Good afternoon'
  }

  return 'Good evening'
}

const createFallbackDeviceContext = (current = createEmptyDeviceContext()) => {
  const timezone = current.timezone || getBrowserTimezone()
  const locationLabel =
    current.locationLabel ||
    (timezone.includes('/') ? timezone.split('/').pop().replace(/_/g, ' ') : '')

  return {
    ...current,
    locationLabel,
    timezone,
  }
}

const getCurrentPositionAsync = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device.'))
      return
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 10 * 60 * 1000,
      timeout: 8000,
    })
  })

const createSettingsForm = (user) => ({
  defaultAddress: user?.defaultAddress || '',
  defaultCity: user?.defaultCity || '',
  defaultCountry: user?.defaultCountry || '',
  fullName: user?.fullName || '',
  newsletterOptIn: Boolean(user?.newsletterOptIn),
  phoneNumber: user?.phoneNumber || '',
})

const createCheckoutForm = (user) => ({
  address: user?.defaultAddress || '',
  city: user?.defaultCity || '',
  country: user?.defaultCountry || '',
  email: user?.email || '',
  name: user?.fullName || '',
  phone: user?.phoneNumber || '',
})

const FAVORITES_STORAGE_KEY = 'luxury-store-favorites'

const getStoredFavorites = () => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function FeaturedVideoShowcase({
  activeIndex,
  featuredVideos,
  onBrowseCollection,
  onPlaybackBlockedChange,
  onSelectVideo,
  storeName,
}) {
  const videoRef = useRef(null)
  const activeVideo = featuredVideos[activeIndex] || featuredVideos[0] || null
  const [manualPlaybackNeeded, setManualPlaybackNeeded] = useState(false)

  useEffect(() => {
    onPlaybackBlockedChange?.(manualPlaybackNeeded)
  }, [manualPlaybackNeeded, onPlaybackBlockedChange])

  const playVideo = ({ fromUser = false } = {}) => {
    const video = videoRef.current

    if (!video) {
      return
    }

    video.defaultMuted = true
    video.muted = true
    video.playsInline = true
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', 'true')

    const playback = video.play()

    if (playback && typeof playback.then === 'function') {
      playback
        .then(() => {
          setManualPlaybackNeeded(false)
        })
        .catch(() => {
          if (!fromUser) {
            setManualPlaybackNeeded(true)
          }
        })
      return
    }

    setManualPlaybackNeeded(false)
  }

  useEffect(() => {
    if (!activeVideo?.videoUrl) {
      return undefined
    }

    setManualPlaybackNeeded(false)

    const video = videoRef.current

    if (!video) {
      return undefined
    }

    const attemptPlayback = () => {
      playVideo()
    }

    const handlePlaying = () => {
      setManualPlaybackNeeded(false)
    }

    video.load()
    attemptPlayback()
    video.addEventListener('loadeddata', attemptPlayback)
    video.addEventListener('canplay', attemptPlayback)
    video.addEventListener('playing', handlePlaying)

    return () => {
      video.removeEventListener('loadeddata', attemptPlayback)
      video.removeEventListener('canplay', attemptPlayback)
      video.removeEventListener('playing', handlePlaying)
    }
  }, [activeVideo?.videoUrl])

  if (!activeVideo) {
    return null
  }

  return (
    <section className="go-featured-video-section">
      <div className="go-section-head">
        <div>
          <h2>Featured edit</h2>
          <p className="go-featured-video-kicker">Two to five clips. One luxury story in motion.</p>
        </div>
        <span className="go-featured-video-timer">5s slideshow</span>
      </div>

      <div className="go-featured-video-grid">
        <article className="go-featured-video-stage">
          <div className="go-featured-video-media">
            <video
              key={activeVideo.videoUrl}
              autoPlay
              className="go-featured-video-player"
              controls={false}
              controlsList="nodownload nofullscreen noremoteplayback"
              defaultMuted
              disablePictureInPicture
              disableRemotePlayback
              loop
              muted
              onClick={() => playVideo({ fromUser: true })}
              playsInline
              preload="auto"
              ref={videoRef}
              src={activeVideo.videoUrl}
            />
            {manualPlaybackNeeded && (
              <button
                className="go-featured-video-play-fallback"
                onClick={() => playVideo({ fromUser: true })}
                type="button"
              >
                <i aria-hidden="true" className="bi bi-play-fill" />
                Tap to play
              </button>
            )}
            <div className="go-featured-video-overlay">
              <span className="go-offer-badge">Asteria film</span>
              <p className="go-offer-eyebrow">{storeName || 'Asteria Luxury House'}</p>
              <h3>{getFeaturedVideoTitle(activeVideo, activeIndex)}</h3>
              <p>
                A moving look at the pieces, finish, and atmosphere behind today&apos;s standout edit.
              </p>
              <button className="go-primary-btn go-primary-btn--light" onClick={onBrowseCollection} type="button">
                Browse collection
              </button>
            </div>
          </div>
        </article>
      </div>

      <div className="go-indicators">
        {featuredVideos.map((video, index) => (
          <button
            key={`${video.videoUrl}-${index}`}
            aria-label={`View featured video ${index + 1}`}
            className={`go-indicator ${activeIndex === index ? 'active' : ''}`}
            onClick={() => onSelectVideo(index)}
            type="button"
          />
        ))}
      </div>
    </section>
  )
}

function HighlightOffer({ onAddToCart, onOpenProduct, products }) {
  const featuredCollection = products.slice(0, 2)

  if (featuredCollection.length === 0) {
    return null
  }

  return (
    <section className="go-collection-section">
      <div className="go-section-head">
        <h2>Collectors Edition</h2>
      </div>

      <div className="go-collection-grid">
        {featuredCollection.map((product) => (
          <article
            key={product.id}
            className="go-collection-card"
            onClick={() => onOpenProduct(product)}
            onKeyDown={(event) => handleInteractiveCardKeyDown(event, () => onOpenProduct(product))}
            role="button"
            tabIndex={0}
          >
            <div className="go-collection-copy">
              <p>{product.badge || product.category}</p>
              <h3>{product.name}</h3>
              <strong>{formatCurrency(product.price)}</strong>
              <span className="go-collection-summary">{getProductSnippet(product.description, 70)}</span>
            </div>
            <button
              className="go-primary-btn"
              onClick={(event) => {
                event.stopPropagation()
                onAddToCart(product.id)
              }}
              type="button"
            >
              Add to cart
            </button>
            <div className="go-collection-media">
              <img alt={product.name} src={product.imageUrl} />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function ProductTile({ busy, isSaved, onAddToCart, onOpenProduct, onToggleSaved, product }) {
  const rating = (4.6 + ((product.id % 3) * 0.1)).toFixed(1)
  const reviews = 12 + product.id * 5
  const revealDelay = `${(product.id % 6) * 55}`

  return (
    <article
      className="go-product-card go-reveal"
      data-reveal
      data-reveal-delay={revealDelay}
      onClick={() => onOpenProduct(product)}
      onKeyDown={(event) => handleInteractiveCardKeyDown(event, () => onOpenProduct(product))}
      role="button"
      tabIndex={0}
    >
      <div className="go-product-media">
        <img alt={product.name} className="go-product-image" src={product.imageUrl} />
        <button
          aria-label={isSaved ? 'Remove from saved' : 'Save item'}
          className={`go-heart-btn ${isSaved ? 'saved' : ''}`}
          onClick={(event) => {
            event.stopPropagation()
            onToggleSaved(product.id)
          }}
          type="button"
        >
          <i className={`bi ${isSaved ? 'bi-heart-fill' : 'bi-heart'}`} aria-hidden="true" />
        </button>
        <div className="go-rating-pill">
          <i className="bi bi-star-fill" aria-hidden="true" />
          {rating} ({reviews})
        </div>
      </div>

      <div className="go-product-content">
        <p className="go-product-category">{product.category}</p>
        <h3 className="go-product-title">{product.name}</h3>
        <p className="go-product-summary">{getProductSnippet(product.description, 78)}</p>
        <div className="go-product-footer">
          <div>
            <p className="go-product-price">{formatCurrency(product.price)}</p>
            <p className="go-product-meta">{product.badge || `${product.stockQuantity} left`}</p>
          </div>

          <button
            className="go-plus-btn"
            disabled={busy || product.stockQuantity === 0}
            onClick={(event) => {
              event.stopPropagation()
              onAddToCart(product.id)
            }}
            type="button"
          >
            <i
              className={`bi ${busy ? 'bi-arrow-repeat animate-spin' : 'bi-plus-lg'}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </article>
  )
}

function CartItemCard({ busyKey, item, onQuantityChange }) {
  return (
    <article className="go-cart-item">
      <img alt={item.name} className="go-cart-thumb" src={item.imageUrl} />
      <div className="go-cart-copy">
        <div>
          <p className="go-product-category">{item.category}</p>
          <h3>{item.name}</h3>
          <p className="go-cart-price">{formatCurrency(item.lineTotal)}</p>
        </div>

        <div className="go-qty-row">
          <div className="go-qty-pill">
            <button
              disabled={busyKey === item.productId}
              onClick={() => onQuantityChange(item.productId, item.quantity - 1)}
              type="button"
            >
              <i className="bi bi-dash" aria-hidden="true" />
            </button>
            <span>{item.quantity}</span>
            <button
              disabled={busyKey === item.productId || item.quantity >= item.stockQuantity}
              onClick={() => onQuantityChange(item.productId, item.quantity + 1)}
              type="button"
            >
              <i className="bi bi-plus" aria-hidden="true" />
            </button>
          </div>

          <button
            className="go-remove-link"
            disabled={busyKey === item.productId}
            onClick={() => onQuantityChange(item.productId, 0)}
            type="button"
          >
            Remove
          </button>
        </div>
      </div>
    </article>
  )
}

function AccountPanel({
  authMode,
  dashboard,
  emailVerificationEnabled,
  messageTone,
  message,
  onAuthModeChange,
  onFieldChange,
  onForgotPassword,
  onReferralBlur,
  onResendVerification,
  onSettingsFieldChange,
  onSettingsSubmit,
  onSubmit,
  orders,
  previewUrl,
  referralChecking,
  referralMessage,
  referralTone,
  settingsForm,
  settingsMessage,
  settingsSubmitting,
  settingsTone,
  signInForm,
  signOut,
  signUpForm,
  submitting,
  user,
}) {
  const [showSignInPassword, setShowSignInPassword] = useState(false)
  const [showSignUpPassword, setShowSignUpPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const authSubtitle =
    authMode === 'signin'
      ? 'Sign in to continue exploring Asteria Luxury House.'
      : 'Create your account to start shopping with a smoother luxury checkout.'

  if (user) {
    return (
      <AccountDashboard
        dashboard={dashboard}
        emailVerificationEnabled={emailVerificationEnabled}
        message={message}
        messageTone={messageTone}
        onFieldChange={onSettingsFieldChange}
        onResendVerification={onResendVerification}
        onSettingsSubmit={onSettingsSubmit}
        orders={orders}
        previewUrl={previewUrl}
        settingsForm={settingsForm}
        settingsMessage={settingsMessage}
        settingsSubmitting={settingsSubmitting}
        settingsTone={settingsTone}
        signOut={signOut}
        user={user}
      />
    )
  }

  return (
    <section className="go-tab-panel go-reveal" data-reveal data-reveal-delay="40">
      <div className="go-auth-shell go-auth-shell--single">
        <div className="go-auth-card go-auth-card--single">
          <div className="go-auth-header">
            {authMode === 'signin' && <div className="go-auth-hero-mark">{'\u{1F44B}'}</div>}
            <h2>{authMode === 'signin' ? 'Welcome Back!' : 'Create Account'}</h2>
            <p className="go-auth-subtitle">{authSubtitle}</p>
          </div>

          <form className="go-auth-form go-auth-form--plain" onSubmit={onSubmit}>
            {authMode === 'signup' && (
              <label className="go-field">
                <span>Full name</span>
                <div className="go-auth-input-wrap">
                  <i aria-hidden="true" className="bi bi-person-fill go-auth-input-icon" />
                  <input
                    name="fullName"
                    placeholder="Enter your full name"
                    required
                    type="text"
                    value={signUpForm.fullName}
                    onChange={onFieldChange}
                  />
                </div>
              </label>
            )}

            <label className="go-field">
              <span>{authMode === 'signin' ? 'Email address' : 'Email'}</span>
              <div className="go-auth-input-wrap">
                <i aria-hidden="true" className="bi bi-envelope-fill go-auth-input-icon" />
                <input
                  name="email"
                  placeholder="Enter your email"
                  required
                  type="email"
                  value={authMode === 'signin' ? signInForm.email : signUpForm.email}
                  onChange={onFieldChange}
                />
              </div>
            </label>

            <div className={authMode === 'signup' ? 'go-auth-field-grid' : ''}>
              <label className="go-field">
                <span>Password</span>
                <div className="go-auth-input-wrap">
                  <i aria-hidden="true" className="bi bi-lock-fill go-auth-input-icon" />
                  <input
                    name="password"
                    placeholder="Enter your password"
                    required
                    type={
                      authMode === 'signin'
                        ? showSignInPassword
                          ? 'text'
                          : 'password'
                        : showSignUpPassword
                          ? 'text'
                          : 'password'
                    }
                    value={authMode === 'signin' ? signInForm.password : signUpForm.password}
                    onChange={onFieldChange}
                  />
                  <button
                    className="go-auth-visibility-btn"
                    onClick={() =>
                      authMode === 'signin'
                        ? setShowSignInPassword((current) => !current)
                        : setShowSignUpPassword((current) => !current)
                    }
                    type="button"
                  >
                    <i
                      aria-hidden="true"
                      className={`bi ${
                        authMode === 'signin'
                          ? showSignInPassword
                            ? 'bi-eye-slash'
                            : 'bi-eye'
                          : showSignUpPassword
                            ? 'bi-eye-slash'
                            : 'bi-eye'
                      }`}
                    />
                  </button>
                </div>
              </label>

              {authMode === 'signup' && (
                <label className="go-field">
                  <span>Confirm password</span>
                  <div className="go-auth-input-wrap">
                    <i aria-hidden="true" className="bi bi-shield-lock-fill go-auth-input-icon" />
                    <input
                      name="confirmPassword"
                      placeholder="Confirm your password"
                      required
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={signUpForm.confirmPassword}
                      onChange={onFieldChange}
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
              )}
            </div>

            {authMode === 'signin' && (
              <div className="go-auth-inline-row">
                <button className="go-auth-inline-action" onClick={onForgotPassword} type="button">
                  Forgot password?
                </button>
              </div>
            )}

            {authMode === 'signup' && (
              <>
                <div className="go-auth-separator">
                  <span>Optional</span>
                </div>

                <label className="go-field">
                  <span>Referral code</span>
                  <div className="go-auth-input-wrap">
                    <i aria-hidden="true" className="bi bi-gift-fill go-auth-input-icon" />
                    <input
                      name="referralCode"
                      placeholder="Enter referral code"
                      type="text"
                      value={signUpForm.referralCode}
                      onBlur={onReferralBlur}
                      onChange={onFieldChange}
                    />
                  </div>
                </label>

                {(referralMessage || referralChecking) && (
                  <div className={`go-auth-note-card ${referralTone || 'info'}`}>
                    <i
                      aria-hidden="true"
                      className={`bi ${
                        referralChecking
                          ? 'bi-arrow-repeat'
                          : referralTone === 'success'
                            ? 'bi-check-circle-fill'
                            : 'bi-info-circle-fill'
                      }`}
                    />
                    <p>{referralChecking ? 'Checking referral code...' : referralMessage}</p>
                  </div>
                )}

                <label className="go-auth-checkbox">
                  <input
                    checked={signUpForm.acceptTerms}
                    name="acceptTerms"
                    type="checkbox"
                    onChange={onFieldChange}
                  />
                  <span>
                    I agree to the <strong>Terms &amp; Conditions</strong>
                  </span>
                </label>
              </>
            )}

            <div className="go-auth-actions">
              <button className="go-primary-btn go-auth-submit" disabled={submitting} type="submit">
                {submitting ? 'Working...' : authMode === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
              <button
                className="go-auth-secondary-btn"
                onClick={() => onAuthModeChange(authMode === 'signin' ? 'signup' : 'signin')}
                type="button"
              >
                {authMode === 'signin' ? 'Create free account' : 'Back to sign in'}
              </button>
            </div>
          </form>

          {message && (
            <div className={`go-inline-message ${messageTone}`}>
              <p>{message}</p>
              {previewUrl && (
                <a href={previewUrl} rel="noreferrer" target="_blank">
                  Open verification link
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function CheckoutSheet({
  error,
  formValues,
  isOpen,
  mailDelivered,
  isSubmitting,
  itemsCount,
  onChange,
  onClose,
  onPaymentMethodChange,
  onProofChange,
  onSubmit,
  order,
  orderPreviewUrl,
  orderTotal,
  paymentConfig,
  paymentMethod,
  proofFileName,
}) {
  if (!isOpen) {
    return null
  }

  const bankTransferEnabled = paymentConfig?.bankTransfer?.enabled !== false
  const paystackEnabled = Boolean(paymentConfig?.paystack?.enabled)
  const isBankTransfer = paymentMethod === 'bank_transfer'
  const orderIsBankTransfer = order?.paymentMethod === 'bank_transfer'
  const submitDisabled =
    isSubmitting || (isBankTransfer ? !bankTransferEnabled : !paystackEnabled)

  return (
    <div className="go-modal-backdrop">
      <div className="go-modal-card">
        <div className="go-modal-head">
          <div>
            <p>{order ? 'Order confirmed' : 'Checkout'}</p>
            <h2>{order ? order.orderNumber : 'Complete your order'}</h2>
          </div>
          <button onClick={onClose} type="button">
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        {order ? (
          <div className="go-order-success">
            <div className={`go-success-banner ${orderIsBankTransfer ? 'pending' : ''}`}>
              <i
                className={`bi ${
                  orderIsBankTransfer ? 'bi-hourglass-split' : 'bi-check2-circle'
                }`}
                aria-hidden="true"
              />
              {orderIsBankTransfer ? 'Proof uploaded for review' : 'Payment verified and order confirmed'}
            </div>
            <div className="go-order-summary-grid">
              <div className="go-mini-card">
                <span>Total</span>
                <strong>{formatCurrency(order.total)}</strong>
              </div>
              <div className="go-mini-card">
                <span>Payment</span>
                <strong>{order.paymentMethod === 'paystack' ? 'Paystack' : 'Bank transfer'}</strong>
              </div>
              <div className="go-mini-card">
                <span>Status</span>
                <strong>{order.paymentStatus === 'paid' ? 'Paid' : 'Awaiting review'}</strong>
              </div>
            </div>
            <div className={`go-inline-message ${orderIsBankTransfer ? 'warning' : 'success'}`}>
              <p>
                {orderIsBankTransfer
                  ? 'Your proof of payment has been submitted. Our team will confirm the transfer and update your order.'
                  : 'Your payment has been confirmed and your order is now being prepared.'}
              </p>
              {order.paymentProofUrl && (
                <a href={order.paymentProofUrl} rel="noreferrer" target="_blank">
                  Open uploaded proof
                </a>
              )}
            </div>
            {orderPreviewUrl && (
              <div className={`go-inline-message ${mailDelivered ? 'success' : 'warning'}`}>
                <p>{orderIsBankTransfer ? 'Acknowledgement email is ready.' : 'Order confirmation is ready.'}</p>
                <a href={orderPreviewUrl} rel="noreferrer" target="_blank">
                  {orderIsBankTransfer ? 'Open acknowledgement preview' : 'Open confirmation preview'}
                </a>
              </div>
            )}
            <button className="go-primary-btn" onClick={onClose} type="button">
              Continue shopping
            </button>
          </div>
        ) : (
          <form className="go-checkout-form" onSubmit={onSubmit}>
            <div className="go-checkout-banner">
              <strong>Choose how you want to pay</strong>
              <p>
                {itemsCount} item(s) will be linked to your account and processed through
                {isBankTransfer ? ' manual transfer review.' : ' secure Paystack checkout.'}
              </p>
            </div>

            <div className="go-checkout-grid">
              <label className="go-field">
                <span>Full name</span>
                <input
                  name="name"
                  placeholder="Ada Obi"
                  required
                  type="text"
                  value={formValues.name}
                  onChange={onChange}
                />
              </label>

              <label className="go-field">
                <span>Email</span>
                <input
                  name="email"
                  placeholder="ada@example.com"
                  required
                  type="email"
                  value={formValues.email}
                  onChange={onChange}
                />
              </label>

              <label className="go-field">
                <span>Phone</span>
                <input
                  name="phone"
                  placeholder="+1 555 123 4567"
                  type="tel"
                  value={formValues.phone}
                  onChange={onChange}
                />
              </label>

              <label className="go-field">
                <span>Country</span>
                <input
                  name="country"
                  placeholder="United States"
                  required
                  type="text"
                  value={formValues.country}
                  onChange={onChange}
                />
              </label>
            </div>

            <label className="go-field">
              <span>Address</span>
              <textarea
                name="address"
                placeholder="14 Riverstone Crescent"
                required
                value={formValues.address}
                onChange={onChange}
              />
            </label>

            <label className="go-field">
              <span>City</span>
              <input
                name="city"
                placeholder="New York"
                required
                type="text"
                value={formValues.city}
                onChange={onChange}
              />
            </label>

            <div className="go-payment-methods">
              <button
                className={`go-payment-method ${paymentMethod === 'paystack' ? 'active' : ''}`}
                disabled={!paystackEnabled}
                onClick={() => onPaymentMethodChange('paystack')}
                type="button"
              >
                <div className="go-payment-method__icon">
                  <i className="bi bi-credit-card-2-front" aria-hidden="true" />
                </div>
                <div>
                  <strong>Paystack</strong>
                  <span>
                    {paystackEnabled
                      ? 'Continue to a secure hosted card or bank checkout.'
                      : 'Paystack is not configured on this server yet.'}
                  </span>
                </div>
              </button>

              <button
                className={`go-payment-method ${paymentMethod === 'bank_transfer' ? 'active' : ''}`}
                disabled={!bankTransferEnabled}
                onClick={() => onPaymentMethodChange('bank_transfer')}
                type="button"
              >
                <div className="go-payment-method__icon">
                  <i className="bi bi-bank" aria-hidden="true" />
                </div>
                <div>
                  <strong>Bank transfer</strong>
                  <span>
                    {bankTransferEnabled
                      ? 'Transfer manually and upload proof for review.'
                      : 'Bank transfer is unavailable right now.'}
                  </span>
                </div>
              </button>
            </div>

            {isBankTransfer ? (
              <div className="go-bank-transfer-panel">
                <div className="go-bank-transfer-card">
                  <span>Bank</span>
                  <strong>{paymentConfig?.bankTransfer?.bankName || 'Set BANK_NAME in backend/.env'}</strong>
                </div>
                <div className="go-bank-transfer-card">
                  <span>Account name</span>
                  <strong>{paymentConfig?.bankTransfer?.accountName || 'Set BANK_ACCOUNT_NAME'}</strong>
                </div>
                <div className="go-bank-transfer-card">
                  <span>Account number</span>
                  <strong>{paymentConfig?.bankTransfer?.accountNumber || 'Set BANK_ACCOUNT_NUMBER'}</strong>
                </div>

                <div className="go-transfer-note">
                  <i className="bi bi-info-circle" aria-hidden="true" />
                  <p>
                    {paymentConfig?.bankTransfer?.instructions ||
                      'Transfer the full amount, then upload proof of payment to complete submission.'}
                  </p>
                </div>

                <label className="go-proof-upload">
                  <input accept=".jpg,.jpeg,.png,.pdf" name="proof" type="file" onChange={onProofChange} />
                  <span className="go-proof-upload__cta">
                    <i className="bi bi-cloud-arrow-up" aria-hidden="true" />
                    {proofFileName ? 'Replace proof file' : 'Upload proof of payment'}
                  </span>
                  <small>
                    {proofFileName
                      ? proofFileName
                      : `Accepted: JPG, PNG, PDF up to ${paymentConfig?.bankTransfer?.maxProofSizeMb || 5}MB`}
                  </small>
                </label>
              </div>
            ) : (
              <div className="go-paystack-panel">
                <div className="go-paystack-panel__icon">
                  <i className="bi bi-shield-lock" aria-hidden="true" />
                </div>
                <div>
                  <strong>Hosted by Paystack</strong>
                  <p>
                    You will be redirected to Paystack to complete your payment securely, then
                    returned here for automatic verification.
                  </p>
                </div>
              </div>
            )}

            {error && <div className="go-inline-message warning">{error}</div>}

            <div className="go-checkout-summary">
              <div className="go-mini-card">
                <span>Items</span>
                <strong>{itemsCount}</strong>
              </div>
              <div className="go-mini-card">
                <span>Total</span>
                <strong>{formatCurrency(orderTotal)}</strong>
              </div>
            </div>

            <button className="go-primary-btn" disabled={submitDisabled} type="submit">
              {isSubmitting
                ? isBankTransfer
                  ? 'Submitting proof...'
                  : 'Redirecting to Paystack...'
                : isBankTransfer
                  ? 'Submit transfer proof'
                  : 'Continue to Paystack'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function SignOutSheet({ isOpen, isSubmitting, onCancel, onConfirm }) {
  if (!isOpen) {
    return null
  }

  return (
    <div
      className="go-modal-backdrop"
      onClick={isSubmitting ? undefined : onCancel}
      role="presentation"
    >
      <div
        aria-labelledby="go-signout-title"
        aria-modal="true"
        className="go-modal-card go-modal-card--confirm"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="go-modal-head">
          <div>
            <p>Confirm sign out</p>
            <h2 id="go-signout-title">Leave your dashboard?</h2>
          </div>
          <button
            aria-label="Close sign out confirmation"
            disabled={isSubmitting}
            onClick={onCancel}
            type="button"
          >
            <i aria-hidden="true" className="bi bi-x-lg" />
          </button>
        </div>

        <div className="go-confirm-sheet">
          <p>
            Your orders, saved pieces, and profile details will still be here when you return.
            Would you like to sign out now?
          </p>

          <div className="go-confirm-sheet__actions">
            <button className="go-secondary-btn" disabled={isSubmitting} onClick={onCancel} type="button">
              No, stay here
            </button>
            <button className="go-primary-btn" disabled={isSubmitting} onClick={onConfirm} type="button">
              {isSubmitting ? 'Signing out...' : 'Yes, sign out'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductDetailSheet({
  error,
  isCheckoutSubmitting,
  isLoading,
  isOpen,
  isSaving,
  onAddToCart,
  onClose,
  onProceedToCheckout,
  product,
}) {
  if (!isOpen) {
    return null
  }

  const isOutOfStock = Number(product?.stockQuantity || 0) <= 0

  return (
    <div className="go-modal-backdrop" onClick={onClose} role="presentation">
      <div
        aria-labelledby="go-product-detail-title"
        aria-modal="true"
        className="go-modal-card go-modal-card--product"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="go-modal-head">
          <div>
            <p>{product?.category || 'Product details'}</p>
            <h2 id="go-product-detail-title">{product?.name || 'Loading product'}</h2>
          </div>
          <button aria-label="Close product details" onClick={onClose} type="button">
            <i aria-hidden="true" className="bi bi-x-lg" />
          </button>
        </div>

        {!product ? (
          <div className="go-product-detail go-product-detail--empty">
            <div className="go-empty-state go-empty-state--compact">
              <div className="go-spinner" />
              <p>Loading product details...</p>
            </div>
          </div>
        ) : (
          <div className="go-product-detail">
            <div className="go-product-detail__media">
              <img alt={product.name} src={product.imageUrl} />
            </div>

            <div className="go-product-detail__copy">
              <div className="go-product-detail__chips">
                <span className="go-dashboard-chip">{product.category}</span>
                {product.badge ? <span className="go-dashboard-chip">{product.badge}</span> : null}
                <span className={`go-status-pill ${isOutOfStock ? 'neutral' : 'success'}`}>
                  {isOutOfStock ? 'Sold out' : `${product.stockQuantity} ready`}
                </span>
              </div>

              <p className="go-product-detail__price">{formatCurrency(product.price)}</p>
              <p className="go-product-detail__description">{product.description}</p>

              <div className="go-product-detail__highlights">
                <article>
                  <span>Availability</span>
                  <strong>{isOutOfStock ? 'Currently unavailable' : 'Ready for delivery'}</strong>
                </article>
                <article>
                  <span>Best for</span>
                  <strong>{product.badge || 'Curated luxury collectors'}</strong>
                </article>
              </div>

              {error ? (
                <div className="go-inline-message warning">
                  <p>{error}</p>
                </div>
              ) : null}

              {isLoading ? (
                <div className="go-inline-message success">
                  <p>Refreshing the latest product details...</p>
                </div>
              ) : null}

              <div className="go-product-detail__actions">
                <button
                  className="go-secondary-btn"
                  disabled={isSaving || isOutOfStock}
                  onClick={() => onAddToCart(product.id, { showAddedSheet: false })}
                  type="button"
                >
                  {isSaving ? 'Adding...' : 'Add to cart'}
                </button>
                <button
                  className="go-primary-btn"
                  disabled={isCheckoutSubmitting || isOutOfStock}
                  onClick={() => onProceedToCheckout(product)}
                  type="button"
                >
                  {isCheckoutSubmitting ? 'Opening checkout...' : 'Proceed to checkout'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function MarketplacePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    dashboard,
    loading: authLoading,
    orders,
    refreshProfile,
    resendVerification,
    signIn,
    signOut,
    signUp,
    updateSettings,
    user,
    token,
  } = useAuth()
  const {
    addToCart,
    busyKey,
    cart,
    cartLoading,
    changeQuantity,
    clearCart,
    initializePaystackCheckout,
    paymentConfig,
    submitBankTransfer,
    verifyPaystackCheckout,
  } = useStore()
  const { publicSettings } = useSiteSettings()
  const headlineOptions =
    publicSettings.heroHeadlines?.length > 0 ? publicSettings.heroHeadlines : TYPING_HEADLINES

  const initialTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(
    TAB_ITEMS.some((item) => item.value === initialTab) ? initialTab : 'home',
  )
  const [allProducts, setAllProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [sortOrder, setSortOrder] = useState('featured')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [featuredVideoIndex, setFeaturedVideoIndex] = useState(0)
  const [featuredVideoPlaybackBlocked, setFeaturedVideoPlaybackBlocked] = useState(false)
  const [savedIds, setSavedIds] = useState(() => getStoredFavorites())
  const [deviceContext, setDeviceContext] = useState(() =>
    createFallbackDeviceContext(getStoredDeviceContext()),
  )
  const [clockTick, setClockTick] = useState(() => Date.now())
  const [locationStatus, setLocationStatus] = useState('idle')
  const [typedHeadline, setTypedHeadline] = useState(headlineOptions[0])
  const [typedHeadlineIndex, setTypedHeadlineIndex] = useState(0)
  const [typedCharIndex, setTypedCharIndex] = useState(headlineOptions[0].length)
  const [typingDirection, setTypingDirection] = useState('hold')
  const [flashMessage, setFlashMessage] = useState(null)
  const [bootLoading, setBootLoading] = useState(true)
  const [recentlyAddedProduct, setRecentlyAddedProduct] = useState(null)
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [productDetailOpen, setProductDetailOpen] = useState(false)
  const [productDetailLoading, setProductDetailLoading] = useState(false)
  const [productDetailError, setProductDetailError] = useState('')
  const [checkoutLaunchProductId, setCheckoutLaunchProductId] = useState(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [confirmedOrder, setConfirmedOrder] = useState(null)
  const [checkoutMailDelivered, setCheckoutMailDelivered] = useState(true)
  const [checkoutPreviewUrl, setCheckoutPreviewUrl] = useState('')
  const [checkoutIntent, setCheckoutIntent] = useState(false)
  const [checkoutMethod, setCheckoutMethod] = useState('paystack')
  const [checkoutProofFile, setCheckoutProofFile] = useState(null)
  const [checkoutProofName, setCheckoutProofName] = useState('')
  const [verifyingPaystackReference, setVerifyingPaystackReference] = useState('')
  const [checkoutForm, setCheckoutForm] = useState(() => createCheckoutForm(user))
  const [authMode, setAuthMode] = useState('signin')
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [authMessageTone, setAuthMessageTone] = useState('success')
  const [authPreviewUrl, setAuthPreviewUrl] = useState('')
  const [referralChecking, setReferralChecking] = useState(false)
  const [referralMessage, setReferralMessage] = useState('')
  const [referralTone, setReferralTone] = useState('info')
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const [logoutSubmitting, setLogoutSubmitting] = useState(false)
  const [settingsForm, setSettingsForm] = useState(() => createSettingsForm(user))
  const [settingsSubmitting, setSettingsSubmitting] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState('')
  const [settingsTone, setSettingsTone] = useState('success')
  const [signInForm, setSignInForm] = useState(signInDefaults)
  const [signUpForm, setSignUpForm] = useState(signUpDefaults)
  const deferredSearch = useDeferredValue(searchInput)

  useEffect(() => {
    let ignore = false

    const loadProducts = async ({ silent = false } = {}) => {
      if (!silent) {
        setLoadingProducts(true)
      }

      try {
        const response = await api.getProducts({ sort: 'featured' })

        if (!ignore) {
          setAllProducts(response.products || [])
        }
      } catch (error) {
        if (!ignore && !silent) {
          setFlashMessage({
            text: error.message || 'Unable to load the collection right now.',
            type: 'warning',
          })
        }
      } finally {
        if (!ignore && !silent) {
          setLoadingProducts(false)
        }
      }
    }

    const refreshSilently = () => {
      if (document.hidden) {
        return
      }

      loadProducts({ silent: true }).catch(() => {})
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshSilently()
      }
    }

    loadProducts()
    const timer = window.setInterval(refreshSilently, PRODUCT_REFRESH_INTERVAL_MS)
    window.addEventListener('focus', refreshSilently)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      ignore = true
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshSilently)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(savedIds))
  }, [savedIds])

  useEffect(() => {
    setStoredDeviceContext(deviceContext)
  }, [deviceContext])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick(Date.now())
    }, 60 * 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (user?.lastKnownLocation || user?.lastKnownTimezone) {
      setDeviceContext((current) =>
        createFallbackDeviceContext({
          ...current,
          city: user.defaultCity || current.city,
          country: user.defaultCountry || current.country,
          latitude: user.lastKnownLatitude ?? current.latitude,
          locationLabel: user.lastKnownLocation || current.locationLabel,
          longitude: user.lastKnownLongitude ?? current.longitude,
          timezone: user.lastKnownTimezone || current.timezone,
        }),
      )
    }
  }, [
    user?.defaultCity,
    user?.defaultCountry,
    user?.lastKnownLatitude,
    user?.lastKnownLocation,
    user?.lastKnownLongitude,
    user?.lastKnownTimezone,
  ])

  useEffect(() => {
    const fullText = headlineOptions[typedHeadlineIndex] || headlineOptions[0]
    let timeout

    if (typingDirection === 'hold') {
      timeout = window.setTimeout(() => {
        setTypingDirection('delete')
      }, 1800)
    } else if (typingDirection === 'type') {
      timeout = window.setTimeout(() => {
        const nextIndex = Math.min(typedCharIndex + 1, fullText.length)
        setTypedCharIndex(nextIndex)
        setTypedHeadline(fullText.slice(0, nextIndex))

        if (nextIndex >= fullText.length) {
          setTypingDirection('hold')
        }
      }, 52)
    } else {
      timeout = window.setTimeout(() => {
        const nextIndex = Math.max(typedCharIndex - 1, 0)
        setTypedCharIndex(nextIndex)
        setTypedHeadline(fullText.slice(0, nextIndex))

        if (nextIndex === 0) {
          const nextHeadlineIndex = (typedHeadlineIndex + 1) % headlineOptions.length
          setTypedHeadlineIndex(nextHeadlineIndex)
          setTypingDirection('type')
        }
      }, 28)
    }

    return () => {
      window.clearTimeout(timeout)
    }
  }, [headlineOptions, typedCharIndex, typedHeadlineIndex, typingDirection])

  useEffect(() => {
    setTypedHeadlineIndex(0)
    setTypedCharIndex(headlineOptions[0].length)
    setTypedHeadline(headlineOptions[0])
    setTypingDirection('hold')
  }, [headlineOptions])

  useEffect(() => {
    setSettingsMessage('')
    setSettingsTone('success')

    if (!user) {
      setSettingsForm(createSettingsForm(null))
      setCheckoutForm(createCheckoutForm(null))
      return
    }

    setSettingsForm(createSettingsForm(user))
    setCheckoutForm((current) => ({
      ...current,
      address: current.address || user.defaultAddress || '',
      city: current.city || user.defaultCity || '',
      country: current.country || user.defaultCountry || '',
      email: current.email || user.email || '',
      name: current.name || user.fullName || '',
      phone: current.phone || user.phoneNumber || '',
    }))
  }, [user])

  useEffect(() => {
    const nextTab = searchParams.get('tab')

    if (TAB_ITEMS.some((item) => item.value === nextTab)) {
      setActiveTab(nextTab)
      return
    }

    setActiveTab('home')
  }, [searchParams])

  useEffect(() => {
    if (activeTab !== 'home' && sortMenuOpen) {
      setSortMenuOpen(false)
    }
  }, [activeTab, sortMenuOpen])

  useEffect(() => {
    const requestedMode = searchParams.get('mode')
    const requestedEmail = String(searchParams.get('email') || '').trim()
    const requestedReferralCode = normalizeReferralCodeInput(searchParams.get('ref'))
    const verified = searchParams.get('verified') === '1'

    if (requestedMode === 'signin' || requestedMode === 'signup') {
      setAuthMode(requestedMode)
    }

    if (requestedEmail) {
      setSignInForm((current) => ({
        ...current,
        email: requestedEmail,
        password: verified ? '' : current.password,
      }))
    }

    if (requestedReferralCode) {
      setAuthMode('signup')
      setSignUpForm((current) => ({
        ...current,
        referralCode: current.referralCode || requestedReferralCode,
      }))
    }

    if (verified && !user) {
      setAuthMode('signin')
      setAuthMessage('Email verified successfully. Sign in to continue to your dashboard.')
      setAuthMessageTone('success')
      setAuthPreviewUrl('')
    }
  }, [searchParams, user])

  useEffect(() => {
    if (!flashMessage) {
      return
    }

    const timer = window.setTimeout(() => {
      setFlashMessage(null)
    }, 3500)

    return () => {
      window.clearTimeout(timer)
    }
  }, [flashMessage])

  useEffect(() => {
    if (!recentlyAddedProduct) {
      return
    }

    const timer = window.setTimeout(() => {
      setRecentlyAddedProduct(null)
    }, 4200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [recentlyAddedProduct])

  useEffect(() => {
    if (!productDetailOpen || !selectedProductId) {
      return
    }

    let ignore = false

    setProductDetailLoading(true)
    setProductDetailError('')

    api
      .getProduct(selectedProductId)
      .then((response) => {
        if (!ignore) {
          setSelectedProduct(response.product)
        }
      })
      .catch((error) => {
        if (!ignore) {
          setProductDetailError(error.message || 'Unable to load the latest product details right now.')
        }
      })
      .finally(() => {
        if (!ignore) {
          setProductDetailLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [productDetailOpen, selectedProductId])

  useEffect(() => {
    if (!user || !checkoutIntent) {
      return
    }

    setCheckoutIntent(false)
    setSearchParams({ tab: 'cart' })
    setActiveTab('cart')
    setFlashMessage({
      text: 'You are signed in. Continue with checkout.',
      type: 'success',
    })
    setCheckoutOpen(true)
  }, [checkoutIntent, setSearchParams, user])

  useEffect(() => {
    if (paymentConfig?.paystack?.enabled || !paymentConfig?.bankTransfer?.enabled) {
      return
    }

    setCheckoutMethod('bank_transfer')
  }, [paymentConfig])

  useEffect(() => {
    const payment = searchParams.get('payment')
    const reference = searchParams.get('reference')

    if (payment !== 'paystack' || !reference || authLoading || verifyingPaystackReference === reference) {
      return
    }

    if (!user || !token) {
      setCheckoutIntent(true)
      setAuthMode('signin')
      setAuthMessage('Sign in to complete Paystack payment verification for your order.')
      setAuthMessageTone('warning')
      setAuthPreviewUrl('')
      setActiveTab('account')
      setSearchParams({ tab: 'account', mode: 'signin' })
      return
    }

    setCheckoutOpen(true)
    setCheckoutSubmitting(true)
    setCheckoutError('')
    setVerifyingPaystackReference(reference)

    verifyPaystackCheckout({ reference, token })
      .then(async (response) => {
        setConfirmedOrder(response.order)
        setCheckoutMailDelivered(response.mailDelivered !== false)
        setCheckoutPreviewUrl(response.mailPreviewUrl || '')
        setCheckoutMethod(response.order.paymentMethod || 'paystack')
        setFlashMessage({
          text: response.message || 'Payment verified and order placed successfully.',
          type: response.mailDelivered === false ? 'warning' : 'success',
        })
        await refreshProfile(token).catch(() => {})
      })
      .catch((error) => {
        setCheckoutError(error.message || 'Unable to verify this Paystack payment yet.')
        setFlashMessage({
          text: error.message || 'Unable to verify this Paystack payment yet.',
          type: 'warning',
        })
      })
      .finally(() => {
        setCheckoutSubmitting(false)
        setVerifyingPaystackReference('')
        setActiveTab('cart')
        setSearchParams({ tab: 'cart' })
      })
  }, [
    authLoading,
    refreshProfile,
    searchParams,
    setSearchParams,
    token,
    user,
    verifyPaystackCheckout,
    verifyingPaystackReference,
  ])

  useEffect(() => {
    if (loadingProducts || cartLoading || authLoading) {
      return
    }

    const timer = window.setTimeout(() => {
      setBootLoading(false)
    }, 220)

    return () => {
      window.clearTimeout(timer)
    }
  }, [authLoading, cartLoading, loadingProducts])

  const categories = useMemo(() => {
    const names = Array.from(new Set(allProducts.map((product) => product.category)))
    return ['All', ...names]
  }, [allProducts])

  const greetingText = useMemo(() => {
    return getGreetingForTimezone(deviceContext.timezone || getBrowserTimezone(), clockTick)
  }, [clockTick, deviceContext.timezone])

  const locationLabel = useMemo(
    () =>
      user?.lastKnownLocation ||
      deviceContext.locationLabel ||
      'Worldwide delivery available',
    [deviceContext.locationLabel, user?.lastKnownLocation],
  )

  const greetingName = user?.fullName?.split(' ')?.[0] || 'there'

  const featuredVideos = useMemo(
    () =>
      Array.isArray(publicSettings.featuredVideos)
        ? publicSettings.featuredVideos
            .filter((video) => String(video?.videoUrl || '').trim())
            .slice(0, 5)
        : [],
    [publicSettings.featuredVideos],
  )

  const featuredProducts = useMemo(() => {
    const featured = allProducts.filter((product) => product.featured)
    return (featured.length > 0 ? featured : allProducts).slice(0, 3)
  }, [allProducts])

  useEffect(() => {
    setFeaturedVideoIndex((current) =>
      featuredVideos.length > 0 ? current % featuredVideos.length : 0,
    )
  }, [featuredVideos.length])

  useEffect(() => {
    if (activeTab !== 'home' || featuredVideos.length === 0 || featuredVideoPlaybackBlocked) {
      return
    }

    const timer = window.setInterval(() => {
      setFeaturedVideoIndex((current) => (current + 1) % featuredVideos.length)
    }, FEATURED_VIDEO_ROTATION_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [activeTab, featuredVideoPlaybackBlocked, featuredVideos.length])

  const filteredProducts = useMemo(() => {
    const nextProducts = allProducts.filter((product) => {
      const categoryMatch = selectedCategory === 'All' || product.category === selectedCategory
      const searchMatch =
        !deferredSearch ||
        `${product.name} ${product.description} ${product.category}`
          .toLowerCase()
          .includes(deferredSearch.toLowerCase())

      return categoryMatch && searchMatch
    })

    const sorted = [...nextProducts]

    switch (sortOrder) {
      case 'price-asc':
        sorted.sort((left, right) => left.price - right.price)
        break
      case 'price-desc':
        sorted.sort((left, right) => right.price - left.price)
        break
      case 'name':
        sorted.sort((left, right) => left.name.localeCompare(right.name))
        break
      default:
        sorted.sort((left, right) => {
          if (left.featured !== right.featured) {
            return Number(right.featured) - Number(left.featured)
          }

          return right.id - left.id
        })
    }

    return sorted
  }, [allProducts, deferredSearch, selectedCategory, sortOrder])

  const savedProducts = useMemo(
    () => allProducts.filter((product) => savedIds.includes(product.id)),
    [allProducts, savedIds],
  )

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('[data-reveal]'))

    if (elements.length === 0) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      {
        rootMargin: '0px 0px -10% 0px',
        threshold: 0.12,
      },
    )

    elements.forEach((element) => {
      element.classList.remove('is-visible')
      const delay = element.getAttribute('data-reveal-delay')

      if (delay) {
        element.style.setProperty('--go-reveal-delay', `${delay}ms`)
      } else {
        element.style.removeProperty('--go-reveal-delay')
      }

      observer.observe(element)
    })

    return () => {
      observer.disconnect()
    }
  }, [activeTab, authMode, Boolean(user), filteredProducts.length, cart.items.length, orders.length, savedProducts.length])

  const setTab = (tab) => {
    if (tab === 'home') {
      setSearchParams({})
    } else if (tab === 'account') {
      setSearchParams({ tab, mode: authMode })
    } else {
      setSearchParams({ tab })
    }

    setActiveTab(tab)
  }

  const syncDeviceContext = async ({ requestPermission = false } = {}) => {
    const fallbackContext = createFallbackDeviceContext(deviceContext)

    if (!requestPermission) {
      setDeviceContext(fallbackContext)
      return fallbackContext
    }

    if (
      fallbackContext.latitude !== null &&
      fallbackContext.longitude !== null &&
      fallbackContext.locationLabel
    ) {
      setLocationStatus('ready')
      setDeviceContext(fallbackContext)
      return fallbackContext
    }

    setLocationStatus('locating')

    try {
      const position = await getCurrentPositionAsync()
      const response = await api.resolveDeviceContext({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timezone: fallbackContext.timezone,
      })
      const resolvedContext = createFallbackDeviceContext(response.deviceContext)

      setDeviceContext(resolvedContext)
      setLocationStatus('ready')
      return resolvedContext
    } catch {
      setDeviceContext(fallbackContext)
      setLocationStatus('fallback')
      return fallbackContext
    }
  }

  const handleSearchChange = (event) => {
    startTransition(() => {
      setSearchInput(event.target.value)
    })
  }

  const handleCategoryChange = (category) => {
    startTransition(() => {
      setSelectedCategory(category)
      setActiveTab('home')
      setSearchParams({})
    })
  }

  const handleSortChange = (nextSort) => {
    setSortOrder(nextSort)
    setSortMenuOpen(false)
  }

  const handleBrowseCollection = () => {
    setSelectedCategory('All')
    setSearchInput('')

    if (typeof document !== 'undefined') {
      document.getElementById('marketplace-picks')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }

  const toggleSaved = (productId) => {
    setSavedIds((current) =>
      current.includes(productId)
        ? current.filter((savedId) => savedId !== productId)
        : [...current, productId],
    )
  }

  const handleOpenProduct = (product) => {
    setSelectedProduct(product)
    setSelectedProductId(product.id)
    setProductDetailError('')
    setProductDetailOpen(true)
  }

  const handleCloseProduct = () => {
    setProductDetailOpen(false)
    setProductDetailError('')
  }

  const handleAddToCart = async (productId, options = {}) => {
    const {
      flashText = 'Item added to cart.',
      showAddedSheet = true,
    } = options

    try {
      const response = await addToCart(productId)
      const matchedProduct = allProducts.find((product) => product.id === productId) || selectedProduct

      if (showAddedSheet) {
        setRecentlyAddedProduct(matchedProduct || null)
      } else {
        setRecentlyAddedProduct(null)
      }

      setFlashMessage({
        text: flashText,
        type: 'success',
      })
      return response
    } catch (error) {
      setFlashMessage({
        text: error.message || 'Unable to update cart.',
        type: 'warning',
      })
      return null
    }
  }

  const handleProceedToCheckout = async (product) => {
    setCheckoutLaunchProductId(product.id)

    try {
      const response = await handleAddToCart(product.id, {
        flashText: 'Item added to cart. Opening checkout...',
        showAddedSheet: false,
      })

      if (!response) {
        return
      }

      handleCloseProduct()
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
      handleRequestCheckout()
    } finally {
      setCheckoutLaunchProductId(null)
    }
  }

  const handleQuantityChange = async (productId, quantity) => {
    try {
      await changeQuantity(productId, quantity)
    } catch (error) {
      setFlashMessage({
        text: error.message || 'Unable to update cart.',
        type: 'warning',
      })
    }
  }

  const handleClearCart = async () => {
    try {
      await clearCart()
    } catch (error) {
      setFlashMessage({
        text: error.message || 'Unable to clear cart.',
        type: 'warning',
      })
    }
  }

  const handleFieldChange = (event) => {
    const { checked, name, type, value } = event.target
    const nextValue =
      name === 'referralCode'
        ? normalizeReferralCodeInput(value)
        : type === 'checkbox'
          ? checked
          : value

    if (name === 'email' || name === 'password') {
      const updater = authMode === 'signin' ? setSignInForm : setSignUpForm

      updater((current) => ({
        ...current,
        [name]: nextValue,
      }))
    }

    if (
      name === 'confirmPassword' ||
      name === 'acceptTerms' ||
      name === 'fullName' ||
      name === 'newsletterOptIn' ||
      name === 'referralCode'
    ) {
      setSignUpForm((current) => ({
        ...current,
        [name]: nextValue,
      }))

      if (name === 'referralCode') {
        setReferralChecking(false)
        setReferralMessage('')
        setReferralTone('info')
      }
    }

    if (['name', 'email', 'phone', 'country', 'city', 'address'].includes(name)) {
      setCheckoutForm((current) => ({
        ...current,
        [name]: nextValue,
      }))
    }
  }

  const handleReferralBlur = async () => {
    if (authMode !== 'signup') {
      return
    }

    const referralCode = normalizeReferralCodeInput(signUpForm.referralCode)

    if (!referralCode) {
      setReferralChecking(false)
      setReferralMessage('')
      setReferralTone('info')
      return
    }

    setReferralChecking(true)

    try {
      const response = await api.lookupReferral(referralCode)
      setReferralMessage(response.message || '')
      setReferralTone(response.valid ? 'success' : 'warning')
    } catch (error) {
      setReferralMessage(error.message || 'Unable to validate the referral code right now.')
      setReferralTone('warning')
    } finally {
      setReferralChecking(false)
    }
  }

  const handleForgotPassword = () => {
    setAuthMessage(
      'Password reset is not self-service yet. Use your admin support channel or store support contact for a secure reset.',
    )
    setAuthMessageTone('warning')
    setAuthPreviewUrl('')
  }

  const handleSettingsFieldChange = (event) => {
    const { checked, name, type, value } = event.target
    const nextValue = type === 'checkbox' ? checked : value

    setSettingsForm((current) => ({
      ...current,
      [name]: nextValue,
    }))
  }

  const resetCheckoutState = ({ keepOrder = false } = {}) => {
    setCheckoutError('')
    setCheckoutPreviewUrl('')
    setCheckoutMailDelivered(true)
    setCheckoutProofFile(null)
    setCheckoutProofName('')

    if (!keepOrder) {
      setConfirmedOrder(null)
    }
  }

  const handlePaymentMethodChange = (nextMethod) => {
    setCheckoutMethod(nextMethod)
    setCheckoutError('')
  }

  const handleProofChange = (event) => {
    const file = event.target.files?.[0] || null
    setCheckoutProofFile(file)
    setCheckoutProofName(file?.name || '')
  }

  const handleAuthModeChange = (nextMode) => {
    const nextParams = new URLSearchParams(searchParams)

    nextParams.set('tab', 'account')
    nextParams.set('mode', nextMode)
    nextParams.delete('verified')

    if (nextMode === 'signup') {
      nextParams.delete('email')
    }

    setSearchParams(nextParams)
    setAuthMode(nextMode)
    setAuthMessage('')
    setAuthPreviewUrl('')
    setAuthMessageTone('success')

    if (nextMode !== 'signup') {
      setReferralChecking(false)
      setReferralMessage('')
      setReferralTone('info')
    }
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthMessage('')
    setAuthPreviewUrl('')

    if (authMode === 'signup') {
      if (signUpForm.password !== signUpForm.confirmPassword) {
        setAuthMessage('Passwords do not match.')
        setAuthMessageTone('warning')
        return
      }

      if (!signUpForm.acceptTerms) {
        setAuthMessage('Accept the terms and conditions before creating your account.')
        setAuthMessageTone('warning')
        return
      }
    }

    setAuthSubmitting(true)

    try {
      const currentDeviceContext = await syncDeviceContext({ requestPermission: true })

      if (authMode === 'signin') {
        const response = await signIn({
          ...signInForm,
          deviceContext: currentDeviceContext,
        })
        setSearchParams({ tab: 'account' })
        setAuthMessage(response.message)
        setAuthMessageTone('success')
      } else {
        const { confirmPassword: _confirmPassword, ...signUpPayload } = signUpForm
        const response = await signUp({
          ...signUpPayload,
          deviceContext: currentDeviceContext,
        })

        if (response.requiresEmailVerification === false) {
          setSearchParams({ tab: 'account' })
          setActiveTab('account')
          setAuthMessage(response.message || 'Account created successfully. Welcome to your dashboard.')
          setAuthMessageTone('success')
          setAuthPreviewUrl('')
          setFlashMessage({
            text: 'Account created successfully.',
            type: 'success',
          })
          return
        }

        const verificationParams = new URLSearchParams()

        verificationParams.set('email', signUpForm.email)
        verificationParams.set('sent', '1')

        if (response.mailMode) {
          verificationParams.set('mailMode', response.mailMode)
        }

        if (response.mailDelivered === false) {
          verificationParams.set('delivery', 'warning')
        }

        if (response.verificationPreviewUrl) {
          verificationParams.set('preview', response.verificationPreviewUrl)
        }

        navigate(`/verify-email?${verificationParams.toString()}`)
        return
      }
    } catch (error) {
      setAuthMessage(error.message || 'Unable to continue.')
      setAuthMessageTone('warning')
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleResendVerification = async () => {
    setAuthSubmitting(true)
    setAuthMessage('')
    setAuthPreviewUrl('')

    try {
      const response = await resendVerification(user?.email || (authMode === 'signin' ? signInForm.email : signUpForm.email))
      setAuthMessage(response.message)
      setAuthPreviewUrl(response.verificationPreviewUrl || '')
      setAuthMessageTone(response.mailDelivered === false ? 'warning' : 'success')
    } catch (error) {
      setAuthMessage(error.message || 'Unable to resend verification.')
      setAuthMessageTone('warning')
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleSettingsSubmit = async (event) => {
    event.preventDefault()
    setSettingsSubmitting(true)
    setSettingsMessage('')

    try {
      const response = await updateSettings(settingsForm)

      setSettingsForm(createSettingsForm(response.user))
      setCheckoutForm(createCheckoutForm(response.user))
      setSettingsMessage(response.message || 'Account settings updated successfully.')
      setSettingsTone('success')
      setFlashMessage({
        text: 'Your dashboard settings have been updated.',
        type: 'success',
      })
    } catch (error) {
      setSettingsMessage(error.message || 'Unable to update account settings.')
      setSettingsTone('warning')
    } finally {
      setSettingsSubmitting(false)
    }
  }

  const handleRequestSignOut = () => {
    setLogoutDialogOpen(true)
  }

  const handleCancelSignOut = () => {
    if (logoutSubmitting) {
      return
    }

    setLogoutDialogOpen(false)
  }

  const handleConfirmSignOut = async () => {
    if (logoutSubmitting) {
      return
    }

    setLogoutSubmitting(true)

    try {
      signOut()
      setLogoutDialogOpen(false)
      setActiveTab('account')
      setAuthMode('signin')
      setAuthMessage('You have been signed out. Sign in again whenever you are ready.')
      setAuthMessageTone('success')
      setAuthPreviewUrl('')
      setSettingsMessage('')
      setSettingsTone('success')
      setSignInForm(signInDefaults)
      setSignUpForm(signUpDefaults)
      setSettingsForm(createSettingsForm(null))
      setCheckoutForm(createCheckoutForm(null))
      setCheckoutOpen(false)
      setCheckoutIntent(false)
      resetCheckoutState()
      setSearchParams({ tab: 'account', mode: 'signin' })
      setFlashMessage({
        text: 'Signed out successfully.',
        type: 'success',
      })
    } finally {
      setLogoutSubmitting(false)
    }
  }

  const handleRequestCheckout = () => {
    if (!user) {
      setCheckoutIntent(true)
      setAuthMode('signin')
      setAuthMessage('Sign in or create an account before checkout. Your cart is saved and waiting for you.')
      setAuthMessageTone('warning')
      setAuthPreviewUrl('')
      setTab('account')
      setFlashMessage({
        text: 'Please sign in or create an account before checkout.',
        type: 'warning',
      })
      return
    }

    resetCheckoutState()
    if (!paymentConfig?.paystack?.enabled && !paymentConfig?.bankTransfer?.enabled) {
      setCheckoutError(
        'No live payment method is configured yet. Add Paystack keys or bank transfer details in backend/.env.',
      )
    }
    setCheckoutMethod(
      paymentConfig?.paystack?.enabled || !paymentConfig?.bankTransfer?.enabled
        ? 'paystack'
        : 'bank_transfer',
    )
    setCheckoutOpen(true)
  }

  const handleCheckoutSubmit = async (event) => {
    event.preventDefault()
    setCheckoutSubmitting(true)
    setCheckoutError('')

    try {
      if (checkoutMethod === 'paystack') {
        const response = await initializePaystackCheckout({
          customer: checkoutForm,
          notes: '',
          token,
        })

        setFlashMessage({
          text: 'Redirecting to Paystack secure checkout...',
          type: 'success',
        })
        window.location.assign(response.authorizationUrl)
        return
      }

      if (!checkoutProofFile) {
        setCheckoutError('Upload a proof of payment before submitting a bank transfer order.')
        return
      }

      const response = await submitBankTransfer({
        customer: checkoutForm,
        notes: '',
        proofFile: checkoutProofFile,
        token,
      })

      setConfirmedOrder(response.order)
      setCheckoutMailDelivered(response.mailDelivered !== false)
      setCheckoutPreviewUrl(response.mailPreviewUrl || '')
      setCheckoutProofFile(null)
      setCheckoutProofName('')
      setFlashMessage({
        text: response.message || 'Proof uploaded successfully.',
        type: response.mailDelivered === false ? 'warning' : 'success',
      })
      await refreshProfile(token).catch(() => {})
    } catch (error) {
      const message = error.message || 'Checkout failed.'

      if (/authentication required|sign in|sign up/i.test(message)) {
        setCheckoutOpen(false)
        setCheckoutIntent(true)
        setAuthMode('signin')
        setAuthMessage('Sign in or create an account before checkout. Your cart is still available.')
        setAuthMessageTone('warning')
        setAuthPreviewUrl('')
        setTab('account')
        setFlashMessage({
          text: 'Please sign in or create an account before checkout.',
          type: 'warning',
        })
      } else {
        setCheckoutError(message)
      }
    } finally {
      setCheckoutSubmitting(false)
    }
  }

  const accountLabel = user ? user.fullName.split(' ')[0] : 'Login/Sign up'
  const isGuestAuthView = activeTab === 'account' && !user
  const showStoreSearch = activeTab === 'home'
  const appInnerClassName = `go-app-inner ${isGuestAuthView ? 'go-app-inner--auth' : ''}`.trim()
  const contentShellClassName = `go-content-shell ${
    isGuestAuthView ? 'go-content-shell--auth' : showStoreSearch ? '' : 'go-content-shell--compact'
  }`.trim()

  return (
    <>
      {bootLoading && (
        <div className="go-app-loader">
          <div className="go-app-loader__panel">
            <div className="go-app-loader__mark">A</div>
            <div className="go-spinner" />
            <p>Preparing your collection...</p>
          </div>
        </div>
      )}

      <main className="go-app-shell">
        <div className={appInnerClassName}>
          {!isGuestAuthView && (
          <section className="go-header-section">
            <div className="go-user-row">
              <div className="go-user-profile">
                <div className="go-user-avatar">
                  {user ? user.fullName.slice(0, 1).toUpperCase() : 'A'}
                </div>
                <div className="go-user-copy">
                  <p className="go-greeting">{`${greetingText}, ${greetingName}`}</p>
                  <h1>{user ? user.fullName : publicSettings.storeName || 'Asteria Client'}</h1>
                </div>
              </div>

              <div className="go-header-icons">
                <button aria-label="Saved items" onClick={() => setTab('saved')} type="button">
                  <i className="bi bi-bookmark-heart" aria-hidden="true" />
                </button>
                <button aria-label="Cart" onClick={() => setTab('cart')} type="button">
                  <i className="bi bi-bag" aria-hidden="true" />
                  {cart.summary.itemCount > 0 && <span>{cart.summary.itemCount}</span>}
                </button>
              </div>
            </div>

            <div className="go-location-line">
              <i className="bi bi-geo-alt-fill" aria-hidden="true" />
              <span>
                {locationStatus === 'locating'
                  ? 'Locating your device...'
                  : locationLabel}
              </span>
            </div>

            <h2 className="go-main-title">
              {typedHeadline}
              <span className="go-typing-caret" aria-hidden="true" />
            </h2>
          </section>
          )}

          {showStoreSearch && (
            <section className="go-search-section">
              <div className="go-search-filter">
                <div className="go-filter-wrap">
                  <button
                    className="go-filter-btn"
                    onClick={() => setSortMenuOpen((current) => !current)}
                    type="button"
                  >
                    <span className="go-filter-icon">
                      <i className="bi bi-sliders" aria-hidden="true" />
                    </span>
                    Filter
                  </button>

                  {sortMenuOpen && (
                    <div className="go-filter-menu">
                      {SORT_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          className={sortOrder === option.value ? 'active' : ''}
                          onClick={() => handleSortChange(option.value)}
                          type="button"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <label className="go-search-bar">
                  <i className="bi bi-search" aria-hidden="true" />
                  <input
                    placeholder="Search the collection"
                    type="search"
                    value={searchInput}
                    onChange={handleSearchChange}
                  />
                </label>
              </div>
            </section>
          )}

          <section className={contentShellClassName}>
            {activeTab === 'home' && (
              <>
                <div data-reveal data-reveal-delay="0">
                  <FeaturedVideoShowcase
                    activeIndex={featuredVideoIndex}
                    featuredVideos={featuredVideos}
                    onBrowseCollection={handleBrowseCollection}
                    onPlaybackBlockedChange={setFeaturedVideoPlaybackBlocked}
                    onSelectVideo={setFeaturedVideoIndex}
                    storeName={publicSettings.storeName}
                  />
                </div>

                <div data-reveal data-reveal-delay="60">
                  <HighlightOffer
                    onAddToCart={handleAddToCart}
                    onOpenProduct={handleOpenProduct}
                    products={featuredProducts}
                  />
                </div>

                <section className="go-chip-section go-reveal" data-reveal data-reveal-delay="90">
                  <div className="go-section-head">
                    <h2>Categories</h2>
                  </div>
                  <div className="go-chip-row">
                    {categories.map((category, index) => {
                      const meta = getCategoryMeta(category)

                      return (
                      <button
                        key={category}
                        aria-label={meta.label}
                        className={`go-chip go-chip--icon ${selectedCategory === category ? 'active' : ''}`}
                        onClick={() => handleCategoryChange(category)}
                        style={{ '--go-chip-delay': `${index * 90}ms` }}
                        title={meta.label}
                        type="button"
                      >
                        <CategoryIcon category={category} />
                        <span>{meta.label}</span>
                      </button>
                      )
                    })}
                  </div>
                </section>

                <section className="go-reveal" data-reveal data-reveal-delay="120" id="marketplace-picks">
                  <div className="go-section-head">
                    <h2>Our picks</h2>
                    <button
                      className="go-text-link"
                      onClick={() => setSelectedCategory('All')}
                      type="button"
                    >
                      See all
                    </button>
                  </div>

                  {loadingProducts ? (
                    <div className="go-grid">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="go-product-skeleton" />
                      ))}
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="go-empty-state">
                      <i className="bi bi-search" aria-hidden="true" />
                      <p>No pieces match this search yet.</p>
                    </div>
                  ) : (
                    <div className="go-grid">
                      {filteredProducts.map((product) => (
                        <ProductTile
                          key={product.id}
                          busy={busyKey === product.id}
                          isSaved={savedIds.includes(product.id)}
                          onAddToCart={handleAddToCart}
                          onOpenProduct={handleOpenProduct}
                          onToggleSaved={toggleSaved}
                          product={product}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {activeTab === 'cart' && (
              <section className="go-tab-panel go-reveal" data-reveal data-reveal-delay="40">
                <div className="go-section-head">
                  <h2>My cart</h2>
                  {cart.items.length > 0 && (
                    <button className="go-text-link" onClick={handleClearCart} type="button">
                      Clear all
                    </button>
                  )}
                </div>

                {cartLoading ? (
                  <div className="go-empty-state">
                    <div className="go-spinner" />
                    <p>Loading your cart...</p>
                  </div>
                ) : cart.items.length === 0 ? (
                  <div className="go-empty-state">
                    <i className="bi bi-bag-heart" aria-hidden="true" />
                    <p>Your cart is empty.</p>
                  </div>
                ) : (
                  <>
                    <div className="go-cart-list">
                      {cart.items.map((item) => (
                        <CartItemCard
                          key={item.productId}
                          busyKey={busyKey}
                          item={item}
                          onQuantityChange={handleQuantityChange}
                        />
                      ))}
                    </div>

                    <div className="go-cart-summary">
                      <div className="go-cart-note">
                        <strong>Ready to order?</strong>
                        <p>Review your pieces, then pay with Paystack or submit a bank transfer proof in the same flow.</p>
                      </div>
                      <div className="go-summary-line">
                        <span>Items</span>
                        <strong>{cart.summary.itemCount}</strong>
                      </div>
                      <div className="go-summary-line">
                        <span>Subtotal</span>
                        <strong>{formatCurrency(cart.summary.subtotal)}</strong>
                      </div>
                      <div className="go-summary-line">
                        <span>Shipping</span>
                        <strong>
                          {cart.summary.shippingFee === 0
                            ? 'Complimentary'
                            : formatCurrency(cart.summary.shippingFee)}
                        </strong>
                      </div>
                      <div className="go-summary-line total">
                        <span>Total</span>
                        <strong>{formatCurrency(cart.summary.total)}</strong>
                      </div>
                      <button className="go-primary-btn" onClick={handleRequestCheckout} type="button">
                        Proceed to checkout
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}

            {activeTab === 'saved' && (
              <section className="go-tab-panel go-reveal" data-reveal data-reveal-delay="40">
                <div className="go-section-head">
                  <h2>Saved items</h2>
                </div>

                {savedProducts.length === 0 ? (
                  <div className="go-empty-state">
                    <i className="bi bi-bookmark-heart" aria-hidden="true" />
                    <p>Save pieces you want to revisit later.</p>
                  </div>
                ) : (
                  <div className="go-grid">
                    {savedProducts.map((product) => (
                      <ProductTile
                        key={product.id}
                        busy={busyKey === product.id}
                        isSaved={savedIds.includes(product.id)}
                        onAddToCart={handleAddToCart}
                        onOpenProduct={handleOpenProduct}
                        onToggleSaved={toggleSaved}
                        product={product}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {activeTab === 'account' && (
              <AccountPanel
                authMode={authMode}
                dashboard={dashboard}
                emailVerificationEnabled={publicSettings.emailVerificationEnabled !== false}
                message={authMessage}
                messageTone={authMessageTone}
                onAuthModeChange={handleAuthModeChange}
                onFieldChange={handleFieldChange}
                onForgotPassword={handleForgotPassword}
                onReferralBlur={handleReferralBlur}
                onResendVerification={handleResendVerification}
                onSettingsFieldChange={handleSettingsFieldChange}
                onSettingsSubmit={handleSettingsSubmit}
                onSubmit={handleAuthSubmit}
                orders={orders}
                previewUrl={authPreviewUrl}
                referralChecking={referralChecking}
                referralMessage={referralMessage}
                referralTone={referralTone}
                settingsForm={settingsForm}
                settingsMessage={settingsMessage}
                settingsSubmitting={settingsSubmitting}
                settingsTone={settingsTone}
                signInForm={signInForm}
                signOut={handleRequestSignOut}
                signUpForm={signUpForm}
                submitting={authSubmitting}
                user={user}
              />
            )}
          </section>
        </div>

        <nav className="go-bottom-nav">
          <div className="go-bottom-nav-inner">
            {TAB_ITEMS.map((item) => (
              <button
                key={item.value}
                className={`go-nav-item ${activeTab === item.value ? 'active' : ''}`}
                onClick={() => setTab(item.value)}
                type="button"
              >
                <i className={`bi ${item.icon}`} aria-hidden="true" />
                <span>{item.value === 'account' ? accountLabel : item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {flashMessage && <div className={`go-toast ${flashMessage.type}`}>{flashMessage.text}</div>}

        {recentlyAddedProduct && (
          <div className="go-added-sheet">
            <div className="go-added-sheet__media">
              <img alt={recentlyAddedProduct.name} src={recentlyAddedProduct.imageUrl} />
            </div>
            <div className="go-added-sheet__copy">
              <p>Added to cart</p>
              <strong>{recentlyAddedProduct.name}</strong>
            </div>
            <div className="go-added-sheet__actions">
              <button
                className="go-secondary-btn"
                onClick={() => setRecentlyAddedProduct(null)}
                type="button"
              >
                Keep shopping
              </button>
              <button
                className="go-primary-btn"
                onClick={() => {
                  setRecentlyAddedProduct(null)
                  setTab('cart')
                }}
                type="button"
              >
                View cart
              </button>
            </div>
          </div>
        )}
      </main>

      <CheckoutSheet
        error={checkoutError}
        formValues={checkoutForm}
        isOpen={checkoutOpen}
        mailDelivered={checkoutMailDelivered}
        isSubmitting={checkoutSubmitting}
        itemsCount={cart.summary.itemCount}
        onChange={handleFieldChange}
        onClose={() => {
          setCheckoutOpen(false)
          resetCheckoutState()
        }}
        onPaymentMethodChange={handlePaymentMethodChange}
        onProofChange={handleProofChange}
        onSubmit={handleCheckoutSubmit}
        order={confirmedOrder}
        orderPreviewUrl={checkoutPreviewUrl}
        orderTotal={confirmedOrder ? confirmedOrder.total : cart.summary.total}
        paymentConfig={paymentConfig}
        paymentMethod={checkoutMethod}
        proofFileName={checkoutProofName}
      />
      <ProductDetailSheet
        error={productDetailError}
        isCheckoutSubmitting={Boolean(selectedProduct && checkoutLaunchProductId === selectedProduct.id)}
        isLoading={productDetailLoading}
        isOpen={productDetailOpen}
        isSaving={Boolean(selectedProduct && busyKey === selectedProduct.id)}
        onAddToCart={handleAddToCart}
        onClose={handleCloseProduct}
        onProceedToCheckout={handleProceedToCheckout}
        product={selectedProduct}
      />
      <SignOutSheet
        isOpen={logoutDialogOpen}
        isSubmitting={logoutSubmitting}
        onCancel={handleCancelSignOut}
        onConfirm={handleConfirmSignOut}
      />
    </>
  )
}
