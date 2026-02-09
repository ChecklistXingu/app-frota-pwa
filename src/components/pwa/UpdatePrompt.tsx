import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRegisterSW } from 'virtual:pwa-register/react';

const UpdatePrompt = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('[PWA] Service Worker registrado:', r);
    },
    onRegisterError(error) {
      console.error('[PWA] Erro ao registrar SW:', error);
    },
  });

  const updateApp = async () => {
    console.log("[PWA] Iniciando atualização...");
    setIsUpdating(true);
    
    try {
      await updateServiceWorker(true);
      console.log('[PWA] Atualização concluída, recarregando...');
    } catch (error) {
      console.error('[PWA] Erro ao atualizar:', error);
      setIsUpdating(false);
    }
  };

  const dismissUpdate = () => {
    console.log('[PWA] Usuário dispensou a atualização');
    setNeedRefresh(false);
  };

  if (!needRefresh) return null;

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
