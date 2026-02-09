import type { DashboardData, DashboardFilters } from '../pages/Admin/dashboard/types/dashboard.types';
import type { Maintenance } from '../services/maintenanceService';

export interface VehicleConsumption {
  vehicle: string;
  plate: string;
  fuelLiters: number;
  maintenanceCount: number;
  totalCost: number;
  branch: string;
}

export interface TopConsumptionByBranch {
  branch: string;
  topVehicles: VehicleConsumption[];
}

export const calculateTopConsumptionByBranch = (
  data: DashboardData,
  filters: DashboardFilters
): TopConsumptionByBranch[] => {
  const branches = ['Água Boa', 'Querência', 'Canarana', 'Confresa'];
  
  return branches.map(branch => {
    // Filtrar dados pela loja (se não for "all")
    const branchFilter = filters.branch === 'all' || filters.branch === branch;
    
    if (!branchFilter) {
      return {
        branch,
        topVehicles: []
      };
    }

    // Agrupar consumo por veículo
    const vehicleMap = new Map<string, VehicleConsumption>();

    // Obter informações dos veículos e mapear por usuário para obter a filial
    const vehicleInfoMap = new Map<string, { model?: string; plate?: string }>();
    const userBranchMap = new Map<string, string>();
    
    // Mapear usuários para filiais
    data.users.forEach(user => {
      if (user.filial) {
        userBranchMap.set(user.id, user.filial);
      }
    });
    
    // Mapear veículos
    data.vehicles.forEach(vehicle => {
      vehicleInfoMap.set(vehicle.id, {
        model: vehicle.model,
        plate: vehicle.plate
      });
    });

    // Processar manutenções
    data.maintenances.forEach((maintenance: Maintenance) => {
      const vehicleInfo = vehicleInfoMap.get(maintenance.vehicleId);
      const userBranch = userBranchMap.get(maintenance.userId);
      
      if (!vehicleInfo || userBranch !== branch) return;
      
      const key = maintenance.vehicleId;
      const existing = vehicleMap.get(key) || {
        vehicle: vehicleInfo.model || 'Veículo',
        plate: vehicleInfo.plate || '',
        fuelLiters: 0,
        maintenanceCount: 0,
        totalCost: 0,
        branch
      };

      existing.maintenanceCount += 1;
      existing.totalCost += maintenance.finalCost || maintenance.forecastedCost || 0;
      
      vehicleMap.set(key, existing);
    });

    // Por enquanto, vamos adicionar dados simulados para combustível
    // TODO: Integrar com dados reais de refueling quando disponíveis
    vehicleMap.forEach((consumption) => {
      // Simulação de dados de combustível baseada no veículo
      const simulatedFuel = Math.floor(Math.random() * 200) + 100; // 100-300L
      consumption.fuelLiters = simulatedFuel;
      consumption.totalCost += simulatedFuel * 5.5; // Preço médio R$5.50/L
    });

    // Ordenar por consumo total e pegar top 3
    const topVehicles = Array.from(vehicleMap.values())
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 3);

    return {
      branch,
      topVehicles
    };
  });
};
