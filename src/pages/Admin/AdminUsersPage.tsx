import { useEffect, useState, useMemo } from "react";
import { listenUsers, type AppUser } from "../../services/usersService";
import { listenVehicles, type Vehicle } from "../../services/vehiclesService";
import { Users, Car, AlertTriangle, Users2 } from "lucide-react";

const AdminUsersPage = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    const unsubUsers = listenUsers(setUsers);
    const unsubVehicles = listenVehicles({}, setVehicles);
    return () => {
      unsubUsers();
      unsubVehicles();
    };
  }, []);

  // Função para obter a placa do veículo do usuário
  const getUserVehiclePlate = (userId: string) => {
    const userVehicle = vehicles.find(v => v.userId === userId);
    return userVehicle ? userVehicle.plate : '-';
  };

  // Analisa duplicatas de placas
  const plateAnalysis = useMemo(() => {
    const plateCount = new Map<string, number>();
    
    // Conta quantos usuários têm cada placa (ignorando case)
    users.forEach(user => {
      const plate = getUserVehiclePlate(user.id);
      if (plate !== '-') {
        // Normaliza a placa para maiúsculas para comparação
        const normalizedPlate = plate.toUpperCase();
        plateCount.set(normalizedPlate, (plateCount.get(normalizedPlate) || 0) + 1);
      }
    });
    
    return plateCount;
  }, [users, vehicles]);

  // Função para obter o status da placa para um usuário
  const getPlateStatus = (userId: string) => {
    const plate = getUserVehiclePlate(userId);
    if (plate === '-') return { count: 0, isDuplicate: false, color: 'text-gray-400' };
    
    // Normaliza a placa para comparação
    const normalizedPlate = plate.toUpperCase();
    const count = plateAnalysis.get(normalizedPlate) || 0;
    const isDuplicate = count > 1;
    
    let color = 'text-green-600'; // Único
    if (count >= 3) color = 'text-red-600'; // 3+ usuários
    else if (isDuplicate) color = 'text-yellow-600'; // 2 usuários
    
    return { count, isDuplicate, color };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Usuários</h2>
        
        {/* Legenda de alertas de placas */}
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            Placa única
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            Placa duplicada
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            Placa com 3+ usuários
          </span>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Nome</th>
              <th className="p-3">Telefone</th>
              <th className="p-3">Filial</th>
              <th className="p-3">Placa do Carro</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const plateStatus = getPlateStatus(u.id);
              const plate = getUserVehiclePlate(u.id);
              
              return (
                <tr key={u.id} className="border-t">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-[#ffd300]/30 flex items-center justify-center text-[#0d2d6c]"><Users size={16} /></div>
                      <div>
                        <p className="font-medium">{u.name || u.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">{u.phone || '-'}</td>
                  <td className="p-3">{u.filial || '-'}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Car size={14} className="text-gray-400" />
                      <span className={plateStatus.color}>{plate}</span>
                      {plateStatus.isDuplicate && (
                        <div className="flex items-center gap-1">
                          {plateStatus.count >= 3 ? (
                            <AlertTriangle size={14} className="text-red-500" />
                          ) : (
                            <Users2 size={14} className="text-yellow-500" />
                          )}
                          <span className={`text-xs font-medium ${plateStatus.color}`}>
                            ({plateStatus.count})
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={4}>Nenhum usuário encontrado</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsersPage;
