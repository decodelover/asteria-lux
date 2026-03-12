import { formatCurrency } from '../utils/format'

export function CheckoutModal({
  error,
  formValues,
  isOpen,
  isSubmitting,
  itemsCount,
  onChange,
  onClose,
  onSubmit,
  order,
  orderTotal,
}) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#110d0acc] px-4 py-6 backdrop-blur-sm">
      <div className="max-h-full w-full max-w-4xl overflow-auto rounded-[36px] border border-white/12 bg-[linear-gradient(180deg,#fbf6ee_0%,#f3ebdd_100%)] shadow-[0_35px_120px_rgba(11,7,5,0.45)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e8dccd] bg-[#f8f3eb]/95 px-5 py-4 backdrop-blur-sm sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8d6b41]">
              Secure checkout
            </p>
            <h2 className="mt-1 font-display text-4xl text-[#201713]">
              {order ? 'Order confirmed' : 'Complete your order'}
            </h2>
          </div>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e1d4c2] bg-white text-[#2a201a] transition hover:border-[#bf9c6a] hover:text-[#8d6b41]"
            onClick={onClose}
            type="button"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        {order ? (
          <div className="grid gap-6 px-5 py-6 sm:px-7 sm:py-8 lg:grid-cols-[1fr_280px]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#eef7f0] px-4 py-2 text-sm font-semibold text-[#2d7445]">
                <i className="bi bi-check2-circle" aria-hidden="true" />
                Order captured successfully
              </div>

              <div className="space-y-3">
                <h3 className="font-display text-5xl leading-none text-[#201713]">
                  {order.orderNumber}
                </h3>
                <p className="max-w-xl text-base leading-7 text-[#5d5147]">
                  Inventory has been updated, the order has been captured, and this session
                  cart has been cleared.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-[#e8dccb] bg-white px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c704c]">
                    Customer
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[#231a15]">
                    {order.customerName}
                  </p>
                  <p className="mt-1 text-sm text-[#65584d]">{order.customerEmail}</p>
                </div>
                <div className="rounded-[24px] border border-[#e8dccb] bg-white px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c704c]">
                    Shipping
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[#231a15]">
                    {order.shippingCity}, {order.shippingCountry}
                  </p>
                  <p className="mt-1 text-sm text-[#65584d]">{order.shippingAddress}</p>
                </div>
              </div>

              <div className="rounded-[26px] border border-[#e7dac7] bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(246,235,220,0.9))] px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c704c]">
                  What happens next
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {[
                    'Order record is available to operations and the customer account.',
                    'Product stock has already been updated server-side.',
                    'Email confirmation depends on the current delivery mode.',
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-[20px] border border-[#eadbc9] bg-white/80 px-4 py-4 text-sm leading-6 text-[#5d5147]"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <aside className="rounded-[28px] border border-[#eadfce] bg-[linear-gradient(180deg,#ffffff_0%,#f6eee2_100%)] p-5 shadow-[0_16px_40px_rgba(37,23,14,0.08)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c704c]">
                Order total
              </p>
              <p className="mt-3 font-display text-5xl leading-none text-[#201713]">
                {formatCurrency(order.total)}
              </p>
              <div className="mt-6 space-y-2 text-sm text-[#5d5147]">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <strong>{formatCurrency(order.subtotal)}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Shipping</span>
                  <strong>
                    {order.shippingFee === 0
                      ? 'Complimentary'
                      : formatCurrency(order.shippingFee)}
                  </strong>
                </div>
              </div>

              <button
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1f1713] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2d221d]"
                onClick={onClose}
                type="button"
              >
                <i className="bi bi-arrow-left" aria-hidden="true" />
                Continue shopping
              </button>
            </aside>
          </div>
        ) : (
          <form
            className="grid gap-6 px-5 py-6 sm:px-7 sm:py-8 lg:grid-cols-[1fr_280px]"
            onSubmit={onSubmit}
          >
            <div className="space-y-5">
              <div className="rounded-[26px] border border-[#eadcca] bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(246,235,220,0.9))] px-5 py-5">
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    ['Customer', 'Capture verified shipping details'],
                    ['Inventory', 'Reduce stock only after order creation'],
                    ['Email', 'Prepare customer confirmation after checkout'],
                  ].map(([title, copy]) => (
                    <div
                      key={title}
                      className="rounded-[20px] border border-[#eadbc9] bg-white/80 px-4 py-4"
                    >
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#8d6b41]">
                        {title}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-[#5d5147]">{copy}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="field-shell">
                  <span className="field-label">Full name</span>
                  <div className="field-input-shell">
                    <i className="bi bi-person text-[#8f714d]" aria-hidden="true" />
                    <input
                      className="field-input"
                      name="name"
                      placeholder="Ada Obi"
                      required
                      type="text"
                      value={formValues.name}
                      onChange={onChange}
                    />
                  </div>
                </label>

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
                      value={formValues.email}
                      onChange={onChange}
                    />
                  </div>
                </label>

                <label className="field-shell">
                  <span className="field-label">Phone</span>
                  <div className="field-input-shell">
                    <i className="bi bi-telephone text-[#8f714d]" aria-hidden="true" />
                    <input
                      className="field-input"
                      name="phone"
                      placeholder="+1 555 123 4567"
                      type="tel"
                      value={formValues.phone}
                      onChange={onChange}
                    />
                  </div>
                </label>

                <label className="field-shell">
                  <span className="field-label">Country</span>
                  <div className="field-input-shell">
                    <i className="bi bi-globe2 text-[#8f714d]" aria-hidden="true" />
                    <input
                      className="field-input"
                      name="country"
                      placeholder="United States"
                      required
                      type="text"
                      value={formValues.country}
                      onChange={onChange}
                    />
                  </div>
                </label>
              </div>

              <label className="field-shell">
                <span className="field-label">Street address</span>
                <div className="field-input-shell items-start">
                  <i
                    className="bi bi-geo-alt mt-0.5 text-[#8f714d]"
                    aria-hidden="true"
                  />
                  <textarea
                    className="field-input min-h-28 resize-y"
                    name="address"
                    placeholder="14 Riverstone Crescent, Apartment 6"
                    required
                    value={formValues.address}
                    onChange={onChange}
                  />
                </div>
              </label>

              <label className="field-shell">
                <span className="field-label">City</span>
                <div className="field-input-shell">
                  <i className="bi bi-buildings text-[#8f714d]" aria-hidden="true" />
                  <input
                    className="field-input"
                    name="city"
                    placeholder="New York"
                    required
                    type="text"
                    value={formValues.city}
                    onChange={onChange}
                  />
                </div>
              </label>

              {error && (
                <div className="rounded-[22px] border border-[#f0c1bc] bg-[#fff5f3] px-4 py-3 text-sm font-medium text-[#a0362b]">
                  {error}
                </div>
              )}
            </div>

            <aside className="rounded-[28px] border border-[#eadfce] bg-[linear-gradient(180deg,#ffffff_0%,#f6eee2_100%)] p-5 shadow-[0_16px_40px_rgba(37,23,14,0.08)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c704c]">
                Order preview
              </p>
              <p className="mt-3 font-display text-5xl leading-none text-[#201713]">
                {formatCurrency(orderTotal)}
              </p>
              <div className="mt-5 rounded-[20px] bg-white px-4 py-4 text-sm leading-7 text-[#5f5146] shadow-[0_10px_24px_rgba(37,22,13,0.05)]">
                {itemsCount} {itemsCount === 1 ? 'piece' : 'pieces'} will be written into
                the order record after submission.
              </div>

              <div className="mt-4 rounded-[20px] border border-[#eadbc9] bg-[#fffaf3] px-4 py-4 text-sm leading-7 text-[#5f5146]">
                Online payment processing is not attached yet. This step records the order
                and customer details cleanly while payment is added separately.
              </div>

              <button
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1f1713] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2d221d] disabled:cursor-not-allowed disabled:bg-[#9d9084]"
                disabled={isSubmitting}
                type="submit"
              >
                <i
                  className={`bi ${
                    isSubmitting ? 'bi-arrow-repeat animate-spin' : 'bi-lock'
                  }`}
                  aria-hidden="true"
                />
                {isSubmitting ? 'Submitting order' : 'Confirm order'}
              </button>
            </aside>
          </form>
        )}
      </div>
    </div>
  )
}
