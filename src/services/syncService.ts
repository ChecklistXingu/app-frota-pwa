/**
 * Serviço de sincronização
 * Processa uploads pendentes quando a conexão volta
 */

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { storage, db } from "./firebase";
import {
  getPendingUploads,
  removePendingUpload,
  isOnline,
  onOnlineStatusChange,
} from "./offlineStorage";

let isSyncing = false;
let syncListeners: ((syncing: boolean, pending: number) => void)[] = [];

// Notifica listeners sobre mudança de status
const notifyListeners = (syncing: boolean, pending: number) => {
  syncListeners.forEach((listener) => listener(syncing, pending));
};

// Adiciona listener para status de sincronização
export const addSyncListener = (
  listener: (syncing: boolean, pending: number) => void
): (() => void) => {
  syncListeners.push(listener);
  return () => {
    syncListeners = syncListeners.filter((l) => l !== listener);
  };
};

// Processa um único upload pendente
const processUpload = async (upload: {
  id: string;
  type: string;
  userId: string;
  photoBlob: Blob;
  fileName: string;
  documentId: string;
}): Promise<boolean> => {
  try {
    console.log("[Sync] Processando upload:", upload.id);

    // Faz upload para o Storage
    const path = `${upload.type}/${upload.userId}/${upload.fileName}`;
    const storageRef = ref(storage, path);
    
    await uploadBytes(storageRef, upload.photoBlob, {
      contentType: upload.photoBlob.type || "image/jpeg",
    });

    // Obtém URL de download
    const downloadUrl = await getDownloadURL(storageRef);
    console.log("[Sync] Upload concluído, URL:", downloadUrl);

    // Atualiza o documento no Firestore com a nova URL
    const docRef = doc(db, upload.type, upload.documentId);
    await updateDoc(docRef, {
      photos: arrayUnion(downloadUrl),
    });

    console.log("[Sync] Documento atualizado:", upload.documentId);

    // Remove da fila de pendentes
    await removePendingUpload(upload.id);

    return true;
  } catch (error) {
    console.error("[Sync] Erro ao processar upload:", upload.id, error);
    return false;
  }
};

// Sincroniza todos os uploads pendentes
export const syncPendingUploads = async (): Promise<{
  success: number;
  failed: number;
}> => {
  if (isSyncing) {
    console.log("[Sync] Sincronização já em andamento");
    return { success: 0, failed: 0 };
  }

  if (!isOnline()) {
    console.log("[Sync] Sem conexão, sincronização adiada");
    return { success: 0, failed: 0 };
  }

  isSyncing = true;
  let success = 0;
  let failed = 0;

  try {
    const pendingUploads = await getPendingUploads();
    console.log("[Sync] Uploads pendentes:", pendingUploads.length);

    notifyListeners(true, pendingUploads.length);

    for (const upload of pendingUploads) {
      const result = await processUpload(upload);
      if (result) {
        success++;
      } else {
        failed++;
      }
      
      // Atualiza contagem
      notifyListeners(true, pendingUploads.length - success - failed);
    }

    console.log(`[Sync] Concluído: ${success} sucesso, ${failed} falhas`);
  } catch (error) {
    console.error("[Sync] Erro na sincronização:", error);
  } finally {
    isSyncing = false;
    notifyListeners(false, failed);
  }

  return { success, failed };
};

// Inicia monitoramento automático de conexão
export const startAutoSync = (): (() => void) => {
  console.log("[Sync] Iniciando auto-sync");

  // Sincroniza ao iniciar se estiver online
  if (isOnline()) {
    syncPendingUploads();
  }

  // Sincroniza quando a conexão voltar
  const unsubscribe = onOnlineStatusChange((online) => {
    if (online) {
      console.log("[Sync] Conexão restaurada, iniciando sincronização...");
      syncPendingUploads();
    }
  });

  return unsubscribe;
};

// Verifica se há uploads pendentes
export const hasPendingUploads = async (): Promise<boolean> => {
  const uploads = await getPendingUploads();
  return uploads.length > 0;
};
