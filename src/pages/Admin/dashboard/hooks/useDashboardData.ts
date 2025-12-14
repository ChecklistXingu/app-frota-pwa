import { useState, useEffect, useCallback } from "react";
import { listenMaintenances } from "../../../../services/maintenanceService";
import { listenVehicles } from "../../../../services/vehiclesService";
import { listenUsers } from "../../../../services/usersService";
import { getRefuelingTimestamp, listenRefuelings } from "../../../../services/refuelingService";
import type { DashboardData } from "../types/dashboard.types";

export const useDashboardData = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const processData = useCallback(
    (
      maintenances: any[] = [],
      vehicles: any[] = [],
      users: any[] = [],
      refuelings: any[] = []
    ): DashboardData => {
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

    maintenances.forEach((m) => {
      const created = toDate(m.createdAt);
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
      total: maintenances.length,
      pending: maintenances.filter(m => m.status === 'pending').length,
      inReview: maintenances.filter(m => m.status === 'in_review').length,
      scheduled: maintenances.filter(m => m.status === 'scheduled').length,
      done: maintenances.filter(m => m.status === 'done').length,
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
    const monthlyRefuelings = refuelings.filter(r => {
      const timestamp = r.date?.toDate ? r.date.toDate() : r.date;
      if (!timestamp) return false;
      const refuelingDate = timestamp instanceof Date ? timestamp : new Date(timestamp);
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      return refuelingDate > oneMonthAgo;
    });

    const monthlyTotal = monthlyRefuelings.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
    const totalLiters = monthlyRefuelings.reduce((sum, r) => sum + (Number(r.liters) || 0), 0);

    const sortedByDate = [...monthlyRefuelings].sort(
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
