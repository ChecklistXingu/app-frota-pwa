import { collection, onSnapshot, query } from "firebase/firestore";
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

export const listenRefuelings = (
  cb: (data: Refueling[]) => void
) => {
  const col = collection(db, "refueling");
  const q = query(col);
  
  return onSnapshot(q, (snap) => {
    const list: Refueling[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    
    // Ordena localmente por data
    list.sort((a, b) => {
      const timeA = a.date?.seconds ? a.date.seconds * 1000 : 0;
      const timeB = b.date?.seconds ? b.date.seconds * 1000 : 0;
      return timeB - timeA;
    });
    
    cb(list);
  });
};
