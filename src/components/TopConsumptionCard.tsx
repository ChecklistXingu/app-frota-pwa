import { Fuel, Wrench, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.tsx";
import type { TopConsumptionByBranch, VehicleConsumption } from "../utils/calculateTopConsumption";

interface TopConsumptionCardProps {
  data: TopConsumptionByBranch[];
  loading?: boolean;
}

const TopConsumptionCard = ({ data, loading }: TopConsumptionCardProps) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Maior Consumo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-1">
                    <div className="h-3 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-2 bg-gray-200 rounded animate-pulse w-3/4"></div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-orange-600" />
          Maior Consumo
          <span className="text-sm font-normal text-gray-500">
            Top 3 por Loja - Combustível + Manutenção
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.map((branchData) => (
            <div key={branchData.branch} className="border rounded-lg p-3 bg-gray-50">
              <h3 className="font-semibold text-sm text-center mb-3 text-gray-800">
                {branchData.branch}
              </h3>
              
              {branchData.topVehicles.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">
                  Sem dados
                </p>
              ) : (
                <div className="space-y-3">
                  {branchData.topVehicles.map((vehicle: VehicleConsumption, index: number) => (
                    <div
                      key={`${vehicle.vehicle}-${index}`}
                      className={`p-2 rounded border ${
                        index === 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-xs truncate flex-1">
                          {vehicle.vehicle}
                        </span>
                        {index === 0 && (
                          <span className="text-xs bg-orange-600 text-white px-1 rounded">
                            #1
                          </span>
                        )}
                      </div>
                      
                      <div className="text-xs text-gray-600 space-y-1">
                        <div className="flex items-center gap-1">
                          <Fuel className="w-3 h-3 text-blue-600" />
                          <span>{vehicle.fuelLiters.toFixed(0)}L</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Wrench className="w-3 h-3 text-orange-600" />
                          <span>{vehicle.maintenanceCount}x</span>
                        </div>
                        
                        <div className="font-semibold text-gray-800">
                          R$ {vehicle.totalCost.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default TopConsumptionCard;
