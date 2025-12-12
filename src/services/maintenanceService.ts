import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase";

export type MaintenanceStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "scheduled"
  | "done";

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
};

export const listenMaintenances = (
  options: { status?: MaintenanceStatus; userId?: string; vehicleId?: string } = {},
  cb: (data: Maintenance[]) => void
) => {
  const col = collection(db, "maintenance");
  const filters = [] as any[];
  if (options.status) filters.push(where("status", "==", options.status));
  if (options.userId) filters.push(where("userId", "==", options.userId));
  if (options.vehicleId) filters.push(where("vehicleId", "==", options.vehicleId));

  const q = query(col, ...filters, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const list: Maintenance[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    cb(list);
  });
};

export const updateMaintenanceStatus = async (
  id: string,
  status: MaintenanceStatus,
  payload: Partial<Maintenance> = {}
) => {
  const ref = doc(db, "maintenance", id);
  await updateDoc(ref, { status, updatedAt: serverTimestamp(), ...payload });
};
