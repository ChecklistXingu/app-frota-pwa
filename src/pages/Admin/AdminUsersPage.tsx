import { useEffect, useState } from "react";
import { listenUsers, type AppUser } from "../../services/usersService";
import { listenVehicles, type Vehicle } from "../../services/vehiclesService";
import { Users, Car } from "lucide-react";

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

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Usuários</h2>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Nome</th>
              <th className="p-3">Telefone</th>
              <th className="p-3">Filial</th>
              <th className="p-3">Placa do Carro</th>
              <th className="p-3">Papel</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
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
                    <span>{getUserVehiclePlate(u.id)}</span>
                  </div>
                </td>
                <td className="p-3">{u.role || 'driver'}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={5}>Nenhum usuário encontrado</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsersPage;
