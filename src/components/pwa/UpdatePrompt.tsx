import { useEffect, useState, useCallback, useRef } from "react";
import { RefreshCw } from "lucide-react";

// Chaves para persistir no localStorage
const SW_UPDATE_DISMISSED_KEY = 'sw_update_dismissed';
const SW_UPDATE_PROCESSING_KEY = 'sw_update_processing';

const UpdatePrompt = () => {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [show, setShow] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const hasProcessedRef = useRef(false); // Evita processamento duplicado

  // Obtém a versão atual do SW (scriptURL como identificador)
  const getCurrentSWVersion = useCallback(() => {
    try {
      if (navigator.serviceWorker.controller) {
        return navigator.serviceWorker.controller.scriptURL;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Verifica se o prompt foi dispensado para esta versão do SW
  const wasUpdateDismissed = useCallback(() => {
    try {
      const dismissedVersion = localStorage.getItem(SW_UPDATE_DISMISSED_KEY);
      const currentVersion = getCurrentSWVersion();
      return dismissedVersion === currentVersion;
    } catch {
      return false;
    }
  }, [getCurrentSWVersion]);

  // Marca que o prompt foi dispensado para esta versão
  const markUpdateDismissed = useCallback(() => {
    try {
      const currentVersion = getCurrentSWVersion();
      if (currentVersion) {
        localStorage.setItem(SW_UPDATE_DISMISSED_KEY, currentVersion);
      }
    } catch {
      // Ignora erros de storage
    }
  }, [getCurrentSWVersion]);

  // Limpa o flag de dismissal (quando uma nova versão é detectada)
  const clearUpdateDismissed = useCallback(() => {
    try {
      localStorage.removeItem(SW_UPDATE_DISMISSED_KEY);
    } catch {
      // Ignora erros de storage
    }
  }, []);

  // Marca que está processando atualização
  const markProcessing = useCallback(() => {
    try {
      localStorage.setItem(SW_UPDATE_PROCESSING_KEY, Date.now().toString());
    } catch {
      // Ignora erros
    }
  }, []);

  // Verifica se está processando recentemente (últimos 10 segundos)
  const isRecentlyProcessing = useCallback(() => {
    try {
      const processingTime = localStorage.getItem(SW_UPDATE_PROCESSING_KEY);
      if (!processingTime) return false;
      
      const elapsed = Date.now() - parseInt(processingTime);
      // Se passou menos de 10 segundos, ainda está processando
      if (elapsed < 10000) {
        return true;
      }
      // Limpa se passou muito tempo
      localStorage.removeItem(SW_UPDATE_PROCESSING_KEY);
      return false;
    } catch {
      return false;
    }
  }, []);

  // Mostra o prompt de atualização
  const showUpdatePrompt = useCallback((worker: ServiceWorker) => {
    // NÃO mostra prompt se estiver offline
    if (!navigator.onLine) {
      console.log('[PWA] Offline - não mostra prompt de atualização');
      return;
    }
    
    if (hasProcessedRef.current || wasUpdateDismissed() || isRecentlyProcessing()) {
      console.log('[PWA] Prompt já processado, dispensado ou em processamento, ignorando');
      return;
    }
    
    hasProcessedRef.current = true;
    console.log('[PWA] Mostrando prompt de atualização');
    setWaitingWorker(worker);
    setShow(true);
  }, [wasUpdateDismissed, isRecentlyProcessing]);

  // Esconde o prompt se ficar offline
  useEffect(() => {
    const handleOffline = () => {
      if (show) {
        console.log('[PWA] Ficou offline - escondendo prompt de atualização');
        setShow(false);
      }
    };

    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, [show]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let isSubscribed = true;

    const checkForWaitingWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        
        if (!registration || !isSubscribed) return;

        // Se há um worker esperando e não foi dispensado
        if (registration.waiting && !wasUpdateDismissed() && !hasProcessedRef.current) {
          console.log('[PWA] Worker encontrado esperando ativação');
          showUpdatePrompt(registration.waiting);
        }

        // Escuta por novas atualizações
        const handleUpdateFound = () => {
          if (!isSubscribed) return;
          
          console.log('[PWA] Nova atualização encontrada');
          const worker = registration.installing;
          
          if (worker) {
            const handleStateChange = () => {
              if (!isSubscribed) return;
              
              console.log('[PWA] Worker state changed to:', worker.state);
              if (worker.state === "installed" && navigator.serviceWorker.controller) {
                // Nova versão instalada - limpa o flag de dismissal
                clearUpdateDismissed();
                hasProcessedRef.current = false;
                showUpdatePrompt(worker);
              }
            };
            
            worker.addEventListener("statechange", handleStateChange);
          }
        };

        registration.addEventListener("updatefound", handleUpdateFound);

        return () => {
          registration.removeEventListener("updatefound", handleUpdateFound);
        };
      } catch (error) {
        console.error('[PWA] Erro ao verificar atualizações:', error);
      }
    };

    // Verifica apenas uma vez na inicialização
    checkForWaitingWorker();

    return () => {
      isSubscribed = false;
    };
  }, [showUpdatePrompt, wasUpdateDismissed, clearUpdateDismissed]);

  const updateApp = async () => {
    if (!waitingWorker) {
      console.log('[PWA] Nenhum worker esperando');
      return;
    }

    console.log("[PWA] Enviando SKIP_WAITING para o worker:", waitingWorker);
    console.log("[PWA] Estado do worker:", waitingWorker.state);
    setIsUpdating(true);
    setShow(false);
    
    // Marca que está processando para evitar mostrar novamente
    markProcessing();
    clearUpdateDismissed();
    
    try {
      // Envia a mensagem para o service worker
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
      console.log('[PWA] Mensagem SKIP_WAITING enviada');
      
      // Aguarda um momento para o SW processar e então recarrega
      setTimeout(() => {
        console.log("[PWA] Forçando reload após SKIP_WAITING");
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('[PWA] Erro ao enviar mensagem:', error);
      localStorage.removeItem(SW_UPDATE_PROCESSING_KEY);
      setIsUpdating(false);
      setShow(true);
    }
  };

  const dismissUpdate = () => {
    console.log('[PWA] Usuário dispensou a atualização');
    markUpdateDismissed();
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50">
      <div className="bg-[#0d2d6c] text-white px-4 py-3 shadow">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-[#ffd300] rounded-full flex items-center justify-center">
            <RefreshCw 
              size={20} 
              className={`text-[#0d2d6c] ${isUpdating ? 'animate-spin' : ''}`} 
            />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Nova versão disponível</p>
            <p className="text-xs opacity-80">
              {isUpdating ? 'Atualizando...' : 'Atualize para continuar'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={dismissUpdate}
              disabled={isUpdating}
              className="px-3 py-2 rounded-lg text-sm font-medium text-white/80 hover:text-white transition-colors"
            >
              Depois
            </button>
            <button
              onClick={updateApp}
              disabled={isUpdating}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isUpdating 
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                  : 'bg-[#ffd300] text-[#0d2d6c] hover:bg-[#e6be00]'
              }`}
            >
              {isUpdating ? 'Atualizando...' : 'Atualizar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdatePrompt;
