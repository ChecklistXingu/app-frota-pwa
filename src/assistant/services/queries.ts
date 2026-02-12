import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../services/firebase";
import { getRefuelingTimestamp, type Refueling } from "../../services/refuelingService";
import type { Vehicle } from "../../services/vehiclesService";
import type { AppUser } from "../../services/usersService";
import type { Maintenance } from "../../services/maintenanceService";

export interface TopFuelSpendingParams {
  branch?: string; // filial (ex.: "Água Boa")
  days?: number;   // período em dias (padrão: 30)
}

export interface TopFuelSpendingResult {
  vehicleId: string;
  plate: string;
  model: string;
  branch: string;
  totalValue: number;
  totalLiters: number;
  refuelingsCount: number;
}

export interface TopDriverMaintenanceParams {
  branch?: string;
  days?: number;
}

export interface TopDriverMaintenanceItem {
  userId: string;
  name: string;
  branch: string;
  totalCost: number;
  forecastedCost: number;
  maintenanceCount: number;
}

export interface TopMaintenanceSpendingParams {
  branch?: string;
  days?: number;
}

export interface TopMaintenanceSpendingResult {
  vehicleId: string;
  plate: string;
  model: string;
  branch: string;
  totalCost: number;
  maintenanceCount: number;
  forecastedCost?: number;
}

export interface MaintenanceTotalsParams {
  branch?: string;
  days?: number;
}

export interface MaintenanceTotalsResult {
  totalCost: number;
  forecastedCost: number;
  count: number;
  avgCost: number;
}

export type DriverFuelMetric = "liters" | "value";

export interface TopDriverFuelParams {
  branch?: string;
  days?: number;
  metric?: DriverFuelMetric; // "liters" (padrão) ou "value" (gasto em R$)
}

export interface TopDriverFuelItem {
  userId: string;
  name: string;
  branch: string;
  totalLiters: number;
  totalValue: number;
  refuelingsCount: number;
}

export const getTopFuelSpendingVehicle = async (
  params: TopFuelSpendingParams = {},
): Promise<TopFuelSpendingResult | null> => {
  const { branch, days = 30 } = params;

  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Carrega abastecimentos do período
  const refuelingCol = collection(db, "refueling");
  const refuelingQuery = query(refuelingCol, where("date", ">=", startDate));
  const [refuelingSnap, usersSnap, vehiclesSnap] = await Promise.all([
    getDocs(refuelingQuery),
    getDocs(collection(db, "users")),
    getDocs(collection(db, "vehicles")),
  ]);

  const usersById: Record<string, AppUser> = {};
  usersSnap.forEach((doc) => {
    usersById[doc.id] = { id: doc.id, ...(doc.data() as any) } as AppUser;
  });

  const vehiclesById: Record<string, Vehicle> = {};
  vehiclesSnap.forEach((doc) => {
    vehiclesById[doc.id] = { id: doc.id, ...(doc.data() as any) } as Vehicle;
  });

  const totalsByVehicle: Record<string, { value: number; liters: number; count: number; branch: string }> = {};

  refuelingSnap.forEach((doc) => {
    const data = { id: doc.id, ...(doc.data() as any) } as Refueling;

    // Filtro por filial (branch) usando o usuário do abastecimento
    const user = data.userId ? usersById[data.userId] : undefined;
    const userBranch = user?.filial || "--";

    if (branch && userBranch !== branch) {
      return;
    }

    const ts = getRefuelingTimestamp(data.date);
    if (!ts || ts < startDate.getTime()) return;

    const vehicleId = data.vehicleId || "desconhecido";
    if (!totalsByVehicle[vehicleId]) {
      totalsByVehicle[vehicleId] = {
        value: 0,
        liters: 0,
        count: 0,
        branch: userBranch,
      };
    }

    totalsByVehicle[vehicleId].value += data.value || 0;
    totalsByVehicle[vehicleId].liters += data.liters || 0;
    totalsByVehicle[vehicleId].count += 1;
  });

  const entries = Object.entries(totalsByVehicle);
  if (entries.length === 0) return null;

  // Encontra o veículo com maior gasto total
  entries.sort((a, b) => b[1].value - a[1].value);
  const [vehicleId, totals] = entries[0];

  const vehicle = vehiclesById[vehicleId];

  return {
    vehicleId,
    plate: vehicle?.plate || "(sem placa)",
    model: vehicle?.model || "Veículo",
    branch: totals.branch,
    totalValue: totals.value,
    totalLiters: totals.liters,
    refuelingsCount: totals.count,
  };
};

export const getTopMaintenanceSpendingVehicle = async (
  params: TopMaintenanceSpendingParams = {},
): Promise<TopMaintenanceSpendingResult | null> => {
  const { branch, days = 30 } = params;

  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const maintenanceCol = collection(db, "maintenance");
  const [maintenanceSnap, usersSnap, vehiclesSnap] = await Promise.all([
    getDocs(maintenanceCol),
    getDocs(collection(db, "users")),
    getDocs(collection(db, "vehicles")),
  ]);

  const usersById: Record<string, AppUser> = {};
  usersSnap.forEach((doc) => {
    usersById[doc.id] = { id: doc.id, ...(doc.data() as any) } as AppUser;
  });

  const vehiclesById: Record<string, Vehicle> = {};
  vehiclesSnap.forEach((doc) => {
    vehiclesById[doc.id] = { id: doc.id, ...(doc.data() as any) } as Vehicle;
  });

  const totalsByVehicle: Record<string, { cost: number; forecastedCost: number; count: number; branch: string }> = {};

  maintenanceSnap.forEach((doc) => {
    const data = { id: doc.id, ...(doc.data() as any) } as Maintenance;

    const user = data.userId ? usersById[data.userId] : undefined;
    const userBranch = user?.filial || "--";

    if (branch && userBranch !== branch) return;

    const ts = data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 0;
    if (ts < startDate.getTime()) return;

    const vehicleId = data.vehicleId || "desconhecido";
    if (!totalsByVehicle[vehicleId]) {
      totalsByVehicle[vehicleId] = { cost: 0, forecastedCost: 0, count: 0, branch: userBranch };
    }

    totalsByVehicle[vehicleId].cost += data.finalCost || 0;
    totalsByVehicle[vehicleId].forecastedCost += data.forecastedCost || 0;
    totalsByVehicle[vehicleId].count += 1;
  });

  const entries = Object.entries(totalsByVehicle);
  if (entries.length === 0) return null;

  entries.sort((a, b) => b[1].cost - a[1].cost);
  const [vehicleId, totals] = entries[0];

  const vehicle = vehiclesById[vehicleId];

  return {
    vehicleId,
    plate: vehicle?.plate || "(sem placa)",
    model: vehicle?.model || "Veículo",
    branch: totals.branch,
    totalCost: totals.cost,
    maintenanceCount: totals.count,
    forecastedCost: totals.forecastedCost,
  };
};

export const getMaintenanceTotals = async (
  params: MaintenanceTotalsParams = {},
): Promise<MaintenanceTotalsResult | null> => {
  const { branch, days = 30 } = params;

  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const maintenanceCol = collection(db, "maintenance");
  const [maintenanceSnap, usersSnap] = await Promise.all([
    getDocs(maintenanceCol),
    getDocs(collection(db, "users")),
  ]);

  const usersById: Record<string, AppUser> = {};
  usersSnap.forEach((doc) => {
    usersById[doc.id] = { id: doc.id, ...(doc.data() as any) } as AppUser;
  });

  let totalCost = 0;
  let forecastedCost = 0;
  let count = 0;

  maintenanceSnap.forEach((doc) => {
    const data = { id: doc.id, ...(doc.data() as any) } as Maintenance;

    const user = data.userId ? usersById[data.userId] : undefined;
    const userBranch = user?.filial || "--";

    if (branch && userBranch !== branch) return;

    const ts = data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 0;
    if (ts < startDate.getTime()) return;

    totalCost += data.finalCost || 0;
    forecastedCost += data.forecastedCost || 0;
    count += 1;
  });

  if (count === 0) return null;

  return {
    totalCost,
    forecastedCost,
    count,
    avgCost: totalCost / count,
  };
};

export const getTopDriverMaintenanceSpending = async (
  params: TopDriverMaintenanceParams = {},
): Promise<TopDriverMaintenanceItem[]> => {
  const { branch, days = 30 } = params;

  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const maintenanceCol = collection(db, "maintenance");
  const [maintenanceSnap, usersSnap, vehiclesSnap] = await Promise.all([
    getDocs(maintenanceCol),
    getDocs(collection(db, "users")),
    getDocs(collection(db, "vehicles")),
  ]);

  const usersById: Record<string, AppUser> = {};
  usersSnap.forEach((doc) => {
    usersById[doc.id] = { id: doc.id, ...(doc.data() as any) } as AppUser;
  });

  const vehiclesById: Record<string, Vehicle> = {};
  vehiclesSnap.forEach((doc) => {
    vehiclesById[doc.id] = { id: doc.id, ...(doc.data() as any) } as Vehicle;
  });

  const totalsByDriver: Record<
    string,
    { cost: number; forecastedCost: number; count: number; branch: string }
  > = {};

  maintenanceSnap.forEach((doc) => {
    const data = { id: doc.id, ...(doc.data() as any) } as Maintenance;

    let driverId = data.userId || "";

    if (!driverId && data.vehicleId) {
      const vehicle = vehiclesById[data.vehicleId];
      if (vehicle?.userId) {
        driverId = vehicle.userId;
      }
    }

    if (!driverId) {
      driverId = "desconhecido";
    }

    const user = usersById[driverId];
    const userBranch = user?.filial || "--";

    if (branch && userBranch !== branch) return;

    const ts = data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 0;
    if (ts < startDate.getTime()) return;

    if (!totalsByDriver[driverId]) {
      totalsByDriver[driverId] = {
        cost: 0,
        forecastedCost: 0,
        count: 0,
        branch: userBranch,
      };
    }

    totalsByDriver[driverId].cost += data.finalCost || 0;
    totalsByDriver[driverId].forecastedCost += data.forecastedCost || 0;
    totalsByDriver[driverId].count += 1;
  });

  const entries = Object.entries(totalsByDriver);
  if (entries.length === 0) return [];

  entries.sort((a, b) => b[1].cost - a[1].cost);
  const top3 = entries.slice(0, 3);

  const items: TopDriverMaintenanceItem[] = top3.map(([userId, totals]) => {
    const user = usersById[userId];
    return {
      userId,
      name: user?.name || "Motorista desconhecido",
      branch: totals.branch,
      totalCost: totals.cost,
      forecastedCost: totals.forecastedCost,
      maintenanceCount: totals.count,
    };
  });

  return items;
};

export const getTopDriverFuelConsumption = async (
  params: TopDriverFuelParams = {},
): Promise<{ items: TopDriverFuelItem[]; metric: DriverFuelMetric }> => {
  const { branch, days = 30, metric = "liters" } = params;

  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const refuelingCol = collection(db, "refueling");
  const refuelingQuery = query(refuelingCol, where("date", ">=", startDate));

  const [refuelingSnap, usersSnap, vehiclesSnap] = await Promise.all([
    getDocs(refuelingQuery),
    getDocs(collection(db, "users")),
    getDocs(collection(db, "vehicles")),
  ]);

  const usersById: Record<string, AppUser> = {};
  usersSnap.forEach((doc) => {
    usersById[doc.id] = { id: doc.id, ...(doc.data() as any) } as AppUser;
  });

  const vehiclesById: Record<string, Vehicle> = {};
  vehiclesSnap.forEach((doc) => {
    vehiclesById[doc.id] = { id: doc.id, ...(doc.data() as any) } as Vehicle;
  });

  const totalsByDriver: Record<
    string,
    { liters: number; value: number; count: number; branch: string }
  > = {};

  refuelingSnap.forEach((doc) => {
    const data = { id: doc.id, ...(doc.data() as any) } as Refueling;

    let driverId = data.userId || "";

    if (!driverId && data.vehicleId) {
      const vehicle = vehiclesById[data.vehicleId];
      if (vehicle?.userId) {
        driverId = vehicle.userId;
      }
    }

    if (!driverId) {
      driverId = "desconhecido";
    }

    const user = usersById[driverId];
    const userBranch = user?.filial || "--";

    if (branch && userBranch !== branch) return;

    const ts = getRefuelingTimestamp(data.date);
    if (!ts || ts < startDate.getTime()) return;

    if (!totalsByDriver[driverId]) {
      totalsByDriver[driverId] = {
        liters: 0,
        value: 0,
        count: 0,
        branch: userBranch,
      };
    }

    totalsByDriver[driverId].liters += data.liters || 0;
    totalsByDriver[driverId].value += data.value || 0;
    totalsByDriver[driverId].count += 1;
  });

  const metricKey: keyof (typeof totalsByDriver)[string] = metric === "value" ? "value" : "liters";
  const entries = Object.entries(totalsByDriver);

  if (entries.length === 0) {
    return { items: [], metric };
  }

  entries.sort((a, b) => b[1][metricKey] - a[1][metricKey]);
  const top3 = entries.slice(0, 3);

  const items: TopDriverFuelItem[] = top3.map(([userId, totals]) => {
    const user = usersById[userId];
    return {
      userId,
      name: user?.name || "Motorista desconhecido",
      branch: totals.branch,
      totalLiters: totals.liters,
      totalValue: totals.value,
      refuelingsCount: totals.count,
    };
  });

  return { items, metric };
};
