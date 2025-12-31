import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
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
