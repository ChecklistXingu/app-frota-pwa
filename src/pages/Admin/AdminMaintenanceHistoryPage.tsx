import { useEffect, useMemo, useState } from "react";
import { listenMaintenances, type Maintenance } from "../../services/maintenanceService";
import { listenAllVehicles, type Vehicle } from "../../services/vehiclesService";
import { listenUsers, type AppUser } from "../../services/usersService";
import { Wrench } from "lucide-react";

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  in_review: "Em análise",
  scheduled: "Agendado",
  done: "Finalizado",
  refused: "Recusado",
  all: "Todas",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const formatCurrency = (value: number) => currencyFormatter.format(value || 0);

const formatQuantity = (value: number) => value.toString().replace(".", ",");

const getDetailedItems = (maintenance: Maintenance) => {
  const directorItems = maintenance.directorApproval?.items || [];
  if (directorItems.length > 0) {
    return directorItems.map((item) => {
      const quantity = typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1;
      const total = typeof item.cost === "number" ? item.cost : quantity * (typeof item.unitCost === "number" ? item.unitCost : 0);
      const unitCost = typeof item.unitCost === "number" ? item.unitCost : quantity > 0 ? total / quantity : total;
      return { name: item.name, quantity, unitCost, total };
    });
  }

  return (maintenance.items || [])
    .filter((item) => item.status)
    .map((item) => {
      const quantity = typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1;
      const total = typeof item.cost === "number" ? item.cost : 0;
      const unitCost = typeof item.unitCost === "number" ? item.unitCost : quantity > 0 ? total / quantity : total;
      return { name: item.name, quantity, unitCost, total };
    });
};

const AdminMaintenanceHistoryPage = () => {
  const [items, setItems] = useState<Maintenance[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");

  useEffect(() => {
    const unsubM = listenMaintenances({}, setItems);
    const unsubV = listenAllVehicles({}, setVehicles);
    const unsubU = listenUsers(setUsers);
    return () => { unsubM(); unsubV(); unsubU(); };
  }, []);

  const usersById = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach((u) => { if (u && u.name) map[u.id] = u.name; });
    return map;
  }, [users]);

  const getVehicleLabel = (vehicleId?: string) => {
    if (!vehicleId) return "Veículo";
    const v = vehicles.find((x) => x.id === vehicleId);
    if (!v) return vehicleId;
    return `${v.plate} • ${v.model}`;
  };

  const formatDateField = (value: any) => {
    if (!value) return "";
    if (value.seconds) return new Date(value.seconds * 1000).toLocaleString("pt-BR");
    if (value.toDate) return value.toDate().toLocaleString("pt-BR");
    return new Date(value).toLocaleString("pt-BR");
  };

  const formatDurationSeconds = (value?: number | null) => {
    if (value == null || Number.isNaN(value)) return "";
    const totalSeconds = Math.max(0, Math.round(value));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const finished = useMemo(() => {
    return items
      .filter((m) => (m.status || "pending") === "done" || (m.status || "pending") === "refused")
      .filter((m) => vehicleFilter === "all" ? true : m.vehicleId === vehicleFilter)
      .sort((a, b) => {
        const aTime = a.completedAt?.seconds ? a.completedAt.seconds * 1000 : a.completedAt?.toDate ? a.completedAt.toDate().getTime() : (a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : 0);
        const bTime = b.completedAt?.seconds ? b.completedAt.seconds * 1000 : b.completedAt?.toDate ? b.completedAt.toDate().getTime() : (b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : 0);
        return bTime - aTime;
      });
  }, [items, vehicleFilter]);

  return (
    <div className="space-y-4 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-3"><Wrench size={20} /> Histórico de Manutenções</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-full sm:w-auto">
            <option value="all">Todos os veículos</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{`${v.plate} • ${v.model}`}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-3 sm:p-4 space-y-4">
        {finished.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma manutenção finalizada.</p>
        ) : (
          <div className="space-y-3">
            {finished.map((m) => (
              <div key={m.id} className="rounded-xl border bg-white px-3 py-3 sm:px-4 sm:py-3 shadow-sm text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <p className="font-semibold text-sm">{getVehicleLabel(m.vehicleId)}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold self-start sm:self-auto ${m.status === "refused" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {m.status === "refused" ? "Recusado" : "Finalizado"}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 sm:text-right">{m.completedAt ? formatDateField(m.completedAt) : ""}</div>
                </div>

                <div className="text-[11px] text-gray-700 mb-2">
                  <p className="font-medium">{m.description || "Manutenção"} {m.km ? `• ${m.km?.toLocaleString("pt-BR")} km` : ""}</p>

                  <div className="mt-2 text-[12px] text-gray-600">
                    <p className="font-medium">Registros do motorista:</p>
                    <p className="mt-1">Criado: {usersById[m.userId] || "Motorista não identificado"}</p>
                    {m.items && m.items.length > 0 && (
                      <p className="mt-1">Itens: {m.items.filter((i:any)=> i.status).map((i:any)=> i.name).join(", ")}</p>
                    )}
                    {getDetailedItems(m).length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="font-medium">Itens detalhados:</p>
                        {getDetailedItems(m).map((item, idx) => (
                          <p key={`${item.name}-${idx}`} className="text-[11px] text-gray-600">
                            {item.name} • Qtde: {formatQuantity(item.quantity)} • Unit: {formatCurrency(item.unitCost)} • Total: {formatCurrency(item.total)}
                          </p>
                        ))}
                      </div>
                    )}
                    {(m as any).notes && <p className="mt-1">Obs: {(m as any).notes}</p>}

                    {(m.statusHistory && (m.statusHistory as any[]).length > 0) && (
                      <div className="mt-2">
                        <p className="font-medium">Histórico do motorista:</p>
                        <ul className="mt-1 list-disc list-inside">
                          {(m.statusHistory as any[]).filter((s:any)=> !s.by || s.by === m.vehicleId).map((s:any, idx:number) => (
                            <li key={idx} className="mt-1"><span className="font-semibold">{statusLabels[s.status] || s.status}</span> • {formatDateField(s.at)}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Fotos - movido para dentro dos registros do motorista */}
                    {(m as any).photos && (m as any).photos.length > 0 && (
                      <div className="mt-2">
                        <p className="text-[11px] font-medium">Fotos registradas:</p>
                        <div className="flex gap-2 mt-1 overflow-x-auto pb-2">
                          {(m as any).photos.map((url:string, idx:number) => (
                            <a key={idx} href={url} target="_blank" rel="noreferrer" className="flex-shrink-0">
                              <img src={url} alt={`Foto ${idx + 1}`} className="w-14 h-14 sm:w-16 sm:h-16 object-contain rounded-lg border bg-white p-1" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Áudios - movido para dentro dos registros do motorista */}
                    <div className="mt-3 text-left">
                      <p className="text-[11px] font-medium">Áudios registrados:</p>
                      <div className="mt-1 space-y-2">
                        {(m as any).audioEvents && (m as any).audioEvents.length > 0 ? (
                          (m as any).audioEvents.map((ev:any, i:number) => (
                            <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <audio controls src={ev.url} className="w-full sm:w-64 max-w-full" />
                              <div className="text-[11px] text-gray-500">
                                <div>Duração: {formatDurationSeconds(ev.duration)}</div>
                                <div className="text-[10px]">Enviado por: {usersById[ev.uploadedBy] || ev.uploadedBy || "-"} • {formatDateField(ev.at)}</div>
                              </div>
                            </div>
                          ))
                        ) : (m as any).audioUrl ? (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <audio controls src={(m as any).audioUrl} className="w-full sm:w-64 max-w-full" />
                            <div className="text-[11px] text-gray-500">
                              <div>Duração: {formatDurationSeconds((m as any).audioDurationSeconds)}</div>
                              <div className="text-[10px]">Enviado por: - • {m.completedAt ? formatDateField(m.completedAt) : ''}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-gray-500">Nenhum áudio registrado.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {((m.workshopName || m.scheduledFor || m.forecastedCompletion || m.completedAt || (m as any).managerNote) ) && (
                    <div className="mt-3 text-[12px] text-gray-600 border-t pt-2">
                      <p className="font-medium">Registros do gestor:</p>
                      {m.workshopName && <p className="mt-1">Oficina: {m.workshopName}</p>}
                      {m.scheduledFor && <p className="mt-1">Agendado: {formatDateField(m.scheduledFor)}{m.managerId ? ` • agendado por ${usersById[m.managerId] || m.managerId}` : ''}</p>}
                      {m.forecastedCompletion && <p className="mt-1">Previsão: {formatDateField(m.forecastedCompletion)}</p>}
                      {m.completedAt && <p className="mt-1">Finalizado: {formatDateField(m.completedAt)}</p>}
                      {(m as any).managerNote && (
                        <p className={`mt-1 ${m.status === "refused" ? "text-red-700 font-medium" : ""}`}>
                          {m.status === "refused" ? "Motivo da recusa: " : "Obs (gestor): "}{(m as any).managerNote}
                        </p>
                      )}
                      {typeof m.directorApproval?.total === "number" && <p className="mt-1">Orçamento aprovado: {formatCurrency(m.directorApproval.total)}</p>}
                      {typeof m.partsCost === "number" && <p className="mt-1">Peças: {formatCurrency(m.partsCost)}</p>}
                      {typeof m.laborCost === "number" && <p className="mt-1">Mão de obra: {formatCurrency(m.laborCost)}</p>}
                      {m.finalCost && <p className="mt-1 text-emerald-600 font-semibold">Valor final: R$ {Number(m.finalCost).toFixed(2).replace('.', ',')}</p>}

                      {(m.statusHistory && (m.statusHistory as any[]).length > 0) && (
                        <div className="mt-2">
                          <p className="font-medium">Histórico do gestor:</p>
                          <ul className="mt-1 list-disc list-inside">
                            {(m.statusHistory as any[]).filter((s:any)=> s.by && s.by === m.managerId).map((s:any, idx:number) => (
                              <li key={idx} className="mt-1"><span className="font-semibold">{statusLabels[s.status] || s.status}</span> • {formatDateField(s.at)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMaintenanceHistoryPage;
