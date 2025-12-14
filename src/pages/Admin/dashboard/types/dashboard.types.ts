import type { Maintenance } from "../../../../services/maintenanceService";
import type { Vehicle } from "../../../../services/vehiclesService";
import type { AppUser } from "../../../../services/usersService";

export type DashboardData = {
  maintenanceStats: {
    total: number;
    pending: number;
    inReview: number;
    scheduled: number;
    done: number;
    averageResolutionTime: string;
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
    averageDistancePerRefueling: number;
  };
  analysisStats?: {
    averageAnalysisTime: string;
    averageResolutionTime: string;
    slaBreachPercent: number;
    topCriticals: Array<{ id: string; vehicleId?: string; title: string; daysOpen: number; status: string }>;
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
