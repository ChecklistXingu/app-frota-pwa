import { useState, useEffect, useCallback } from "react";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Chave para armazenar quando foi dispensado (expira em 7 dias)
const INSTALL_DISMISSED_KEY = 'pwa-install-dismissed';
const DISMISS_EXPIRY_DAYS = 7;

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Verifica se o dismiss expirou
  const isDismissExpired = useCallback(() => {
    try {
      const dismissedAt = localStorage.getItem(INSTALL_DISMISSED_KEY);
      if (!dismissedAt) return true;
      
      const dismissDate = new Date(dismissedAt);
      const now = new Date();
      const diffDays = (now.getTime() - dismissDate.getTime()) / (1000 * 60 * 60 * 24);
      
      // Se passou mais de 7 dias, permite mostrar novamente
      if (diffDays > DISMISS_EXPIRY_DAYS) {
        localStorage.removeItem(INSTALL_DISMISSED_KEY);
        return true;
      }
      return false;
    } catch {
      return true;
    }
  }, []);

  // Verifica se está em modo standalone (já instalado)
  const isStandalone = useCallback(() => {
    return window.matchMedia("(display-mode: standalone)").matches ||
           (window.navigator as any).standalone === true ||
           document.referrer.includes('android-app://');
  }, []);

  // Verifica se o app está rodando embutido em um iframe (ex: dentro do Xingu Access)
  const isEmbeddedInIframe = useCallback(() => {
    try {
      return window.self !== window.top;
    } catch {
      // Em caso de erro de cross-origin, consideramos que está em iframe
      return true;
    }
  }, []);

  // Detecta iOS
  const isIOS = useCallback(() => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  }, []);

  useEffect(() => {
    // Se está embutido em iframe (ex: dentro do Xingu Access), nunca mostra banner
    if (isEmbeddedInIframe()) {
      console.log('[PWA Install] Executando em iframe (ex: Xingu Access) - não mostrar banner de instalação');
      return;
    }

    // Se já está instalado, não mostra nada
    if (isStandalone()) {
      console.log('[PWA Install] App já está instalado (standalone mode)');
      return;
    }

    // Verifica se foi dispensado recentemente
    if (!isDismissExpired()) {
      console.log('[PWA Install] Prompt dispensado recentemente');
      return;
    }

    // iOS - mostra instruções específicas
    if (isIOS()) {
      console.log('[PWA Install] Detectado iOS, mostrando instruções');
      // Mostra instruções para iOS após 3 segundos
      const timer = setTimeout(() => {
        if (!isStandalone()) {
          setShowIOSInstructions(true);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }

    // Android/Chrome - captura o evento beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      console.log('[PWA Install] beforeinstallprompt capturado');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Mostra o banner após um pequeno delay
      setTimeout(() => setShowInstallBanner(true), 2000);
    };

    // Verifica se o app foi instalado
    const handleAppInstalled = () => {
      console.log('[PWA Install] App instalado com sucesso');
      setShowInstallBanner(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    console.log('[PWA Install] Listeners registrados, aguardando beforeinstallprompt...');

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [isStandalone, isDismissExpired, isIOS, isEmbeddedInIframe]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    setShowIOSInstructions(false);
    setDismissed(true);
    // Salva a data atual para expirar após 7 dias
    localStorage.setItem(INSTALL_DISMISSED_KEY, new Date().toISOString());
  };

  // Banner para Android/Chrome
  if (showInstallBanner && !dismissed) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
        <div className="bg-[#0d2d6c] text-white px-4 py-3 shadow-lg">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <div className="w-12 h-12 bg-[#ffd300] rounded-xl flex items-center justify-center flex-shrink-0">
              <Download size={24} className="text-[#0d2d6c]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Instalar App Frota</p>
              <p className="text-xs text-white/70">Acesse mais rápido direto da sua tela inicial</p>
            </div>
            <button
              onClick={handleInstallClick}
              className="bg-[#ffd300] text-[#0d2d6c] font-semibold px-4 py-2 rounded-lg text-sm hover:bg-[#e6be00] transition-colors"
            >
              Instalar
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Instruções para iOS
  if (showIOSInstructions && !dismissed) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={handleDismiss}>
        <div 
          className="bg-white rounded-t-2xl w-full max-w-md p-6 animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-bold text-[#0d2d6c]">Instalar App Frota</h3>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Fechar"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Para instalar o app no seu iPhone/iPad:
          </p>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-[#0d2d6c] rounded-full flex items-center justify-center text-white text-sm font-bold">
                1
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-700">
                  Toque no botão <Share size={16} className="inline text-[#007AFF]" /> <strong>Compartilhar</strong>
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-[#0d2d6c] rounded-full flex items-center justify-center text-white text-sm font-bold">
                2
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-700">
                  Role e toque em <strong>"Adicionar à Tela de Início"</strong>
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-[#0d2d6c] rounded-full flex items-center justify-center text-white text-sm font-bold">
                3
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-700">
                  Toque em <strong>"Adicionar"</strong> no canto superior direito
                </p>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleDismiss}
            className="w-full mt-5 bg-[#ffd300] text-[#0d2d6c] font-semibold py-3 rounded-xl"
          >
            Entendi
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default InstallPrompt;
