import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "./firebase";

export type AppUser = {
  id: string;
  name: string;
  phone?: string;
  filial?: string;
  role?: "driver" | "admin";
};

export const listenUsers = (cb: (data: AppUser[]) => void) => {
  const q = query(collection(db, "users"), orderBy("name", "asc"));
  return onSnapshot(q, (snap) => {
    const list: AppUser[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    cb(list);
  });
};
