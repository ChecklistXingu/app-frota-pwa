import { useEffect, useState } from "react";
import { listenMaintenances, updateMaintenanceStatus, type Maintenance, type MaintenanceStatus } from "../../services/maintenanceService";
import { listenVehicles, type Vehicle } from "../../services/vehiclesService";
import { listenUsers, type AppUser } from "../../services/usersService";
import { ChevronDown, Wrench } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const statusOptions: MaintenanceStatus[] = ["pending", "in_review", "scheduled", "done"];

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  in_review: "Em análise",
  scheduled: "Agendado",
  done: "Finalizado",
  all: "Todas",
};

const AdminMaintenancePage = () => {
  const [items, setItems] = useState<Maintenance[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filter, setFilter] = useState<MaintenanceStatus | "all">("all");
  const { profile } = useAuth();

  const [ticketModal, setTicketModal] = useState<{ open: boolean; maintenance: Maintenance | null }>({
    open: false,
    maintenance: null,
  });
  const [ticketForm, setTicketForm] = useState({
    workshopName: "",
    scheduledFor: "",
    forecastedCompletion: "",
    managerNote: "",
  });
  const [savingTicket, setSavingTicket] = useState(false);
  const [completionModal, setCompletionModal] = useState<{ open: boolean; maintenance: Maintenance | null; date: string }>({
    open: false,
    maintenance: null,
    date: "",
  });
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    const unsub1 = listenMaintenances(
      filter === "all" ? {} : { status: filter },
      setItems
    );
    const unsub2 = listenUsers(setUsers);
    const unsub3 = listenVehicles({}, setVehicles);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [filter]);

  const onChangeStatus = async (maintenance: Maintenance, status: MaintenanceStatus) => {
    if (status === "scheduled") {
      openTicketModal(maintenance);
      return;
    }
    if (status === "done") {
      setCompletionModal({ open: true, maintenance, date: toInputDateTime(new Date()) });
      return;
    }
    await updateMaintenanceStatus(maintenance.id, status, {
      managerId: profile?.id,
    });
  };

  const toInputDateTime = (value: any) => {
    if (!value) return "";
    const date = value?.toDate ? value.toDate() : value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 16);
  };

  const openTicketModal = (maintenance: Maintenance) => {
    setTicketModal({ open: true, maintenance });
    setTicketForm({
      workshopName: maintenance.workshopName || "",
      scheduledFor: toInputDateTime(maintenance.scheduledFor) || "",
      forecastedCompletion: toInputDateTime(maintenance.forecastedCompletion) || "",
      managerNote: maintenance.managerNote || "",
    });
  };

  const closeTicketModal = () => {
    setTicketModal({ open: false, maintenance: null });
    setTicketForm({ workshopName: "", scheduledFor: "", forecastedCompletion: "", managerNote: "" });
    setSavingTicket(false);
  };

  const handleTicketSubmit = async () => {
    if (!ticketModal.maintenance) return;
    setSavingTicket(true);
    try {
      const scheduledDate = ticketForm.scheduledFor ? new Date(ticketForm.scheduledFor) : null;
      const forecastedDate = ticketForm.forecastedCompletion ? new Date(ticketForm.forecastedCompletion) : null;
      await updateMaintenanceStatus(ticketModal.maintenance.id, "scheduled", {
        workshopName: ticketForm.workshopName || undefined,
        scheduledFor: scheduledDate || undefined,
        forecastedCompletion: forecastedDate || undefined,
        managerNote: ticketForm.managerNote || undefined,
        managerId: profile?.id,
      });
      closeTicketModal();
    } catch (error) {
      console.error("Erro ao salvar ticket", error);
      setSavingTicket(false);
    }
  };

  const handleCompleteSubmit = async () => {
    if (!completionModal.maintenance) return;
    setCompleting(true);
    try {
      const completedDate = completionModal.date ? new Date(completionModal.date) : new Date();
      await updateMaintenanceStatus(completionModal.maintenance.id, "done", {
        completedAt: completedDate,
        managerId: profile?.id,
      });
      setCompletionModal({ open: false, maintenance: null, date: "" });
    } catch (error) {
      console.error("Erro ao finalizar manutenção", error);
    } finally {
      setCompleting(false);
    }
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

  const getNotes = (m: Maintenance) => {
    return (m as any).notes || m.managerNote || "";
  };

  return (
    <>
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
                    {m.workshopName && (
                      <p className="text-xs text-gray-500 mt-1">Oficina: {m.workshopName}</p>
                    )}
                    {m.scheduledFor && (
                      <p className="text-xs text-gray-500">Agendado: {formatDate(m.scheduledFor)}</p>
                    )}
                    {m.forecastedCompletion && (
                      <p className="text-xs text-gray-500">Previsão: {formatDate(m.forecastedCompletion)}</p>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="relative inline-block">
                      <select
                        value={m.status || "pending"}
                        onChange={(e) => onChangeStatus(m, e.target.value as MaintenanceStatus)}
                        className="appearance-none border rounded-lg px-3 py-2 pr-8 bg-white"
                      >
                        {statusOptions.map((s) => (
                          <option key={s} value={s}>{statusLabels[s]}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                    <button
                      type="button"
                      onClick={() => openTicketModal(m)}
                      className="mt-2 inline-flex items-center rounded-md border border-[#0d2d6c] px-3 py-1 text-xs font-semibold text-[#0d2d6c] hover:bg-[#0d2d6c]/10"
                    >
                      {m.status === "scheduled" ? "Editar ticket" : "Abrir ticket"}
                    </button>
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

      {ticketModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-1">{ticketModal.maintenance?.status === "scheduled" ? "Editar ticket" : "Abrir ticket"}</h3>
            <p className="text-sm text-gray-500 mb-4">Informe a oficina e a data programada para que o motorista acompanhe o processo.</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600">Oficina</label>
                <input
                  type="text"
                  value={ticketForm.workshopName}
                  onChange={(e) => setTicketForm((prev) => ({ ...prev, workshopName: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d2d6c]"
                  placeholder="Ex: Oficina Centro"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Data/Hora agendada</label>
                <input
                  type="datetime-local"
                  value={ticketForm.scheduledFor}
                  onChange={(e) => setTicketForm((prev) => ({ ...prev, scheduledFor: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d2d6c]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Previsão de finalização do conserto</label>
                <input
                  type="datetime-local"
                  value={ticketForm.forecastedCompletion}
                  onChange={(e) => setTicketForm((prev) => ({ ...prev, forecastedCompletion: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d2d6c]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Observação</label>
                <textarea
                  value={ticketForm.managerNote}
                  onChange={(e) => setTicketForm((prev) => ({ ...prev, managerNote: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d2d6c]"
                  rows={3}
                  placeholder="Detalhes para o motorista"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeTicketModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600"
                disabled={savingTicket}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleTicketSubmit}
                className="rounded-lg bg-[#0d2d6c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b2559] disabled:opacity-60"
                disabled={savingTicket}
              >
                {savingTicket ? "Salvando..." : "Salvar ticket"}
              </button>
            </div>
          </div>
        </div>
      )}

      {completionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-1">Finalizar manutenção</h3>
            <p className="text-sm text-gray-500 mb-4">Informe a data/hora real da finalização.</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600">Data/Hora da finalização</label>
                <input
                  type="datetime-local"
                  value={completionModal.date}
                  onChange={(e) => setCompletionModal((prev) => ({ ...prev, date: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d2d6c]"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCompletionModal({ open: false, maintenance: null, date: "" })}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600"
                disabled={completing}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCompleteSubmit}
                className="rounded-lg bg-[#0d2d6c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b2559] disabled:opacity-60"
                disabled={completing}
              >
                {completing ? "Finalizando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const StatusBadge = ({ status }: { status: MaintenanceStatus }) => {
  const map: Record<MaintenanceStatus, string> = {
    pending: "bg-orange-100 text-orange-800",
    in_review: "bg-blue-100 text-blue-800",
    scheduled: "bg-purple-100 text-purple-800",
    done: "bg-emerald-100 text-emerald-800",
  };
  return <span className={`px-2 py-1 rounded-md text-xs font-medium ${map[status]}`}>{statusLabels[status]}</span>;
};

export default AdminMaintenancePage;
