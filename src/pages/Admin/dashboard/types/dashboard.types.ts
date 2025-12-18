import type { Maintenance } from "../../../../services/maintenanceService";
import type { Vehicle } from "../../../../services/vehiclesService";
import type { AppUser } from "../../../../services/usersService";

export type DashboardFilters = {
  startDate?: string;
  endDate?: string;
  branch?: string;
};

export type DashboardData = {
  maintenanceStats: {
    total: number;
    pending: number;
    inReview: number;
    scheduled: number;
    done: number;
    averageResolutionTime: string;
    avgAnalysisTime: string;
    avgCompletionTime: string;
    avgForecastDelta: string;
  };
  vehicleStats: {
    total: number;
    inOperation: number;
    inMaintenance: number;
    inactive: number;
  };
  refuelingStats: {
    monthlyTotal: number;
    averageConsumption: number;
    totalLiters: number;
    costPerKm: number;
    totalDistance: number;
    validSamples: number;
    vehiclesWithInsufficientData: number;
    skippedVehicles: number;
    averageDistancePerRefueling: number;
  };
  recentActivities: Array<{
    id: string;
    type: 'maintenance' | 'refueling' | 'alert';
    title: string;
    description: string;
    date: Date;
    status: string;
    vehicleId?: string;
  }>;
  maintenanceByType: Array<{ type: string; count: number }>;
  monthlyCosts: Array<{ month: string; maintenance: number; fuel: number }>;
  costsByBranch: Array<{ branch: string; maintenance: number; fuel: number }>;
  costPerKmTimeline: Array<{ month: string } & Record<string, number>>;
  timelineBranches: string[];
  vehicles: Vehicle[];
  users: AppUser[];
  maintenances: Maintenance[];
};

export type StatCardProps = {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color?: string;
};
