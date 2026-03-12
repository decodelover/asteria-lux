import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="page-shell max-w-[980px]">
      <section className="panel-dark rounded-[36px] px-6 py-10 text-center sm:px-8">
        <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-full bg-white/8 text-[#ddb97b]">
          <i className="bi bi-signpost-split text-3xl" aria-hidden="true" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-[#c8a979]">
          404
        </p>
        <h1 className="mt-3 font-display text-6xl text-white">Page not found</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-[#d8cfc2] sm:text-base">
          The page you requested does not exist in this storefront. Use the main routes
          below to continue browsing the catalog or return to the homepage.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link className="button-primary" to="/">
            Return home
          </Link>
          <Link className="button-secondary border-white/10 bg-white/6 text-[#f0e1ce]" to="/shop">
            Go to shop
          </Link>
        </div>
      </section>
    </main>
  )
}
