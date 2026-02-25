import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./firebase";
import type { DirectorApprovalAttachment } from "./maintenanceService";

const ATTACHMENT_ROOT = "director-approvals";

export type AttachmentUploadResult = DirectorApprovalAttachment;

const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9_.-]/g, "_");

export const uploadApprovalAttachment = async (
  file: File,
  maintenanceId: string,
  options?: { uploadedBy?: string }
): Promise<AttachmentUploadResult> => {
  const safeName = sanitizeFileName(file.name || "arquivo");
  const timestamp = Date.now();
  const storagePath = `${ATTACHMENT_ROOT}/${maintenanceId}/${timestamp}_${safeName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, {
    contentType: file.type || "application/octet-stream",
  });

  const url = await getDownloadURL(storageRef);

  return {
    name: file.name || safeName,
    size: file.size,
    url,
    contentType: file.type || "application/octet-stream",
    storagePath,
    uploadedAt: new Date().toISOString(),
    uploadedBy: options?.uploadedBy,
  };
};

export const deleteApprovalAttachment = async (storagePath: string) => {
  if (!storagePath) return;
  const storageRef = ref(storage, storagePath);
  try {
    await deleteObject(storageRef);
  } catch (error) {
    console.warn("[Attachments] Erro ao remover arquivo do storage", error);
  }
};
