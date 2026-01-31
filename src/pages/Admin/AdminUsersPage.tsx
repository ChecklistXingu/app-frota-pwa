import { useEffect, useState, useMemo } from "react";
import { listenUsers, type AppUser } from "../../services/usersService";
import { listenAllVehicles, type Vehicle } from "../../services/vehiclesService";
import { Users, Car, AlertTriangle, Users2, Filter, X } from "lucide-react";

const AdminUsersPage = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  useEffect(() => {
    const unsubUsers = listenUsers(setUsers);
    const unsubVehicles = listenAllVehicles({}, setVehicles);
    return () => {
      unsubUsers();
      unsubVehicles();
    };
  }, []);

  // Obter lista única de filiais para o filtro
  const branchOptions = useMemo(() => {
    const branches = new Set<string>();
    users.forEach(user => {
      if (user.filial && user.filial.trim()) {
        branches.add(user.filial.trim());
      }
    });
    return Array.from(branches).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [users]);

  // Filtrar usuários por filial selecionada
  const filteredUsers = useMemo(() => {
    if (selectedBranch === 'all') {
      return users;
    }
    return users.filter(user => 
      user.filial && user.filial.trim() === selectedBranch
    );
  }, [users, selectedBranch]);

  // Função para obter TODOS os veículos do usuário (incluindo duplicatas)
  const getUserVehicles = (userId: string) => {
    return vehicles.filter(v => v.userId === userId);
  };

  // Analisa duplicatas de placas (apenas para usuários filtrados)
  const plateAnalysis = useMemo(() => {
    const plateCount = new Map<string, number>();
    
    // Conta quantos usuários têm cada placa (ignorando case)
    filteredUsers.forEach(user => {
      const userVehicles = getUserVehicles(user.id);
      userVehicles.forEach(vehicle => {
        if (vehicle.plate) {
          // Normaliza a placa para maiúsculas para comparação
          const normalizedPlate = vehicle.plate.toUpperCase();
          plateCount.set(normalizedPlate, (plateCount.get(normalizedPlate) || 0) + 1);
        }
      });
    });
    
    return plateCount;
  }, [filteredUsers, vehicles]);

  // Função para obter a cor de uma placa específica baseada na contagem global
  const getPlateColor = (plate: string) => {
    if (!plate) return 'text-gray-400';
    
    const count = plateAnalysis.get(plate.toUpperCase()) || 0;
    
    if (count === 0) return 'text-gray-400';      // Sem placa
    if (count === 1) return 'text-green-600';      // Placa única
    if (count === 2) return 'text-yellow-600';     // Duplicada
    return 'text-red-600';                         // 3+ usuários
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold">Usuários</h2>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Filtro por filial */}
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <select 
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ffd300] focus:border-transparent"
            >
              <option value="all">Todas as Filiais</option>
              {branchOptions.map(branch => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
            {selectedBranch !== 'all' && (
              <button
                onClick={() => setSelectedBranch('all')}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                title="Limpar filtro"
              >
                <X size={14} className="text-gray-500" />
              </button>
            )}
          </div>
          
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
      </div>

      {/* Indicador de filtro ativo */}
      {selectedBranch !== 'all' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
          <Filter size={16} className="text-blue-600" />
          <span className="text-sm text-blue-800">
            Filtrando por filial: <strong>{selectedBranch}</strong> ({filteredUsers.length} {filteredUsers.length === 1 ? 'usuário' : 'usuários'})
          </span>
        </div>
      )}

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
            {filteredUsers.map((u) => {
              const userVehicles = getUserVehicles(u.id);
              
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
                    {userVehicles.length === 0 ? (
                      <span className="text-gray-400">-</span>
                    ) : (
                      <div className="space-y-1">
                        {userVehicles.map((vehicle) => {
                          const normalizedPlate = vehicle.plate.toUpperCase();
                          const count = plateAnalysis.get(normalizedPlate) || 0;
                          const isDuplicate = count > 1;
                          const plateColor = getPlateColor(vehicle.plate);
                          
                          return (
                            <div key={vehicle.id} className="flex items-center gap-2">
                              <Car size={14} className="text-gray-400" />
                              <span className={plateColor}>
                                {vehicle.plate}
                              </span>
                              {isDuplicate && (
                                <div className="flex items-center gap-1">
                                  {count >= 3 ? (
                                    <AlertTriangle size={12} className="text-red-500" />
                                  ) : (
                                    <Users2 size={12} className="text-yellow-500" />
                                  )}
                                  <span className={`text-xs font-medium ${plateColor}`}>
                                    ({count})
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredUsers.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={4}>
                  {selectedBranch === 'all' 
                    ? 'Nenhum usuário encontrado' 
                    : `Nenhum usuário encontrado na filial "${selectedBranch}"`
                  }
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsersPage;
