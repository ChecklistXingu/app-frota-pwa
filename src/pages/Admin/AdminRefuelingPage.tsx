import { useEffect, useState } from "react";
import { getRefuelingTimestamp, listenRefuelings, type Refueling } from "../../services/refuelingService";
import { listenVehicles, type Vehicle } from "../../services/vehiclesService";
import { listenUsers, type AppUser } from "../../services/usersService";
import { Fuel } from "lucide-react";

const AdminRefuelingPage = () => {
  const [items, setItems] = useState<Refueling[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

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
              <th className="p-3">Veículo</th>
              <th className="p-3">KM</th>
              <th className="p-3">Litros</th>
              <th className="p-3">Valor</th>
              <th className="p-3">R$/L</th>
            </tr>
          </thead>
          <tbody>
            {[...items]
              .sort((a, b) => getRefuelingTimestamp(b.date) - getRefuelingTimestamp(a.date))
              .map((r) => {
              const pricePerLiter = r.liters ? r.value / r.liters : 0;
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-[#ffd300]/30 flex items-center justify-center text-[#0d2d6c]">
                        <Fuel size={16} />
                      </div>
                      <span>{formatDate(r.date)}</span>
                    </div>
                  </td>
                  <td className="p-3">{getDriverName(r.userId)}</td>
                  <td className="p-3">{getVehicleInfo(r.vehicleId)}</td>
                  <td className="p-3">{r.km?.toLocaleString("pt-BR")} km</td>
                  <td className="p-3">{r.liters?.toFixed(2)} L</td>
                  <td className="p-3">R$ {r.value?.toFixed(2)}</td>
                  <td className="p-3">
                    <span className="px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                      R$ {pricePerLiter.toFixed(2)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={7}>
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
