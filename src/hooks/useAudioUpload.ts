import { useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../services/firebase";
import { isOnline, savePendingUpload } from "../services/offlineStorage";

type CollectionFolder = "maintenance" | "refueling" | "vehicle";

export interface FileUploadResult {
  url: string;
  path: string;
  isOffline?: boolean;
}

export const useAudioUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadAudio = async (
    blob: Blob | null,
    folder: CollectionFolder,
    userId: string,
    documentId: string,
    options?: {
      extraData?: Record<string, any>;
    }
  ): Promise<FileUploadResult | null> => {
    if (!blob) return null;

    setUploading(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const extension = blob.type?.split("/")[1] || "webm";
      const fileName = `${timestamp}_relato.${extension}`;
      const contentType = blob.type || "audio/webm";
      const storagePath = `${folder}/${userId}/${fileName}`;
      const storageRef = ref(storage, storagePath);

      if (isOnline()) {
        await uploadBytes(storageRef, blob, { contentType });
        const url = await getDownloadURL(storageRef);
        setUploading(false);
        return { url, path: storagePath };
      }

      await savePendingUpload({
        type: folder,
        userId,
        fileBlob: blob,
        fileName,
        documentId,
        field: "audioUrl",
        contentType,
        extraData: options?.extraData,
      });

      setUploading(false);
      const tempUrl = URL.createObjectURL(blob);
      return { url: tempUrl, path: storagePath, isOffline: true };
    } catch (err: any) {
      console.error("Erro no upload de áudio", err);
      setError(err?.message || "Erro ao enviar áudio");
      setUploading(false);
      return null;
    }
  };

  return { uploadAudio, uploading, error };
};
