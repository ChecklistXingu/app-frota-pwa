import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import AppRouter from './router/AppRouter'
import { AuthProvider } from './contexts/AuthContext'
import InstallPrompt from './components/pwa/InstallPrompt'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
        <InstallPrompt />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)

// Registra Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      
      // Força atualização se houver nova versão
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nova versão disponível - recarrega
              window.location.reload()
            }
          })
        }
      })
    } catch (error) {
      console.error('SW registration failed', error)
    }
  })
}
