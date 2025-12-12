import { useState, useEffect, useCallback } from "react";
import { listenMaintenances } from "../../../../services/maintenanceService";
import { listenVehicles } from "../../../../services/vehiclesService";
import { listenUsers } from "../../../../services/usersService";
import { listenRefuelings } from "../../../../services/refuelingService";
import type { DashboardData } from "../types/dashboard.types";

export const useDashboardData = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const processData = useCallback((maintenances: any[] = [], vehicles: any[] = [], users: any[] = [], refuelings: any[] = []): DashboardData => {
    // Processar dados de manutenção
    const maintenanceStats = {
      total: maintenances.length,
      pending: maintenances.filter(m => m.status === 'pending').length,
      inProgress: maintenances.filter(m => m.status === 'in_progress').length,
      completed: maintenances.filter(m => m.status === 'completed').length,
      averageResolutionTime: '2d 5h' // Exemplo simplificado
    };

    // Processar dados de veículos
    const vehicleStats = {
      total: vehicles.length,
      inOperation: vehicles.filter(v => v.status === 'operational').length,
      inMaintenance: vehicles.filter(v => v.status === 'maintenance').length,
      inactive: vehicles.filter(v => v.status === 'inactive').length
    };

    // Processar dados de abastecimento
    const monthlyRefuelings = refuelings.filter(r => {
      const refuelingDate = r.date?.toDate();
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      return refuelingDate > oneMonthAgo;
    });

    const refuelingStats = {
      monthlyTotal: monthlyRefuelings.reduce((sum, r) => sum + (r.value || 0), 0),
      totalLiters: monthlyRefuelings.reduce((sum, r) => sum + (r.liters || 0), 0),
      averageConsumption: 8.5, // km/l - exemplo
      costPerKm: 0.85 // R$/km - exemplo
    };

    // Atividades recentes
    const recentActivities = [
      ...maintenances.slice(0, 5).map(m => ({
        id: m.id,
        type: 'maintenance' as const,
        title: `Manutenção ${m.id.slice(0, 6)}`,
        description: m.description || 'Sem descrição',
        date: m.createdAt?.toDate() || new Date(),
        status: m.status,
        vehicleId: m.vehicleId
      })),
      ...refuelings.slice(0, 3).map(r => ({
        id: r.id,
        type: 'refueling' as const,
        title: `Abastecimento ${r.id.slice(0, 6)}`,
        description: `${r.liters}L - R$ ${r.value.toFixed(2)}`,
        date: r.date?.toDate() || new Date(),
        status: 'completed',
        vehicleId: r.vehicleId
      }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);

    // Dados para gráficos
    const maintenanceByType = [
      { type: 'Preventiva', count: maintenances.filter(m => m.type === 'preventive').length },
      { type: 'Corretiva', count: maintenances.filter(m => m.type === 'corrective').length },
      { type: 'Pneus', count: maintenances.filter(m => m.type === 'tires').length },
      { type: 'Outros', count: maintenances.filter(m => !['preventive', 'corrective', 'tires'].includes(m.type)).length }
    ];

    const monthlyCosts = [
      { month: 'Jan', maintenance: 12500, fuel: 18700 },
      { month: 'Fev', maintenance: 9800, fuel: 17500 },
      { month: 'Mar', maintenance: 14700, fuel: 19200 },
      { month: 'Abr', maintenance: 11200, fuel: 16800 },
      { month: 'Mai', maintenance: 8900, fuel: 15400 },
      { month: 'Jun', maintenance: 10300, fuel: 17600 }
    ];

    return {
      maintenanceStats,
      vehicleStats,
      refuelingStats,
      recentActivities,
      maintenanceByType,
      monthlyCosts,
      vehicles,
      users,
      maintenances
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    
    const unsubs = [
      listenMaintenances({}, (maintenances) => {
        setData(prev => {
          if (!prev) return null;
          return { ...prev, maintenances } as DashboardData;
        });
      }),
      
      listenVehicles({}, (vehicles) => {
        setData(prev => {
          if (!prev) return null;
          return { ...prev, vehicles } as DashboardData;
        });
      }),
      
      listenUsers((users) => {
        setData(prev => {
          if (!prev) return null;
          return { ...prev, users } as DashboardData;
        });
      }),
      
      listenRefuelings((refuelings) => {
        setData(prev => {
          if (!prev) return null;
          return { ...prev, refuelings } as any;
        });
      })
    ];

    // Cleanup function
    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [processData]);

  return { data, loading };
};
