import { useEffect, useState } from "react";
import { listenVehicles, type Vehicle } from "../../services/vehiclesService";
import { Car } from "lucide-react";

const AdminVehiclesPage = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    const unsub = listenVehicles({}, setVehicles);
    return () => unsub();
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Veículos</h2>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Placa</th>
              <th className="p-3">Modelo</th>
              <th className="p-3">Proprietário</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id} className="border-t">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-[#ffd300]/30 flex items-center justify-center text-[#0d2d6c]"><Car size={16} /></div>
                    <div>
                      <p className="font-medium">{v.plate}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3">{v.brand} {v.model}</td>
                <td className="p-3">{v.userId}</td>
                <td className="p-3">{v.active === false ? "Inativo" : "Ativo"}</td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={4}>Nenhum veículo encontrado</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminVehiclesPage;
