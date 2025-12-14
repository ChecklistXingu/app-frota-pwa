import { useEffect, useMemo, useState } from "react";
import { getRefuelingTimestamp, listenRefuelings, type Refueling } from "../../services/refuelingService";
import { listenVehicles, type Vehicle } from "../../services/vehiclesService";
import { listenUsers, type AppUser } from "../../services/usersService";
import { ChevronDown, ChevronUp, Fuel } from "lucide-react";

const AdminRefuelingPage = () => {
  const [items, setItems] = useState<Refueling[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [expandedVehicles, setExpandedVehicles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsub1 = listenRefuelings(setItems);
    const unsub2 = listenUsers(setUsers);
    const unsub3 = listenVehicles({}, setVehicles);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  // Função para obter o nome do motorista pelo ID
  const getDriverName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name || "Não informado";
  };

  const getDriverBranch = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.filial || "--";
  };

  // Função para obter placa e modelo do veículo pelo ID
  const getVehicleInfo = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      return `${vehicle.plate} • ${vehicle.model}`;
    }
    return vehicleId;
  };

  // Função para formatar a data corretamente
  const formatDate = (dateField: any) => {
    if (!dateField) return "N/A";
    
    const timestamp = getRefuelingTimestamp(dateField);
    if (!timestamp) return "N/A";

    return new Date(timestamp).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
  };

  // Calcula totais
  const totalLiters = items.reduce((acc, r) => acc + (r.liters || 0), 0);
  const totalValue = items.reduce((acc, r) => acc + (r.value || 0), 0);

  const groupedByVehicle = useMemo(() => {
    const map = new Map<string, Refueling[]>();

    items.forEach((refueling) => {
      const vehicleId = refueling.vehicleId || "desconhecido";
      if (!map.has(vehicleId)) {
        map.set(vehicleId, []);
      }
      map.get(vehicleId)!.push(refueling);
    });

    return Array.from(map.entries())
      .map(([vehicleId, refuelings]) => {
        const sorted = refuelings.sort(
          (a, b) => getRefuelingTimestamp(b.date) - getRefuelingTimestamp(a.date)
        );
        return { vehicleId, refuelings: sorted };
      })
      .sort((a, b) => {
        const latestA = getRefuelingTimestamp(a.refuelings[0]?.date);
        const latestB = getRefuelingTimestamp(b.refuelings[0]?.date);
        return latestB - latestA;
      });
  }, [items]);

  const toggleVehicle = (vehicleId: string) => {
    setExpandedVehicles((prev) => ({
      ...prev,
      [vehicleId]: !prev[vehicleId],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Abastecimentos</h2>
        <div className="flex gap-4 text-sm">
          <div className="bg-blue-50 px-3 py-1 rounded-lg">
            <span className="text-gray-600">Total Litros:</span>{" "}
            <span className="font-semibold text-blue-700">{totalLiters.toFixed(2)} L</span>
          </div>
          <div className="bg-green-50 px-3 py-1 rounded-lg">
            <span className="text-gray-600">Total Valor:</span>{" "}
            <span className="font-semibold text-green-700">R$ {totalValue.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Data</th>
              <th className="p-3">Motorista</th>
              <th className="p-3">Filial</th>
              <th className="p-3">Veículo</th>
              <th className="p-3">KM</th>
              <th className="p-3">Litros</th>
              <th className="p-3">Valor</th>
              <th className="p-3">R$/L</th>
              <th className="p-3 w-16 text-center">Abrir</th>
            </tr>
          </thead>
          <tbody>
            {groupedByVehicle.map(({ vehicleId, refuelings }) => {
              const latest = refuelings[0];
              const pricePerLiter = latest?.liters ? latest.value / latest.liters : 0;
              const isExpanded = expandedVehicles[vehicleId];
              const canExpand = refuelings.length > 1;

              return (
                <>
                  <tr key={`${vehicleId}-latest`} className="border-t">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-[#ffd300]/30 flex items-center justify-center text-[#0d2d6c]">
                          <Fuel size={16} />
                        </div>
                        <span>{formatDate(latest?.date)}</span>
                      </div>
                    </td>
                    <td className="p-3">{getDriverName(latest?.userId || "")}</td>
                    <td className="p-3">{getDriverBranch(latest?.userId || "")}</td>
                    <td className="p-3">{getVehicleInfo(vehicleId)}</td>
                    <td className="p-3">{latest?.km?.toLocaleString("pt-BR") ?? "-"} km</td>
                    <td className="p-3">{latest?.liters?.toFixed(2)} L</td>
                    <td className="p-3">R$ {latest?.value?.toFixed(2)}</td>
                    <td className="p-3">
                      <span className="px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                        R$ {pricePerLiter.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => canExpand && toggleVehicle(vehicleId)}
                        className={`mx-auto rounded-full border p-1 transition ${canExpand ? "text-slate-600 hover:bg-blue-50" : "cursor-not-allowed text-slate-300"}`}
                        aria-label={isExpanded ? "Recolher abastecimentos" : "Expandir abastecimentos"}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && refuelings.slice(1).map((refueling) => {
                    const price = refueling.liters ? refueling.value / refueling.liters : 0;
                    return (
                      <tr key={refueling.id} className="border-t bg-blue-50/30">
                        <td className="p-3 pl-10">
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span>Registro anterior</span>
                            <span>•</span>
                            <span>{formatDate(refueling.date)}</span>
                          </div>
                        </td>
                        <td className="p-3 text-sm text-slate-600">{getDriverName(refueling.userId)}</td>
                        <td className="p-3 text-sm text-slate-600">{getDriverBranch(refueling.userId)}</td>
                        <td className="p-3 text-sm text-slate-600">{getVehicleInfo(vehicleId)}</td>
                        <td className="p-3 text-sm text-slate-600">{refueling.km?.toLocaleString("pt-BR") ?? "-"} km</td>
                        <td className="p-3 text-sm text-slate-600">{refueling.liters?.toFixed(2)} L</td>
                        <td className="p-3 text-sm text-slate-600">R$ {refueling.value?.toFixed(2)}</td>
                        <td className="p-3 text-sm text-slate-600">
                          <span className="px-2 py-1 rounded-md text-xs font-medium bg-white text-blue-700 border border-blue-100">
                            R$ {price.toFixed(2)}
                          </span>
                        </td>
                        <td />
                      </tr>
                    );
                  })}
                </>
              );
            })}
            {groupedByVehicle.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={8}>
                  Nenhum abastecimento encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminRefuelingPage;
