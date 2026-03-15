import { formatCurrency, formatNumber, formatShortDate } from '../utils/format'

const ACTIVE_ORDER_STATUSES = new Set([
  'awaiting_payment_review',
  'confirmed',
  'processing',
  'shipped',
])

const ORDER_STATUS_META = {
  awaiting_payment_review: {
    label: 'Awaiting review',
    tone: 'warning',
  },
  cancelled: {
    label: 'Cancelled',
    tone: 'neutral',
  },
  confirmed: {
    label: 'Confirmed',
    tone: 'success',
  },
  delivered: {
    label: 'Delivered',
    tone: 'success',
  },
  processing: {
    label: 'Processing',
    tone: 'info',
  },
  shipped: {
    label: 'Shipped',
    tone: 'info',
  },
}

const PAYMENT_STATUS_META = {
  failed: {
    label: 'Failed',
    tone: 'neutral',
  },
  paid: {
    label: 'Paid',
    tone: 'success',
  },
  pending: {
    label: 'Pending',
    tone: 'warning',
  },
  proof_submitted: {
    label: 'Proof submitted',
    tone: 'warning',
  },
}

const getMeta = (metaMap, value, fallbackLabel) =>
  metaMap[String(value || '').trim().toLowerCase()] || {
    label: fallbackLabel,
    tone: 'neutral',
  }

const getRecentItems = (orders) =>
  orders
    .flatMap((order) =>
      (order.items || []).map((item) => ({
        ...item,
        createdAt: order.createdAt,
        orderNumber: order.orderNumber,
        orderStatus: order.status,
      })),
    )
    .slice(0, 6)

function StatusPill({ fallbackLabel, value, variant }) {
  const meta = getMeta(
    variant === 'payment' ? PAYMENT_STATUS_META : ORDER_STATUS_META,
    value,
    fallbackLabel,
  )

  return <span className={`go-status-pill ${meta.tone}`}>{meta.label}</span>
}

function DashboardStat({ icon, label, value }) {
  return (
    <article className="go-dashboard-stat">
      <div className="go-dashboard-stat__icon">
        <i aria-hidden="true" className={`bi ${icon}`} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  )
}

export function AccountDashboard({
  dashboard,
  emailVerificationEnabled = true,
  message,
  messageTone,
  onFieldChange,
  onResendVerification,
  onSettingsSubmit,
  orders,
  previewUrl,
  settingsForm,
  settingsMessage,
  settingsSubmitting,
  settingsTone,
  signOut,
  user,
}) {
  const activeOrders = orders.filter((order) =>
    ACTIVE_ORDER_STATUSES.has(String(order.status || '').trim().toLowerCase()),
  )
  const recentItems = getRecentItems(orders)
  const totalSpend = dashboard?.totalAmountSpent ?? 0

  return (
    <section className="go-tab-panel go-reveal" data-reveal data-reveal-delay="40">
      <div className="go-section-head">
        <h2>My dashboard</h2>
        <button className="go-text-link" onClick={signOut} type="button">
          Sign out
        </button>
      </div>

      <div className="go-dashboard-hero">
        <div className="go-profile-card go-profile-card--dashboard">
          <div className="go-profile-avatar">{user.fullName.slice(0, 1).toUpperCase()}</div>
          <div className="go-profile-copy">
            <div className="go-dashboard-badges">
              <span className="go-dashboard-chip">Client profile</span>
              <span
                className={`go-status-pill ${
                  emailVerificationEnabled
                    ? user.emailVerified
                      ? 'success'
                      : 'warning'
                    : 'success'
                }`}
              >
                {emailVerificationEnabled
                  ? user.emailVerified
                    ? 'Verified'
                    : 'Verification pending'
                  : 'Account active'}
              </span>
            </div>
            <p className="go-profile-name">{user.fullName}</p>
            <p className="go-profile-email">{user.email}</p>
            <p className="go-dashboard-meta">
              Joined {formatShortDate(user.createdAt)}
              {user.lastLoginAt ? ` • Last sign-in ${formatShortDate(user.lastLoginAt)}` : ''}
            </p>
          </div>
        </div>

        <div className="go-dashboard-summary">
          <DashboardStat
            icon="bi-bag-check"
            label="Products ordered"
            value={formatNumber(dashboard?.productsOrdered || 0)}
          />
          <DashboardStat
            icon="bi-wallet2"
            label="Total amount spent"
            value={formatCurrency(totalSpend)}
          />
          <DashboardStat
            icon="bi-truck"
            label="Products tracking"
            value={formatNumber(dashboard?.activeTrackingCount || 0)}
          />
          <DashboardStat
            icon="bi-box-seam"
            label="Delivered orders"
            value={formatNumber(dashboard?.deliveredOrders || 0)}
          />
        </div>
      </div>

      {emailVerificationEnabled && !user.emailVerified && (
        <button className="go-secondary-btn" onClick={onResendVerification} type="button">
          Resend verification
        </button>
      )}

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

      {settingsMessage && (
        <div className={`go-inline-message ${settingsTone}`}>
          <p>{settingsMessage}</p>
        </div>
      )}

      <div className="go-dashboard-grid">
        <section className="go-dashboard-panel">
          <div className="go-panel-head">
            <div>
              <h3>Products tracking</h3>
              <p>Track orders currently moving through payment review, processing, and shipping.</p>
            </div>
            <span>{formatNumber(activeOrders.length)} active</span>
          </div>

          {activeOrders.length === 0 ? (
            <div className="go-empty-state go-empty-state--compact">
              <i aria-hidden="true" className="bi bi-truck" />
              <p>No active deliveries at the moment.</p>
            </div>
          ) : (
            <div className="go-tracking-list">
              {activeOrders.map((order) => (
                <article key={order.orderNumber} className="go-tracking-card">
                  <div className="go-tracking-card__head">
                    <div>
                      <p className="go-order-number">{order.orderNumber}</p>
                      <h3>{order.quantityCount || order.itemCount} item(s)</h3>
                    </div>
                    <StatusPill
                      fallbackLabel="In progress"
                      value={order.status}
                      variant="order"
                    />
                  </div>

                  <div className="go-tracking-card__meta">
                    <span>{formatShortDate(order.createdAt)}</span>
                    <span>{order.paymentMethod === 'paystack' ? 'Paystack' : 'Bank transfer'}</span>
                    <StatusPill
                      fallbackLabel="Pending"
                      value={order.paymentStatus}
                      variant="payment"
                    />
                  </div>

                  <div className="go-item-chip-row">
                    {(order.items || []).slice(0, 3).map((item) => (
                      <span key={`${order.orderNumber}-${item.productId}-${item.name}`} className="go-item-chip">
                        {item.name}
                      </span>
                    ))}
                  </div>

                  {(order.trackingCarrier || order.trackingNumber || order.trackingEvents?.[0]) && (
                    <p className="go-dashboard-meta">
                      {order.trackingCarrier ? `${order.trackingCarrier}` : 'Tracking update'}
                      {order.trackingNumber ? ` | ${order.trackingNumber}` : ''}
                      {order.trackingEvents?.[0]?.message ? ` | ${order.trackingEvents[0].message}` : ''}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="go-dashboard-panel">
          <div className="go-panel-head">
            <div>
              <h3>Products ordered</h3>
              <p>Recent pieces linked to your account and ready for quick follow-up.</p>
            </div>
            <span>{formatNumber(dashboard?.productsOrdered || 0)} items</span>
          </div>

          {recentItems.length === 0 ? (
            <div className="go-empty-state go-empty-state--compact">
              <i aria-hidden="true" className="bi bi-bag-heart" />
              <p>Your first completed order will appear here.</p>
            </div>
          ) : (
            <div className="go-ordered-items">
              {recentItems.map((item, index) => (
                <article
                  key={`${item.orderNumber}-${item.productId}-${index}`}
                  className="go-ordered-item-card"
                >
                  <img alt={item.name} src={item.imageUrl} />
                  <div>
                    <p className="go-product-category">{item.orderNumber}</p>
                    <h3>{item.name}</h3>
                    <p className="go-dashboard-meta">
                      {item.quantity} x {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="go-dashboard-panel go-dashboard-panel--settings">
          <div className="go-panel-head">
            <div>
              <h3>Settings</h3>
              <p>Keep your checkout profile updated so orders and future admin actions stay in sync.</p>
            </div>
            <span>Editable</span>
          </div>

          <form className="go-settings-form" onSubmit={onSettingsSubmit}>
            <div className="go-settings-grid">
              <label className="go-field">
                <span>Full name</span>
                <input
                  name="fullName"
                  placeholder="Ada Obi"
                  required
                  type="text"
                  value={settingsForm.fullName}
                  onChange={onFieldChange}
                />
              </label>

              <label className="go-field">
                <span>Email</span>
                <input disabled type="email" value={user.email} />
              </label>

              <label className="go-field">
                <span>Phone number</span>
                <input
                  name="phoneNumber"
                  placeholder="0800 000 0000"
                  type="tel"
                  value={settingsForm.phoneNumber}
                  onChange={onFieldChange}
                />
              </label>

              <label className="go-field">
                <span>Country</span>
                <input
                  name="defaultCountry"
                  placeholder="Nigeria"
                  type="text"
                  value={settingsForm.defaultCountry}
                  onChange={onFieldChange}
                />
              </label>

              <label className="go-field">
                <span>City</span>
                <input
                  name="defaultCity"
                  placeholder="Lagos"
                  type="text"
                  value={settingsForm.defaultCity}
                  onChange={onFieldChange}
                />
              </label>
            </div>

            <label className="go-field">
              <span>Default address</span>
              <textarea
                name="defaultAddress"
                placeholder="14 Riverstone Crescent"
                value={settingsForm.defaultAddress}
                onChange={onFieldChange}
              />
            </label>

            <label className="go-check-field">
              <input
                checked={settingsForm.newsletterOptIn}
                name="newsletterOptIn"
                type="checkbox"
                onChange={onFieldChange}
              />
              Receive product updates, verification reminders, and order notices
            </label>

            <div className="go-settings-actions">
              <button className="go-primary-btn" disabled={settingsSubmitting} type="submit">
                {settingsSubmitting ? 'Saving...' : 'Save settings'}
              </button>
              <p className="go-dashboard-meta">
                These details are stored in your account and will be reusable from the admin side later.
              </p>
            </div>
          </form>
        </section>
      </div>

      <div className="go-section-head go-section-head--tight">
        <h2>Order history</h2>
      </div>

      {orders.length === 0 ? (
        <div className="go-empty-state">
          <i aria-hidden="true" className="bi bi-bag-heart" />
          <p>No orders have been linked to this account yet.</p>
        </div>
      ) : (
        <div className="go-dashboard-orders">
          {orders.map((order) => (
            <article key={order.orderNumber} className="go-dashboard-order-card">
              <div className="go-dashboard-order-card__head">
                <div>
                  <p className="go-order-number">{order.orderNumber}</p>
                  <h3>{order.quantityCount || order.itemCount} item(s)</h3>
                  <p className="go-dashboard-meta">
                    {formatShortDate(order.createdAt)} •{' '}
                    {order.paymentMethod === 'paystack' ? 'Paystack' : 'Bank transfer'}
                  </p>
                </div>
                <div className="go-dashboard-order-card__summary">
                  <strong>{formatCurrency(order.total)}</strong>
                  <div className="go-dashboard-badges">
                    <StatusPill
                      fallbackLabel="In progress"
                      value={order.status}
                      variant="order"
                    />
                    <StatusPill
                      fallbackLabel="Pending"
                      value={order.paymentStatus}
                      variant="payment"
                    />
                  </div>
                </div>
              </div>

              {order.items?.length > 0 && (
                <div className="go-order-line-list">
                  {order.items.map((item, index) => (
                    <div
                      key={`${order.orderNumber}-${item.productId}-${index}`}
                      className="go-order-line"
                    >
                      <img alt={item.name} src={item.imageUrl} />
                      <div>
                        <h4>{item.name}</h4>
                        <p>
                          {item.quantity} x {formatCurrency(item.unitPrice)}
                        </p>
                      </div>
                      <strong>{formatCurrency(item.lineTotal)}</strong>
                    </div>
                  ))}
                </div>
              )}

              {(order.trackingCarrier || order.trackingNumber || order.trackingEvents?.[0]) && (
                <p className="go-dashboard-meta">
                  {order.trackingCarrier ? `${order.trackingCarrier}` : 'Tracking update'}
                  {order.trackingNumber ? ` | ${order.trackingNumber}` : ''}
                  {order.trackingEvents?.[0]?.message ? ` | ${order.trackingEvents[0].message}` : ''}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
