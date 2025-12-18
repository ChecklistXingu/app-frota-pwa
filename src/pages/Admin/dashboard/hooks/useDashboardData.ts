import { useState, useEffect, useCallback } from "react";
import { listenMaintenances } from "../../../../services/maintenanceService";
import { listenVehicles } from "../../../../services/vehiclesService";
import { listenUsers } from "../../../../services/usersService";
import { listenRefuelings } from "../../../../services/refuelingService";
import type { DashboardData, DashboardFilters } from "../types/dashboard.types";

const parseInputDate = (value?: string | null, endOfDay = false): Date | null => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  if (endOfDay) {
    return new Date(year, month - 1, day, 23, 59, 59, 999);
  }
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

export const useDashboardData = (filters?: DashboardFilters) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const processData = useCallback(
    (
      maintenances: any[] = [],
      vehicles: any[] = [],
      users: any[] = [],
      refuelings: any[] = []
    ): DashboardData => {
    const branchFilter = filters?.branch && filters.branch !== "all" ? filters.branch : null;
    const startDate = parseInputDate(filters?.startDate, false);
    const endDate = parseInputDate(filters?.endDate, true);
    const isDateFilterActive = Boolean(startDate || endDate);

    const toDate = (value: any): Date | null => {
      if (!value) return null;
      if (value.toDate) return value.toDate();
      if (value.seconds) return new Date(value.seconds * 1000);
      if (value instanceof Date) return value;
      if (typeof value === "string") {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
      }
      return null;
    };

    const getAverageDuration = (values: number[]): number => {
      if (!values.length) return 0;
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    };

    const formatDuration = (ms: number): string => {
      if (!ms || ms <= 0) return "--";
      const totalMinutes = Math.round(ms / 60000);
      const days = Math.floor(totalMinutes / (60 * 24));
      const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
      const minutes = totalMinutes % 60;

      if (days > 0) {
        return `${days}d ${hours}h`;
      }
      if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
      }
      return `${minutes}min`;
    };

    const analysisDurations: number[] = [];
    const resolutionDurations: number[] = [];
    const forecastDeviationDurations: number[] = [];

    const userBranchMap = new Map(users.map((u: any) => [u.id, u.filial || "--"]));

    const isBranchAllowed = (userId: string) => {
      if (!branchFilter) return true;
      return userBranchMap.get(userId) === branchFilter;
    };

    const isDateAllowed = (date: Date | null) => {
      if (!isDateFilterActive) return true;
      if (!date) return false;
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
      return true;
    };

    const filteredMaintenances = maintenances.filter((m) => {
      const created = toDate(m.createdAt || (m as any).date);
      return isBranchAllowed(m.userId) && isDateAllowed(created);
    });

    const filteredRefuelings = refuelings.filter((r) => {
      const dateValue = r.date?.toDate ? r.date.toDate() : r.date ? new Date(r.date) : null;
      return isBranchAllowed(r.userId) && isDateAllowed(dateValue);
    });

    filteredMaintenances.forEach((m) => {
      const created = toDate(m.createdAt || (m as any).date);
      const analysisStarted = toDate((m as any).analysisStartedAt);
      const completed = toDate((m as any).completedAt);
      const scheduled = toDate((m as any).scheduledFor);
      const forecasted = toDate((m as any).forecastedCompletion);

      if (created) {
        if (scheduled && scheduled > created) {
          analysisDurations.push(scheduled.getTime() - created.getTime());
        } else if (analysisStarted && analysisStarted > created) {
          analysisDurations.push(analysisStarted.getTime() - created.getTime());
        }
      }

      if (created && completed && completed > created) {
        resolutionDurations.push(completed.getTime() - created.getTime());
      }

      if (forecasted && completed) {
        forecastDeviationDurations.push(completed.getTime() - forecasted.getTime());
      }
    });

    const avgAnalysisMs = getAverageDuration(analysisDurations);
    const avgResolutionMs = getAverageDuration(resolutionDurations);
    const avgForecastDeltaMs = getAverageDuration(forecastDeviationDurations);

    const maintenanceStats = {
      total: filteredMaintenances.length,
      pending: filteredMaintenances.filter(m => m.status === 'pending').length,
      inReview: filteredMaintenances.filter(m => m.status === 'in_review').length,
      scheduled: filteredMaintenances.filter(m => m.status === 'scheduled').length,
      done: filteredMaintenances.filter(m => m.status === 'done').length,
      averageResolutionTime: formatDuration(avgResolutionMs),
      avgAnalysisTime: formatDuration(avgAnalysisMs),
      avgCompletionTime: formatDuration(avgResolutionMs),
      avgForecastDelta: avgForecastDeltaMs ? formatDuration(Math.abs(avgForecastDeltaMs)) : "--",
    };

    // Processar dados de veículos
    const vehicleStats = {
      total: vehicles.length,
      inOperation: vehicles.filter(v => v.status === 'operational').length,
      inMaintenance: vehicles.filter(v => v.status === 'maintenance').length,
      inactive: vehicles.filter(v => v.status === 'inactive').length
    };

    // Processar dados de abastecimento
    const fallbackWindowStart = new Date();
    fallbackWindowStart.setMonth(fallbackWindowStart.getMonth() - 1);

    const monthlyRefuelings = (isDateFilterActive ? filteredRefuelings : refuelings.filter((r) => {
      const timestamp = r.date?.toDate ? r.date.toDate() : r.date;
      if (!timestamp) return false;
      const refuelingDate = timestamp instanceof Date ? timestamp : new Date(timestamp);
      return refuelingDate >= fallbackWindowStart;
    })).filter((r) => !branchFilter || isBranchAllowed(r.userId));

    const effectiveRefuelings = isDateFilterActive ? filteredRefuelings : monthlyRefuelings;

    const monthlyTotal = effectiveRefuelings.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
    const totalLiters = effectiveRefuelings.reduce((sum, r) => sum + (Number(r.liters) || 0), 0);

    const monthMap = new Map<string, { label: string; order: number; maintenance: number; fuel: number }>();
    const branchMap = new Map<string, { branch: string; maintenance: number; fuel: number }>();
    const branchMonthMap = new Map<string, { label: string; branches: Map<string, { maintenance: number; fuel: number; distance: number }> }>();

    const ensureMonthEntry = (date: Date | null | undefined) => {
      if (!date) return null;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap.has(key)) {
        const label = date.toLocaleString("pt-BR", { month: "short" });
        monthMap.set(key, { label, order: Number(`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`), maintenance: 0, fuel: 0 });
      }
      return key;
    };

    const ensureBranchEntry = (branch: string) => {
      let entry = branchMap.get(branch);
      if (!entry) {
        entry = { branch, maintenance: 0, fuel: 0 };
        branchMap.set(branch, entry);
      }
      return entry;
    };

    const ensureBranchMonthEntry = (monthKey: string, label: string, branch: string) => {
      let monthEntry = branchMonthMap.get(monthKey);
      if (!monthEntry) {
        monthEntry = { label, branches: new Map() };
        branchMonthMap.set(monthKey, monthEntry);
      }
      let branchEntry = monthEntry.branches.get(branch);
      if (!branchEntry) {
        branchEntry = { maintenance: 0, fuel: 0, distance: 0 };
        monthEntry.branches.set(branch, branchEntry);
      }
      return branchEntry;
    };

    filteredRefuelings.forEach((r) => {
      const date = r.date?.toDate ? r.date.toDate() : r.date ? new Date(r.date) : null;
      const key = ensureMonthEntry(date);
      if (!key) return;
      const entry = monthMap.get(key)!;
      const fuelValue = Number(r.value) || 0;
      entry.fuel += fuelValue;

      const branch = userBranchMap.get(r.userId) || "--";
      const monthEntry = ensureBranchMonthEntry(key, entry.label, branch);
      monthEntry.fuel += fuelValue;
      const branchTotals = ensureBranchEntry(branch);
      branchTotals.fuel += fuelValue;
    });

    filteredMaintenances.forEach((m) => {
      const date = toDate(m.createdAt || (m as any).date);
      const key = ensureMonthEntry(date);
      if (!key) return;
      const entry = monthMap.get(key)!;
      const maintenanceCost = Number(
        (m as any).finalCost ?? m.finalCost ?? (m as any).cost ?? (m as any).totalCost ?? m.forecastedCost ?? 0
      );
      entry.maintenance += maintenanceCost;

      const branch = userBranchMap.get(m.userId) || "--";
      const monthEntry = ensureBranchMonthEntry(key, entry.label, branch);
      monthEntry.maintenance += maintenanceCost;
      const branchTotals = ensureBranchEntry(branch);
      branchTotals.maintenance += maintenanceCost;
    });

    // Função para agrupar e ordenar abastecimentos por veículo
    const groupRefuelsByVehicle = (refuels: any[]) => {
      const vehicleMap = new Map<string, any[]>();
      
      refuels.forEach(refuel => {
        if (!refuel.vehicleId) return;
        
        if (!vehicleMap.has(refuel.vehicleId)) {
          vehicleMap.set(refuel.vehicleId, []);
        }
        vehicleMap.get(refuel.vehicleId)?.push(refuel);
      });

      // Ordena os abastecimentos de cada veículo por data
      vehicleMap.forEach((vehicleRefuels) => {
        vehicleRefuels.sort((a, b) => {
          const aDate = a.date?.toDate?.() || a.date;
          const bDate = b.date?.toDate?.() || b.date;
          return new Date(aDate).getTime() - new Date(bDate).getTime();
        });
      });

      return vehicleMap;
    };

    // Agrupa abastecimentos por veículo e ordena por data
    const refuelsByVehicle = groupRefuelsByVehicle(effectiveRefuelings);
    
    console.log('[DEBUG] effectiveRefuelings:', effectiveRefuelings.length);
    console.log('[DEBUG] refuelsByVehicle:', refuelsByVehicle);
    
    let totalDistance = 0;
    let validSamples = 0;
    const monthlyDistances = new Map<string, number>();

    // Calcula a distância percorrida para cada veículo
    refuelsByVehicle.forEach((vehicleRefuels, vehicleId) => {
      console.log(`[DEBUG] Processando veículo ${vehicleId} com ${vehicleRefuels.length} abastecimentos`);
      
      // Pula se tiver menos de 2 abastecimentos
      if (vehicleRefuels.length < 2) {
        console.log(`[DEBUG] Veículo ${vehicleId} pulado - menos de 2 abastecimentos`);
        return;
      }

      // Ordena por data para garantir a ordem correta
      vehicleRefuels.sort((a, b) => {
        const aDate = a.date?.toDate?.() || a.date;
        const bDate = b.date?.toDate?.() || b.date;
        return new Date(aDate).getTime() - new Date(bDate).getTime();
      });

      // Calcula a distância entre abastecimentos consecutivos
      for (let i = 1; i < vehicleRefuels.length; i++) {
        const current = vehicleRefuels[i];
        const previous = vehicleRefuels[i - 1];
        
        const currentKm = Number(current.km);
        const previousKm = Number(previous.km);
        
        console.log(`[DEBUG] Comparando abastecimento ${i-1} -> ${i}: ${previousKm}km -> ${currentKm}km`);
        
        // Apenas considera se ambas as leituras forem válidas e a atual for maior que a anterior
        if (!isNaN(currentKm) && !isNaN(previousKm) && currentKm > previousKm) {
          const distance = currentKm - previousKm;
          totalDistance += distance;
          validSamples++;
          
          console.log(`[DEBUG] Distância válida: ${distance}km (total: ${totalDistance}, samples: ${validSamples})`);

          // Atualiza o registro de distância mensal
          const refuelDate = current.date?.toDate?.() || current.date;
          if (refuelDate) {
            const date = refuelDate instanceof Date ? refuelDate : new Date(refuelDate);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const currentTotal = monthlyDistances.get(monthKey) || 0;
            monthlyDistances.set(monthKey, currentTotal + distance);
          }
        }
      }
    });

    // Atualiza as distâncias mensais no monthMap
    monthlyDistances.forEach((distance, monthKey) => {
      const monthData = monthMap.get(monthKey);
      if (monthData) {
        const branch = '--'; // Usa '--' como branch padrão para distância
        const monthEntry = ensureBranchMonthEntry(monthKey, monthData.label, branch);
        monthEntry.distance = (monthEntry.distance || 0) + distance;
      }
    });

    // Calcula a média de consumo (km/L)
    const averageConsumption = validSamples > 0 && totalLiters > 0 ? 
      totalDistance / totalLiters : 0;
      
    // Calcula o custo por km (R$/km)
    const costPerKm = validSamples > 0 && totalDistance > 0 ? 
      monthlyTotal / totalDistance : 0;

    console.log('[DEBUG] Cálculos finais:');
    console.log('  - totalDistance:', totalDistance);
    console.log('  - totalLiters:', totalLiters);
    console.log('  - validSamples:', validSamples);
    console.log('  - monthlyTotal:', monthlyTotal);
    console.log('  - averageConsumption:', averageConsumption);
    console.log('  - costPerKm:', costPerKm);

    const refuelingStats = {
      monthlyTotal,
      totalLiters,
      averageConsumption,
      costPerKm,
      totalDistance,
      validSamples,
      averageDistancePerRefueling: validSamples > 0 ? totalDistance / validSamples : 0,
    };

    // Atividades recentes
    const recentActivities = [
      ...filteredMaintenances.slice(0, 5).map(m => ({
        id: m.id,
        type: 'maintenance' as const,
        title: `Manutenção ${m.id.slice(0, 6)}`,
        description: m.description || 'Sem descrição',
        date: m.createdAt?.toDate ? m.createdAt.toDate() : toDate(m.createdAt || (m as any).date) || new Date(),
        status: m.status,
        vehicleId: m.vehicleId
      })),
      ...filteredRefuelings.slice(0, 3).map(r => ({
        id: r.id,
        type: 'refueling' as const,
        title: `Abastecimento ${r.id.slice(0, 6)}`,
        description: `${r.liters}L - R$ ${r.value.toFixed(2)}`,
        date: r.date?.toDate ? r.date.toDate() : new Date(),
        status: 'completed',
        vehicleId: r.vehicleId
      }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);

    // Dados para gráficos
    const maintenanceByType = [
      { type: 'Preventiva', count: filteredMaintenances.filter(m => m.type === 'preventive').length },
      { type: 'Corretiva', count: filteredMaintenances.filter(m => m.type === 'corrective').length },
      { type: 'Pneus', count: filteredMaintenances.filter(m => m.type === 'tires').length },
      { type: 'Outros', count: filteredMaintenances.filter(m => !['preventive', 'corrective', 'tires'].includes(m.type)).length }
    ];

    const monthlyCosts = Array.from(monthMap.values())
      .sort((a, b) => a.order - b.order)
      .slice(-6)
      .map(({ label, maintenance, fuel }) => ({ month: label, maintenance, fuel }));

    console.log('[DEBUG] monthlyCosts:', monthlyCosts);
    console.log('[DEBUG] monthMap size:', monthMap.size);

    const costsByBranch = Array.from(branchMap.values()).sort((a, b) => b.maintenance + b.fuel - (a.maintenance + a.fuel));
    
    console.log('[DEBUG] costsByBranch:', costsByBranch);
    console.log('[DEBUG] branchMap size:', branchMap.size);

    const sortedTimelineMonths = Array.from(branchMonthMap.entries())
      .sort((a, b) => ((monthMap.get(a[0])?.order || 0) - (monthMap.get(b[0])?.order || 0)))
      .slice(-6);

    const timelineBranchesSet = new Set<string>();
    const costPerKmTimeline = sortedTimelineMonths
      .map(([_, { label, branches }]) => {
        const point = { month: label } as { month: string } & Record<string, number>;
        branches.forEach((values, branch) => {
          const totalCost = values.maintenance + values.fuel;
          const distance = values.distance || 0;
          if (distance > 0 && totalCost > 0) {
            point[branch] = Number((totalCost / distance).toFixed(2));
            timelineBranchesSet.add(branch);
          }
        });
        return point;
      })
      .filter(point => Object.keys(point).length > 1);

    const timelineBranches = Array.from(timelineBranchesSet).sort();

    return {
      maintenanceStats,
      vehicleStats,
      refuelingStats,
      recentActivities,
      maintenanceByType,
      monthlyCosts,
      costsByBranch,
      vehicles,
      users,
      maintenances: filteredMaintenances,
      costPerKmTimeline,
      timelineBranches,
    };
  }, [filters]);

  useEffect(() => {
    setLoading(true);

    let maintenances: any[] = [];
    let vehicles: any[] = [];
    let users: any[] = [];
    let refuelings: any[] = [];

    const updateDashboard = () => {
      setData(processData(maintenances, vehicles, users, refuelings));
      setLoading(false);
    };

    const unsubs = [
      listenMaintenances({}, (items) => {
        maintenances = items;
        updateDashboard();
      }),
      listenVehicles({}, (items) => {
        vehicles = items;
        updateDashboard();
      }),
      listenUsers((items) => {
        users = items;
        updateDashboard();
      }),
      // Listen to refuelings
      listenRefuelings((items) => {
        console.log('[DEBUG] Refuelings recebidos do Firebase:', items.length);
        console.log('[DEBUG] Amostra de refuelings:', items.slice(0, 3));
        refuelings = items;
        updateDashboard();
      })

    ];

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [processData]);

  return { data, loading };
};
