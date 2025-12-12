import { useState, useEffect } from "react";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Verifica se já foi instalado ou dispensado
    const isInstalled = window.matchMedia("(display-mode: standalone)").matches;
    const wasDismissed = localStorage.getItem("pwa-install-dismissed");
    
    if (isInstalled || wasDismissed) {
      return;
    }

    // Detecta iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInStandaloneMode = window.matchMedia("(display-mode: standalone)").matches;

    if (isIOS && !isInStandaloneMode) {
      // Mostra instruções para iOS após 2 segundos
      setTimeout(() => setShowIOSInstructions(true), 2000);
      return;
    }

    // Android/Chrome - captura o evento beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

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
    localStorage.setItem("pwa-install-dismissed", "true");
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
