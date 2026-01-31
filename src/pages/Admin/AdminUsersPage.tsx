import { useEffect, useState, useMemo } from "react";
import { listenUsers, type AppUser } from "../../services/usersService";
import { listenAllVehicles, type Vehicle } from "../../services/vehiclesService";
import { Users, Car, AlertTriangle, Users2, Filter, X } from "lucide-react";

const AdminUsersPage = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [hoveredPlate, setHoveredPlate] = useState<string | null>(null);

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

  // Função para obter todos os usuários que usam a mesma placa
  const getUsersWithSamePlate = (plate: string) => {
    if (!plate) return [];
    
    const normalizedPlate = plate.toUpperCase();
    const samePlateUsers: Array<{ userId: string; userName: string; filial: string }> = [];
    
    vehicles.forEach(vehicle => {
      if (vehicle.plate && vehicle.plate.toUpperCase() === normalizedPlate) {
        const user = users.find(u => u.id === vehicle.userId);
        if (user) {
          samePlateUsers.push({
            userId: user.id,
            userName: user.name || user.id,
            filial: user.filial || 'Não informada'
          });
        }
      }
    });
    
    // Remove duplicatas e ordena por nome
    const uniqueUsers = samePlateUsers.filter((user, index, self) => 
      index === self.findIndex((u) => u.userId === user.userId)
    );
    
    return uniqueUsers.sort((a, b) => a.userName.localeCompare(b.userName, 'pt-BR'));
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
                          const samePlateUsers = getUsersWithSamePlate(vehicle.plate);
                          
                          return (
                            <div key={vehicle.id} className="relative">
                              <div 
                                className="flex items-center gap-2 cursor-help"
                                onMouseEnter={() => isDuplicate && setHoveredPlate(vehicle.plate)}
                                onMouseLeave={() => setHoveredPlate(null)}
                                onClick={() => isDuplicate && setHoveredPlate(hoveredPlate === vehicle.plate ? null : vehicle.plate)}
                              >
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
                              
                              {/* Tooltip com nomes dos usuários */}
                              {hoveredPlate === vehicle.plate && isDuplicate && (
                                <div className="absolute z-10 bottom-full left-0 mb-2 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg border border-gray-700 min-w-max">
                                  <div className="font-semibold mb-2 text-yellow-400">
                                    Usuários com placa {vehicle.plate}:
                                  </div>
                                  <div className="space-y-1">
                                    {samePlateUsers.map((user) => (
                                      <div key={user.userId} className="flex items-center justify-between gap-4">
                                        <span className="flex items-center gap-2">
                                          <Users size={12} className="text-gray-400" />
                                          {user.userName}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                          {user.filial}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="absolute bottom-0 left-4 transform translate-y-full">
                                    <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                  </div>
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
