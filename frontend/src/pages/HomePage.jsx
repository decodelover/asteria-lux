import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProductCard } from '../components/ProductCard'
import { useStore } from '../hooks/useStore'
import { api } from '../lib/api'

const pillars = [
  {
    description:
      'Private accounts, verified contact details, and a clean order journey give returning clients a consistent experience.',
    icon: 'bi-shield-check',
    title: 'Client confidence',
  },
  {
    description:
      'Curated pieces, concierge contact, and account-linked orders now move together like a real store system.',
    icon: 'bi-database-check',
    title: 'Connected service',
  },
  {
    description:
      'Every page carries the same dark editorial direction, from the landing experience through checkout.',
    icon: 'bi-window-stack',
    title: 'Refined presentation',
  },
]

export function HomePage() {
  const { addToCart, busyKey } = useStore()
  const [featuredProducts, setFeaturedProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false

    const loadFeaturedProducts = async () => {
      try {
        const response = await api.getProducts({ featured: true, sort: 'featured' })

        if (!ignore) {
          setFeaturedProducts(response.products.slice(0, 3))
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadFeaturedProducts()

    return () => {
      ignore = true
    }
  }, [])

  return (
    <main className="page-shell flex flex-col gap-8">
      <section className="overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(140deg,rgba(17,13,11,0.98),rgba(25,19,16,0.96))] px-6 py-8 shadow-[0_34px_120px_rgba(3,2,2,0.42)] sm:px-8 lg:px-10 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_420px] lg:items-end">
          <div className="space-y-6">
            <div className="lux-kicker border-white/10 bg-white/6 text-[#e0c090]">
              <i className="bi bi-stars" aria-hidden="true" />
              Luxury storefront system
            </div>

            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#b98b46]">
                Fine jewelry, elevated accessories, and private client service
              </p>
              <h1 className="font-display text-6xl leading-none text-[#fff6ea] sm:text-7xl lg:text-[5.6rem]">
                Modern luxury with a sharper online experience.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-[#d6ccbe] sm:text-lg">
                Discover signature pieces, maintain a private account, and move from
                browsing to order confirmation in a storefront designed to feel deliberate
                at every step.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link className="button-primary" to="/shop">
                Shop collection
                <i className="bi bi-arrow-right" aria-hidden="true" />
              </Link>
              <Link className="button-secondary border-white/10 bg-white/6 text-[#f0e1ce]" to="/auth">
                Open account
                <i className="bi bi-person-plus" aria-hidden="true" />
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Collections', 'Jewelry, watches, rings, bangles, eyewear'],
                ['Service', 'Order updates, client accounts, direct contact'],
                ['Delivery', 'Persistent cart and insured checkout flow'],
              ].map(([title, copy]) => (
                <div
                  key={title}
                  className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b98b46]">
                    {title}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[#efe3d2]">{copy}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel rounded-[34px] p-6">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8b6538]">
                Asteria standard
              </p>
              <h2 className="font-display text-5xl leading-none text-[#201713]">
                Elevated details from the first impression onward.
              </h2>
            </div>
            <div className="mt-6 grid gap-4">
              {pillars.map((pillar) => (
                <article
                  key={pillar.title}
                  className="rounded-[24px] border border-[#e6d8c5] bg-white px-4 py-4 shadow-[0_12px_28px_rgba(18,11,7,0.06)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f5ead8] text-[#8d6b41]">
                      <i className={`bi ${pillar.icon}`} aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-[#201713]">{pillar.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-[#5f5147]">
                        {pillar.description}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b98b46]">
              Featured inventory
            </p>
            <h2 className="mt-2 font-display text-5xl leading-none text-[#fff4e6]">
              Featured collection
            </h2>
          </div>
          <Link className="text-sm font-semibold text-[#e3c28e]" to="/shop">
            View the full catalog
          </Link>
        </div>

        {loading ? (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <article
                key={`home-skeleton-${index}`}
                className="animate-pulse rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-[0_18px_50px_rgba(37,23,14,0.07)]"
              >
                <div className="aspect-[4/5] rounded-[22px] bg-[#efe6d9]" />
                <div className="mt-4 h-5 w-28 rounded-full bg-[#efe6d9]" />
                <div className="mt-3 h-10 rounded-full bg-[#f2e8dc]" />
              </article>
            ))}
          </section>
        ) : (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {featuredProducts.map((product) => (
              <ProductCard
                key={product.id}
                busy={busyKey === product.id}
                categoryIcon="bi-gem"
                product={product}
                onAddToCart={() => addToCart(product.id)}
              />
            ))}
          </section>
        )}
      </section>
    </main>
  )
}
