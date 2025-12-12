import { useEffect, useState } from "react";
import { listenMaintenances, updateMaintenanceStatus, type Maintenance, type MaintenanceStatus } from "../../services/maintenanceService";
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

const AdminMaintenancePage = () => {
  const [items, setItems] = useState<Maintenance[]>([]);
  const [filter, setFilter] = useState<MaintenanceStatus | "all">("all");

  useEffect(() => {
    console.log("🔄 AdminMaintenancePage: Setting up listener with filter:", filter);
    const unsub = listenMaintenances(
      filter === "all" ? {} : { status: filter },
      (data) => {
        console.log("📊 AdminMaintenancePage: Received data:", data.length, "items");
        console.log("📋 Data:", data);
        setItems(data);
      }
    );
    return () => unsub();
  }, [filter]);

  const onChangeStatus = async (id: string, status: MaintenanceStatus) => {
    await updateMaintenanceStatus(id, status);
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
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Solicitação</th>
              <th className="p-3">Usuário</th>
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
                      <p className="font-medium truncate max-w-[340px]">{m.description || "Checklist de manutenção"}</p>
                      <p className="text-gray-500">{new Date(m.createdAt?.seconds ? m.createdAt.seconds * 1000 : Date.now()).toLocaleString()}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3">{m.userId || "N/A"}</td>
                <td className="p-3">{m.vehicleId || "N/A"}</td>
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
                        <option key={s} value={s}>{s}</option>
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
  return <span className={`px-2 py-1 rounded-md text-xs font-medium ${map[status]}`}>{status}</span>;
};

export default AdminMaintenancePage;
