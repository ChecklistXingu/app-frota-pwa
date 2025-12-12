import { useEffect, useState } from "react";
import { listenVehicles, type Vehicle } from "../../services/vehiclesService";
import { listenUsers, type AppUser } from "../../services/usersService";
import { Car } from "lucide-react";

const AdminVehiclesPage = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    const unsub1 = listenVehicles({}, setVehicles);
    const unsub2 = listenUsers(setUsers);
    return () => { unsub1(); unsub2(); };
  }, []);

  // Função para obter o nome do motorista pelo ID
  const getDriverName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name || "Não informado";
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Veículos</h2>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Veículo</th>
              <th className="p-3">Motorista</th>
              <th className="p-3">Ano</th>
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
                      <p className="text-gray-500 text-xs">{v.model}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3">{getDriverName(v.userId)}</td>
                <td className="p-3">{v.year || "N/A"}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${v.active === false ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                    {v.active === false ? "Inativo" : "Ativo"}
                  </span>
                </td>
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
