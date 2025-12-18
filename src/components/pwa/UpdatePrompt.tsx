import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

const UpdatePrompt = () => {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [show, setShow] = useState(false);
  const [hasShown, setHasShown] = useState(false); // Controle para não mostrar múltiplas vezes

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
    if (!waitingWorker) return;

    console.log("[PWA] Enviando SKIP_WAITING");
    
    // Envia a mensagem para o service worker
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    
    // Aguarda um pouco e força o reload
    setTimeout(() => {
      console.log("[PWA] Forçando reload após SKIP_WAITING");
      window.location.reload();
    }, 500);
    
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50">
      <div className="bg-[#0d2d6c] text-white px-4 py-3 shadow">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-[#ffd300] rounded-full flex items-center justify-center">
            <RefreshCw size={20} className="animate-spin text-[#0d2d6c]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Nova versão disponível</p>
            <p className="text-xs opacity-80">Atualize para continuar</p>
          </div>
          <button
            onClick={updateApp}
            className="bg-[#ffd300] text-[#0d2d6c] px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Atualizar
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdatePrompt;
