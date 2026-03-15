import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
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
  newsletterOptIn: true,
  phoneNumber: '',
  confirmPassword: '',
  password: '',
}

const TYPING_HEADLINES = [
  'What would you love to collect today?',
  'Discover signature watches, rings, and rare jewelry.',
  'Curated luxury pieces, delivered with a smoother experience.',
]

const CATEGORY_META = {
  All: {
    icon: 'bi-grid-1x2-fill',
    label: 'All categories',
  },
  Bangles: {
    icon: 'bi-circle',
    label: 'Bangles',
  },
  Eyewear: {
    icon: 'bi-eyeglasses',
    label: 'Eyewear',
  },
  Jewelry: {
    icon: 'bi-diamond-fill',
    label: 'Jewelry',
  },
  Rings: {
    icon: 'bi-record-circle',
    label: 'Rings',
  },
  Watches: {
    icon: 'bi-watch',
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
    icon: 'bi-stars',
    label: category,
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

function PromoCarousel({ onShopPromo, promoProducts, promoIndex, setPromoIndex }) {
  if (promoProducts.length === 0) {
    return null
  }

  return (
    <section className="go-carousel-section">
      <div className="go-section-head">
        <h2>Featured drops</h2>
        <button className="go-text-link" onClick={onShopPromo} type="button">
          See all
        </button>
      </div>

      <div className="go-carousel-shell">
        <div
          className="go-carousel-track"
          style={{ transform: `translateX(-${promoIndex * 100}%)` }}
        >
          {promoProducts.map((product, index) => (
            <article key={product.id} className="go-carousel-slide">
              <div className="go-carousel-copy">
                <span className="go-offer-badge">
                  {index === 0 ? 'Limited offer' : 'New arrival'}
                </span>
                <p className="go-offer-eyebrow">{product.category}</p>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <button
                  className="go-primary-btn go-primary-btn--light"
                  onClick={onShopPromo}
                  type="button"
                >
                  Collect now
                </button>
              </div>
              <div className="go-carousel-image-wrap">
                <img alt={product.name} className="go-carousel-image" src={product.imageUrl} />
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="go-indicators">
        {promoProducts.map((product, index) => (
          <button
            key={product.id}
            aria-label={`View promo ${index + 1}`}
            className={`go-indicator ${promoIndex === index ? 'active' : ''}`}
            onClick={() => setPromoIndex(index)}
            type="button"
          />
        ))}
      </div>
    </section>
  )
}

function HighlightOffer({ onAddToCart, products }) {
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
          <article key={product.id} className="go-collection-card">
            <div className="go-collection-copy">
              <p>{product.badge || product.category}</p>
              <h3>{product.name}</h3>
              <strong>{formatCurrency(product.price)}</strong>
            </div>
            <button className="go-primary-btn" onClick={() => onAddToCart(product.id)} type="button">
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

function ProductTile({ busy, isSaved, onAddToCart, onToggleSaved, product }) {
  const rating = (4.6 + ((product.id % 3) * 0.1)).toFixed(1)
  const reviews = 12 + product.id * 5
  const revealDelay = `${(product.id % 6) * 55}`

  return (
    <article className="go-product-card go-reveal" data-reveal data-reveal-delay={revealDelay}>
      <div className="go-product-media">
        <img alt={product.name} className="go-product-image" src={product.imageUrl} />
        <button
          aria-label={isSaved ? 'Remove from saved' : 'Save item'}
          className={`go-heart-btn ${isSaved ? 'saved' : ''}`}
          onClick={() => onToggleSaved(product.id)}
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
        <div className="go-product-footer">
          <div>
            <p className="go-product-price">{formatCurrency(product.price)}</p>
            <p className="go-product-meta">{product.badge || `${product.stockQuantity} left`}</p>
          </div>

          <button
            className="go-plus-btn"
            disabled={busy || product.stockQuantity === 0}
            onClick={() => onAddToCart(product.id)}
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
  messageTone,
  message,
  onAuthModeChange,
  onFieldChange,
  onResendVerification,
  onSettingsFieldChange,
  onSettingsSubmit,
  onSubmit,
  orders,
  previewUrl,
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
  if (user) {
    return (
      <AccountDashboard
        dashboard={dashboard}
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
            <div className="go-auth-header-row">
              <h2>{authMode === 'signin' ? 'Sign in' : 'Sign up'}</h2>
              <span aria-hidden="true" className="go-auth-header-badge is-wave">
                {'\u{1F44B}'}
              </span>
            </div>
          </div>

          <div className="go-auth-toggle">
            <button
              className={authMode === 'signin' ? 'active' : ''}
              onClick={() => onAuthModeChange('signin')}
              type="button"
            >
              Sign in
            </button>
            <button
              className={authMode === 'signup' ? 'active' : ''}
              onClick={() => onAuthModeChange('signup')}
              type="button"
            >
              Sign up
            </button>
          </div>

          <form className="go-auth-form go-auth-form--plain" onSubmit={onSubmit}>
            {authMode === 'signup' && (
              <label className="go-field">
                <span>Full name</span>
                <input
                  name="fullName"
                  placeholder="Ada Obi"
                  required
                  type="text"
                  value={signUpForm.fullName}
                  onChange={onFieldChange}
                />
              </label>
            )}

            {authMode === 'signup' && (
              <label className="go-field">
                <span>Mobile number</span>
                <input
                  name="phoneNumber"
                  placeholder="0801 234 5678"
                  required
                  type="tel"
                  value={signUpForm.phoneNumber}
                  onChange={onFieldChange}
                />
              </label>
            )}

            <label className="go-field">
              <span>Email</span>
              <input
                name="email"
                placeholder="ada@example.com"
                required
                type="email"
                value={authMode === 'signin' ? signInForm.email : signUpForm.email}
                onChange={onFieldChange}
              />
            </label>

            <label className="go-field">
              <span>Password</span>
              <input
                name="password"
                placeholder="At least 8 characters"
                required
                type="password"
                value={authMode === 'signin' ? signInForm.password : signUpForm.password}
                onChange={onFieldChange}
              />
            </label>

            {authMode === 'signup' && (
              <label className="go-field">
                <span>Confirm password</span>
                <input
                  name="confirmPassword"
                  placeholder="Re-enter your password"
                  required
                  type="password"
                  value={signUpForm.confirmPassword}
                  onChange={onFieldChange}
                />
              </label>
            )}

            {authMode === 'signup' && (
              <label className="go-check-field">
                <input
                  checked={signUpForm.newsletterOptIn}
                  name="newsletterOptIn"
                  type="checkbox"
                  onChange={onFieldChange}
                />
                Receive launch notes and order updates
              </label>
            )}

            <div className="go-auth-actions">
              <button className="go-primary-btn" disabled={submitting} type="submit">
                {submitting ? 'Working...' : authMode === 'signin' ? 'Sign in' : 'Create account'}
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
  const [promoIndex, setPromoIndex] = useState(0)
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

    const loadProducts = async () => {
      setLoadingProducts(true)

      try {
        const response = await api.getProducts({ sort: 'featured' })

        if (!ignore) {
          setAllProducts(response.products || [])
        }
      } catch (error) {
        if (!ignore) {
          setFlashMessage({
            text: error.message || 'Unable to load the collection right now.',
            type: 'warning',
          })
        }
      } finally {
        if (!ignore) {
          setLoadingProducts(false)
        }
      }
    }

    loadProducts()

    return () => {
      ignore = true
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

    if (verified && !user) {
      setAuthMode('signin')
      setAuthMessage('Email verified successfully. Sign in to continue to your dashboard.')
      setAuthMessageTone('success')
      setAuthPreviewUrl('')
    }
  }, [searchParams, user])

  useEffect(() => {
    if (activeTab !== 'home') {
      return
    }

    const featuredCount = Math.max(
      1,
      Math.min(3, allProducts.filter((product) => product.featured).length || 1),
    )

    const timer = window.setInterval(() => {
      setPromoIndex((current) => (current + 1) % featuredCount)
    }, 5000)

    return () => {
      window.clearInterval(timer)
    }
  }, [activeTab, allProducts])

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

  const featuredProducts = useMemo(() => {
    const featured = allProducts.filter((product) => product.featured)
    return (featured.length > 0 ? featured : allProducts).slice(0, 3)
  }, [allProducts])

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

  const toggleSaved = (productId) => {
    setSavedIds((current) =>
      current.includes(productId)
        ? current.filter((savedId) => savedId !== productId)
        : [...current, productId],
    )
  }

  const handleAddToCart = async (productId) => {
    try {
      await addToCart(productId)
      setRecentlyAddedProduct(
        allProducts.find((product) => product.id === productId) || null,
      )
      setFlashMessage({
        text: 'Item added to cart.',
        type: 'success',
      })
    } catch (error) {
      setFlashMessage({
        text: error.message || 'Unable to update cart.',
        type: 'warning',
      })
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
    const nextValue = type === 'checkbox' ? checked : value

    if (name === 'email' || name === 'password') {
      const updater = authMode === 'signin' ? setSignInForm : setSignUpForm

      updater((current) => ({
        ...current,
        [name]: nextValue,
      }))
    }

    if (
      name === 'confirmPassword' ||
      name === 'fullName' ||
      name === 'newsletterOptIn' ||
      name === 'phoneNumber'
    ) {
      setSignUpForm((current) => ({
        ...current,
        [name]: nextValue,
      }))
    }

    if (['name', 'email', 'phone', 'country', 'city', 'address'].includes(name)) {
      setCheckoutForm((current) => ({
        ...current,
        [name]: nextValue,
      }))
    }
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
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthMessage('')
    setAuthPreviewUrl('')

    if (authMode === 'signup' && signUpForm.password !== signUpForm.confirmPassword) {
      setAuthMessage('Passwords do not match.')
      setAuthMessageTone('warning')
      return
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
        <div className="go-app-inner">
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
                  <PromoCarousel
                    onShopPromo={() => setTab('home')}
                    promoIndex={promoIndex}
                    promoProducts={featuredProducts}
                    setPromoIndex={setPromoIndex}
                  />
                </div>

                <div data-reveal data-reveal-delay="60">
                  <HighlightOffer onAddToCart={handleAddToCart} products={featuredProducts} />
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
                        <i className={`bi ${meta.icon}`} aria-hidden="true" />
                        <span>{meta.label}</span>
                      </button>
                      )
                    })}
                  </div>
                </section>

                <section className="go-reveal" data-reveal data-reveal-delay="120">
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
                message={authMessage}
                messageTone={authMessageTone}
                onAuthModeChange={handleAuthModeChange}
                onFieldChange={handleFieldChange}
                onResendVerification={handleResendVerification}
                onSettingsFieldChange={handleSettingsFieldChange}
                onSettingsSubmit={handleSettingsSubmit}
                onSubmit={handleAuthSubmit}
                orders={orders}
                previewUrl={authPreviewUrl}
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
      <SignOutSheet
        isOpen={logoutDialogOpen}
        isSubmitting={logoutSubmitting}
        onCancel={handleCancelSignOut}
        onConfirm={handleConfirmSignOut}
      />
    </>
  )
}
