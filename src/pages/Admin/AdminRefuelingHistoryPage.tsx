import { useEffect, useMemo, useState } from "react";
import { listenRefuelings, type Refueling, getRefuelingTimestamp } from "../../services/refuelingService";
import { listenAllVehicles, type Vehicle } from "../../services/vehiclesService";
import { listenUsers, type AppUser } from "../../services/usersService";
import { Fuel } from "lucide-react";

const AdminRefuelingHistoryPage = () => {
  const [items, setItems] = useState<Refueling[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");

  useEffect(() => {
    const unsubR = listenRefuelings(setItems);
    const unsubV = listenAllVehicles({}, setVehicles);
    const unsubU = listenUsers(setUsers);
    return () => { unsubR(); unsubV(); unsubU(); };
  }, []);

  const usersById = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach((u) => { if (u && u.name) map[u.id] = u.name; });
    return map;
  }, [users]);

  const getVehicleLabel = (vehicleId?: string) => {
    if (!vehicleId) return "Veículo";
    const v = vehicles.find((x) => x.id === vehicleId);
    if (!v) return vehicleId;
    return `${v.plate} • ${v.model}`;
  };

  const formatDateField = (value: any) => {
    if (!value) return "";
    if (value.seconds) return new Date(value.seconds * 1000).toLocaleString("pt-BR");
    if (value.toDate) return value.toDate().toLocaleString("pt-BR");
    return new Date(value).toLocaleString("pt-BR");
  };

  const filteredItems = useMemo(() => {
    return items
      .filter((r) => vehicleFilter === "all" ? true : r.vehicleId === vehicleFilter)
      .sort((a, b) => getRefuelingTimestamp(b.date) - getRefuelingTimestamp(a.date));
  }, [items, vehicleFilter]);

  // Calcula histórico comparativo
  const getComparativeHistory = useMemo(() => {
    const byVehicle: Record<string, Refueling[]> = {};
    
    filteredItems.forEach((item) => {
      if (!byVehicle[item.vehicleId]) {
        byVehicle[item.vehicleId] = [];
      }
      byVehicle[item.vehicleId].push(item);
    });

    const result: Array<{
      item: Refueling;
      previousKm: number | null;
      difference: number | null;
    }> = [];

    Object.values(byVehicle).forEach((vehicleItems) => {
      vehicleItems.forEach((current, index) => {
        const previous = vehicleItems[index + 1];
        result.push({
          item: current,
          previousKm: previous?.km || null,
          difference: previous ? current.km - previous.km : null,
        });
      });
    });

    return result.sort((a, b) => 
      getRefuelingTimestamp(b.item.date) - getRefuelingTimestamp(a.item.date)
    );
  }, [filteredItems]);

  return (
    <div className="space-y-4 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-3">
          <Fuel size={20} /> Histórico de Abastecimentos
        </h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select 
            value={vehicleFilter} 
            onChange={(e) => setVehicleFilter(e.target.value)} 
            className="border rounded-lg px-3 py-2 text-sm w-full sm:w-auto"
          >
            <option value="all">Todos os veículos</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{`${v.plate} • ${v.model}`}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-3 sm:p-4 space-y-4">
        {getComparativeHistory.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum abastecimento registrado.</p>
        ) : (
          <div className="space-y-3">
            {getComparativeHistory.map(({ item, previousKm, difference }) => (
              <div key={item.id} className="rounded-xl border bg-gray-50 px-3 py-3 sm:px-4 sm:py-3 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                  <div className="flex flex-col gap-1">
                    <p className="font-semibold text-sm">{getVehicleLabel(item.vehicleId)}</p>
                    <p className="text-[10px] text-gray-500">
                      {usersById[item.userId] || "Motorista"} • {formatDateField(item.date)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase font-medium">KM Atual</p>
                    <p className="text-lg font-bold text-blue-800">{item.km.toLocaleString("pt-BR")} km</p>
                  </div>
                  
                  {previousKm !== null && (
                    <>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-medium">KM Anterior</p>
                        <p className="text-sm font-semibold text-gray-600">{previousKm.toLocaleString("pt-BR")} km</p>
                      </div>
                      
                      {difference !== null && (
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase font-medium">Diferença</p>
                          <p className="text-sm font-bold text-green-600">+{difference.toLocaleString("pt-BR")} km</p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-gray-200">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase font-medium">Litros</p>
                    <p className="text-sm font-semibold text-gray-700">{item.liters.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L</p>
                  </div>
                  
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase font-medium">Valor</p>
                    <p className="text-sm font-semibold text-gray-700">R$ {item.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase font-medium">Preço/Litro</p>
                    <p className="text-sm font-semibold text-gray-700">
                      R$ {(item.value / item.liters).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {item.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-[10px] text-gray-500 uppercase font-medium mb-1">Observações</p>
                    <p className="text-xs text-gray-700">{item.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRefuelingHistoryPage;
