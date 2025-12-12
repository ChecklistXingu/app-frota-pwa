import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import AppRouter from './router/AppRouter'
import { AuthProvider } from './contexts/AuthContext'
import InstallPrompt from './components/pwa/InstallPrompt'
import UpdatePrompt from './components/pwa/UpdatePrompt'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <UpdatePrompt />
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
      await navigator.serviceWorker.register('/sw.js')
      console.log('[App] Service Worker registrado')
    } catch (error) {
      console.error('[App] Falha ao registrar SW:', error)
    }
  })
}
