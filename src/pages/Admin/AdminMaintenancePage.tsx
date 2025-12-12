import { useEffect, useState } from "react";
import { listenMaintenances, updateMaintenanceStatus, type Maintenance, type MaintenanceStatus } from "../../services/maintenanceService";
import { listenVehicles, type Vehicle } from "../../services/vehiclesService";
import { listenUsers, type AppUser } from "../../services/usersService";
import { ChevronDown, Wrench } from "lucide-react";

const statusOptions: MaintenanceStatus[] = [
  "pending",
  "in_progress",
  "in_review",
  "approved",
  "rejected",
  "scheduled",
  "completed",
  "done",
];

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  in_review: "Em análise",
  approved: "Aprovado",
  rejected: "Rejeitado",
  scheduled: "Agendado",
  completed: "Concluído",
  done: "Finalizado",
  all: "Todas",
};

const AdminMaintenancePage = () => {
  const [items, setItems] = useState<Maintenance[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filter, setFilter] = useState<MaintenanceStatus | "all">("all");

  useEffect(() => {
    const unsub1 = listenMaintenances(
      filter === "all" ? {} : { status: filter },
      setItems
    );
    const unsub2 = listenUsers(setUsers);
    const unsub3 = listenVehicles({}, setVehicles);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [filter]);

  const onChangeStatus = async (id: string, status: MaintenanceStatus) => {
    await updateMaintenanceStatus(id, status);
  };

  // Função para obter o nome do usuário pelo ID
  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name || userId;
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
    
    // Se for um Timestamp do Firestore (tem seconds)
    if (dateField.seconds) {
      return new Date(dateField.seconds * 1000).toLocaleString("pt-BR");
    }
    
    // Se for um objeto Date do Firestore (toDate)
    if (dateField.toDate) {
      return dateField.toDate().toLocaleString("pt-BR");
    }
    
    // Se for uma string ou Date normal
    return new Date(dateField).toLocaleString("pt-BR");
  };

  // Função para obter os itens marcados da manutenção
  const getMaintenanceItems = (m: Maintenance) => {
    // Pega os itens marcados (status: true)
    const checkedItems = m.items?.filter(item => item.status)?.map(item => item.name) || [];
    
    if (checkedItems.length > 0) {
      return checkedItems.join(", ");
    }
    
    return m.description || "Checklist de manutenção";
  };

  // Função para obter a observação
  const getNotes = (m: Maintenance) => {
    return (m as any).notes || m.managerNote || "";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Manutenções</h2>
        <div className="flex items-center gap-2">
          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <option value="all">Todas</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{statusLabels[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Solicitação</th>
              <th className="p-3">Motorista</th>
              <th className="p-3">Veículo</th>
              <th className="p-3">Status</th>
              <th className="p-3 w-40">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-[#ffd300]/30 flex items-center justify-center text-[#0d2d6c]"><Wrench size={16} /></div>
                    <div>
                      <p className="font-medium truncate max-w-[340px]">{getMaintenanceItems(m)}</p>
                      {getNotes(m) && (
                        <p className="text-gray-600 text-xs truncate max-w-[340px]">Obs: {getNotes(m)}</p>
                      )}
                      <p className="text-gray-400 text-xs">{formatDate(m.createdAt || (m as any).date)}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3">{getUserName(m.userId)}</td>
                <td className="p-3">{getVehicleInfo(m.vehicleId)}</td>
                <td className="p-3">
                  <StatusBadge status={m.status || "pending"} />
                </td>
                <td className="p-3">
                  <div className="relative inline-block">
                    <select
                      value={m.status || "pending"}
                      onChange={(e) => onChangeStatus(m.id, e.target.value as MaintenanceStatus)}
                      className="appearance-none border rounded-lg px-3 py-2 pr-8 bg-white"
                    >
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>{statusLabels[s]}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={5}>Nenhuma solicitação encontrada</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: MaintenanceStatus }) => {
  const map: Record<string, string> = {
    pending: "bg-orange-100 text-orange-800",
    in_progress: "bg-blue-100 text-blue-800",
    in_review: "bg-blue-100 text-blue-800",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-800",
    scheduled: "bg-purple-100 text-purple-800",
    completed: "bg-gray-100 text-gray-800",
    done: "bg-gray-100 text-gray-800",
  };
  return <span className={`px-2 py-1 rounded-md text-xs font-medium ${map[status]}`}>{statusLabels[status] || status}</span>;
};

export default AdminMaintenancePage;
