const storePillars = [
  {
    icon: 'bi-person-badge',
    text: 'Private client accounts create a smoother return experience from sign-in through order history.',
    title: 'Private client care',
  },
  {
    icon: 'bi-envelope-check',
    text: 'Thoughtful order communication, contact follow-up, and launch updates keep the store relationship active beyond checkout.',
    title: 'Clear communication',
  },
  {
    icon: 'bi-database-check',
    text: 'The collection, cart, and order experience move as one connected system rather than disconnected pages.',
    title: 'Connected commerce',
  },
]

const experiencePoints = [
  'Editorial presentation and measured spacing instead of generic storefront defaults.',
  'A smoother path from discovery to checkout with less visual noise.',
  'A store identity that feels intentional across product browsing, contact, and account pages.',
]

export function AboutPage() {
  return (
    <main className="page-shell flex flex-col gap-8">
      <section className="panel-dark overflow-hidden rounded-[36px] px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_360px] lg:items-end">
          <div className="space-y-5">
            <div className="inline-tag border-white/10 bg-white/8 text-[#e4c697]">
              <i className="bi bi-buildings" aria-hidden="true" />
              About Asteria
            </div>
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c9ab7a]">
                Designed to feel editorial, premium, and quietly confident
              </p>
              <h1 className="font-display text-6xl leading-none text-[#fff6ea] sm:text-7xl">
                Asteria Luxury House is built around modern luxury service.
              </h1>
              <p className="max-w-3xl text-base leading-8 text-[#d9cfc2] sm:text-lg">
                The brand direction centers on restraint, clarity, and service. Every page
                is shaped to make the catalog feel curated, the journey feel calm, and the
                client feel looked after from first visit through order follow-up.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Materials', 'Fine jewelry, timepieces, eyewear, and statement pieces'],
                ['Service', 'Direct contact, private accounts, and order communication'],
                ['Experience', 'A dark luxury visual language with editorial balance'],
              ].map(([title, copy]) => (
                <div key={title} className="metric-card">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#caab7c]">
                    {title}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[#efe3d2]">{copy}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="panel rounded-[32px] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8d6b41]">
              Experience principles
            </p>
            <div className="mt-5 space-y-3">
              {experiencePoints.map((item, index) => (
                <div
                  key={item}
                  className="rounded-[22px] border border-[#e7dac7] bg-white px-4 py-4 shadow-[0_14px_34px_rgba(21,14,9,0.06)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f6ebda] text-[#8d6b41]">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-7 text-[#5d5147]">{item}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {storePillars.map((item) => (
          <article key={item.title} className="panel px-5 py-6 shadow-[0_18px_50px_rgba(37,23,14,0.08)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f3e9db] text-[#8d6b41]">
              <i className={`bi ${item.icon}`} aria-hidden="true" />
            </div>
            <h2 className="mt-4 font-display text-4xl text-[#201713]">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-[#5d5147]">{item.text}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="panel px-6 py-7 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8d6b41]">
            Brand direction
          </p>
          <h2 className="mt-3 font-display text-5xl leading-none text-[#201713]">
            Luxury retail online should feel composed, not overloaded.
          </h2>
          <p className="mt-4 text-sm leading-8 text-[#5d5147] sm:text-base">
            That means strong typography, disciplined spacing, clear product hierarchy,
            polished communication, and a checkout journey that stays calm instead of loud.
          </p>
        </section>

        <section className="panel-dark rounded-[34px] px-6 py-7 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d1b386]">
            Signature details
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[
              'Curated collection browsing',
              'Persistent personal cart',
              'Private client sign-in',
              'Order and update communication',
              'Direct contact and concierge intake',
              'A cohesive visual direction across the full site',
            ].map((item) => (
              <div
                key={item}
                className="rounded-[22px] border border-white/10 bg-white/6 px-4 py-4 text-sm leading-6 text-[#eee1d0]"
              >
                <i className="bi bi-check2-circle mr-2 text-[#dbb87b]" aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}
