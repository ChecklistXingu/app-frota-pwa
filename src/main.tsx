import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import 'react-datepicker/dist/react-datepicker.css'
import './styles/datepicker.css'
import './index.css'
import AppRouter from './router/AppRouter'
import { AuthProvider } from './contexts/AuthContext'
import InstallPrompt from './components/pwa/InstallPrompt'
import OfflineIndicator from './components/pwa/OfflineIndicator'
import UpdatePrompt from './components/pwa/UpdatePrompt'
import { startAutoSync } from './services/syncService'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <OfflineIndicator />
        <UpdatePrompt />
        <AppRouter />
        <InstallPrompt />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)

// Inicia sincronização automática de uploads pendentes
startAutoSync()

// Configuração do Service Worker do PWA
registerSW({
  onNeedRefresh() {
    // O UpdatePrompt.tsx cuida da UI de atualização
    // Não fazemos nada aqui para evitar duplicação
    console.log('[PWA] onNeedRefresh - nova versão disponível');
  },
  onOfflineReady() {
    console.log('[PWA] App pronto para uso offline!')
    // Mostra uma notificação de que o app está pronto para uso offline
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Aplicativo pronto para uso offline!', {
        body: 'Agora você pode usar o aplicativo mesmo sem conexão com a internet.',
        icon: '/icons/icon-192.png'
      });
      // Adiciona vibração se suportado
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    }
  },
  onRegistered(registration) {
    console.log('[PWA] Service Worker registrado:', registration)
    if (!registration) return
    
    // Log para debug
    registration.addEventListener('updatefound', () => {
      console.log('[PWA] updatefound - novo service worker instalando')
      const newWorker = registration.installing
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          console.log('[PWA] novo worker state:', newWorker.state)
        })
      }
    })
    
    // Verifica atualizações a cada 1 hora (não muito agressivo)
    const updateInterval = setInterval(() => {
      registration.update().catch(console.error)
    }, 60 * 60 * 1000) // 1 hora
    
    window.addEventListener('beforeunload', () => {
      clearInterval(updateInterval)
    })
  },
  onRegisterError(error) {
    console.error('[PWA] Erro ao registrar SW:', error)
  },
})

// Reload quando o service worker muda (nova versão ativada)
let refreshing = false
if (navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    console.log('[PWA] controllerchange - recarregando para ativar novo SW')
    window.location.reload()
  })
}
