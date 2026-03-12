import { formatCurrency, formatNumber } from '../utils/format'

export function CartPanel({
  amountToFreeShipping,
  busyKey,
  cart,
  loading,
  onClearCart,
  onOpenCheckout,
  onQuantityChange,
}) {
  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,13,11,0.94),rgba(24,18,15,0.94))] shadow-[0_28px_90px_rgba(5,4,3,0.34)]">
        <div className="border-b border-white/8 px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#cfb489]">
                Private basket
              </p>
              <h2 className="mt-2 font-display text-4xl text-white">Cart summary</h2>
              <p className="mt-2 max-w-xs text-sm leading-6 text-[#d9cec0]">
                Reserved pieces stay with this browsing session until checkout completes.
              </p>
            </div>
            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#f2e3c9]">
              {formatNumber(cart.summary.itemCount)} items
            </div>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5 text-[#f0e3d2]">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`cart-skeleton-${index}`}
                  className="animate-pulse rounded-[24px] border border-white/8 bg-white/6 p-4"
                >
                  <div className="flex gap-3">
                    <div className="h-18 w-18 rounded-[18px] bg-white/10" />
                    <div className="flex-1 space-y-3">
                      <div className="h-4 w-2/3 rounded-full bg-white/10" />
                      <div className="h-3 w-1/3 rounded-full bg-white/8" />
                      <div className="h-9 rounded-full bg-white/8" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : cart.items.length > 0 ? (
            <div className="space-y-3">
              {cart.items.map((item) => (
                <article
                  key={item.productId}
                  className="rounded-[24px] border border-white/8 bg-white/6 p-4 shadow-[0_12px_28px_rgba(2,2,2,0.16)]"
                >
                  <div className="flex gap-3">
                    <img
                      alt={item.name}
                      className="h-18 w-18 rounded-[18px] object-cover"
                      src={item.imageUrl}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-[#fff5e8]">
                            {item.name}
                          </h3>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#c7a777]">
                            {item.category}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-[#efcf99]">
                          {formatCurrency(item.lineTotal)}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/18 px-2 py-1">
                          <button
                            className="flex h-8 w-8 items-center justify-center rounded-full text-[#f0e4d2] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={busyKey === item.productId}
                            onClick={() =>
                              onQuantityChange(item.productId, item.quantity - 1)
                            }
                            type="button"
                          >
                            <i className="bi bi-dash" aria-hidden="true" />
                          </button>
                          <span className="min-w-6 text-center text-sm font-semibold text-[#fff5e8]">
                            {item.quantity}
                          </span>
                          <button
                            className="flex h-8 w-8 items-center justify-center rounded-full text-[#f0e4d2] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={
                              busyKey === item.productId || item.quantity >= item.stockQuantity
                            }
                            onClick={() =>
                              onQuantityChange(item.productId, item.quantity + 1)
                            }
                            type="button"
                          >
                            <i className="bi bi-plus" aria-hidden="true" />
                          </button>
                        </div>

                        <button
                          className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d0ab78] transition hover:text-[#f0d8ae] disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={busyKey === item.productId}
                          onClick={() => onQuantityChange(item.productId, 0)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[26px] border border-dashed border-white/10 bg-white/6 px-5 py-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/8 text-[#d2b07a]">
                <i className="bi bi-bag-heart text-2xl" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-display text-3xl text-[#fff4e8]">Cart is empty</h3>
              <p className="mt-2 text-sm leading-6 text-[#d2c4b4]">
                Add pieces from the collection and they will stay with this browser session
                until you are ready to check out.
              </p>
            </div>
          )}

          <div className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] p-5">
            <div className="space-y-3 text-sm text-[#ddd0c0]">
              <div className="flex items-center justify-between">
                <span>Items</span>
                <strong className="text-[#fff3e6]">
                  {formatNumber(cart.summary.itemCount)}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <strong className="text-[#fff3e6]">
                  {formatCurrency(cart.summary.subtotal)}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Shipping</span>
                <strong className="text-[#fff3e6]">
                  {cart.summary.shippingFee === 0
                    ? 'Complimentary'
                    : formatCurrency(cart.summary.shippingFee)}
                </strong>
              </div>
              <div className="flex items-center justify-between border-t border-white/8 pt-3 text-base">
                <span className="font-semibold text-[#fff1e2]">Estimated total</span>
                <strong className="text-[#efcd95]">
                  {formatCurrency(cart.summary.total)}
                </strong>
              </div>
            </div>

            <div className="mt-4 rounded-[20px] border border-white/8 bg-black/16 px-4 py-3 text-sm text-[#e0d2c2]">
              {amountToFreeShipping > 0
                ? `Add ${formatCurrency(amountToFreeShipping)} to unlock free insured delivery.`
                : 'Free insured delivery is active for this order.'}
            </div>

            <div className="mt-5 flex flex-col gap-3">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#c89f63_0%,#aa7b38_100%)] px-4 py-3 text-sm font-semibold text-[#1b140f] transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-[#9d9084] disabled:text-[#f5e7d2]"
                disabled={cart.items.length === 0 || busyKey !== null}
                onClick={onOpenCheckout}
                type="button"
              >
                <i className="bi bi-shield-check" aria-hidden="true" />
                Proceed to checkout
              </button>

              <button
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold text-[#f1e4d3] transition hover:border-[#bf9c6a] hover:text-[#f6e0b9] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={cart.items.length === 0 || busyKey !== null}
                onClick={onClearCart}
                type="button"
              >
                <i className="bi bi-trash3" aria-hidden="true" />
                Clear cart
              </button>
            </div>
          </div>
        </div>
      </section>
    </aside>
  )
}
