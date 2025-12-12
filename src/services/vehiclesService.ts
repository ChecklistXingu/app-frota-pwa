import { collection, doc, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase";

export type Vehicle = {
  id: string;
  userId: string;
  plate: string;
  model?: string;
  brand?: string;
  year?: number;
  active?: boolean;
};

export const listenVehicles = (
  options: { userId?: string } = {},
  cb: (data: Vehicle[]) => void
) => {
  const col = collection(db, "vehicles");
  const filters = [] as any[];
  if (options.userId) filters.push(where("userId", "==", options.userId));
  const q = query(col, ...filters, orderBy("plate", "asc"));
  return onSnapshot(q, (snap) => {
    const list: Vehicle[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    cb(list);
  });
};

export const updateVehicle = async (id: string, data: Partial<Vehicle>) => {
  await updateDoc(doc(db, "vehicles", id), data as any);
};
