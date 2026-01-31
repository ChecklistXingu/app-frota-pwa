import { useEffect, useState, useMemo } from "react";
import { listenUsers, type AppUser } from "../../services/usersService";
import { listenVehicles, type Vehicle } from "../../services/vehiclesService";
import { Users, Car, AlertTriangle, Users2, Filter, X } from "lucide-react";

const AdminUsersPage = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  useEffect(() => {
    const unsubUsers = listenUsers(setUsers);
    const unsubVehicles = listenVehicles({}, setVehicles);
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

  // Função para obter a placa do veículo do usuário
  const getUserVehiclePlate = (userId: string) => {
    const userVehicle = vehicles.find(v => v.userId === userId);
    return userVehicle ? userVehicle.plate : '-';
  };

  // Analisa duplicatas de placas (apenas para usuários filtrados)
  const plateAnalysis = useMemo(() => {
    const plateCount = new Map<string, number>();
    
    // Conta quantos usuários têm cada placa (ignorando case)
    filteredUsers.forEach(user => {
      const plate = getUserVehiclePlate(user.id);
      if (plate !== '-') {
        // Normaliza a placa para maiúsculas para comparação
        const normalizedPlate = plate.toUpperCase();
        plateCount.set(normalizedPlate, (plateCount.get(normalizedPlate) || 0) + 1);
      }
    });
    
    return plateCount;
  }, [filteredUsers, vehicles]);

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
