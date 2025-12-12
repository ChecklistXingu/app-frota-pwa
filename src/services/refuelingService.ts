import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "./firebase";

export type Refueling = {
  id: string;
  userId: string;
  vehicleId: string;
  km: number;
  liters: number;
  value: number;
  date?: any;
  notes?: string;
  photoUrl?: string;
};

export const getRefuelingTimestamp = (value: any): number => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") {
    const nanos = typeof value.nanoseconds === "number" ? value.nanoseconds / 1_000_000 : 0;
    return value.seconds * 1000 + nanos;
  }
  if (value instanceof Date) return value.getTime();

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

export const listenRefuelings = (
  cb: (data: Refueling[]) => void
) => {
  const col = collection(db, "refueling");
  const q = query(col, orderBy("date", "desc"));

  return onSnapshot(q, (snap) => {
    const list: Refueling[] = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .sort((a, b) => getRefuelingTimestamp(b.date) - getRefuelingTimestamp(a.date));

    cb(list);
  });
};
