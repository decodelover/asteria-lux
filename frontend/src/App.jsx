import { Navigate, Route, Routes } from 'react-router-dom'
import { SiteLayout } from './components/SiteLayout'
import { useAdminAuth } from './hooks/useAdminAuth'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { AdminLoginPage } from './pages/AdminLoginPage'
import { MarketplacePage } from './pages/MarketplacePage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'

function AdminOnlyRoute({ children }) {
  const { loading, token } = useAdminAuth()

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f6f3fb] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center">
          <section className="w-full max-w-xl rounded-[32px] border border-white/70 bg-white/90 p-10 text-center shadow-[0_36px_120px_rgba(84,35,122,0.14)] backdrop-blur">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f1e8fb]">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#c9a7ec] border-t-[#5b1793]" />
            </div>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.28em] text-[#7d668d]">
              Admin workspace
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#2c1639]">
              Loading admin session...
            </h1>
          </section>
        </div>
      </main>
    )
  }

  return token ? children : <Navigate replace to="/admin/login" />
}

function AdminGuestRoute({ children }) {
  const { loading, token } = useAdminAuth()

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f6f3fb] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center">
          <section className="w-full max-w-xl rounded-[32px] border border-white/70 bg-white/90 p-10 text-center shadow-[0_36px_120px_rgba(84,35,122,0.14)] backdrop-blur">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f1e8fb]">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#c9a7ec] border-t-[#5b1793]" />
            </div>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.28em] text-[#7d668d]">
              Admin workspace
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#2c1639]">
              Loading admin session...
            </h1>
          </section>
        </div>
      </main>
    )
  }

  return token ? <Navigate replace to="/admin" /> : children
}

function App() {
  return (
    <Routes>
      <Route
        element={
          <AdminGuestRoute>
            <AdminLoginPage />
          </AdminGuestRoute>
        }
        path="/admin/login"
      />
      <Route
        element={
          <AdminOnlyRoute>
            <AdminDashboardPage />
          </AdminOnlyRoute>
        }
        path="/admin"
      />
      <Route element={<SiteLayout />}>
        <Route element={<MarketplacePage />} index />
        <Route element={<Navigate replace to="/?tab=account&mode=signin" />} path="/auth" />
        <Route element={<Navigate replace to="/?tab=account&mode=signin" />} path="/account" />
        <Route element={<Navigate replace to="/" />} path="/shop" />
        <Route element={<Navigate replace to="/" />} path="/about" />
        <Route element={<Navigate replace to="/" />} path="/contact" />
        <Route element={<ResetPasswordPage />} path="/reset-password" />
        <Route element={<VerifyEmailPage />} path="/verify-email" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Route>
    </Routes>
  )
}

export default App
