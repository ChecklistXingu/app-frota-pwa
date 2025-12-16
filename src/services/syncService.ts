/**
 * Serviço de sincronização
 * Processa uploads pendentes quando a conexão volta
 */

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
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
  fileBlob?: Blob;
  photoBlob?: Blob; // fallback para compatibilidade
  fileName: string;
  documentId: string;
  field?: string;
  contentType?: string;
  extraData?: Record<string, any>;
}): Promise<boolean> => {
  try {
    console.log("[Sync] Processando upload:", upload.id);

    // Faz upload para o Storage
    const path = `${upload.type}/${upload.userId}/${upload.fileName}`;
    const storageRef = ref(storage, path);
    const blob = upload.fileBlob || upload.photoBlob;
    if (!blob) {
      console.error("[Sync] Upload sem blob:", upload.id);
      await removePendingUpload(upload.id);
      return false;
    }

    await uploadBytes(storageRef, blob, {
      contentType: upload.contentType || blob.type || "application/octet-stream",
    });

    // Obtém URL de download
    const downloadUrl = await getDownloadURL(storageRef);
    console.log("[Sync] Upload concluído, URL:", downloadUrl);

    // Atualiza o documento no Firestore com a nova URL
    const docRef = doc(db, upload.type, upload.documentId);
    const field = upload.field || "photos";
      if (field === "photos") {
      await updateDoc(docRef, {
        photos: arrayUnion(downloadUrl),
        ...(upload.extraData || {}),
      });
    } else {
      // Para uploads que não são 'photos', aplicamos atualizações de forma segura.
      const extra = upload.extraData || {};

      // Caso haja necessidade de aplicar arrayUnion no histórico de áudios
      const audioHistoryUnion = extra.audioHistoryUnion;
      const audioEvent = extra.audioEvent;

      // Remove chave especial para não sobrescrever diretamente
      if (audioHistoryUnion) {
        const { audioHistoryUnion: _, audioEvent: _ev, ...rest } = extra as any;
        // Atualiza o campo principal (ex: audioUrl = downloadUrl) e demais dados
        await updateDoc(docRef, {
          [field]: downloadUrl,
          ...(rest || {}),
        } as any);

        // Adiciona o item antigo ao array de histórico
        await updateDoc(docRef, {
          audioHistory: arrayUnion(audioHistoryUnion),
        });

        // Se houver metadados do evento de áudio no item pendente, adiciona ao histórico de eventos
        if (audioEvent) {
          await updateDoc(docRef, {
            audioEvents: arrayUnion({ url: downloadUrl, uploadedBy: audioEvent.uploadedBy, duration: audioEvent.duration, at: serverTimestamp() }),
          });
        }
      } else {
        await updateDoc(docRef, {
          [field]: downloadUrl,
          ...(extra || {}),
        } as any);

        if (audioEvent) {
          await updateDoc(docRef, {
            audioEvents: arrayUnion({ url: downloadUrl, uploadedBy: audioEvent.uploadedBy, duration: audioEvent.duration, at: serverTimestamp() }),
          });
        }
      }
    }

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
