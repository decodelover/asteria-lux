import { formatCurrency } from '../utils/format'

export function ProductCard({ busy, categoryIcon, onAddToCart, product }) {
  const lowStock = product.stockQuantity > 0 && product.stockQuantity <= 3

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,15,13,0.9),rgba(29,22,18,0.82))] shadow-[0_24px_80px_rgba(5,4,3,0.3)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_34px_110px_rgba(5,4,3,0.38)]">
      <div className="relative aspect-[4/5] overflow-hidden">
        <img
          alt={product.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          loading="lazy"
          src={product.imageUrl}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,6,5,0.08)_5%,rgba(12,9,7,0.2)_42%,rgba(17,12,10,0.82)_100%)]" />

        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {product.badge && (
            <span className="rounded-full bg-[#f8ecda] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7d5b31]">
              {product.badge}
            </span>
          )}
          {product.featured && (
            <span className="rounded-full border border-white/18 bg-black/35 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#f0dfbe]">
              Featured
            </span>
          )}
        </div>

        <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/92 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#3b2f26]">
            <i className={`bi ${categoryIcon}`} aria-hidden="true" />
            {product.category}
          </div>
          <div className="rounded-full border border-white/12 bg-black/35 px-4 py-2 text-right text-[#f8ead4] backdrop-blur-sm">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#d8b47f]">
              Price
            </p>
            <p className="text-lg font-semibold">{formatCurrency(product.price)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 p-5 text-[#f2e7d8]">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#bf9a66]">
                Curated piece
              </p>
              <h3 className="font-display text-4xl leading-none text-[#fff6ea]">
                {product.name}
              </h3>
            </div>
          </div>
          <p className="text-sm leading-7 text-[#d8cbbb]">{product.description}</p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
              product.stockQuantity === 0
                ? 'bg-[#4f2420] text-[#ffd6d2]'
                : lowStock
                  ? 'bg-[#4b3820] text-[#f6ddb0]'
                  : 'bg-[#173225] text-[#bde8c8]'
            }`}
          >
            <i
              className={`bi ${
                product.stockQuantity === 0
                  ? 'bi-x-circle'
                  : lowStock
                    ? 'bi-exclamation-circle'
                    : 'bi-check-circle'
              }`}
              aria-hidden="true"
            />
            {product.stockQuantity === 0
              ? 'Out of stock'
              : `${product.stockQuantity} ready to ship`}
          </div>

          <button
            className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#c89f63_0%,#aa7b38_100%)] px-4 py-2.5 text-sm font-semibold text-[#1b140f] transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-[#9d9084] disabled:text-[#f5e7d2]"
            disabled={busy || product.stockQuantity === 0}
            onClick={onAddToCart}
            type="button"
          >
            <i
              className={`bi ${busy ? 'bi-arrow-repeat animate-spin' : 'bi-bag-plus'}`}
              aria-hidden="true"
            />
            {busy ? 'Adding' : 'Add to cart'}
          </button>
        </div>
      </div>
    </article>
  )
}
