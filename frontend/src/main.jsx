import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'bootstrap-icons/font/bootstrap-icons.css'
import App from './App.jsx'
import { AdminAuthProvider } from './context/AdminAuthContext'
import { AuthProvider } from './context/AuthContext'
import { SiteSettingsProvider } from './context/SiteSettingsContext'
import { StoreProvider } from './context/StoreContext'
import './index.css'

const hideBootLoader = () => {
  const loader = document.getElementById('site-loader')

  if (!loader) {
    return
  }

  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      loader.classList.add('is-hidden')
    }, 180)

    window.setTimeout(() => {
      loader.remove()
    }, 520)
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AdminAuthProvider>
        <AuthProvider>
          <SiteSettingsProvider>
            <StoreProvider>
              <App />
            </StoreProvider>
          </SiteSettingsProvider>
        </AuthProvider>
      </AdminAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

hideBootLoader()
