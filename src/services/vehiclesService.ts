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
  createdAt?: any;
};

// Função de deduplicação para ser usada em todo o app
export const deduplicateVehicles = (vehicles: Vehicle[]): Vehicle[] => {
  const vehicleMap = new Map<string, Vehicle>();
  
  vehicles.forEach(vehicle => {
    const existingVehicle = vehicleMap.get(vehicle.plate);
    
    // Se não existe ou se o veículo atual é mais recente
    if (!existingVehicle || 
        (vehicle.createdAt && existingVehicle.createdAt && 
         new Date(vehicle.createdAt).getTime() > new Date(existingVehicle.createdAt).getTime())) {
      vehicleMap.set(vehicle.plate, vehicle);
    }
  });
  
  return Array.from(vehicleMap.values());
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
    // Aplica deduplicação automaticamente
    const uniqueList = deduplicateVehicles(list);
    cb(uniqueList);
  });
};

export const updateVehicle = async (id: string, data: Partial<Vehicle>) => {
  await updateDoc(doc(db, "vehicles", id), data as any);
};
