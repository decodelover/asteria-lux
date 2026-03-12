import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { CartPanel } from '../components/CartPanel'
import { CheckoutModal } from '../components/CheckoutModal'
import { ProductCard } from '../components/ProductCard'
import { useAuth } from '../hooks/useAuth'
import { useStore } from '../hooks/useStore'
import { api } from '../lib/api'
import { formatCurrency, formatNumber } from '../utils/format'

const CATEGORY_META = {
  All: { icon: 'bi-grid-3x3-gap', label: 'All Pieces' },
  Bangles: { icon: 'bi-record-circle', label: 'Bangles' },
  Eyewear: { icon: 'bi-eyeglasses', label: 'Eyewear' },
  Jewelry: { icon: 'bi-gem', label: 'Jewelry' },
  Rings: { icon: 'bi-bullseye', label: 'Rings' },
  Watches: { icon: 'bi-watch', label: 'Watches' },
}

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured first' },
  { value: 'newest', label: 'Newest arrivals' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name', label: 'Alphabetical' },
]

const serviceCards = [
  'Reserved pieces stay in a persistent personal cart for this browser session.',
  'Signed-in clients keep orders tied to their account history.',
  'Order communication stays connected to the checkout flow.',
]

export function ShopPage() {
  const { token, user } = useAuth()
  const {
    addToCart,
    amountToFreeShipping,
    busyKey,
    cart,
    cartLoading,
    changeQuantity,
    checkout,
    clearCart,
    sessionId,
  } = useStore()

  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [sortOrder, setSortOrder] = useState('featured')
  const [message, setMessage] = useState(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [confirmedOrder, setConfirmedOrder] = useState(null)
  const [orderMailDelivered, setOrderMailDelivered] = useState(true)
  const [orderMailPreviewUrl, setOrderMailPreviewUrl] = useState('')
  const [checkoutForm, setCheckoutForm] = useState({
    address: '',
    city: '',
    country: '',
    email: user?.email || '',
    name: user?.fullName || '',
    phone: '',
  })
  const deferredSearch = useDeferredValue(searchInput)

  useEffect(() => {
    setCheckoutForm((current) => ({
      ...current,
      email: current.email || user?.email || '',
      name: current.name || user?.fullName || '',
    }))
  }, [user])

  useEffect(() => {
    let ignore = false

    const loadCategories = async () => {
      const response = await api.getCategories()

      if (!ignore) {
        setCategories(response.categories)
      }
    }

    loadCategories().catch((error) => {
      if (!ignore) {
        setMessage({
          text: error.message || 'Unable to load categories.',
          type: 'error',
        })
      }
    })

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    let ignore = false

    const loadProducts = async () => {
      setCatalogLoading(true)

      try {
        const response = await api.getProducts({
          category: selectedCategory,
          search: deferredSearch,
          sort: sortOrder,
        })

        if (!ignore) {
          setProducts(response.products)
        }
      } catch (error) {
        if (!ignore) {
          setMessage({
            text: error.message || 'Failed to load products.',
            type: 'error',
          })
        }
      } finally {
        if (!ignore) {
          setCatalogLoading(false)
        }
      }
    }

    loadProducts()

    return () => {
      ignore = true
    }
  }, [deferredSearch, selectedCategory, sortOrder])

  const refreshProducts = async () => {
    const response = await api.getProducts({
      category: selectedCategory,
      search: deferredSearch,
      sort: sortOrder,
    })
    setProducts(response.products)
  }

  const handleSearchChange = (event) => {
    startTransition(() => {
      setSearchInput(event.target.value)
    })
  }

  const handleCategoryChange = (nextCategory) => {
    startTransition(() => {
      setSelectedCategory(nextCategory)
    })
  }

  const handleSortChange = (event) => {
    startTransition(() => {
      setSortOrder(event.target.value)
    })
  }

  const handleAddToCart = async (productId) => {
    setMessage(null)

    try {
      await addToCart(productId)
      setMessage({
        text: 'Item added to your private cart.',
        type: 'success',
      })
    } catch (error) {
      setMessage({
        text: error.message || 'Unable to update your cart.',
        type: 'error',
      })
    }
  }

  const handleQuantityChange = async (productId, nextQuantity) => {
    setMessage(null)

    try {
      await changeQuantity(productId, nextQuantity)
    } catch (error) {
      setMessage({
        text: error.message || 'Unable to update your cart.',
        type: 'error',
      })
    }
  }

  const handleClearCart = async () => {
    setMessage(null)

    try {
      await clearCart()
    } catch (error) {
      setMessage({
        text: error.message || 'Unable to clear your cart.',
        type: 'error',
      })
    }
  }

  const handleCheckoutFieldChange = (event) => {
    const { name, value } = event.target

    setCheckoutForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleCheckoutSubmit = async (event) => {
    event.preventDefault()
    setCheckoutSubmitting(true)
    setCheckoutError('')
    setMessage(null)

    try {
      const response = await checkout({
        customer: checkoutForm,
        notes: '',
        token,
      })
      setConfirmedOrder(response.order)
      setOrderMailDelivered(response.mailDelivered !== false)
      setOrderMailPreviewUrl(response.mailPreviewUrl || '')
      setCheckoutForm((current) => ({
        ...current,
        address: '',
        city: '',
        country: '',
        phone: '',
      }))
      setMessage({
        text: response.message || `Order ${response.order.orderNumber} has been confirmed.`,
        type: response.mailDelivered === false ? 'warning' : 'success',
      })
      await refreshProducts()
    } catch (error) {
      setCheckoutError(error.message || 'Checkout failed.')
    } finally {
      setCheckoutSubmitting(false)
    }
  }

  const totalCatalogItems = useMemo(
    () => categories.reduce((total, category) => total + category.count, 0),
    [categories],
  )

  const categoryOptions = useMemo(
    () => [{ count: totalCatalogItems, name: 'All' }, ...categories],
    [categories, totalCatalogItems],
  )

  return (
    <>
      <main className="page-shell flex flex-col gap-6">
        <section className="panel-dark relative overflow-hidden rounded-[36px] px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[40%] bg-[radial-gradient(circle_at_top,rgba(184,137,75,0.22),transparent_58%)] lg:block" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_360px] lg:items-end">
            <div className="space-y-6">
              <div className="inline-tag border-white/10 bg-white/8 text-[#e2c392]">
                <i className="bi bi-gem" aria-hidden="true" />
                Live storefront
              </div>

              <div className="space-y-4">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#caab7c]">
                  Discover signature pieces with a cleaner retail experience
                </p>
                <h1 className="font-display text-6xl leading-none text-white sm:text-7xl">
                  Shop the working catalog.
                </h1>
                <p className="max-w-3xl text-base leading-8 text-[#d8cfc2] sm:text-lg">
                  Explore the collection, refine by category, and move from interest to
                  checkout in a storefront built to feel more composed and premium than the
                  usual catalog grid.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="metric-card">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#caab7c]">
                    Catalog count
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-[#fff6ea]">
                    {formatNumber(totalCatalogItems || products.length)}
                  </p>
                </div>
                <div className="metric-card">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#caab7c]">
                    Active cart
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-[#fff6ea]">
                    {formatNumber(cart.summary.itemCount)}
                  </p>
                </div>
                <div className="metric-card">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#caab7c]">
                    Session
                  </p>
                  <p className="mt-3 text-lg font-semibold text-[#fff6ea]">
                    {(sessionId || 'pending').slice(0, 12)}
                  </p>
                </div>
              </div>
            </div>

            <div className="panel rounded-[32px] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8d6b41]">
                Current order status
              </p>
              <h2 className="mt-3 font-display text-5xl leading-none text-[#201713]">
                {confirmedOrder ? confirmedOrder.orderNumber : 'Ready to check out'}
              </h2>
                    <p className="mt-4 text-sm leading-7 text-[#5d5147]">
                      {confirmedOrder
                        ? `Order captured for ${formatCurrency(confirmedOrder.total)}.`
                        : user
                          ? `Signed in as ${user.email}. Orders placed here will be attached to your account page.`
                    : 'Guests can still order, but signing in keeps your purchase history and client details together.'}
                    </p>

              <div className="mt-6 grid gap-3">
                {serviceCards.map((item) => (
                  <div
                    key={item}
                    className="rounded-[22px] border border-[#eadbc9] bg-white px-4 py-4 text-sm leading-6 text-[#5d5147]"
                  >
                    {item}
                  </div>
                ))}
              </div>

              {orderMailPreviewUrl && (
                <a
                  className={`mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
                    orderMailDelivered
                      ? 'bg-[#eef7f0] text-[#2d7445]'
                      : 'bg-[#fff6e6] text-[#7c5d2d]'
                  }`}
                  href={orderMailPreviewUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
                  Open order email preview
                </a>
              )}
            </div>
          </div>
        </section>

        {message && (
          <section
            className={`rounded-[24px] border px-5 py-4 text-sm font-medium shadow-[0_18px_40px_rgba(36,21,12,0.08)] ${
              message.type === 'error'
                ? 'border-[#f0c1bc] bg-[#fff5f3] text-[#9f3226]'
                : message.type === 'warning'
                  ? 'border-[#e3cfa8] bg-[#fff8eb] text-[#7a5a29]'
                  : 'border-[#cfe8d4] bg-[#f4fbf5] text-[#25663c]'
            }`}
          >
            {message.text}
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-6">
            <section className="panel rounded-[34px] px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8d6b41]">
                      Curated inventory
                    </p>
                    <h2 className="mt-2 font-display text-4xl text-[#1f1814]">
                      Shop the live catalog
                    </h2>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                    <label className="field-shell">
                      <span className="field-label">Search pieces</span>
                      <div className="field-input-shell">
                        <i className="bi bi-search text-[#8f714d]" aria-hidden="true" />
                        <input
                          className="field-input"
                          placeholder="Search by name or description"
                          type="search"
                          value={searchInput}
                          onChange={handleSearchChange}
                        />
                      </div>
                    </label>

                    <label className="field-shell">
                      <span className="field-label">Sort by</span>
                      <div className="field-input-shell">
                        <i className="bi bi-sliders text-[#8f714d]" aria-hidden="true" />
                        <select className="field-input" value={sortOrder} onChange={handleSortChange}>
                          {SORT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {categoryOptions.map((category) => {
                    const meta = CATEGORY_META[category.name] || CATEGORY_META.All
                    const isActive = selectedCategory === category.name

                    return (
                      <button
                        key={category.name}
                        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                          isActive
                            ? 'border-[#201714] bg-[#201714] text-white'
                            : 'border-[#dfd2c0] bg-white/78 text-[#41342b] hover:border-[#c2a070] hover:text-[#8a6840]'
                        }`}
                        onClick={() => handleCategoryChange(category.name)}
                        type="button"
                      >
                        <i className={`bi ${meta.icon}`} aria-hidden="true" />
                        {meta.label}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[0.7rem] ${
                            isActive ? 'bg-white/15 text-white' : 'bg-[#f3ece3] text-[#8d6b41]'
                          }`}
                        >
                          {category.count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                  <div className="rounded-[28px] border border-[#eadcc7] bg-[linear-gradient(135deg,rgba(255,252,247,0.95),rgba(246,234,216,0.95))] px-5 py-5">
                    <p className="text-lg font-semibold text-[#211814]">
                      {amountToFreeShipping > 0
                        ? `Add ${formatCurrency(amountToFreeShipping)} more for complimentary insured delivery.`
                        : 'Complimentary insured delivery is unlocked on this cart.'}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-[#66584d]">
                      Orders above the threshold receive complimentary insured delivery for
                      a smoother checkout experience.
                    </p>
                  </div>

                  <div className="rounded-[28px] border border-[#eadcc7] bg-white px-5 py-5 shadow-[0_14px_34px_rgba(23,15,10,0.06)]">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#8d6b41]">
                      Account status
                    </p>
                    <p className="mt-3 text-sm leading-7 text-[#5d5147]">
                      {user
                        ? `Signed in as ${user.fullName}. Orders placed here will show in your account history.`
                        : 'Ordering as a guest is available, but sign-in gives you account-linked order history.'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {catalogLoading ? (
              <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <article
                    key={`shop-skeleton-${index}`}
                    className="animate-pulse rounded-[30px] border border-white/10 bg-white/6 p-4 shadow-[0_18px_50px_rgba(7,5,4,0.18)]"
                  >
                    <div className="aspect-[4/5] rounded-[24px] bg-white/8" />
                    <div className="mt-4 h-4 w-24 rounded-full bg-white/10" />
                    <div className="mt-3 h-8 rounded-full bg-white/8" />
                    <div className="mt-3 h-20 rounded-[18px] bg-white/8" />
                    <div className="mt-4 h-11 rounded-full bg-white/8" />
                  </article>
                ))}
              </section>
            ) : products.length > 0 ? (
              <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    busy={busyKey === product.id}
                    categoryIcon={(CATEGORY_META[product.category] || CATEGORY_META.All).icon}
                    product={product}
                    onAddToCart={() => handleAddToCart(product.id)}
                  />
                ))}
              </section>
            ) : (
              <section className="panel rounded-[32px] px-6 py-12 text-center">
                <h3 className="font-display text-4xl text-[#1f1713]">No pieces match those filters</h3>
                <p className="mt-3 text-sm leading-7 text-[#5d5147]">
                  Change the category or search term and the collection will refresh with a
                  new selection.
                </p>
              </section>
            )}
          </div>

          <CartPanel
            amountToFreeShipping={amountToFreeShipping}
            busyKey={busyKey}
            cart={cart}
            loading={cartLoading}
            onClearCart={handleClearCart}
            onOpenCheckout={() => setCheckoutOpen(true)}
            onQuantityChange={handleQuantityChange}
          />
        </section>
      </main>

      <CheckoutModal
        error={checkoutError}
        formValues={checkoutForm}
        isOpen={checkoutOpen}
        isSubmitting={checkoutSubmitting}
        itemsCount={cart.summary.itemCount}
        onChange={handleCheckoutFieldChange}
        onClose={() => {
          setCheckoutOpen(false)
          setCheckoutError('')
          if (confirmedOrder) {
            setConfirmedOrder(null)
          }
        }}
        onSubmit={handleCheckoutSubmit}
        order={confirmedOrder}
        orderTotal={confirmedOrder ? confirmedOrder.total : cart.summary.total}
      />
    </>
  )
}
