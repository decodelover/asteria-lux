import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useAdminAuth } from '../hooks/useAdminAuth'
import { useSiteSettings } from '../hooks/useSiteSettings'
import { useStore } from '../hooks/useStore'
import { formatCurrency } from '../utils/format'

const SECTION_ITEMS = [
  { capability: 'overview', icon: 'bi-grid', label: 'Overview', value: 'overview' },
  { capability: 'products', icon: 'bi-box-seam', label: 'Products', value: 'products' },
  { capability: 'orders', icon: 'bi-truck', label: 'Orders', value: 'orders' },
  { capability: 'users', icon: 'bi-people', label: 'Users', value: 'users' },
  { capability: 'team', icon: 'bi-shield-lock', label: 'Team', value: 'team' },
  { capability: 'inbox', icon: 'bi-inboxes', label: 'Inbox', value: 'inbox' },
  { capability: 'settings', icon: 'bi-sliders2', label: 'Settings', value: 'settings' },
]

const SECTION_COPY = {
  overview: {
    eyebrow: 'Operations snapshot',
    title: 'Monitor the store at a glance.',
    description: 'Track revenue, orders, customer growth, and pending reviews from one place.',
  },
  products: {
    eyebrow: 'Catalog control',
    title: 'Keep the storefront current.',
    description: 'Create products, upload images, and push changes to the live storefront instantly.',
  },
  orders: {
    eyebrow: 'Fulfilment desk',
    title: 'Review payments and shipping.',
    description: 'Approve orders, update statuses, add tracking, and send customers live updates.',
  },
  users: {
    eyebrow: 'Customer records',
    title: 'Manage customer access and communication.',
    description: 'Edit customer details, handle account states, and message customers directly.',
  },
  team: {
    eyebrow: 'Admin access',
    title: 'Control team permissions.',
    description: 'Create operational admins, adjust roles, and secure access with password management.',
  },
  inbox: {
    eyebrow: 'Store inbox',
    title: 'Stay on top of customer interest.',
    description: 'Review customer contact requests and reply from a cleaner inbox workspace.',
  },
  settings: {
    eyebrow: 'Runtime settings',
    title: 'Configure the business layer.',
    description: 'Update brand identity, payment setup, email delivery, and storefront copy.',
  },
}

const ORDER_STATUS_OPTIONS = [
  'awaiting_payment_review',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]

const PAYMENT_STATUS_OPTIONS = ['pending', 'proof_submitted', 'paid', 'rejected', 'failed']
const CATEGORY_OPTIONS = ['Watches', 'Rings', 'Jewelry', 'Bangles', 'Eyewear']
const ADMIN_ROLE_OPTIONS = ['owner', 'manager', 'support']

const PRODUCT_DEFAULTS = {
  badge: '',
  category: 'Jewelry',
  description: '',
  featured: false,
  imageUrl: '',
  name: '',
  price: '',
  stockQuantity: '0',
}

const ADMIN_CREATE_DEFAULTS = {
  email: '',
  fullName: '',
  isActive: true,
  password: '',
  role: 'support',
}

const ADMIN_PASSWORD_DEFAULTS = {
  currentPassword: '',
  newPassword: '',
}

const FIELD_CLASS = 'flex flex-col gap-2'
const LABEL_CLASS = 'text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7d668d]'
const INPUT_CLASS =
  'h-12 rounded-2xl border border-[#eadcf7] bg-white px-4 text-sm text-slate-900 shadow-[0_18px_48px_rgba(114,73,151,0.08)] outline-none transition placeholder:text-slate-400 focus:border-[#7c3aed] focus:ring-4 focus:ring-[#7c3aed]/15'
const TEXTAREA_CLASS =
  'min-h-[120px] rounded-2xl border border-[#eadcf7] bg-white px-4 py-3 text-sm text-slate-900 shadow-[0_18px_48px_rgba(114,73,151,0.08)] outline-none transition placeholder:text-slate-400 focus:border-[#7c3aed] focus:ring-4 focus:ring-[#7c3aed]/15'
const PRIMARY_BUTTON_CLASS =
  'inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#5b1793] px-5 text-sm font-semibold text-white shadow-[0_22px_44px_rgba(91,23,147,0.3)] transition hover:-translate-y-0.5 hover:bg-[#4d1281] disabled:cursor-not-allowed disabled:opacity-60'
const SECONDARY_BUTTON_CLASS =
  'inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#dfccef] bg-white px-5 text-sm font-semibold text-[#5b1793] shadow-[0_16px_36px_rgba(114,73,151,0.08)] transition hover:-translate-y-0.5 hover:border-[#caaaf0] hover:bg-[#fbf8ff] disabled:cursor-not-allowed disabled:opacity-60'

const createOrderDraft = (order) => ({
  adminNote: order.adminNote || '',
  emailMessage: '',
  emailSubject: `Update for order ${order.orderNumber}`,
  estimatedDeliveryAt: order.estimatedDeliveryAt
    ? String(order.estimatedDeliveryAt).slice(0, 10)
    : '',
  notifyCustomer: false,
  paymentReviewNote: order.paymentReviewNote || '',
  paymentStatus: order.paymentStatus || 'pending',
  status: order.status || 'confirmed',
  trackingCarrier: order.trackingCarrier || '',
  trackingEventLocation: '',
  trackingEventMessage: '',
  trackingEventStatus: order.status || 'confirmed',
  trackingNumber: order.trackingNumber || '',
  trackingUrl: order.trackingUrl || '',
})

const createUserDraft = (user) => ({
  accountStatus: user.accountStatus || 'active',
  emailMessage: '',
  emailSubject: `Update from ${user.fullName || 'the store'}`,
  emailVerified: Boolean(user.emailVerified),
  fullName: user.fullName || '',
  newsletterOptIn: Boolean(user.newsletterOptIn),
  phoneNumber: user.phoneNumber || '',
})

const createAdminDraft = (admin) => ({
  email: admin.email || '',
  fullName: admin.fullName || '',
  isActive: Boolean(admin.isActive),
  newPassword: '',
  role: admin.role || 'support',
})

const createSettingsForm = (settings) => ({
  brand: {
    storeName: settings?.brand?.storeName || 'Asteria Luxury House',
    supportEmail: settings?.brand?.supportEmail || '',
    supportPhone: settings?.brand?.supportPhone || '',
    whatsappNumber: settings?.brand?.whatsappNumber || '',
  },
  email: {
    appBaseUrl: settings?.email?.appBaseUrl || '',
    smtpFromEmail: settings?.email?.smtpFromEmail || '',
    smtpHost: settings?.email?.smtpHost || '',
    smtpPass: settings?.email?.smtpPass || '',
    smtpPort: settings?.email?.smtpPort || 587,
    smtpSecure: Boolean(settings?.email?.smtpSecure),
    smtpUser: settings?.email?.smtpUser || '',
    supportEmail: settings?.email?.supportEmail || '',
  },
  payments: {
    bankAccountName: settings?.payments?.bankAccountName || '',
    bankAccountNumber: settings?.payments?.bankAccountNumber || '',
    bankInstructions: settings?.payments?.bankInstructions || '',
    bankName: settings?.payments?.bankName || '',
    bankTransferEnabled: Boolean(settings?.payments?.bankTransferEnabled),
    currency: settings?.payments?.currency || 'NGN',
    locale: settings?.payments?.locale || 'en-NG',
    paystackPublicKey: settings?.payments?.paystackPublicKey || '',
    paystackSecretKey: settings?.payments?.paystackSecretKey || '',
  },
  storefront: {
    heroHeadlines:
      settings?.storefront?.heroHeadlines?.length > 0
        ? [...settings.storefront.heroHeadlines]
        : [
            'What would you love to collect today?',
            'Discover signature watches, rings, and rare jewelry.',
            'Curated luxury pieces, delivered with a smoother experience.',
          ],
  },
})

const formatDate = (value) => {
  if (!value) {
    return 'Not available'
  }

  try {
    return new Intl.DateTimeFormat('en-NG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

const humanizeValue = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())

const matchesQuery = (query, values) => {
  const normalized = String(query || '').trim().toLowerCase()

  if (!normalized) {
    return true
  }

  return values.some((value) => String(value || '').toLowerCase().includes(normalized))
}

function AdminLoader({ label }) {
  return (
    <main className="min-h-screen bg-[#f6f3fb] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center">
        <section className="w-full max-w-xl rounded-[32px] border border-white/70 bg-white/90 p-10 text-center shadow-[0_36px_120px_rgba(84,35,122,0.14)] backdrop-blur">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f1e8fb]">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#c9a7ec] border-t-[#5b1793]" />
          </div>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.28em] text-[#7d668d]">
            Admin workspace
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#2c1639]">{label}</h1>
          <p className="mt-3 text-sm text-slate-500">
            Synchronizing products, customers, orders, and settings.
          </p>
        </section>
      </div>
    </main>
  )
}

function Panel({ actions, children, className = '', description, icon, title }) {
  return (
    <section
      className={`rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_26px_80px_rgba(94,49,133,0.1)] backdrop-blur sm:p-6 ${className}`}
    >
      {(title || description || actions) && (
        <div className="mb-6 flex flex-col gap-4 border-b border-[#f0e7f7] pb-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            {icon ? (
              <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4ecff] text-xl text-[#5b1793]">
                <i aria-hidden="true" className={`bi ${icon}`} />
              </span>
            ) : null}
            {title ? <h2 className="text-xl font-semibold tracking-tight text-[#281535]">{title}</h2> : null}
            {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  )
}

function SectionIntro({ eyebrow, title, description, extra }) {
  return (
    <section className="relative overflow-hidden rounded-[34px] bg-[#2d123f] px-6 py-7 text-white shadow-[0_34px_120px_rgba(76,24,109,0.28)] sm:px-8">
      <div className="absolute inset-y-0 right-0 hidden w-64 bg-[radial-gradient(circle_at_center,_rgba(181,135,255,0.35),_transparent_68%)] md:block" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#d8b7ff]">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[2.3rem]">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">{description}</p>
        </div>
        {extra ? <div className="relative z-10 flex flex-wrap gap-3">{extra}</div> : null}
      </div>
    </section>
  )
}

function StatCard({ icon, label, value }) {
  return (
    <article className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_70px_rgba(94,49,133,0.1)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <strong className="mt-4 block text-3xl font-semibold tracking-tight text-[#24112f]">
            {value}
          </strong>
        </div>
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4ecff] text-xl text-[#5b1793]">
          <i aria-hidden="true" className={`bi ${icon}`} />
        </span>
      </div>
    </article>
  )
}

function EmptyState({ copy, icon, title }) {
  return (
    <div className="rounded-[28px] border border-dashed border-[#d7c2ec] bg-[#fbf8ff] px-5 py-10 text-center">
      <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl text-[#8c5bc7] shadow-[0_16px_40px_rgba(106,68,141,0.08)]">
        <i aria-hidden="true" className={`bi ${icon}`} />
      </span>
      <h3 className="mt-4 text-lg font-semibold text-[#2b1837]">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{copy}</p>
    </div>
  )
}

function StatusPill({ tone = 'default', children }) {
  const tones = {
    default: 'border-[#eadcf7] bg-[#f7f1fe] text-[#5b1793]',
    success: 'border-[#d7eedd] bg-[#eefbf1] text-[#1f6b38]',
    warning: 'border-[#f5e4b8] bg-[#fff8e5] text-[#8d6112]',
    danger: 'border-[#f1d3dc] bg-[#fff1f5] text-[#a11a42]',
    slate: 'border-[#dfe3ea] bg-[#f7f8fb] text-slate-600',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone] || tones.default}`}
    >
      {children}
    </span>
  )
}

function Field({ children, className = '', label }) {
  return (
    <label className={`${FIELD_CLASS} ${className}`}>
      <span className={LABEL_CLASS}>{label}</span>
      {children}
    </label>
  )
}

function ToggleField({ checked, copy, hint, onChange }) {
  return (
    <label className="flex items-start gap-3 rounded-[24px] border border-[#eadcf7] bg-[#fbf8ff] px-4 py-4 text-sm text-slate-600">
      <input
        checked={checked}
        className="mt-1 h-4 w-4 rounded border-[#d7c2ec] text-[#5b1793] focus:ring-[#7c3aed]"
        type="checkbox"
        onChange={onChange}
      />
      <span className="space-y-1">
        <strong className="block font-semibold text-[#2b1837]">{copy}</strong>
        {hint ? <span className="block text-xs leading-5 text-slate-500">{hint}</span> : null}
      </span>
    </label>
  )
}

function IconActionButton({ disabled, href, icon, label, onClick, tone = 'default' }) {
  const tones = {
    default: 'border-[#e6d5f5] bg-white text-[#5b1793] hover:border-[#cbaef0] hover:bg-[#fbf8ff]',
    success: 'border-[#d9eddf] bg-white text-[#1f6b38] hover:border-[#bbe3c7] hover:bg-[#f1fbf3]',
    danger: 'border-[#f1d3dc] bg-white text-[#a11a42] hover:border-[#e8b4c4] hover:bg-[#fff2f6]',
    warning: 'border-[#f2e0b0] bg-white text-[#8d6112] hover:border-[#e8cd87] hover:bg-[#fff9ea]',
  }

  const className = `inline-flex h-11 w-11 items-center justify-center rounded-2xl border shadow-[0_14px_34px_rgba(114,73,151,0.08)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${
    tones[tone] || tones.default
  }`

  if (href) {
    return (
      <a
        className={className}
        href={href}
        rel="noreferrer"
        target="_blank"
        title={label}
        aria-label={label}
      >
        <i aria-hidden="true" className={`bi ${icon}`} />
      </a>
    )
  }

  return (
    <button
      className={className}
      disabled={disabled}
      title={label}
      type="button"
      aria-label={label}
      onClick={onClick}
    >
      <i aria-hidden="true" className={`bi ${icon}`} />
    </button>
  )
}

export function AdminDashboardPage() {
  const { admin, signOut, token } = useAdminAuth()
  const { refreshSettings } = useSiteSettings()
  const { refreshPaymentConfig } = useStore()
  const [section, setSection] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState('success')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [dashboard, setDashboard] = useState(null)
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [users, setUsers] = useState([])
  const [admins, setAdmins] = useState([])
  const [contacts, setContacts] = useState([])
  const [settingsForm, setSettingsForm] = useState(createSettingsForm(null))
  const [productForm, setProductForm] = useState(PRODUCT_DEFAULTS)
  const [productEditorOpen, setProductEditorOpen] = useState(false)
  const [editingProductId, setEditingProductId] = useState(null)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [orderDrafts, setOrderDrafts] = useState({})
  const [userDrafts, setUserDrafts] = useState({})
  const [adminDrafts, setAdminDrafts] = useState({})
  const [adminCreateForm, setAdminCreateForm] = useState(ADMIN_CREATE_DEFAULTS)
  const [passwordForm, setPasswordForm] = useState(ADMIN_PASSWORD_DEFAULTS)

  const visibleSections = useMemo(
    () => SECTION_ITEMS.filter((item) => (admin?.capabilities || []).includes(item.capability)),
    [admin?.capabilities],
  )

  useEffect(() => {
    if (!visibleSections.some((item) => item.value === section) && visibleSections[0]) {
      setSection(visibleSections[0].value)
    }
  }, [section, visibleSections])

  const hydrateAdminData = (response) => {
    setDashboard(response.dashboard || null)
    setProducts(response.products || [])
    setOrders(response.orders || [])
    setUsers(response.users || [])
    setAdmins(response.admins || [])
    setContacts(response.contacts || [])
    setSettingsForm(createSettingsForm(response.settings))
    setOrderDrafts(
      Object.fromEntries(
        (response.orders || []).map((order) => [order.orderNumber, createOrderDraft(order)]),
      ),
    )
    setUserDrafts(
      Object.fromEntries((response.users || []).map((user) => [user.id, createUserDraft(user)])),
    )
    setAdminDrafts(
      Object.fromEntries((response.admins || []).map((item) => [item.id, createAdminDraft(item)])),
    )
  }

  const loadAdminData = async () => {
    const response = await api.getAdminBootstrap(token)
    hydrateAdminData(response)
    return response
  }

  useEffect(() => {
    let ignore = false

    const load = async () => {
      setLoading(true)
      setMessage('')

      try {
        const response = await api.getAdminBootstrap(token)

        if (!ignore) {
          hydrateAdminData(response)
        }
      } catch (error) {
        if (!ignore) {
          setMessage(error.message || 'Unable to load admin dashboard.')
          setMessageTone('warning')
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      ignore = true
    }
  }, [token])

  useEffect(() => {
    setMenuOpen(false)
  }, [section])

  const overviewCards = useMemo(
    () => [
      { icon: 'bi-box-seam', label: 'Products', value: dashboard?.productsCount || 0 },
      { icon: 'bi-people', label: 'Users', value: dashboard?.usersCount || 0 },
      { icon: 'bi-truck', label: 'Orders', value: dashboard?.ordersCount || 0 },
      { icon: 'bi-shield-lock', label: 'Admins', value: dashboard?.adminsCount || admins.length || 0 },
      { icon: 'bi-wallet2', label: 'Revenue', value: formatCurrency(dashboard?.revenueTotal || 0) },
      {
        icon: 'bi-hourglass-split',
        label: 'Pending reviews',
        value: dashboard?.pendingReviewsCount || 0,
      },
    ],
    [admins.length, dashboard],
  )

  const filteredProducts = useMemo(
    () =>
      products.filter((product) =>
        matchesQuery(deferredQuery, [product.name, product.category, product.badge]),
      ),
    [deferredQuery, products],
  )

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) =>
        matchesQuery(deferredQuery, [
          order.orderNumber,
          order.customerName,
          order.customerEmail,
          order.status,
          order.paymentStatus,
          order.trackingNumber,
          order.trackingCarrier,
        ]),
      ),
    [deferredQuery, orders],
  )

  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        matchesQuery(deferredQuery, [user.fullName, user.email, user.phoneNumber, user.accountStatus]),
      ),
    [deferredQuery, users],
  )

  const filteredAdmins = useMemo(
    () =>
      admins.filter((item) =>
        matchesQuery(deferredQuery, [
          item.fullName,
          item.email,
          item.role,
          item.isActive ? 'active' : 'inactive',
        ]),
      ),
    [admins, deferredQuery],
  )

  const filteredContacts = useMemo(
    () =>
      contacts.filter((contact) =>
        matchesQuery(deferredQuery, [contact.fullName, contact.email, contact.subject, contact.message]),
      ),
    [contacts, deferredQuery],
  )

  const activeSection = visibleSections.find((item) => item.value === section) || visibleSections[0]
  const activeSectionLabel = activeSection?.label || 'Overview'
  const activeCopy = SECTION_COPY[section] || SECTION_COPY.overview
  const selectedUser = users.find((user) => user.id === selectedUserId) || null
  const selectedUserDraft = selectedUser
    ? userDrafts[selectedUser.id] || createUserDraft(selectedUser)
    : null

  const handleAction = async (action, successMessage, warningMessage) => {
    setSubmitting(true)
    setMessage('')

    try {
      await action()
      setMessage(successMessage)
      setMessageTone('success')
    } catch (error) {
      setMessage(error.message || warningMessage)
      setMessageTone('warning')
    } finally {
      setSubmitting(false)
    }
  }

  const updateProductForm = (event) => {
    const { checked, name, type, value } = event.target
    setProductForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  const updateOrderDraft = (orderNumber, key, value) => {
    setOrderDrafts((current) => ({
      ...current,
      [orderNumber]: { ...current[orderNumber], [key]: value },
    }))
  }

  const updateUserDraft = (userId, key, value) => {
    setUserDrafts((current) => ({ ...current, [userId]: { ...current[userId], [key]: value } }))
  }

  const updateAdminDraft = (adminId, key, value) => {
    setAdminDrafts((current) => ({
      ...current,
      [adminId]: { ...current[adminId], [key]: value },
    }))
  }

  const updateSettingsField = (group, key, value) => {
    setSettingsForm((current) => ({ ...current, [group]: { ...current[group], [key]: value } }))
  }

  const saveProduct = async (event) => {
    event.preventDefault()

    await handleAction(
      async () => {
        const payload = {
          ...productForm,
          price: Number(productForm.price),
          stockQuantity: Number(productForm.stockQuantity),
        }

        if (editingProductId) {
          await api.updateAdminProduct({ payload, productId: editingProductId, token })
        } else {
          await api.createAdminProduct(payload, token)
        }

        await loadAdminData()
        setEditingProductId(null)
        setProductForm(PRODUCT_DEFAULTS)
        setProductEditorOpen(false)
      },
      editingProductId ? 'Product updated.' : 'Product created.',
      'Unable to save product.',
    )
  }

  const openNewProductEditor = () => {
    setEditingProductId(null)
    setProductForm(PRODUCT_DEFAULTS)
    setProductEditorOpen(true)

    if (typeof document !== 'undefined') {
      window.setTimeout(() => {
        document.getElementById('admin-product-editor')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 80)
    }
  }

  const editProduct = (product) => {
    startTransition(() => setSection('products'))
    setEditingProductId(product.id)
    setProductEditorOpen(true)
    setProductForm({
      badge: product.badge || '',
      category: product.category,
      description: product.description,
      featured: Boolean(product.featured),
      imageUrl: product.imageUrl,
      name: product.name,
      price: String(product.price),
      stockQuantity: String(product.stockQuantity),
    })

    if (typeof document !== 'undefined') {
      window.setTimeout(() => {
        document.getElementById('admin-product-editor')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 80)
    }
  }

  const removeProduct = async (productId) => {
    if (!window.confirm('Remove this product from the storefront?')) {
      return
    }

    await handleAction(
      async () => {
        await api.deleteAdminProduct(productId, token)
        await loadAdminData()

        if (editingProductId === productId) {
          setEditingProductId(null)
          setProductForm(PRODUCT_DEFAULTS)
          setProductEditorOpen(false)
        }
      },
      'Product removed.',
      'Unable to remove product.',
    )
  }

  const uploadProductImage = async (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setUploadingImage(true)
    setMessage('')

    try {
      const formData = new FormData()
      formData.set('image', file)
      const response = await api.uploadAdminProductImage(formData, token)
      setProductForm((current) => ({ ...current, imageUrl: response.imageUrl || response.path || '' }))
      setMessage(response.message || 'Product image uploaded.')
      setMessageTone('success')
    } catch (error) {
      setMessage(error.message || 'Unable to upload product image.')
      setMessageTone('warning')
    } finally {
      setUploadingImage(false)
      event.target.value = ''
    }
  }

  const saveOrder = async (orderNumber) =>
    handleAction(
      async () => {
        await api.updateAdminOrder({ orderNumber, payload: orderDrafts[orderNumber], token })
        await loadAdminData()
      },
      `Order ${orderNumber} updated.`,
      'Unable to update order.',
    )

  const emailOrder = async (orderNumber) => {
    const draft = orderDrafts[orderNumber]
    setSubmitting(true)
    setMessage('')

    try {
      const response = await api.emailAdminOrderCustomer({
        orderNumber,
        payload: { message: draft.emailMessage, subject: draft.emailSubject },
        token,
      })
      setMessage(response.message || 'Order email sent.')
      setMessageTone(response.mailDelivered === false ? 'warning' : 'success')
    } catch (error) {
      setMessage(error.message || 'Unable to send order email.')
      setMessageTone('warning')
    } finally {
      setSubmitting(false)
    }
  }

  const openUserWorkspace = (userId) => {
    setSelectedUserId(userId)

    if (typeof document !== 'undefined') {
      window.setTimeout(() => {
        document.getElementById('admin-user-workspace')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 80)
    }
  }

  const saveUser = async (userId) =>
    handleAction(
      async () => {
        await api.updateAdminUser({ payload: userDrafts[userId], token, userId })
        await loadAdminData()
        setSelectedUserId(userId)
      },
      'User updated.',
      'Unable to update user.',
    )

  const emailUser = async (userId) => {
    const draft = userDrafts[userId]
    setSubmitting(true)
    setMessage('')

    try {
      const response = await api.emailAdminUser({
        payload: { message: draft.emailMessage, subject: draft.emailSubject },
        token,
        userId,
      })
      setMessage(response.message || 'User email sent.')
      setMessageTone(response.mailDelivered === false ? 'warning' : 'success')
    } catch (error) {
      setMessage(error.message || 'Unable to send user email.')
      setMessageTone('warning')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleUserBlock = async (user) => {
    const draft = userDrafts[user.id] || createUserDraft(user)
    const nextStatus = (draft.accountStatus || user.accountStatus) === 'suspended' ? 'active' : 'suspended'

    await handleAction(
      async () => {
        await api.updateAdminUser({
          payload: {
            ...draft,
            accountStatus: nextStatus,
          },
          token,
          userId: user.id,
        })
        await loadAdminData()
        setSelectedUserId(user.id)
      },
      nextStatus === 'suspended' ? 'User blocked.' : 'User restored.',
      'Unable to update user status.',
    )
  }

  const deleteUser = async (user) => {
    if (!window.confirm(`Delete ${user.email} permanently? This cannot be undone.`)) {
      return
    }

    await handleAction(
      async () => {
        await api.deleteAdminUser(user.id, token)
        await loadAdminData()

        if (selectedUserId === user.id) {
          setSelectedUserId(null)
        }
      },
      'User deleted.',
      'Unable to delete user.',
    )
  }

  const renderUserActions = (user, className = '') => (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      <IconActionButton icon="bi-eye" label="View user" onClick={() => openUserWorkspace(user.id)} />
      <IconActionButton icon="bi-pencil-square" label="Edit user" onClick={() => openUserWorkspace(user.id)} />
      <IconActionButton icon="bi-envelope-paper" label="Open mail panel" onClick={() => openUserWorkspace(user.id)} />
      <IconActionButton icon="bi-trash3" label="Delete user" tone="danger" onClick={() => deleteUser(user)} />
      <IconActionButton
        icon="bi-slash-circle"
        label={user.accountStatus === 'suspended' ? 'Restore user' : 'Block user'}
        tone="warning"
        onClick={() => toggleUserBlock(user)}
      />
    </div>
  )

  const createAdminAccount = async (event) => {
    event.preventDefault()

    await handleAction(
      async () => {
        await api.createAdminAccount(adminCreateForm, token)
        await loadAdminData()
        setAdminCreateForm(ADMIN_CREATE_DEFAULTS)
      },
      'Admin account created.',
      'Unable to create admin account.',
    )
  }

  const saveAdminAccount = async (adminId) =>
    handleAction(
      async () => {
        await api.updateAdminAccount({
          adminId,
          payload: adminDrafts[adminId],
          token,
        })
        await loadAdminData()
      },
      'Admin account updated.',
      'Unable to update admin account.',
    )

  const changeAdminPassword = async (event) => {
    event.preventDefault()

    await handleAction(
      async () => {
        await api.adminChangePassword(passwordForm, token)
        setPasswordForm(ADMIN_PASSWORD_DEFAULTS)
      },
      'Admin password changed.',
      'Unable to update admin password.',
    )
  }

  const saveSettings = async (event) => {
    event.preventDefault()

    await handleAction(
      async () => {
        await api.updateAdminSettings(settingsForm, token)
        await Promise.all([refreshSettings(), refreshPaymentConfig().catch(() => {})])
        await loadAdminData()
      },
      'Admin settings saved and synced to the site.',
      'Unable to save admin settings.',
    )
  }

  const setSectionValue = (value) => {
    startTransition(() => setSection(value))
    setMenuOpen(false)
  }

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {overviewCards.map((item) => (
          <StatCard key={item.label} icon={item.icon} label={item.label} value={item.value} />
        ))}
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
        <Panel
          actions={<StatusPill tone="slate">{(dashboard?.recentOrders || []).length} recent</StatusPill>}
          description="Latest customer orders reaching the business."
          icon="bi-clock-history"
          title="Recent orders"
        >
          {(dashboard?.recentOrders || []).length > 0 ? (
            <div className="overflow-hidden rounded-[26px] border border-[#eadcf7] bg-[#fcfaff]">
              <div className="hidden grid-cols-[60px_minmax(0,1.2fr)_140px_140px_160px] gap-3 border-b border-[#eadcf7] bg-[#f7f1fe] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7d668d] sm:grid">
                <span>No.</span>
                <span>Order</span>
                <span>Status</span>
                <span>Total</span>
                <span>Placed</span>
              </div>
              {(dashboard?.recentOrders || []).map((order, index) => (
                <article key={order.orderNumber} className="grid gap-3 border-t border-[#f0e7f7] px-4 py-4 first:border-t-0 sm:grid-cols-[60px_minmax(0,1.2fr)_140px_140px_160px] sm:items-center">
                  <span className="text-sm font-semibold text-[#5b1793]">{index + 1}.</span>
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-semibold text-[#271535]">{order.orderNumber}</strong>
                    <p className="mt-1 truncate text-sm text-slate-500">{order.customerName}</p>
                  </div>
                  <div>
                    <StatusPill>{humanizeValue(order.status)}</StatusPill>
                  </div>
                  <strong className="text-sm font-semibold text-[#271535]">{formatCurrency(order.total)}</strong>
                  <span className="text-sm text-slate-500">{formatDate(order.createdAt)}</span>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState copy="New orders will appear here as soon as customers complete checkout." icon="bi-bag-check" title="No recent orders" />
          )}
        </Panel>

        <Panel
          actions={<StatusPill tone="slate">{(dashboard?.recentUsers || []).length} recent</StatusPill>}
          description="New and active customer accounts."
          icon="bi-person-badge"
          title="Recent users"
        >
          {(dashboard?.recentUsers || []).length > 0 ? (
            <div className="overflow-hidden rounded-[26px] border border-[#eadcf7] bg-[#fcfaff]">
              <div className="hidden grid-cols-[60px_minmax(0,1.2fr)_120px_120px] gap-3 border-b border-[#eadcf7] bg-[#f7f1fe] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7d668d] sm:grid">
                <span>No.</span>
                <span>User</span>
                <span>Status</span>
                <span>Orders</span>
              </div>
              {(dashboard?.recentUsers || []).map((user, index) => (
                <article key={user.id} className="grid gap-3 border-t border-[#f0e7f7] px-4 py-4 first:border-t-0 sm:grid-cols-[60px_minmax(0,1.2fr)_120px_120px] sm:items-center">
                  <span className="text-sm font-semibold text-[#5b1793]">{index + 1}.</span>
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-semibold text-[#271535]">{user.email}</strong>
                    <p className="mt-1 truncate text-sm text-slate-500">{user.fullName}</p>
                  </div>
                  <div>
                    <StatusPill>{humanizeValue(user.accountStatus)}</StatusPill>
                  </div>
                  <span className="text-sm text-slate-500">{user.ordersCount} orders</span>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState copy="Customer signups and verified accounts will surface here." icon="bi-people" title="No recent users" />
          )}
        </Panel>
      </div>
    </div>
  )

  const renderProducts = () => (
    <div className="space-y-6">
      <Panel
        actions={
          <button className={PRIMARY_BUTTON_CLASS} type="button" onClick={openNewProductEditor}>
            <i aria-hidden="true" className="bi bi-plus-circle" />
            <span>Add new product</span>
          </button>
        }
        description="Keep the catalog in a clean row layout and open the editor only when you need it."
        icon="bi-box-seam"
        title="Product catalog"
      >
        {filteredProducts.length > 0 ? (
          <div className="overflow-hidden rounded-[26px] border border-[#eadcf7] bg-[#fcfaff]">
            <div className="hidden grid-cols-[60px_minmax(0,1.3fr)_120px_120px_120px_110px] gap-3 border-b border-[#eadcf7] bg-[#f7f1fe] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7d668d] lg:grid">
              <span>No.</span>
              <span>Product</span>
              <span>Category</span>
              <span>Price</span>
              <span>Stock</span>
              <span className="text-right">Actions</span>
            </div>
            {filteredProducts.map((product, index) => (
              <article key={product.id} className={`grid gap-4 border-t border-[#f0e7f7] px-4 py-4 first:border-t-0 lg:grid-cols-[60px_minmax(0,1.3fr)_120px_120px_120px_110px] lg:items-center ${editingProductId === product.id ? 'bg-[#fbf5ff]' : 'bg-transparent'}`}>
                <span className="text-sm font-semibold text-[#5b1793]">{index + 1}.</span>
                <div className="min-w-0 flex items-center gap-3">
                  <img alt={product.name} className="h-14 w-14 rounded-2xl object-cover" src={product.imageUrl} />
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-semibold text-[#271535]">{product.name}</strong>
                    <p className="mt-1 truncate text-sm text-slate-500">{product.badge || 'No badge assigned'}</p>
                  </div>
                </div>
                <span className="text-sm text-slate-500">{product.category}</span>
                <strong className="text-sm font-semibold text-[#271535]">{formatCurrency(product.price)}</strong>
                <div>
                  <StatusPill tone="slate">Stock {product.stockQuantity}</StatusPill>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <IconActionButton icon="bi-pencil-square" label="Edit product" onClick={() => editProduct(product)} />
                  <IconActionButton icon="bi-trash3" label="Delete product" tone="danger" onClick={() => removeProduct(product.id)} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState copy="No products matched the current search. Try a different query or add a new item." icon="bi-box-seam" title="No products found" />
        )}
      </Panel>

      {productEditorOpen ? (
        <div id="admin-product-editor">
          <Panel
            actions={
              <button className={SECONDARY_BUTTON_CLASS} type="button" onClick={() => { setEditingProductId(null); setProductForm(PRODUCT_DEFAULTS); setProductEditorOpen(false) }}>
                <i aria-hidden="true" className="bi bi-x-circle" />
                <span>Close editor</span>
              </button>
            }
            description="Use the same template for editing an existing product or creating a new one."
            icon="bi-pencil-square"
            title={editingProductId ? 'Edit product' : 'Add new product'}
          >
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveProduct}>
              <Field className="sm:col-span-2" label="Product name">
                <input className={INPUT_CLASS} name="name" required type="text" value={productForm.name} onChange={updateProductForm} />
              </Field>

              <Field label="Category">
                <select className={INPUT_CLASS} name="category" value={productForm.category} onChange={updateProductForm}>
                  {CATEGORY_OPTIONS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </Field>

              <Field label="Badge">
                <input className={INPUT_CLASS} name="badge" type="text" value={productForm.badge} onChange={updateProductForm} />
              </Field>

              <Field label="Price">
                <input className={INPUT_CLASS} name="price" required type="number" value={productForm.price} onChange={updateProductForm} />
              </Field>

              <Field label="Stock quantity">
                <input className={INPUT_CLASS} name="stockQuantity" required type="number" value={productForm.stockQuantity} onChange={updateProductForm} />
              </Field>

              <Field className="sm:col-span-2" label="Image URL">
                <input className={INPUT_CLASS} name="imageUrl" required type="url" value={productForm.imageUrl} onChange={updateProductForm} />
              </Field>

              <div className="sm:col-span-2 rounded-[24px] border border-dashed border-[#d9c7ee] bg-[#fbf8ff] p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#291436]">Upload product image</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">JPG, PNG, or WEBP up to 4MB. Uploaded files are stored on the server.</p>
                  </div>
                  <label className={SECONDARY_BUTTON_CLASS}>
                    <input accept="image/jpeg,image/png,image/webp" hidden type="file" onChange={uploadProductImage} />
                    <i aria-hidden="true" className={`bi ${uploadingImage ? 'bi-arrow-repeat animate-spin' : 'bi-cloud-arrow-up'}`} />
                    <span>{uploadingImage ? 'Uploading...' : 'Choose image'}</span>
                  </label>
                </div>
              </div>

              {productForm.imageUrl ? (
                <div className="sm:col-span-2 overflow-hidden rounded-[24px] border border-[#eadcf7] bg-[#fbf8ff]">
                  <img alt="Product preview" className="h-64 w-full object-cover" src={productForm.imageUrl} />
                </div>
              ) : null}

              <Field className="sm:col-span-2" label="Description">
                <textarea className={TEXTAREA_CLASS} name="description" required rows="4" value={productForm.description} onChange={updateProductForm} />
              </Field>

              <div className="sm:col-span-2">
                <ToggleField checked={productForm.featured} copy="Show this item in featured placements" hint="Featured products appear more prominently across the storefront." onChange={updateProductForm} />
              </div>

              <div className="flex flex-wrap gap-3 sm:col-span-2">
                <button className={PRIMARY_BUTTON_CLASS} disabled={submitting || uploadingImage} type="submit">
                  <i aria-hidden="true" className={`bi ${editingProductId ? 'bi-check2-circle' : 'bi-plus-circle'}`} />
                  <span>{editingProductId ? 'Save product' : 'Add product'}</span>
                </button>
              </div>
            </form>
          </Panel>
        </div>
      ) : null}
    </div>
  )

  const renderOrders = () => (
    <div className="space-y-5">
      {filteredOrders.length > 0 ? (
        filteredOrders.map((order) => {
          const draft = orderDrafts[order.orderNumber] || createOrderDraft(order)

          return (
            <Panel
              key={order.orderNumber}
              actions={
                <div className="flex items-center gap-2">
                  {order.paymentProofUrl ? (
                    <IconActionButton href={order.paymentProofUrl} icon="bi-receipt" label="View payment proof" tone="warning" />
                  ) : null}
                  <IconActionButton
                    disabled={submitting}
                    icon="bi-envelope-paper"
                    label="Send order email"
                    onClick={() => emailOrder(order.orderNumber)}
                  />
                  <IconActionButton
                    disabled={submitting}
                    icon="bi-check2-circle"
                    label="Save order"
                    tone="success"
                    onClick={() => saveOrder(order.orderNumber)}
                  />
                </div>
              }
              description={`${order.customerName} | ${order.customerEmail}`}
              icon="bi-truck"
              title={order.orderNumber}
            >
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill>{humanizeValue(order.status)}</StatusPill>
                  <StatusPill tone="slate">{humanizeValue(order.paymentStatus)}</StatusPill>
                  <StatusPill tone="slate">{formatCurrency(order.total)}</StatusPill>
                  <StatusPill tone="slate">{formatDate(order.createdAt)}</StatusPill>
                  {order.paymentMethod ? <StatusPill tone="slate">{humanizeValue(order.paymentMethod)}</StatusPill> : null}
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <Field label="Order status">
                    <select
                      className={INPUT_CLASS}
                      value={draft.status}
                      onChange={(event) => updateOrderDraft(order.orderNumber, 'status', event.target.value)}
                    >
                      {ORDER_STATUS_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {humanizeValue(item)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Payment status">
                    <select
                      className={INPUT_CLASS}
                      value={draft.paymentStatus}
                      onChange={(event) => updateOrderDraft(order.orderNumber, 'paymentStatus', event.target.value)}
                    >
                      {PAYMENT_STATUS_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {humanizeValue(item)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <ToggleField
                    checked={draft.notifyCustomer}
                    copy="Notify customer on save"
                    hint="Use this when the order update should email the customer automatically."
                    onChange={(event) => updateOrderDraft(order.orderNumber, 'notifyCustomer', event.target.checked)}
                  />
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <Field label="Tracking carrier">
                    <input
                      className={INPUT_CLASS}
                      value={draft.trackingCarrier}
                      onChange={(event) => updateOrderDraft(order.orderNumber, 'trackingCarrier', event.target.value)}
                    />
                  </Field>

                  <Field label="Tracking number">
                    <input
                      className={INPUT_CLASS}
                      value={draft.trackingNumber}
                      onChange={(event) => updateOrderDraft(order.orderNumber, 'trackingNumber', event.target.value)}
                    />
                  </Field>

                  <Field label="Estimated delivery">
                    <input
                      className={INPUT_CLASS}
                      type="date"
                      value={draft.estimatedDeliveryAt}
                      onChange={(event) => updateOrderDraft(order.orderNumber, 'estimatedDeliveryAt', event.target.value)}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Field label="Tracking URL">
                    <input
                      className={INPUT_CLASS}
                      value={draft.trackingUrl}
                      onChange={(event) => updateOrderDraft(order.orderNumber, 'trackingUrl', event.target.value)}
                    />
                  </Field>

                  <Field label="Tracking event location">
                    <input
                      className={INPUT_CLASS}
                      value={draft.trackingEventLocation}
                      onChange={(event) => updateOrderDraft(order.orderNumber, 'trackingEventLocation', event.target.value)}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Field label="Tracking event status">
                    <select
                      className={INPUT_CLASS}
                      value={draft.trackingEventStatus}
                      onChange={(event) => updateOrderDraft(order.orderNumber, 'trackingEventStatus', event.target.value)}
                    >
                      {ORDER_STATUS_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {humanizeValue(item)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Tracking event note">
                    <textarea
                      className={TEXTAREA_CLASS}
                      rows="3"
                      value={draft.trackingEventMessage}
                      onChange={(event) => updateOrderDraft(order.orderNumber, 'trackingEventMessage', event.target.value)}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Field label="Internal admin note">
                    <textarea
                      className={TEXTAREA_CLASS}
                      rows="3"
                      value={draft.adminNote}
                      onChange={(event) => updateOrderDraft(order.orderNumber, 'adminNote', event.target.value)}
                    />
                  </Field>

                  <Field label="Payment review note">
                    <textarea
                      className={TEXTAREA_CLASS}
                      rows="3"
                      value={draft.paymentReviewNote}
                      onChange={(event) => updateOrderDraft(order.orderNumber, 'paymentReviewNote', event.target.value)}
                    />
                  </Field>
                </div>

                <div className="rounded-[26px] border border-[#f0e7f7] bg-[#fcfaff] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7d668d]">Items</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(order.items || []).map((item) => (
                      <span
                        key={`${order.orderNumber}-${item.productId || item.name}`}
                        className="inline-flex items-center rounded-full bg-white px-3 py-2 text-sm text-slate-600 shadow-[0_12px_32px_rgba(106,68,141,0.08)]"
                      >
                        {item.quantity}x {item.name}
                      </span>
                    ))}
                  </div>
                </div>

                {(order.trackingEvents || []).length > 0 ? (
                  <div className="rounded-[26px] border border-[#f0e7f7] bg-[#fcfaff] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7d668d]">
                      Tracking timeline
                    </p>
                    <div className="mt-4 space-y-4">
                      {(order.trackingEvents || []).map((item) => (
                        <article key={item.id} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <span className="mt-1 h-3 w-3 rounded-full bg-[#7c3aed]" />
                            <span className="mt-2 h-full w-px bg-[#eadcf7]" />
                          </div>
                          <div className="pb-4">
                            <strong className="text-sm font-semibold text-[#281535]">
                              {humanizeValue(item.status)}
                            </strong>
                            <p className="mt-1 text-sm text-slate-500">{item.message}</p>
                            <span className="mt-2 block text-xs text-slate-400">
                              {formatDate(item.occurredAt)}
                              {item.location ? ` | ${item.location}` : ''}
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-2">
                  <Field label="Email subject">
                    <input
                      className={INPUT_CLASS}
                      value={draft.emailSubject}
                      onChange={(event) => updateOrderDraft(order.orderNumber, 'emailSubject', event.target.value)}
                    />
                  </Field>

                  <Field label="Email message">
                    <textarea
                      className={TEXTAREA_CLASS}
                      rows="3"
                      value={draft.emailMessage}
                      onChange={(event) => updateOrderDraft(order.orderNumber, 'emailMessage', event.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </Panel>
          )
        })
      ) : (
        <EmptyState copy="No orders matched the current search." icon="bi-truck" title="No orders found" />
      )}
    </div>
  )

  const renderUsers = () => (
    <div className={`grid gap-6 ${selectedUser ? '2xl:grid-cols-[minmax(0,1fr)_430px]' : ''}`}>
      <Panel
        actions={<StatusPill tone="slate">{filteredUsers.length} user(s)</StatusPill>}
        description="Customer accounts with quick actions, status control, and a cleaner workspace layout."
        icon="bi-people"
        title="Customer users"
      >
        {filteredUsers.length > 0 ? (
          <div className="overflow-hidden rounded-[28px] border border-[#eadcf7] bg-[#fcfaff] shadow-[0_20px_44px_rgba(91,23,147,0.06)]">
            <div className="hidden 2xl:grid grid-cols-[56px_minmax(0,1.35fr)_minmax(0,1.05fr)_120px_120px_220px] gap-4 border-b border-[#eadcf7] bg-[#f7f1fe] px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7d668d]">
              <span>No.</span>
              <span>Email</span>
              <span>Name</span>
              <span>Status</span>
              <span>Spent</span>
              <span className="text-right">Actions</span>
            </div>
            {filteredUsers.map((user, index) => (
              <article
                key={user.id}
                className={`border-t border-[#f0e7f7] px-5 py-5 first:border-t-0 ${selectedUserId === user.id ? 'bg-[#fbf5ff]' : 'bg-transparent'}`}
              >
                <div className="2xl:hidden">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[#f4eafb] text-sm font-semibold text-[#5b1793]">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="truncate text-sm font-semibold text-[#271535]">{user.fullName}</strong>
                            <StatusPill tone={user.accountStatus === 'suspended' ? 'warning' : 'success'}>
                              {humanizeValue(user.accountStatus)}
                            </StatusPill>
                          </div>
                          <p className="mt-1 truncate text-sm text-[#5a456e]">{user.email}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-2 rounded-full bg-[#f7f1fe] px-3 py-1.5">
                          <i aria-hidden="true" className="bi bi-telephone" />
                          <span>{user.phoneNumber || 'No phone number'}</span>
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full bg-[#f7f1fe] px-3 py-1.5">
                          <i aria-hidden="true" className="bi bi-bag-check" />
                          <span>{user.ordersCount} order(s)</span>
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full bg-[#f7f1fe] px-3 py-1.5 text-[#271535]">
                          <i aria-hidden="true" className="bi bi-cash-coin" />
                          <span>{formatCurrency(user.totalSpent || 0)}</span>
                        </span>
                      </div>
                    </div>

                    {renderUserActions(user, 'w-full justify-start sm:w-auto sm:justify-end')}
                  </div>
                </div>

                <div className="hidden 2xl:grid 2xl:grid-cols-[56px_minmax(0,1.35fr)_minmax(0,1.05fr)_120px_120px_220px] 2xl:items-center 2xl:gap-4">
                  <span className="text-sm font-semibold text-[#5b1793]">{index + 1}.</span>
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-semibold text-[#271535]">{user.email}</strong>
                    <p className="mt-1 text-xs text-slate-500">{user.phoneNumber || 'No phone number'}</p>
                  </div>
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-semibold text-[#271535]">{user.fullName}</strong>
                    <p className="mt-1 text-xs text-slate-500">{user.ordersCount} order(s)</p>
                  </div>
                  <div>
                    <StatusPill tone={user.accountStatus === 'suspended' ? 'warning' : 'success'}>
                      {humanizeValue(user.accountStatus)}
                    </StatusPill>
                  </div>
                  <strong className="text-sm font-semibold text-[#271535]">{formatCurrency(user.totalSpent || 0)}</strong>
                  {renderUserActions(user, 'justify-end')}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState copy="No users matched the current search." icon="bi-people" title="No users found" />
        )}
      </Panel>

      {selectedUser && selectedUserDraft ? (
        <div id="admin-user-workspace">
          <Panel
            actions={<button className={SECONDARY_BUTTON_CLASS} type="button" onClick={() => setSelectedUserId(null)}><i aria-hidden="true" className="bi bi-x-circle" /><span>Close</span></button>}
            description={selectedUser.email}
            icon="bi-person-vcard"
            title={selectedUser.fullName}
          >
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={selectedUser.accountStatus === 'suspended' ? 'warning' : 'success'}>{humanizeValue(selectedUser.accountStatus)}</StatusPill>
                <StatusPill tone="slate">{selectedUser.ordersCount} orders</StatusPill>
                <StatusPill tone="slate">{formatCurrency(selectedUser.totalSpent || 0)} spent</StatusPill>
                {selectedUser.emailVerified ? <StatusPill tone="success">Verified</StatusPill> : <StatusPill tone="warning">Unverified</StatusPill>}
              </div>

              <div className="grid gap-4">
                <Field label="Email address">
                  <input className={`${INPUT_CLASS} bg-[#f7f1fe]`} readOnly value={selectedUser.email} />
                </Field>
                <Field label="Full name">
                  <input className={INPUT_CLASS} value={selectedUserDraft.fullName} onChange={(event) => updateUserDraft(selectedUser.id, 'fullName', event.target.value)} />
                </Field>
                <Field label="Phone number">
                  <input className={INPUT_CLASS} value={selectedUserDraft.phoneNumber} onChange={(event) => updateUserDraft(selectedUser.id, 'phoneNumber', event.target.value)} />
                </Field>
                <Field label="Account status">
                  <select className={INPUT_CLASS} value={selectedUserDraft.accountStatus} onChange={(event) => updateUserDraft(selectedUser.id, 'accountStatus', event.target.value)}>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </Field>
              </div>

              <div className="grid gap-4">
                <ToggleField checked={selectedUserDraft.emailVerified} copy="Email verified" hint="Controls whether this customer account is treated as verified." onChange={(event) => updateUserDraft(selectedUser.id, 'emailVerified', event.target.checked)} />
                <ToggleField checked={selectedUserDraft.newsletterOptIn} copy="Newsletter opt-in" hint="Shows whether the user is subscribed to email updates." onChange={(event) => updateUserDraft(selectedUser.id, 'newsletterOptIn', event.target.checked)} />
              </div>

              <div className="grid gap-4">
                <Field label="Email subject">
                  <input className={INPUT_CLASS} value={selectedUserDraft.emailSubject} onChange={(event) => updateUserDraft(selectedUser.id, 'emailSubject', event.target.value)} />
                </Field>
                <Field label="Email message">
                  <textarea className={TEXTAREA_CLASS} rows="4" value={selectedUserDraft.emailMessage} onChange={(event) => updateUserDraft(selectedUser.id, 'emailMessage', event.target.value)} />
                </Field>
              </div>

              <div className="flex flex-wrap gap-3">
                <button className={PRIMARY_BUTTON_CLASS} disabled={submitting} type="button" onClick={() => saveUser(selectedUser.id)}>
                  <i aria-hidden="true" className="bi bi-check2-circle" />
                  <span>Save user</span>
                </button>
                <button className={SECONDARY_BUTTON_CLASS} disabled={submitting} type="button" onClick={() => emailUser(selectedUser.id)}>
                  <i aria-hidden="true" className="bi bi-envelope-paper" />
                  <span>Send mail</span>
                </button>
              </div>
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  )

  const renderTeam = () => (
    <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="space-y-6 xl:sticky xl:top-[7.5rem] xl:h-fit">
        <Panel
          description="Add operational admins with distinct roles and a separate login session."
          icon="bi-person-plus"
          title="Create admin account"
        >
          <form className="grid gap-4" onSubmit={createAdminAccount}>
            <Field label="Full name">
              <input
                className={INPUT_CLASS}
                value={adminCreateForm.fullName}
                onChange={(event) =>
                  setAdminCreateForm((current) => ({ ...current, fullName: event.target.value }))
                }
              />
            </Field>

            <Field label="Email">
              <input
                className={INPUT_CLASS}
                type="email"
                value={adminCreateForm.email}
                onChange={(event) =>
                  setAdminCreateForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </Field>

            <Field label="Role">
              <select
                className={INPUT_CLASS}
                value={adminCreateForm.role}
                onChange={(event) =>
                  setAdminCreateForm((current) => ({ ...current, role: event.target.value }))
                }
              >
                {ADMIN_ROLE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {humanizeValue(item)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Temporary password">
              <input
                className={INPUT_CLASS}
                type="password"
                value={adminCreateForm.password}
                onChange={(event) =>
                  setAdminCreateForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </Field>

            <ToggleField
              checked={adminCreateForm.isActive}
              copy="Account is active immediately"
              hint="Disable this if the admin should not sign in yet."
              onChange={(event) =>
                setAdminCreateForm((current) => ({ ...current, isActive: event.target.checked }))
              }
            />

            <button className={PRIMARY_BUTTON_CLASS} disabled={submitting} type="submit">
              <i aria-hidden="true" className="bi bi-plus-circle" />
              <span>Create admin</span>
            </button>
          </form>
        </Panel>

        <Panel
          description="Update your current admin password without leaving the dashboard."
          icon="bi-key"
          title="Change my password"
        >
          <form className="grid gap-4" onSubmit={changeAdminPassword}>
            <Field label="Current password">
              <input
                className={INPUT_CLASS}
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))
                }
              />
            </Field>

            <Field label="New password">
              <input
                className={INPUT_CLASS}
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))
                }
              />
            </Field>

            <button className={PRIMARY_BUTTON_CLASS} disabled={submitting} type="submit">
              <i aria-hidden="true" className="bi bi-shield-check" />
              <span>Update password</span>
            </button>
          </form>
        </Panel>
      </div>

      <Panel
        actions={<StatusPill tone="slate">{filteredAdmins.length} admin(s)</StatusPill>}
        description="Edit admin accounts, roles, activity state, and optional password resets."
        icon="bi-shield-lock"
        title="Admin team"
      >
        {filteredAdmins.length > 0 ? (
          <div className="space-y-5">
            {filteredAdmins.map((item) => {
              const draft = adminDrafts[item.id] || createAdminDraft(item)

              return (
                <article
                  key={item.id}
                  className="rounded-[28px] border border-[#f0e7f7] bg-[#fcfaff] p-5 shadow-[0_16px_40px_rgba(102,66,139,0.08)]"
                >
                  <div className="flex flex-col gap-4 border-b border-[#ece1f7] pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight text-[#251230]">
                        {item.fullName}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">{item.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill>{humanizeValue(item.role)}</StatusPill>
                      {item.isActive ? <StatusPill tone="success">Active</StatusPill> : <StatusPill tone="warning">Inactive</StatusPill>}
                      <IconActionButton
                        disabled={submitting}
                        icon="bi-check2-circle"
                        label="Save admin"
                        tone="success"
                        onClick={() => saveAdminAccount(item.id)}
                      />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <Field label="Full name">
                      <input
                        className={INPUT_CLASS}
                        value={draft.fullName}
                        onChange={(event) => updateAdminDraft(item.id, 'fullName', event.target.value)}
                      />
                    </Field>

                    <Field label="Email">
                      <input
                        className={INPUT_CLASS}
                        value={draft.email}
                        onChange={(event) => updateAdminDraft(item.id, 'email', event.target.value)}
                      />
                    </Field>

                    <Field label="Role">
                      <select
                        className={INPUT_CLASS}
                        value={draft.role}
                        onChange={(event) => updateAdminDraft(item.id, 'role', event.target.value)}
                      >
                        {ADMIN_ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {humanizeValue(role)}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="New password">
                      <input
                        className={INPUT_CLASS}
                        type="password"
                        value={draft.newPassword}
                        onChange={(event) => updateAdminDraft(item.id, 'newPassword', event.target.value)}
                      />
                    </Field>

                    <div className="lg:col-span-2">
                      <ToggleField
                        checked={draft.isActive}
                        copy="Account is active"
                        hint="Inactive admins cannot use the separate admin session."
                        onChange={(event) => updateAdminDraft(item.id, 'isActive', event.target.checked)}
                      />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState copy="No admin accounts matched the current search." icon="bi-shield-lock" title="No admins found" />
        )}
      </Panel>
    </div>
  )

  const renderInbox = () => (
    <Panel
      actions={<StatusPill tone="slate">{filteredContacts.length} message(s)</StatusPill>}
      description="Customer inquiries arranged in a cleaner inbox list without the newsletter block."
      icon="bi-chat-left-text"
      title="Contact messages"
    >
      {filteredContacts.length > 0 ? (
        <div className="overflow-hidden rounded-[26px] border border-[#eadcf7] bg-[#fcfaff]">
          <div className="hidden grid-cols-[60px_180px_minmax(0,0.9fr)_170px_minmax(0,1.3fr)] gap-3 border-b border-[#eadcf7] bg-[#f7f1fe] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7d668d] xl:grid">
            <span>No.</span>
            <span>From</span>
            <span>Subject</span>
            <span>Received</span>
            <span>Message</span>
          </div>
          {filteredContacts.map((contact, index) => (
            <article key={contact.id} className="grid gap-4 border-t border-[#f0e7f7] px-4 py-4 first:border-t-0 xl:grid-cols-[60px_180px_minmax(0,0.9fr)_170px_minmax(0,1.3fr)] xl:items-start">
              <span className="text-sm font-semibold text-[#5b1793]">{index + 1}.</span>
              <div className="min-w-0">
                <strong className="block truncate text-sm font-semibold text-[#271535]">{contact.email}</strong>
                <p className="mt-1 truncate text-sm text-slate-500">{contact.fullName}</p>
              </div>
              <strong className="min-w-0 truncate text-sm font-semibold text-[#271535]">{contact.subject}</strong>
              <span className="text-sm text-slate-500">{formatDate(contact.createdAt)}</span>
              <p className="text-sm leading-6 text-slate-500">{contact.message}</p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState copy="There are no contact messages matching the current query." icon="bi-chat-left-text" title="No messages found" />
      )}
    </Panel>
  )

  const renderSettings = () => (
    <form className="space-y-6" onSubmit={saveSettings}>
      <Panel
        description="Store identity that feeds the public storefront and support channels."
        icon="bi-buildings"
        title="Brand and contact"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Store name">
            <input
              className={INPUT_CLASS}
              value={settingsForm.brand.storeName}
              onChange={(event) => updateSettingsField('brand', 'storeName', event.target.value)}
            />
          </Field>

          <Field label="Support email">
            <input
              className={INPUT_CLASS}
              value={settingsForm.brand.supportEmail}
              onChange={(event) => updateSettingsField('brand', 'supportEmail', event.target.value)}
            />
          </Field>

          <Field label="Support phone">
            <input
              className={INPUT_CLASS}
              value={settingsForm.brand.supportPhone}
              onChange={(event) => updateSettingsField('brand', 'supportPhone', event.target.value)}
            />
          </Field>

          <Field label="WhatsApp number">
            <input
              className={INPUT_CLASS}
              value={settingsForm.brand.whatsappNumber}
              onChange={(event) => updateSettingsField('brand', 'whatsappNumber', event.target.value)}
            />
          </Field>
        </div>
      </Panel>

      <Panel
        description="Homepage text rotation controlled from the admin side."
        icon="bi-stars"
        title="Storefront headlines"
      >
        <div className="grid gap-4">
          {settingsForm.storefront.heroHeadlines.map((headline, index) => (
            <Field key={index} label={`Headline ${index + 1}`}>
              <input
                className={INPUT_CLASS}
                value={headline}
                onChange={(event) => {
                  const next = [...settingsForm.storefront.heroHeadlines]
                  next[index] = event.target.value
                  updateSettingsField('storefront', 'heroHeadlines', next)
                }}
              />
            </Field>
          ))}
        </div>
      </Panel>

      <Panel
        description="Live checkout configuration and bank transfer details."
        icon="bi-credit-card-2-front"
        title="Payments"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Currency">
            <input
              className={INPUT_CLASS}
              value={settingsForm.payments.currency}
              onChange={(event) => updateSettingsField('payments', 'currency', event.target.value)}
            />
          </Field>

          <Field label="Locale">
            <input
              className={INPUT_CLASS}
              value={settingsForm.payments.locale}
              onChange={(event) => updateSettingsField('payments', 'locale', event.target.value)}
            />
          </Field>

          <Field label="Paystack public key">
            <input
              className={INPUT_CLASS}
              value={settingsForm.payments.paystackPublicKey}
              onChange={(event) => updateSettingsField('payments', 'paystackPublicKey', event.target.value)}
            />
          </Field>

          <Field label="Paystack secret key">
            <input
              className={INPUT_CLASS}
              value={settingsForm.payments.paystackSecretKey}
              onChange={(event) => updateSettingsField('payments', 'paystackSecretKey', event.target.value)}
            />
          </Field>

          <Field label="Bank name">
            <input
              className={INPUT_CLASS}
              value={settingsForm.payments.bankName}
              onChange={(event) => updateSettingsField('payments', 'bankName', event.target.value)}
            />
          </Field>

          <Field label="Account name">
            <input
              className={INPUT_CLASS}
              value={settingsForm.payments.bankAccountName}
              onChange={(event) => updateSettingsField('payments', 'bankAccountName', event.target.value)}
            />
          </Field>

          <Field label="Account number">
            <input
              className={INPUT_CLASS}
              value={settingsForm.payments.bankAccountNumber}
              onChange={(event) => updateSettingsField('payments', 'bankAccountNumber', event.target.value)}
            />
          </Field>

          <ToggleField
            checked={settingsForm.payments.bankTransferEnabled}
            copy="Enable bank transfer"
            hint="Customers will see manual transfer instructions during checkout."
            onChange={(event) => updateSettingsField('payments', 'bankTransferEnabled', event.target.checked)}
          />

          <Field className="lg:col-span-2" label="Bank transfer instructions">
            <textarea
              className={TEXTAREA_CLASS}
              rows="4"
              value={settingsForm.payments.bankInstructions}
              onChange={(event) => updateSettingsField('payments', 'bankInstructions', event.target.value)}
            />
          </Field>
        </div>
      </Panel>

      <Panel
        description="Verification, order, and admin notification mail settings."
        icon="bi-envelope-at"
        title="Email delivery"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="App base URL">
            <input
              className={INPUT_CLASS}
              value={settingsForm.email.appBaseUrl}
              onChange={(event) => updateSettingsField('email', 'appBaseUrl', event.target.value)}
            />
          </Field>

          <Field label="SMTP from">
            <input
              className={INPUT_CLASS}
              value={settingsForm.email.smtpFromEmail}
              onChange={(event) => updateSettingsField('email', 'smtpFromEmail', event.target.value)}
            />
          </Field>

          <Field label="SMTP host">
            <input
              className={INPUT_CLASS}
              value={settingsForm.email.smtpHost}
              onChange={(event) => updateSettingsField('email', 'smtpHost', event.target.value)}
            />
          </Field>

          <Field label="SMTP port">
            <input
              className={INPUT_CLASS}
              value={settingsForm.email.smtpPort}
              onChange={(event) => updateSettingsField('email', 'smtpPort', event.target.value)}
            />
          </Field>

          <Field label="SMTP user">
            <input
              className={INPUT_CLASS}
              value={settingsForm.email.smtpUser}
              onChange={(event) => updateSettingsField('email', 'smtpUser', event.target.value)}
            />
          </Field>

          <Field label="SMTP password">
            <input
              className={INPUT_CLASS}
              value={settingsForm.email.smtpPass}
              onChange={(event) => updateSettingsField('email', 'smtpPass', event.target.value)}
            />
          </Field>

          <Field label="Support inbox">
            <input
              className={INPUT_CLASS}
              value={settingsForm.email.supportEmail}
              onChange={(event) => updateSettingsField('email', 'supportEmail', event.target.value)}
            />
          </Field>

          <ToggleField
            checked={settingsForm.email.smtpSecure}
            copy="Use secure SMTP"
            hint="Enable this if your SMTP provider requires a secure connection."
            onChange={(event) => updateSettingsField('email', 'smtpSecure', event.target.checked)}
          />
        </div>
      </Panel>

      <div className="rounded-[28px] border border-white/70 bg-white/92 p-5 shadow-[0_22px_60px_rgba(94,49,133,0.1)] backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7d668d]">
              Finalize changes
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Save your edits to sync the storefront, payment config, and mail settings.
            </p>
          </div>
          <button className={PRIMARY_BUTTON_CLASS} disabled={submitting} type="submit">
            <i aria-hidden="true" className="bi bi-check2-circle" />
            <span>Save settings</span>
          </button>
        </div>
      </div>
    </form>
  )

  if (loading) {
    return <AdminLoader label="Loading admin dashboard..." />
  }

  return (
    <main className="min-h-screen bg-[#f6f3fb] text-slate-900">
      <div className="mx-auto flex max-w-[1700px] gap-4 px-4 py-4 sm:px-6 lg:gap-6 lg:px-8">
        {menuOpen ? (
          <button
            className="fixed inset-0 z-30 bg-[#19061f]/55 backdrop-blur-sm lg:hidden"
            type="button"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          />
        ) : null}

        <aside
          className={`fixed inset-y-4 left-4 z-40 flex w-[292px] flex-col overflow-hidden rounded-[34px] bg-[#250c34] text-white shadow-[0_34px_120px_rgba(50,13,74,0.42)] transition duration-300 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:translate-x-0 ${
            menuOpen ? 'translate-x-0' : '-translate-x-[120%]'
          }`}
        >
          <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,_rgba(196,149,255,0.28),_transparent_72%)]" />
          <div className="relative flex h-full flex-col">
            <div className="border-b border-white/10 px-6 py-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#d8b7ff]">
                    Operations desk
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight">Luxury control</h2>
                </div>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-xl text-white">
                  <i aria-hidden="true" className="bi bi-stars" />
                </span>
              </div>

              <div className="mt-6 rounded-[26px] border border-white/10 bg-white/8 p-4 backdrop-blur">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/12 text-lg font-semibold">
                    {(admin?.fullName || 'A').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{admin?.fullName}</p>
                    <p className="truncate text-sm text-white/60">{admin?.email}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <StatusPill>{humanizeValue(admin?.role || 'owner')}</StatusPill>
                  <StatusPill tone="slate">Separate admin session</StatusPill>
                </div>
              </div>
            </div>

            <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-5">
              {visibleSections.map((item) => {
                const active = section === item.value

                return (
                  <button
                    key={item.value}
                    className={`group flex w-full items-center gap-3 rounded-[22px] px-4 py-3 text-left text-sm font-semibold transition ${
                      active
                        ? 'bg-white text-[#2b1538] shadow-[0_18px_40px_rgba(31,9,46,0.18)]'
                        : 'text-white/70 hover:bg-white/8 hover:text-white'
                    }`}
                    type="button"
                    onClick={() => setSectionValue(item.value)}
                  >
                    <span
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-lg transition ${
                        active ? 'bg-[#f3ebff] text-[#5b1793]' : 'bg-white/8 text-white'
                      }`}
                    >
                      <i aria-hidden="true" className={`bi ${item.icon}`} />
                    </span>
                    <div className="min-w-0">
                      <span className="block truncate">{item.label}</span>
                      <span className={`block text-xs font-normal ${active ? 'text-slate-500' : 'text-white/45'}`}>
                        {SECTION_COPY[item.value]?.eyebrow || 'Admin area'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </nav>

            <div className="border-t border-white/10 px-4 py-4">
              <button
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/10 text-sm font-semibold text-white transition hover:bg-white/15"
                type="button"
                onClick={signOut}
              >
                <i aria-hidden="true" className="bi bi-box-arrow-right" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="space-y-6">
            <header className="sticky top-4 z-20 rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-[0_26px_80px_rgba(94,49,133,0.1)] backdrop-blur sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <button
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#eadcf7] bg-[#fbf8ff] text-lg text-[#5b1793] shadow-[0_12px_30px_rgba(114,73,151,0.08)] lg:hidden"
                    type="button"
                    aria-label="Toggle admin navigation"
                    onClick={() => setMenuOpen((current) => !current)}
                  >
                    <i aria-hidden="true" className={`bi ${menuOpen ? 'bi-x-lg' : 'bi-list'}`} />
                  </button>

                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#7d668d]">
                      Admin workspace
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#281535] sm:text-3xl">
                      {activeSectionLabel}
                    </h1>
                    <p className="mt-2 text-sm text-slate-500">
                      Last admin sign-in {formatDate(admin?.lastLoginAt)}.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {section !== 'settings' ? (
                    <label className="flex h-12 min-w-0 items-center gap-3 rounded-2xl border border-[#eadcf7] bg-[#fbf8ff] px-4 text-sm text-slate-500 shadow-[0_12px_30px_rgba(114,73,151,0.08)] sm:min-w-[280px]">
                      <i aria-hidden="true" className="bi bi-search text-[#7c3aed]" />
                      <input
                        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
                        placeholder={`Search ${activeSectionLabel.toLowerCase()}...`}
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </label>
                  ) : null}
                  <StatusPill tone="slate">{humanizeValue(admin?.role || 'owner')}</StatusPill>
                </div>
              </div>
            </header>

            <SectionIntro
              description={activeCopy.description}
              eyebrow={activeCopy.eyebrow}
              title={activeCopy.title}
              extra={
                <>
                  <StatusPill tone="slate">{dashboard?.ordersCount || 0} orders</StatusPill>
                  <StatusPill tone="slate">{dashboard?.usersCount || 0} customers</StatusPill>
                  <StatusPill tone="slate">{dashboard?.pendingReviewsCount || 0} reviews pending</StatusPill>
                </>
              }
            />

            {message ? (
              <div
                aria-live={messageTone === 'warning' ? 'assertive' : 'polite'}
                className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-[24px] border px-5 py-4 text-sm shadow-[0_18px_44px_rgba(64,24,97,0.18)] ${
                  messageTone === 'warning'
                    ? 'border-[#f3d8b7] bg-[#fff7ed] text-[#8d6112]'
                    : 'border-[#d8eddc] bg-[#f1fbf3] text-[#1f6b38]'
                }`}
                role={messageTone === 'warning' ? 'alert' : 'status'}
              >
                <i
                  aria-hidden="true"
                  className={`mt-0.5 text-base bi ${
                    messageTone === 'warning' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'
                  }`}
                />
                <span>{message}</span>
              </div>
            ) : null}

            {section === 'overview' ? renderOverview() : null}
            {section === 'products' ? renderProducts() : null}
            {section === 'orders' ? renderOrders() : null}
            {section === 'users' ? renderUsers() : null}
            {section === 'team' ? renderTeam() : null}
            {section === 'inbox' ? renderInbox() : null}
            {section === 'settings' ? renderSettings() : null}
          </div>
        </section>
      </div>
    </main>
  )
}

















