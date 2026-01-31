import { useEffect, useState, useMemo } from "react";
import { listenVehicles, type Vehicle } from "../../services/vehiclesService";
import { listenUsers, type AppUser } from "../../services/usersService";
import { Car, User, Calendar, CheckCircle, XCircle } from "lucide-react";

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

  // Remove duplicatas de veículos com a mesma placa, mantendo o mais recente
  const uniqueVehicles = useMemo(() => {
    const vehicleMap = new Map<string, Vehicle>();
    
    vehicles.forEach(vehicle => {
      const existingVehicle = vehicleMap.get(vehicle.plate);
      
      // Se não existe ou se o veículo atual é mais recente (createdAt maior)
      if (!existingVehicle || 
          (vehicle.createdAt && existingVehicle.createdAt && 
           new Date(vehicle.createdAt).getTime() > new Date(existingVehicle.createdAt).getTime())) {
        vehicleMap.set(vehicle.plate, vehicle);
      }
    });
    
    return Array.from(vehicleMap.values());
  }, [vehicles]);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Veículos</h2>

      {/* Desktop Table - Hidden on mobile */}
      <div className="bg-white border rounded-xl overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
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
              {uniqueVehicles.map((v) => (
                <tr key={`desktop-${v.id}`} className="border-t hover:bg-gray-50">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-[#ffd300]/30 flex items-center justify-center text-[#0d2d6c]">
                        <Car size={16} />
                      </div>
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
              {uniqueVehicles.length === 0 && (
                <tr>
                  <td className="p-6 text-center text-gray-500" colSpan={4}>
                    Nenhum veículo encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards - Only shown on mobile */}
      <div className="md:hidden space-y-3">
        {uniqueVehicles.length === 0 ? (
          <div className="p-6 text-center text-gray-500 border rounded-xl bg-white">
            Nenhum veículo encontrado
          </div>
        ) : (
          uniqueVehicles.map((v) => (
            <div key={`mobile-${v.id}`} className="bg-white border rounded-xl p-4 space-y-3 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#ffd300]/30 flex items-center justify-center text-[#0d2d6c]">
                  <Car size={18} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#0d2d6c]">{v.plate}</p>
                  <p className="text-sm text-gray-600">{v.model}</p>
                </div>
                <span className={`px-2 py-1 rounded-md text-xs font-medium ${v.active === false ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                  {v.active === false ? "Inativo" : "Ativo"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-gray-400" />
                    <span className="font-medium">Motorista</span>
                  </div>
                  <p className="text-gray-800">{getDriverName(v.userId)}</p>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-gray-400" />
                    <span className="font-medium">Ano</span>
                  </div>
                  <p className="text-gray-800">{v.year || "N/A"}</p>
                </div>
              </div>

              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 text-sm">
                  {v.active === false ? (
                    <>
                      <XCircle size={16} className="text-red-500" />
                      <span className="text-gray-600">Veículo inativo</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} className="text-green-500" />
                      <span className="text-gray-600">Veículo ativo na frota</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminVehiclesPage;
