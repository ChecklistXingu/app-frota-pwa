import { useEffect, useState, useMemo } from 'react';
import { listenVehicles, type Vehicle } from '../services/vehiclesService';

// Hook customizado para fornecer veículos sempre deduplicados
export const useUniqueVehicles = (options?: { userId?: string }) => {
  const [rawVehicles, setRawVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = listenVehicles(options || {}, (vehicles) => {
      setRawVehicles(vehicles);
      setLoading(false);
    });

    return unsub;
  }, [options?.userId]);

  // Aplica deduplicação sempre que os veículos mudam
  const uniqueVehicles = useMemo(() => {
    return deduplicateVehicles(rawVehicles);
  }, [rawVehicles]);

  return { vehicles: uniqueVehicles, loading };
};

// Função de deduplicação que pode ser reutilizada em todo o app
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

// Função para encontrar um veículo específico já deduplicado
export const findVehicleById = (vehicles: Vehicle[], id: string): Vehicle | undefined => {
  const uniqueVehicles = deduplicateVehicles(vehicles);
  return uniqueVehicles.find(v => v.id === id);
};

// Função para encontrar um veículo por placa (já deduplicado)
export const findVehicleByPlate = (vehicles: Vehicle[], plate: string): Vehicle | undefined => {
  const uniqueVehicles = deduplicateVehicles(vehicles);
  return uniqueVehicles.find(v => v.plate === plate);
};
