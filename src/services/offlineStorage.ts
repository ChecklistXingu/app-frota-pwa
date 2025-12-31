/**
 * Serviço de armazenamento offline usando IndexedDB
 * Armazena fotos e registros pendentes para sincronização quando voltar a rede
 */

const DB_NAME = "app-frota-offline";
const DB_VERSION = 1;

// Stores
const PENDING_UPLOADS_STORE = "pending-uploads";
const OFFLINE_PHOTOS_STORE = "offline-photos";

interface PendingUpload {
  id: string;
  type: "maintenance" | "refueling" | "vehicle";
  userId: string;
  fileBlob: Blob;
  fileName: string;
  documentId: string; // ID do documento no Firestore que precisa ser atualizado
  field: string;
  contentType?: string;
  extraData?: Record<string, any>;
  createdAt: number;
}

interface OfflinePhoto {
  id: string;
  blob: Blob;
  previewUrl: string;
}

let dbInstance: IDBDatabase | null = null;

// Abre ou cria o banco de dados
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("[OfflineDB] Erro ao abrir banco:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store para uploads pendentes
      if (!db.objectStoreNames.contains(PENDING_UPLOADS_STORE)) {
        const store = db.createObjectStore(PENDING_UPLOADS_STORE, { keyPath: "id" });
        store.createIndex("type", "type", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }

      // Store para fotos offline (temporárias antes de salvar)
      if (!db.objectStoreNames.contains(OFFLINE_PHOTOS_STORE)) {
        db.createObjectStore(OFFLINE_PHOTOS_STORE, { keyPath: "id" });
      }
    };
  });
};

// ============================================
// FOTOS PENDENTES DE UPLOAD
// ============================================

export const savePendingUpload = async (
  upload: Omit<PendingUpload, "id" | "createdAt">
): Promise<string> => {
  const db = await openDB();
  const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const record: PendingUpload = {
    ...upload,
    id,
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_UPLOADS_STORE, "readwrite");
    const store = tx.objectStore(PENDING_UPLOADS_STORE);
    const request = store.add(record);

    request.onsuccess = () => {
      console.log("[OfflineDB] Upload pendente salvo:", id);
      // Notificar o Hub sobre nova pendência
      if (typeof window !== 'undefined' && window.parent !== window) {
        try {
          window.parent.postMessage({ type: 'FROTA_SYNC_PENDING' }, '*');
        } catch (e) {
          console.warn('[OfflineDB] Falha ao enviar postMessage para o Hub:', e);
        }
      }
      resolve(id);
    };
    request.onerror = () => reject(request.error);
  });
};

export const getPendingUploads = async (): Promise<PendingUpload[]> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_UPLOADS_STORE, "readonly");
    const store = tx.objectStore(PENDING_UPLOADS_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const removePendingUpload = async (id: string): Promise<void> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_UPLOADS_STORE, "readwrite");
    const store = tx.objectStore(PENDING_UPLOADS_STORE);
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log("[OfflineDB] Upload pendente removido:", id);
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
};

export const getPendingUploadsCount = async (): Promise<number> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_UPLOADS_STORE, "readonly");
    const store = tx.objectStore(PENDING_UPLOADS_STORE);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// ============================================
// FOTOS OFFLINE TEMPORÁRIAS
// ============================================

export const saveOfflinePhoto = async (file: File): Promise<OfflinePhoto> => {
  const db = await openDB();
  const id = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Converte File para Blob
  const blob = new Blob([await file.arrayBuffer()], { type: file.type });
  const previewUrl = URL.createObjectURL(blob);

  const record: OfflinePhoto = {
    id,
    blob,
    previewUrl,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_PHOTOS_STORE, "readwrite");
    const store = tx.objectStore(OFFLINE_PHOTOS_STORE);
    const request = store.add(record);

    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
};

export const getOfflinePhoto = async (id: string): Promise<OfflinePhoto | null> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_PHOTOS_STORE, "readonly");
    const store = tx.objectStore(OFFLINE_PHOTOS_STORE);
    const request = store.get(id);

    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        // Recria o URL do blob
        result.previewUrl = URL.createObjectURL(result.blob);
      }
      resolve(result || null);
    };
    request.onerror = () => reject(request.error);
  });
};

export const removeOfflinePhoto = async (id: string): Promise<void> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_PHOTOS_STORE, "readwrite");
    const store = tx.objectStore(OFFLINE_PHOTOS_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// ============================================
// UTILIDADES
// ============================================

export const isOnline = (): boolean => {
  return navigator.onLine;
};

export const onOnlineStatusChange = (callback: (online: boolean) => void): (() => void) => {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
};
