import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import AppRouter from './router/AppRouter'
import { AuthProvider } from './contexts/AuthContext'
import InstallPrompt from './components/pwa/InstallPrompt'
import UpdatePrompt from './components/pwa/UpdatePrompt'
import OfflineIndicator from './components/pwa/OfflineIndicator'
import { startAutoSync } from './services/syncService'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <UpdatePrompt />
        <OfflineIndicator />
        <AppRouter />
        <InstallPrompt />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)

// Inicia sincronização automática de uploads pendentes
startAutoSync()

// Registra Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/sw.js')
      console.log('[App] Service Worker registrado')
    } catch (error) {
      console.error('[App] Falha ao registrar SW:', error)
    }
  })
}
