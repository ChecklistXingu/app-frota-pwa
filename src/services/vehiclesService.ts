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
    // Normaliza a placa para maiúsculas para comparação
    const normalizedPlate = vehicle.plate.toUpperCase();
    const existingVehicle = vehicleMap.get(normalizedPlate);
    
    // Se não existe ou se o veículo atual é mais recente
    if (!existingVehicle || 
        (vehicle.createdAt && existingVehicle.createdAt && 
         new Date(vehicle.createdAt).getTime() > new Date(existingVehicle.createdAt).getTime())) {
      vehicleMap.set(normalizedPlate, vehicle);
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

// Nova função para buscar TODOS os veículos sem deduplicação
export const listenAllVehicles = (
  options: { userId?: string } = {},
  cb: (data: Vehicle[]) => void
) => {
  const col = collection(db, "vehicles");
  const filters = [] as any[];
  if (options.userId) filters.push(where("userId", "==", options.userId));
  const q = query(col, ...filters, orderBy("plate", "asc"));
  return onSnapshot(q, (snap) => {
    const list: Vehicle[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    // Retorna lista COM duplicatas para análise no painel de usuários
    cb(list);
  });
};

export const updateVehicle = async (id: string, data: Partial<Vehicle>) => {
  await updateDoc(doc(db, "vehicles", id), data as any);
};
