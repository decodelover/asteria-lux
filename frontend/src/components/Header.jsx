import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useStore } from '../hooks/useStore'

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Shop', to: '/shop' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
]

export function Header() {
  const { user } = useAuth()
  const { cart } = useStore()

  return (
    <header className="sticky top-0 z-40">
      <div className="mx-auto w-full max-w-[1480px] px-4 py-4 sm:px-6 lg:px-8">
        <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,11,10,0.84),rgba(17,13,11,0.9))] px-4 py-4 shadow-[0_22px_80px_rgba(2,2,2,0.35)] backdrop-blur-2xl sm:px-6">
          <div className="flex flex-col gap-3 border-b border-white/8 pb-3 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[#c9af87] lg:flex-row lg:items-center lg:justify-between">
            <p>Private client storefront</p>
            <div className="flex flex-wrap gap-3 text-[#dbc9b1]">
              <span>Insured delivery</span>
              <span>Private account access</span>
              <span>Concierge contact</span>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center justify-between gap-4">
              <NavLink className="flex items-center gap-3" to="/">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#c89f63_0%,#a97835_100%)] text-[#1b140f] shadow-[0_18px_36px_rgba(188,137,63,0.24)]">
                  <i className="bi bi-gem text-lg" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[0.66rem] font-semibold uppercase tracking-[0.32em] text-[#d8bf98]">
                    Asteria
                  </p>
                  <p className="font-display text-3xl leading-none text-[#fff5e7]">
                    Luxury House
                  </p>
                </div>
              </NavLink>

              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#ead8bc] lg:hidden">
                <i className="bi bi-bag-check" aria-hidden="true" />
                {cart.summary.itemCount}
              </div>
            </div>

            <nav className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  className={({ isActive }) =>
                    `rounded-full px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? 'bg-white text-[#17120f]'
                        : 'text-[#e8dccb] hover:bg-white/8 hover:text-white'
                    }`
                  }
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="flex flex-wrap items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-2 text-sm font-semibold text-[#f0e2cf] lg:inline-flex">
                <i className="bi bi-bag-check text-[#d7b37d]" aria-hidden="true" />
                {cart.summary.itemCount} in cart
              </div>

              <NavLink className="button-secondary border-white/10 bg-white/6 text-[#f0e1ce]" to="/shop">
                <i className="bi bi-bag" aria-hidden="true" />
                Shop now
              </NavLink>

              <NavLink
                className="button-primary px-4 py-2.5"
                to={user ? '/account' : '/auth'}
              >
                <i className={`bi ${user ? 'bi-person-check' : 'bi-person'}`} aria-hidden="true" />
                {user ? user.fullName.split(' ')[0] : 'Sign in'}
              </NavLink>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
