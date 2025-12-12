import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import AppRouter from './router/AppRouter'
import { AuthProvider } from './contexts/AuthContext'
import InstallPrompt from './components/pwa/InstallPrompt'
import OfflineIndicator from './components/pwa/OfflineIndicator'
import { startAutoSync } from './services/syncService'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <OfflineIndicator />
        <AppRouter />
        <InstallPrompt />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)

// Inicia sincronização automática de uploads pendentes
startAutoSync()

// Configuração do Service Worker do PWA
let updateSW = registerSW({
  onNeedRefresh() {
    // Mostra notificação de atualização
    const shouldUpdate = window.confirm(
      'Uma nova versão do aplicativo está disponível!\nDeseja atualizar agora?'
    )
    
    if (shouldUpdate) {
      // Força a atualização
      updateSW(true)
        .then(() => {
          // Recarrega a página após a atualização
          window.location.reload()
        })
    }
  },
  onOfflineReady() {
    console.log('[PWA] App pronto para uso offline!')
  },
  onRegistered(registration) {
    console.log('[PWA] Service Worker registrado:', registration)
    
    // Verifica atualizações a cada 30 minutos
    const updateInterval = setInterval(() => {
      registration && registration.update().catch(console.error)
    }, 30 * 60 * 1000)
    
    // Limpa o intervalo quando a página for fechada
    window.addEventListener('beforeunload', () => {
      clearInterval(updateInterval)
    })
  },
  onRegisterError(error) {
    console.error('[PWA] Erro ao registrar SW:', error)
  },
})

// Verifica atualizações quando a página ganha foco
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    updateSW(true).catch(console.error)
  }
}

// Adiciona listener para verificar atualizações quando a página ganha foco
document.addEventListener('visibilitychange', handleVisibilityChange)

// Verifica atualizações a cada hora
setInterval(() => {
  updateSW(true).catch(console.error)
}, 60 * 60 * 1000)
