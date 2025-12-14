import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { updateVehicle } from "./vehiclesService";

export type MaintenanceStatus = "pending" | "in_review" | "scheduled" | "done";

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

export type Maintenance = {
  id: string;
  userId: string;
  vehicleId: string;
  description?: string;
  items?: Array<{ name: string; status?: boolean }>;
  status: MaintenanceStatus;
  photos?: string[];
  createdAt?: any;
  updatedAt?: any;
  managerId?: string;
  managerNote?: string;
  assignedAt?: any;
  scheduledAt?: any;
  closedAt?: any;
  workshop?: string;
  statusHistory?: Array<{ status: string; timestamp?: any; userId?: string; note?: string }>;
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
  options: { managerId?: string; note?: string; scheduledAt?: any; workshop?: string } = {},
  payload: Partial<Maintenance> = {}
) => {
  const ref = doc(db, "maintenance", id);

  // Build update object
  const updates: any = { status, updatedAt: serverTimestamp(), ...payload };

  // Set timestamps depending on status
  if (status === "in_review") {
    updates.assignedAt = serverTimestamp();
  }
  if (status === "scheduled") {
    updates.scheduledAt = options.scheduledAt ?? serverTimestamp();
    updates.assignedAt = updates.assignedAt ?? serverTimestamp();
  }
  if (status === "done") {
    updates.closedAt = serverTimestamp();
  }

  if (options.workshop) updates.workshop = options.workshop;
  if (options.managerId) updates.managerId = options.managerId;
  if (options.note) updates.managerNote = options.note;

  // Push to statusHistory
  updates.statusHistory = arrayUnion({ status, timestamp: serverTimestamp(), userId: options.managerId, note: options.note });

  await updateDoc(ref, updates);

  // Try to update vehicle status for visibility in the vehicles list
  try {
    const snap = await getDoc(ref);
    const data = snap.data() as any;
    const vehicleId = data?.vehicleId;
    if (vehicleId) {
        if (status === "in_review" || status === "scheduled") {
          updateVehicle(vehicleId, { status: "in_maintenance" } as any).catch(() => {});
        } else if (status === "done") {
          updateVehicle(vehicleId, { status: "operational" } as any).catch(() => {});
      }
    }
  } catch (e) {
    console.warn("Could not update vehicle status", e);
  }
};

export const openMaintenanceTicket = async (
  id: string,
  managerId?: string,
  opts: { scheduledAt?: any; workshop?: string; note?: string } = {}
) => {
  const statusToSet: MaintenanceStatus = opts.scheduledAt ? "scheduled" : "in_review";
  return updateMaintenanceStatus(id, statusToSet, { managerId, scheduledAt: opts.scheduledAt, workshop: opts.workshop, note: opts.note });
};
