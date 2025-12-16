import { useEffect, useMemo, useState } from "react";
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
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const { profile } = useAuth();

  const [ticketModal, setTicketModal] = useState<{ open: boolean; maintenance: Maintenance | null }>({
    open: false,
    maintenance: null,
  });
  const [ticketForm, setTicketForm] = useState({
    workshopName: "",
    scheduledFor: "",
    forecastedCompletion: "",
    forecastedCost: "",
    managerNote: "",
  });
  const [savingTicket, setSavingTicket] = useState(false);
  const [completionModal, setCompletionModal] = useState<{ open: boolean; maintenance: Maintenance | null; date: string; cost: string }>({
    open: false,
    maintenance: null,
    date: "",
    cost: "",
  });
  const [completing, setCompleting] = useState(false);
  const [photoModal, setPhotoModal] = useState<{ open: boolean; photos: string[]; maintenance: Maintenance | null }>({
    open: false,
    photos: [],
    maintenance: null,
  });
  const [audioModal, setAudioModal] = useState<{ open: boolean; url: string | null; duration?: number | null; maintenance: Maintenance | null }>({
    open: false,
    url: null,
    duration: null,
    maintenance: null,
  });

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
      const seedCost = typeof maintenance.finalCost === "number" ? maintenance.finalCost : maintenance.forecastedCost;
      setCompletionModal({
        open: true,
        maintenance,
        date: toInputDateTime(new Date()),
        cost: seedCost ? seedCost.toString() : "",
      });
      return;
    }
    // Optimistic UI update
    const previous = items;
    try {
      setItems((prev) => prev.map((it) => it.id === maintenance.id ? { ...it, status } : it));
      await updateMaintenanceStatus(maintenance.id, status, {
        managerId: profile?.id,
      });
    } catch (err: any) {
      // Revert on failure
      console.error("Erro ao atualizar status:", err);
      setItems(previous);
      // Mensagem específica para permissão negada
      if (err && err.code === 'permission-denied') {
        alert("Permissão negada: verifique se seu usuário tem role 'admin' na coleção users do Firestore.");
      } else {
        alert("Erro ao atualizar status. Verifique a conexão ou as permissões e tente novamente.");
      }
    }
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
      forecastedCost: maintenance.forecastedCost ? maintenance.forecastedCost.toString() : "",
      managerNote: maintenance.managerNote || "",
    });
  };

  const closeTicketModal = () => {
    setTicketModal({ open: false, maintenance: null });
    setTicketForm({ workshopName: "", scheduledFor: "", forecastedCompletion: "", forecastedCost: "", managerNote: "" });
    setSavingTicket(false);
  };

  const handleTicketSubmit = async () => {
    if (!ticketModal.maintenance) return;
    setSavingTicket(true);
    try {
      const scheduledDate = ticketForm.scheduledFor ? new Date(ticketForm.scheduledFor) : null;
      const forecastedDate = ticketForm.forecastedCompletion ? new Date(ticketForm.forecastedCompletion) : null;
      const forecastedCost = ticketForm.forecastedCost ? Number(ticketForm.forecastedCost) : undefined;
      await updateMaintenanceStatus(ticketModal.maintenance.id, "scheduled", {
        workshopName: ticketForm.workshopName || undefined,
        scheduledFor: scheduledDate || undefined,
        forecastedCompletion: forecastedDate || undefined,
        forecastedCost: forecastedCost && !Number.isNaN(forecastedCost) ? forecastedCost : undefined,
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
      const finalCost = completionModal.cost ? Number(completionModal.cost) : undefined;
      await updateMaintenanceStatus(completionModal.maintenance.id, "done", {
        completedAt: completedDate,
        finalCost: finalCost && !Number.isNaN(finalCost) ? finalCost : undefined,
        managerId: profile?.id,
      });
      setCompletionModal({ open: false, maintenance: null, date: "", cost: "" });
    } catch (error) {
      console.error("Erro ao finalizar manutenção", error);
    } finally {
      setCompleting(false);
    }
  };

  // Função para obter o nome do usuário pelo ID
  const userBranchMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((user) => {
      const normalized = (user.filial || "").trim();
      map.set(user.id, normalized || "--");
    });
    return map;
  }, [users]);

  const branchOptions = useMemo(() => {
    const unique = new Set<string>();
    users.forEach((user) => {
      const branch = (user.filial || "").trim();
      if (branch) {
        unique.add(branch);
      }
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [users]);

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name || userId;
  };

  const getUserBranch = (userId: string) => {
    return userBranchMap.get(userId) || "--";
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

  const getSortTime = (m: Maintenance) => {
    const source = m.createdAt || (m as any).date || m.updatedAt;
    if (!source) return 0;
    if ((source as any).seconds) return (source as any).seconds * 1000;
    if ((source as any).toDate) return (source as any).toDate().getTime();
    const date = new Date(source as any);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  };

  const formatDurationSeconds = (value?: number | null) => {
    if (value == null || Number.isNaN(value)) return "";
    const totalSeconds = Math.max(0, Math.round(value));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const filteredItems = useMemo(() => {
    return items.filter((maintenance) => {
      const branchMatches =
        branchFilter === "all" || (userBranchMap.get(maintenance.userId) || "--") === branchFilter;
      const statusMatches = filter === "all" || (maintenance.status || "pending") === filter;
      return branchMatches && statusMatches;
    });
  }, [items, branchFilter, userBranchMap, filter]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => getSortTime(b) - getSortTime(a));
  }, [filteredItems]);

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold">Manutenções</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="all">Todas as filiais</option>
              {branchOptions.map((branch) => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
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
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">Solicitação</th>
                <th className="p-3">Motorista</th>
                <th className="p-3">Filial</th>
                <th className="p-3">Veículo</th>
                <th className="p-3">Status</th>
                <th className="p-3 w-40">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((m) => (
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
                  <td className="p-3">{getUserBranch(m.userId)}</td>
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
                    {m.completedAt && (
                      <p className="text-xs text-gray-500">Finalizado: {formatDate(m.completedAt)}</p>
                    )}
                    {typeof m.finalCost === "number" && (
                      <p className="text-xs text-emerald-600 font-medium">Valor final: R$ {m.finalCost.toFixed(2)}</p>
                    )}
                    {typeof m.finalCost !== "number" && typeof m.forecastedCost === "number" && (
                      <p className="text-xs text-gray-500">Previsão de valor: R$ {m.forecastedCost.toFixed(2)}</p>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end sm:gap-2">
                      <div className="flex-shrink-0">
                        <select
                          value={m.status || "pending"}
                          onChange={(e) => onChangeStatus(m, e.target.value as MaintenanceStatus)}
                          className="w-36 h-10 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-semibold px-3"
                        >
                          {statusOptions.map((s) => (
                            <option key={s} value={s}>{statusLabels[s]}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex gap-2 flex-wrap mt-2 sm:mt-0">
                        <button
                          type="button"
                          onClick={() => openTicketModal(m)}
                          className="w-36 h-10 rounded-lg border border-blue-600 text-blue-600 text-xs font-semibold hover:bg-blue-50"
                        >
                          {m.status === "scheduled" ? "Editar ticket" : "Abrir ticket"}
                        </button>

                        { (m as any).photos?.length ? (
                          <button
                            type="button"
                            onClick={() => setPhotoModal({ open: true, photos: (m as any).photos || [], maintenance: m })}
                            className="w-36 h-10 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50"
                          >
                            Ver fotos ({(m as any).photos.length})
                          </button>
                        ) : null}

                        {(m as any).audioUrl ? (
                          <button
                            type="button"
                            onClick={() => setAudioModal({ open: true, url: (m as any).audioUrl || null, duration: (m as any).audioDurationSeconds ?? null, maintenance: m })}
                            className="w-36 h-10 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50"
                          >
                            Ouvir áudio
                          </button>
                        ) : (m as any).audioDurationSeconds ? (
                          <div className="text-xs text-gray-500 flex items-center h-10">Áudio enviado offline</div>
                        ) : null}
                      </div>
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
            {/* Audio modal */}
            {audioModal.open && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl w-full max-w-md p-5 shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-800">Áudio do motorista</h3>
                    <button onClick={() => setAudioModal({ open: false, url: null, duration: null, maintenance: null })} className="p-1 text-gray-400 hover:text-gray-600"><ChevronDown size={18} /></button>
                  </div>
                  <div className="space-y-4">
                    {audioModal.url ? (
                      <div>
                        <audio controls src={audioModal.url} className="w-full" />
                        {typeof audioModal.duration === "number" && (
                          <p className="text-[12px] text-gray-500 mt-2">Duração: {formatDate(audioModal.duration)}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">Áudio ainda não disponível (pendente de sincronização).</p>
                    )}
                    <div className="flex justify-end">
                      <button onClick={() => setAudioModal({ open: false, url: null, duration: null, maintenance: null })} className="px-4 py-2 rounded bg-gray-200">Fechar</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* Layout mobile */}
          <div className="md:hidden divide-y border-t">
            {sortedItems.length === 0 && (
              <p className="p-6 text-center text-gray-500">Nenhuma solicitação encontrada</p>
            )}
            {sortedItems.map((m) => (
              <div key={`card-${m.id}`} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#ffd300]/30 flex items-center justify-center text-[#0d2d6c]">
                    <Wrench size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#0d2d6c] leading-tight">{getMaintenanceItems(m)}</p>
                    {getNotes(m) && (
                      <p className="text-xs text-gray-600 truncate">Obs: {getNotes(m)}</p>
                    )}
                    <p className="text-[11px] text-gray-400">{formatDate(m.createdAt || (m as any).date)}</p>
                  </div>
                  <StatusBadge status={m.status || "pending"} />
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                  <div>
                    <p className="font-semibold text-gray-500">Motorista</p>
                    <p className="text-sm text-gray-800">{getUserName(m.userId)}</p>
                    <p className="text-[11px] text-gray-400">Filial: {getUserBranch(m.userId)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-500">Veículo</p>
                    <p className="text-sm text-gray-800 leading-tight">{getVehicleInfo(m.vehicleId)}</p>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-gray-600">
                  {m.workshopName && <p>Oficina: <strong>{m.workshopName}</strong></p>}
                  {m.scheduledFor && <p>Agendado: {formatDate(m.scheduledFor)}</p>}
                  {m.forecastedCompletion && <p>Previsão: {formatDate(m.forecastedCompletion)}</p>}
                  {m.completedAt && <p>Finalizado: {formatDate(m.completedAt)}</p>}
                  {(m as any).audioUrl ? (
                    <div className="mt-2">
                      <audio controls src={(m as any).audioUrl} className="w-full" preload="none" />
                      {typeof (m as any).audioDurationSeconds === "number" && (
                        <p className="text-[10px] text-gray-500">Duração: {formatDurationSeconds((m as any).audioDurationSeconds)}</p>
                      )}
                    </div>
                  ) : (m as any).audioDurationSeconds ? (
                    <p className="mt-2 text-[10px] text-gray-500">Áudio enviado offline</p>
                  ) : null}
                  {typeof m.finalCost === "number" && (
                    <p className="text-emerald-600 font-semibold">Valor final: R$ {m.finalCost.toFixed(2)}</p>
                  )}
                  {typeof m.finalCost !== "number" && typeof m.forecastedCost === "number" && (
                    <p>Previsão de valor: R$ {m.forecastedCost.toFixed(2)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="relative">
                    <select
                      value={m.status || "pending"}
                      onChange={(e) => onChangeStatus(m, e.target.value as MaintenanceStatus)}
                      className="w-full appearance-none border rounded-lg px-3 py-2 pr-9 text-sm"
                    >
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>{statusLabels[s]}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => openTicketModal(m)}
                      className="flex-1 inline-flex items-center justify-center rounded-md border border-[#0d2d6c] px-3 py-2 text-xs font-semibold text-[#0d2d6c] hover:bg-[#0d2d6c]/10"
                    >
                      {m.status === "scheduled" ? "Editar ticket" : "Abrir ticket"}
                    </button>
                    {m.photos?.length ? (
                      <button
                        type="button"
                        onClick={() => setPhotoModal({ open: true, photos: m.photos || [], maintenance: m })}
                        className="flex-1 inline-flex items-center justify-center rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                      >
                        Ver fotos ({m.photos.length})
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
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
                <label className="text-xs font-semibold text-gray-600">Previsão de valor</label>
                <div className="mt-1 flex items-center rounded-lg border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-[#0d2d6c]">
                  <span className="text-gray-400 mr-2">R$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ticketForm.forecastedCost}
                    onChange={(e) => setTicketForm((prev) => ({ ...prev, forecastedCost: e.target.value }))}
                    className="w-full bg-transparent focus:outline-none"
                    placeholder="0,00"
                  />
                </div>
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
              <div>
                <label className="text-xs font-semibold text-gray-600">Valor final do serviço</label>
                <div className="mt-1 flex items-center rounded-lg border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-[#0d2d6c]">
                  <span className="text-gray-400 mr-2">R$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={completionModal.cost}
                    onChange={(e) => setCompletionModal((prev) => ({ ...prev, cost: e.target.value }))}
                    className="w-full bg-transparent focus:outline-none"
                    placeholder="0,00"
                  />
                </div>
                {completionModal.maintenance?.forecastedCost && (
                  <p className="text-xs text-gray-500 mt-1">
                    Previsão original: R$ {completionModal.maintenance?.forecastedCost?.toFixed(2)}
                  </p>
                )}
                {completionModal.maintenance?.forecastedCost && completionModal.cost && (
                  <p className="text-xs mt-1 text-gray-500">
                    Diferença: R$ {(Number(completionModal.cost) - (completionModal.maintenance?.forecastedCost || 0)).toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCompletionModal({ open: false, maintenance: null, date: "", cost: "" })}
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

      {photoModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Fotos da manutenção</h3>
                {photoModal.maintenance && (
                  <p className="text-sm text-gray-500">{getMaintenanceItems(photoModal.maintenance)}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPhotoModal({ open: false, photos: [], maintenance: null })}
                className="rounded-md border border-gray-200 px-3 py-1 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>

            {photoModal.photos.length ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {photoModal.photos.map((url, idx) => (
                  <a
                    key={`${url}-${idx}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border bg-gray-50 p-2 hover:border-[#0d2d6c]"
                  >
                    <img
                      src={url}
                      alt={`Foto ${idx + 1}`}
                      className="w-full h-40 object-contain"
                    />
                    <p className="mt-2 text-xs text-gray-500 text-center">Abrir em nova aba</p>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Nenhuma foto disponível.</p>
            )}
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
