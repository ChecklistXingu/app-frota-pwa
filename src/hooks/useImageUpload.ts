import { useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../services/firebase";

interface UploadResult {
  url: string;
  path: string;
}

export const useImageUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /**
   * Faz upload de uma imagem para o Firebase Storage
   * @param file - Arquivo da imagem
   * @param folder - Pasta onde salvar (ex: "maintenance", "vehicles")
   * @param userId - ID do usuário
   * @returns URL da imagem e caminho no storage
   */
  const uploadImage = async (
    file: File,
    folder: string,
    userId: string
  ): Promise<UploadResult | null> => {
    if (!file) return null;

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      // Gera nome único: pasta/userId/timestamp_nomeoriginal
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
      const path = `${folder}/${userId}/${timestamp}_${safeName}`;
      
      const storageRef = ref(storage, path);
      
      // Upload simples (para arquivos pequenos como fotos de celular)
      await uploadBytes(storageRef, file);
      setProgress(100);
      
      // Obtém URL pública
      const url = await getDownloadURL(storageRef);
      
      setUploading(false);
      return { url, path };
    } catch (err: any) {
      console.error("Erro no upload:", err);
      setError(err.message || "Erro ao enviar imagem");
      setUploading(false);
      return null;
    }
  };

  /**
   * Comprime e faz upload de uma imagem (reduz tamanho antes de enviar)
   */
  const uploadCompressedImage = async (
    file: File,
    folder: string,
    userId: string,
    maxWidth = 1200
  ): Promise<UploadResult | null> => {
    try {
      const compressed = await compressImage(file, maxWidth);
      return uploadImage(compressed, folder, userId);
    } catch {
      return uploadImage(file, folder, userId);
    }
  };

  return {
    uploadImage,
    uploadCompressedImage,
    uploading,
    progress,
    error,
  };
};

/**
 * Comprime uma imagem reduzindo suas dimensões
 */
const compressImage = (file: File, maxWidth: number): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      
      let width = img.width;
      let height = img.height;
      
      // Redimensiona mantendo proporção
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas não suportado"));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: "image/jpeg" }));
          } else {
            reject(new Error("Erro ao comprimir"));
          }
        },
        "image/jpeg",
        0.8 // qualidade 80%
      );
    };
    
    img.onerror = () => reject(new Error("Erro ao carregar imagem"));
    img.src = URL.createObjectURL(file);
  });
};
