import { useEffect, useState } from "react";
import { listenUsers, type AppUser } from "../../services/usersService";
import { Users } from "lucide-react";

const AdminUsersPage = () => {
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    const unsub = listenUsers(setUsers);
    return () => unsub();
  }, []);

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
                <td className="p-3">{u.role || 'driver'}</td>
              </tr>
            ))}
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
