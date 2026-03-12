import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency, formatShortDate } from '../utils/format'

export function AccountPage() {
  const { loading, orders, resendVerification, signOut, user } = useAuth()
  const [message, setMessage] = useState('')
  const [mailDelivered, setMailDelivered] = useState(true)
  const [previewUrl, setPreviewUrl] = useState('')

  if (loading) {
    return (
      <main className="page-shell">
        <section className="panel px-6 py-10 text-[#5d5147]">Loading account...</section>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="page-shell">
        <section className="panel-dark rounded-[36px] px-6 py-10 text-center sm:px-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/8 text-[#d4b37c]">
            <i className="bi bi-person-lock text-2xl" aria-hidden="true" />
          </div>
          <h1 className="mt-5 font-display text-5xl text-white">No active account session</h1>
          <p className="mt-3 text-sm leading-7 text-[#d8cfc2]">
            Sign in first to view customer details, verification state, and order history.
          </p>
          <Link className="button-primary mt-6" to="/auth">
            Go to sign in
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="page-shell flex flex-col gap-6">
      <section className="panel-dark overflow-hidden rounded-[36px] px-6 py-8 sm:px-8 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="space-y-5">
            <div className="inline-tag border-white/10 bg-white/8 text-[#e2c392]">
              <i className="bi bi-person-check" aria-hidden="true" />
              Customer account
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#caab7c]">
                Account overview
              </p>
              <h1 className="font-display text-6xl leading-none text-white sm:text-7xl">
                {user.fullName}
              </h1>
              <p className="text-base leading-8 text-[#d8cfc2] sm:text-lg">{user.email}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="metric-card">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#caab7c]">
                  Email status
                </p>
                <p className="mt-3 text-sm font-semibold text-[#fff6ea]">
                  {user.emailVerified ? 'Verified' : 'Pending verification'}
                </p>
              </div>
              <div className="metric-card">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#caab7c]">
                  Orders
                </p>
                <p className="mt-3 text-sm font-semibold text-[#fff6ea]">{orders.length}</p>
              </div>
              <div className="metric-card">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#caab7c]">
                  Joined
                </p>
                <p className="mt-3 text-sm font-semibold text-[#fff6ea]">
                  {formatShortDate(user.createdAt)}
                </p>
              </div>
            </div>
          </div>

          <aside className="panel rounded-[32px] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8d6b41]">
              Account actions
            </p>
            <div className="mt-5 grid gap-3">
              {!user.emailVerified && (
                <button
                  className="button-secondary w-full justify-center"
                  onClick={async () => {
                    try {
                      const response = await resendVerification()
                      setMessage(response.message)
                      setMailDelivered(response.mailDelivered !== false)
                      setPreviewUrl(response.verificationPreviewUrl || '')
                    } catch (error) {
                      setMessage(error.message || 'Unable to resend verification right now.')
                      setMailDelivered(false)
                      setPreviewUrl('')
                    }
                  }}
                  type="button"
                >
                  <i className="bi bi-envelope-arrow-up" aria-hidden="true" />
                  Resend verification
                </button>
              )}
              <Link className="button-primary w-full justify-center" to="/shop">
                <i className="bi bi-bag" aria-hidden="true" />
                Continue shopping
              </Link>
              <button
                className="rounded-full border border-[#dbcab5] bg-white px-5 py-3 text-sm font-semibold text-[#342922] transition hover:border-[#be9b69] hover:text-[#8d6b41]"
                onClick={signOut}
                type="button"
              >
                <i className="bi bi-box-arrow-right mr-2" aria-hidden="true" />
                Sign out
              </button>
            </div>
          </aside>
        </div>

        {message && (
          <div
            className={`mt-6 rounded-[24px] border px-5 py-4 text-sm leading-7 ${
              mailDelivered
                ? 'border-white/10 bg-white/6 text-[#ede1d0]'
                : 'border-[#82623c] bg-[rgba(58,41,28,0.72)] text-[#f6e3c4]'
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
                Open verification link
              </a>
            )}
          </div>
        )}
      </section>

      <section className="panel rounded-[36px] px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8d6b41]">
              Order history
            </p>
            <h2 className="mt-2 font-display text-5xl leading-none text-[#201713]">
              Your recent orders
            </h2>
          </div>
          <div className="rounded-full bg-[#f4eadb] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#8d6b41]">
            Private order archive
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-[#e2d4c1] bg-[#fcfaf6] px-5 py-8 text-sm leading-7 text-[#5d5147]">
            No orders have been linked to this account yet. Place an order from the shop
            page and it will appear here automatically.
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {orders.map((order) => (
              <article
                key={order.orderNumber}
                className="rounded-[28px] border border-[#e6d8c5] bg-[#fcfaf6] px-5 py-5 shadow-[0_16px_36px_rgba(24,16,10,0.05)]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#8d6b41]">
                      {order.orderNumber}
                    </p>
                    <h3 className="text-xl font-semibold text-[#201713]">
                      {order.itemCount} item(s) ordered on {formatShortDate(order.createdAt)}
                    </h3>
                    <p className="text-sm text-[#6a5b51]">
                      Shipping fee:{' '}
                      {order.shippingFee === 0 ? 'Complimentary' : formatCurrency(order.shippingFee)}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[260px]">
                    <div className="rounded-[20px] border border-[#eadbc9] bg-white px-4 py-4">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#8d6b41]">
                        Total
                      </p>
                      <p className="mt-2 text-lg font-semibold text-[#201713]">
                        {formatCurrency(order.total)}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-[#eadbc9] bg-white px-4 py-4">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#8d6b41]">
                        Customer
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[#201713]">{user.fullName}</p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
