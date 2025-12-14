import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";

const UpdatePrompt = () => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleUpdate = async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration) {
        // Verifica se já tem um worker esperando
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowUpdate(true);
        }

        // Escuta por novas atualizações
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
                setShowUpdate(true);
              }
            });
          }
        });
      }
    };

    handleUpdate();

    // Verifica atualizações a cada 60 segundos
    const interval = setInterval(() => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.update();
      });
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      // Envia mensagem para o SW ativar imediatamente (suporta string ou obj)
      try {
        waitingWorker.postMessage('SKIP_WAITING')
      } catch (e) {
        // fallback to object shape
        waitingWorker.postMessage({ type: 'SKIP_WAITING' })
      }
    }
    
    // Recarrega a página
    window.location.reload();
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-slide-down">
      <div className="bg-[#0d2d6c] text-white px-4 py-3 shadow-lg">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-[#ffd300] rounded-full flex items-center justify-center flex-shrink-0">
            <RefreshCw size={20} className="text-[#0d2d6c]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Nova versão disponível!</p>
            <p className="text-xs text-white/70">Clique para atualizar o app</p>
          </div>
          <button
            onClick={handleUpdate}
            className="bg-[#ffd300] text-[#0d2d6c] font-semibold px-4 py-2 rounded-lg text-sm hover:bg-[#e6be00] transition-colors"
          >
            Atualizar
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdatePrompt;
