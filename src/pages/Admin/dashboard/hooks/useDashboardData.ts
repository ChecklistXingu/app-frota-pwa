import { useState, useEffect, useCallback } from "react";
import { listenMaintenances } from "../../../../services/maintenanceService";
import { listenVehicles } from "../../../../services/vehiclesService";
import { listenUsers } from "../../../../services/usersService";
import { getRefuelingTimestamp, listenRefuelings } from "../../../../services/refuelingService";
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

    const sortedByDate = [...effectiveRefuelings].sort(
      (a, b) => getRefuelingTimestamp(a.date) - getRefuelingTimestamp(b.date)
    );

    const distanceByVehicle = new Map<string, number>();
    let totalDistance = 0;
    let distanceSamples = 0;

    sortedByDate.forEach((refueling) => {
      const vehicleId = refueling.vehicleId;
      const currentKm = Number(refueling.km);
      if (!vehicleId || Number.isNaN(currentKm)) {
        return;
      }

      const lastKm = distanceByVehicle.get(vehicleId);
      if (lastKm !== undefined && currentKm > lastKm) {
        totalDistance += currentKm - lastKm;
        distanceSamples += 1;
      }

      distanceByVehicle.set(vehicleId, currentKm);
    });

    const averageConsumption = totalLiters > 0 ? totalDistance / totalLiters : 0;
    const costPerKm = totalDistance > 0 ? monthlyTotal / totalDistance : 0;

    const refuelingStats = {
      monthlyTotal,
      totalLiters,
      averageConsumption,
      costPerKm,
      averageDistancePerRefueling: distanceSamples > 0 ? totalDistance / distanceSamples : 0,
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

    const monthMap = new Map<string, { label: string; order: number; maintenance: number; fuel: number }>();

    const ensureMonthEntry = (date: Date | null | undefined) => {
      if (!date) return null;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap.has(key)) {
        const label = date.toLocaleString('pt-BR', { month: 'short' });
        monthMap.set(key, { label, order: Number(`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`), maintenance: 0, fuel: 0 });
      }
      return key;
    };

    filteredRefuelings.forEach((r) => {
      const date = r.date?.toDate ? r.date.toDate() : r.date ? new Date(r.date) : null;
      const key = ensureMonthEntry(date);
      if (!key) return;
      const entry = monthMap.get(key)!;
      entry.fuel += Number(r.value) || 0;
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
    });

    const monthlyCosts = Array.from(monthMap.values())
      .sort((a, b) => a.order - b.order)
      .slice(-6)
      .map(({ label, maintenance, fuel }) => ({ month: label, maintenance, fuel }));

    return {
      maintenanceStats,
      vehicleStats,
      refuelingStats,
      recentActivities,
      maintenanceByType,
      monthlyCosts,
      vehicles,
      users,
      maintenances: filteredMaintenances
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
      listenRefuelings((items) => {
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
