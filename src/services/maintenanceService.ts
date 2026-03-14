import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "./firebase";

export type MaintenanceStatus = "pending" | "in_review" | "scheduled" | "done";

export type DirectorApprovalStatus = "pending" | "approved" | "rejected";

export type DirectorApprovalItem = {
  name: string;
  cost?: number;
  quantity?: number;
  unitCost?: number;
};

export type DirectorApprovalAttachment = {
  name: string;
  url: string;
  size?: number;
  contentType?: string;
  storagePath?: string;
  uploadedBy?: string;
  uploadedAt?: any;
  shortUrl?: string;
  slug?: string;
};

export type DirectorApproval = {
  status: DirectorApprovalStatus;
  requestedBy?: string;
  requestedAt?: any;
  responseBy?: string;
  responseAt?: any;
  targetPhone?: string | null;
  vendor?: string;
  workshopLocation?: string;
  laborCost?: number;
  items?: DirectorApprovalItem[];
  total?: number;
  notes?: string;
  deliveryMethod?: "manual" | "zapi";
  messageId?: string;
  lastMessageSentAt?: any;
  attachments?: DirectorApprovalAttachment[];
};

export const normalizeMaintenanceStatus = (status?: string): MaintenanceStatus => {
  const map: Record<string, MaintenanceStatus> = {
    pending: "pending",
    in_progress: "in_review",
    in_review: "in_review",
    approved: "in_review",
    rejected: "in_review",
    scheduled: "scheduled",
    completed: "done",
    done: "done",
  };
  return map[status || "pending"] ?? "pending";
};

export type StatusHistoryItem = {
  status: MaintenanceStatus;
  at: any; // Pode ser Date, Timestamp ou string
  by?: string;
  note?: string;
};

export type MaintenanceItem = {
  name: string;
  status?: boolean;
  cost?: number;
  quantity?: number;
  unitCost?: number;
  description?: string;
};

export type Maintenance = {
  id: string;
  userId: string;
  vehicleId: string;
  description?: string;
  items?: MaintenanceItem[];
  status: MaintenanceStatus;
  photos?: string[];
  audioUrl?: string;
  audioDurationSeconds?: number;
  createdAt?: any;
  updatedAt?: any;
  managerId?: string;
  managerNote?: string;
  analysisStartedAt?: any;
  completedAt?: any;
  workshopName?: string;
  workshopId?: string;
  scheduledFor?: any;
  forecastedCompletion?: any;
  forecastedCost?: number;
  finalCost?: number;
  laborCost?: number;
  partsCost?: number;
  km?: number;
  statusHistory?: StatusHistoryItem[];
  isMigrated?: boolean; // Flag para indicar dados migrados
  directorApproval?: DirectorApproval;
};

export const listenMaintenances = (
  options: { status?: MaintenanceStatus; userId?: string; vehicleId?: string } = {},
  cb: (data: Maintenance[]) => void
) => {
  console.log("🔍 listenMaintenances called with options:", options);
  
  const col = collection(db, "maintenance");
  
  // TEMPORÁRIO: Sem orderBy para evitar erro de índice
  const q = query(col);
  
  console.log("📝 Query created:", q);
  
  return onSnapshot(q, (snap) => {
    console.log("📸 Snapshot received:", snap.size, "documents");
    
    const list: Maintenance[] = snap.docs.map((d) => {
      const data = d.data() as any;
      console.log("📄 Document:", d.id, "Data:", data);
      
      // Verifica se o documento tem os campos necessários
      if (!data.status) {
        console.warn("⚠️ Document without status:", d.id);
      }
      if (!data.userId) {
        console.warn("⚠️ Document without userId:", d.id);
      }
      if (!data.vehicleId) {
        console.warn("⚠️ Document without vehicleId:", d.id);
      }
      
      return { id: d.id, ...data, status: normalizeMaintenanceStatus(data.status) };
    });
    
    // Ordena localmente por createdAt
    list.sort((a, b) => {
      const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
      const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
      return timeB - timeA;
    });
    
    console.log("🔧 Maintenance service - Processed list:", list.length, "items");
    cb(list);
  }, (error) => {
    console.error("❌ Firestore error:", error);
  });
};

export const updateMaintenanceStatus = async (
  id: string,
  status: MaintenanceStatus,
  payload: Partial<Maintenance> = {}
) => {
  const ref = doc(db, "maintenance", id);
  const snap = await getDoc(ref);
  const data = snap.exists() ? (snap.data() as any) : {};

  const updates: Partial<Maintenance> & { status: MaintenanceStatus; updatedAt: any } = {
    status,
    updatedAt: serverTimestamp(),
    ...payload,
  };

  const currentStatus = normalizeMaintenanceStatus(data.status);

  if (!data.analysisStartedAt && (status === "in_review" || status === "scheduled")) {
    updates.analysisStartedAt = serverTimestamp();
  }

  if (!payload.completedAt && !data.completedAt && status === "done" && currentStatus !== "done") {
    updates.completedAt = serverTimestamp();
  }

  // Aplica atualização de status e registra histórico de alterações
  // Inclui um registro em statusHistory com carimbo de tempo e autor (se disponível em payload)
  const by = (payload as any).managerId || (payload as any).userId || null;
  try {
    // Atualiza os campos principais e o histórico em uma única operação
    await updateDoc(ref, { 
      ...updates,
      // Adiciona o histórico de status diretamente na mesma atualização
      statusHistory: arrayUnion({ 
        status, 
        by, 
        at: new Date().toISOString() // Usa o timestamp local
      })
    } as any);
    console.log(`✅ Manutenção ${id} atualizada para status ${status} por ${by}`);
    return true;
  } catch (err) {
    console.error(`❌ Falha ao atualizar manutenção ${id} para ${status}:`, err);
    throw err;
  }
};
