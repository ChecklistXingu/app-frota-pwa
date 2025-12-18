import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

const UpdatePrompt = () => {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [show, setShow] = useState(false);
  const [hasShown, setHasShown] = useState(false); // Controle para não mostrar múltiplas vezes
  const [isUpdating, setIsUpdating] = useState(false); // Controle para animação

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onControllerChange = () => {
      console.log("[PWA] Novo Service Worker ativo, recarregando...");
      window.location.reload();
    };

    const onMessage = (event: MessageEvent) => {
      console.log('[PWA] Mensagem do SW:', event.data);
      if (event.data?.type === 'SKIP_WAITING_COMPLETE') {
        console.log('[PWA] SW confirmou atualização, recarregando...');
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    navigator.serviceWorker.addEventListener("message", onMessage);

    const checkForUpdates = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        
        if (!registration) return;

        // Verifica se já tem um worker esperando
        if (registration.waiting && !hasShown) {
          console.log('[PWA] Worker encontrado esperando ativação');
          setWaitingWorker(registration.waiting);
          setShow(true);
          setHasShown(true); // Marca que já mostrou
        }

        // Força verificação de atualizações
        await registration.update();

        // Escuta por novas atualizações
        registration.addEventListener("updatefound", () => {
          console.log('[PWA] Nova atualização encontrada');
          const worker = registration.installing;
          
          if (worker) {
            worker.addEventListener("statechange", () => {
              console.log('[PWA] Worker state changed to:', worker.state);
              if (worker.state === "installed" && navigator.serviceWorker.controller && !hasShown) {
                console.log('[PWA] Novo worker instalado, mostrando prompt');
                setWaitingWorker(worker);
                setShow(true);
                setHasShown(true); // Marca que já mostrou
              }
            });
          }
        });
      } catch (error) {
        console.error('[PWA] Erro ao verificar atualizações:', error);
      }
    };

    // Verifica atualizações na inicialização
    checkForUpdates();

    // Verifica atualizações periodicamente (reduzido para 30 minutos para não sobrecarregar)
    const interval = setInterval(checkForUpdates, 30 * 60 * 1000); // 30 minutos

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      navigator.serviceWorker.removeEventListener("message", onMessage);
      clearInterval(interval);
    };
  }, []);

  const updateApp = async () => {
    if (!waitingWorker) {
      console.log('[PWA] Nenhum worker esperando');
      return;
    }

    console.log("[PWA] Enviando SKIP_WAITING para o worker:", waitingWorker);
    console.log("[PWA] Estado do worker:", waitingWorker.state);
    setIsUpdating(true); // Inicia a animação
    
    // Adiciona listener para resposta
    const handleMessage = (event: MessageEvent) => {
      console.log('[PWA] Mensagem recebida do worker:', event.data);
      if (event.data?.type === 'SKIP_WAITING_COMPLETE') {
        console.log('[PWA] Worker confirmou, recarregando...');
        window.location.reload();
      }
    };
    
    navigator.serviceWorker.addEventListener('message', handleMessage);
    
    try {
      // Envia a mensagem para o service worker
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
      console.log('[PWA] Mensagem enviada com sucesso');
    } catch (error) {
      console.error('[PWA] Erro ao enviar mensagem:', error);
      setIsUpdating(false);
    }
    
    // Timeout de segurança caso o worker não responda
    setTimeout(() => {
      console.log("[PWA] Timeout - forçando reload");
      window.location.reload();
    }, 2000); // 2 segundos de timeout
    
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
  );
};

export default UpdatePrompt;
