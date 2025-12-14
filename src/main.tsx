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
    // Cria um toast personalizado para notificar sobre a atualização
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.backgroundColor = '#0d2d6c';
    toast.style.color = 'white';
    toast.style.padding = '16px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.zIndex = '10000';
    toast.style.display = 'flex';
    toast.style.flexDirection = 'column';
    toast.style.gap = '12px';
    toast.style.maxWidth = '320px';
    
    const message = document.createElement('div');
    message.textContent = 'Uma nova versão do aplicativo está disponível!';
    message.style.fontWeight = '500';
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '8px';
    buttonContainer.style.justifyContent = 'flex-end';
    
    const updateButton = document.createElement('button');
    updateButton.textContent = 'Atualizar';
    updateButton.style.padding = '8px 16px';
    updateButton.style.backgroundColor = '#4CAF50';
    updateButton.style.color = 'white';
    updateButton.style.border = 'none';
    updateButton.style.borderRadius = '4px';
    updateButton.style.cursor = 'pointer';
    
    const laterButton = document.createElement('button');
    laterButton.textContent = 'Depois';
    laterButton.style.padding = '8px 16px';
    laterButton.style.backgroundColor = '#f0f0f0';
    laterButton.style.border = '1px solid #ddd';
    laterButton.style.borderRadius = '4px';
    laterButton.style.cursor = 'pointer';
    
    // Adiciona os elementos ao toast
    buttonContainer.appendChild(laterButton);
    buttonContainer.appendChild(updateButton);
    toast.appendChild(message);
    toast.appendChild(buttonContainer);
    document.body.appendChild(toast);
    
    // Configura os eventos dos botões
    const updateApp = () => {
      updateSW(true).then(() => {
        document.body.removeChild(toast);
        window.location.reload();
      });
    };
    
    updateButton.addEventListener('click', updateApp);
    laterButton.addEventListener('click', () => {
      document.body.removeChild(toast);
    });
    
    // Atualiza automaticamente após 1 minuto se o usuário não interagir
    const timeout = setTimeout(updateApp, 60000);
    
    // Limpa o timeout se o usuário fechar manualmente
    laterButton.addEventListener('click', () => {
      clearTimeout(timeout);
    });
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

// Verifica atualizações a cada 5 minutos (para testes)
// Em produção, você pode aumentar esse tempo (ex: 1 hora)
setInterval(() => {
  if (document.visibilityState === 'visible') {
    updateSW(true).catch(console.error);
  }
}, 5 * 60 * 1000); // 5 minutos
