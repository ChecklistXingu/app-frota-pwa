import { useState, useEffect } from "react";
import { WifiOff, CloudUpload, Check } from "lucide-react";
import { isOnline, onOnlineStatusChange, getPendingUploadsCount } from "../../services/offlineStorage";
import { addSyncListener, syncPendingUploads } from "../../services/syncService";

const OfflineIndicator = () => {
  const [online, setOnline] = useState(isOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Monitora status de conexão
    const unsubOnline = onOnlineStatusChange((status) => {
      setOnline(status);
      if (status) {
        // Atualiza contagem quando voltar online
        getPendingUploadsCount().then(setPendingCount);
      }
    });

    // Monitora sincronização
    const unsubSync = addSyncListener((isSyncing, pending) => {
      setSyncing(isSyncing);
      setPendingCount(pending);
      
      // Mostra sucesso quando terminar de sincronizar
      if (!isSyncing && pending === 0) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    });

    // Carrega contagem inicial
    getPendingUploadsCount().then(setPendingCount);

    return () => {
      unsubOnline();
      unsubSync();
    };
  }, []);

  // Não mostra nada se estiver online e sem pendências
  if (online && pendingCount === 0 && !syncing && !showSuccess) {
    return null;
  }

  // Mostra sucesso após sincronização
  if (showSuccess) {
    return (
      <div className="fixed top-14 left-0 right-0 z-40 px-4 py-2 bg-green-500 text-white text-center text-xs flex items-center justify-center gap-2 animate-slide-down">
        <Check size={14} />
        <span>Dados sincronizados com sucesso!</span>
      </div>
    );
  }

  // Mostra sincronização em andamento
  if (syncing) {
    return (
      <div className="fixed top-14 left-0 right-0 z-40 px-4 py-2 bg-blue-500 text-white text-center text-xs flex items-center justify-center gap-2">
        <CloudUpload size={14} className="animate-pulse" />
        <span>Sincronizando {pendingCount} {pendingCount === 1 ? "foto" : "fotos"}...</span>
      </div>
    );
  }

  // Mostra indicador offline
  if (!online) {
    return (
      <div className="fixed top-14 left-0 right-0 z-40 px-4 py-2 bg-orange-500 text-white text-center text-xs flex items-center justify-center gap-2">
        <WifiOff size={14} />
        <span>
          Modo offline
          {pendingCount > 0 && ` • ${pendingCount} ${pendingCount === 1 ? "foto pendente" : "fotos pendentes"}`}
        </span>
      </div>
    );
  }

  // Online mas com pendências (pode acontecer se falhou antes)
  if (pendingCount > 0) {
    return (
      <button
        onClick={() => syncPendingUploads()}
        className="fixed top-14 left-0 right-0 z-40 px-4 py-2 bg-yellow-500 text-white text-center text-xs flex items-center justify-center gap-2 cursor-pointer hover:bg-yellow-600 transition-colors"
      >
        <CloudUpload size={14} />
        <span>
          {pendingCount} {pendingCount === 1 ? "foto" : "fotos"} para sincronizar • Toque para enviar
        </span>
      </button>
    );
  }

  return null;
};

export default OfflineIndicator;
