import { useEffect, useState, type ReactNode } from "react";
import { listenMaintenances, type Maintenance } from "../../services/maintenanceService";
import { listenVehicles, type Vehicle } from "../../services/vehiclesService";
import { listenUsers, type AppUser } from "../../services/usersService";
import { Wrench, Car, Users, CheckCircle2, Clock } from "lucide-react";

const AdminDashboardPage = () => {
  const [maint, setMaint] = useState<Maintenance[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    const unsub1 = listenMaintenances({}, setMaint);
    const unsub2 = listenVehicles({}, setVehicles);
    const unsub3 = listenUsers(setUsers);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const pending = maint.filter(m => m.status === "pending" || m.status === "in_review" || m.status === "in_progress").length;
  const done = maint.filter(m => m.status === "done" || m.status === "completed").length;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Visão geral</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Wrench />} title="Manutenções" value={maint.length} />
        <StatCard icon={<Clock />} title="Pendentes" value={pending} />
        <StatCard icon={<CheckCircle2 />} title="Concluídas" value={done} />
        <StatCard icon={<Car />} title="Veículos" value={vehicles.length} />
        <StatCard icon={<Users />} title="Usuários" value={users.length} />
      </div>

      <section className="bg-white border rounded-xl p-4">
        <h3 className="font-semibold mb-3">Últimas solicitações</h3>
        <div className="divide-y">
          {maint.slice(0, 8).map((m) => (
            <div key={m.id} className="py-2 flex items-center justify-between text-sm">
              <div className="truncate">
                <p className="font-medium">{m.description || "Checklist de manutenção"}</p>
                <p className="text-gray-500">Veículo: {m.vehicleId} • Usuário: {m.userId}</p>
              </div>
              <StatusBadge status={m.status} />
            </div>
          ))}
          {maint.length === 0 && <p className="text-gray-500 text-sm">Sem dados ainda.</p>}
        </div>
      </section>
    </div>
  );
};

const StatCard = ({ icon, title, value }: { icon: ReactNode; title: string; value: number }) => (
  <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
    <div className="w-10 h-10 rounded-lg bg-[#ffd300]/30 flex items-center justify-center text-[#0d2d6c]">
      {icon}
    </div>
    <div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  </div>
);

const StatusBadge = ({ status }: { status: Maintenance["status"] }) => {
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

export default AdminDashboardPage;
