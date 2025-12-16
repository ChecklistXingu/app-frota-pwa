import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { Car, Fuel, Wrench } from "lucide-react";
import { normalizeMaintenanceStatus, type MaintenanceStatus } from "../../services/maintenanceService";

type RefuelingRecord = {
  id: string;
  vehicleId: string;
  liters: number;
  value: number;
  date: Date | null;
};

type MaintenanceRecord = {
  id: string;
  vehicleId: string;
  type: "preventiva" | "corretiva" | "solicitacao";
  status: MaintenanceStatus;
  date: Date | null;
  km?: number;
  items?: { name: string; status?: boolean }[];
  notes?: string;
  photos?: string[];
  audioUrl?: string | null;
  audioDurationSeconds?: number | null;
  managerNote?: string;
  managerId?: string;
  createdAt?: any;
  completedAtRaw?: any;
  scheduledForRaw?: any;
  statusHistory?: Array<{ status: string; by?: string; at?: any }>;
  audioEvents?: Array<{ url: string; uploadedBy?: string; duration?: number; at?: any }>;
};

type Vehicle = {
  id: string;
  plate: string;
  model: string;
};

const DashboardPage = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [lastRefueling, setLastRefueling] = useState<RefuelingRecord | null>(
    null,
  );
  const [lastMaintenance, setLastMaintenance] =
    useState<MaintenanceRecord | null>(null);
  const [historicMaintenances, setHistoricMaintenances] = useState<MaintenanceRecord[]>([]);
  const [showHistoricModal, setShowHistoricModal] = useState(false);
  const [showDriverViewForAdmin, setShowDriverViewForAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Veículos
    const qVehicles = query(
      collection(db, "vehicles"),
      where("userId", "==", user.uid),
    );

    const unsubVehicles = onSnapshot(qVehicles, (snap) => {
      const list: Vehicle[] = snap.docs.map((doc) => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          plate: data.plate ?? "",
          model: data.model ?? "",
        };
      });
      setVehicles(list);
    });

    // Último abastecimento
    const qRefueling = query(
      collection(db, "refueling"),
      where("userId", "==", user.uid),
    );

    const unsubRefueling = onSnapshot(qRefueling, (snap) => {
      if (snap.empty) {
        setLastRefueling(null);
        return;
      }
      // Ordena localmente e pega o mais recente
      const sorted = snap.docs.sort((a, b) => {
        const dateA = a.data().date?.toDate?.() || new Date(0);
        const dateB = b.data().date?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      const docSnap = sorted[0];
      const data = docSnap.data() as any;
      setLastRefueling({
        id: docSnap.id,
        vehicleId: data.vehicleId,
        liters: data.liters,
        value: data.value,
        date: data.date
          ? data.date.toDate
            ? data.date.toDate()
            : data.date
          : null,
      });
    });

    // Última manutenção
    const qMaintenance = query(
      collection(db, "maintenance"),
      where("userId", "==", user.uid),
    );

    const unsubMaintenance = onSnapshot(qMaintenance, (snap) => {
      if (snap.empty) {
        setLastMaintenance(null);
        return;
      }
      // Ordena localmente e pega o mais recente
      const sorted = snap.docs.sort((a, b) => {
        const dateA = a.data().date?.toDate?.() || new Date(0);
        const dateB = b.data().date?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      const docSnap = sorted[0];
      const data = docSnap.data() as any;
      setLastMaintenance({
        id: docSnap.id,
        vehicleId: data.vehicleId,
        type: data.type ?? "solicitacao",
        status: normalizeMaintenanceStatus(data.status),
        date: data.date
          ? data.date.toDate
            ? data.date.toDate()
            : data.date
          : null,
      });
    });

    // Histórico de manutenções finalizadas (últimos 5)
    const qHistoric = query(
      collection(db, "maintenance"),
      where("userId", "==", user.uid),
    );

    const unsubHistoric = onSnapshot(qHistoric, (snap) => {
      const finished = snap.docs
        .map((d) => ({ id: d.id, data: d.data() as any }))
        .filter((d) => d.data.status === "done")
        .sort((a, b) => {
          const aTime = a.data.completedAt?.toDate?.() ? a.data.completedAt.toDate().getTime() : 0;
          const bTime = b.data.completedAt?.toDate?.() ? b.data.completedAt.toDate().getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 5)
        .map((d) => ({
          id: d.id,
          vehicleId: d.data.vehicleId,
          type: d.data.type ?? "solicitacao",
          status: normalizeMaintenanceStatus(d.data.status),
          date: d.data.completedAt ? (d.data.completedAt.toDate ? d.data.completedAt.toDate() : d.data.completedAt) : null,
          createdAt: d.data.createdAt || null,
          completedAtRaw: d.data.completedAt || null,
          scheduledForRaw: d.data.scheduledFor || null,
          managerId: d.data.managerId || null,
          km: d.data.km ?? undefined,
          items: Array.isArray(d.data.items) ? d.data.items : undefined,
          notes: d.data.notes || undefined,
          managerNote: d.data.managerNote || undefined,
          photos: Array.isArray(d.data.photos) ? d.data.photos : undefined,
          audioUrl: typeof d.data.audioUrl === 'string' ? d.data.audioUrl : null,
          audioDurationSeconds: typeof d.data.audioDurationSeconds === 'number' ? d.data.audioDurationSeconds : null,
          statusHistory: Array.isArray(d.data.statusHistory) ? d.data.statusHistory : [],
          audioEvents: Array.isArray(d.data.audioEvents) ? d.data.audioEvents : [],
        }));

      setHistoricMaintenances(finished);
    });

    return () => {
      unsubVehicles();
      unsubRefueling();
      unsubMaintenance();
      unsubHistoric();
    };
  }, [user]);

  const getVehicleLabel = (vehicleId: string) => {
    const v = vehicles.find((x) => x.id === vehicleId);
    if (!v) return "Veículo";
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

  const firstName = profile?.name?.split(" ")[0] ?? "";

  const statusLabels: Record<string, string> = {
    pending: "Pendente",
    in_review: "Em análise",
    scheduled: "Agendado",
    done: "Finalizado",
    all: "Todas",
  };

  // Tela de seleção para usuários admin
  if (profile?.role === "admin" && !showDriverViewForAdmin) {
    return (
      <div className="space-y-6 pt-2">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gray-400">
            Selecionar modo de acesso
          </p>
          <h2 className="text-2xl font-semibold text-[color:var(--color-primary)]">
            Olá{firstName ? `, ${firstName}` : ""}
          </h2>
          <p className="text-sm text-gray-600">
            Como você deseja usar o App Frota agora?
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="w-full rounded-2xl bg-[color:var(--color-primary)] text-white px-4 py-3 text-sm font-semibold shadow-md hover:shadow-lg transition"
          >
            Acessar como gestor (Painel de Gestão)
          </button>

          <button
            type="button"
            onClick={() => setShowDriverViewForAdmin(true)}
            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 transition"
          >
            Acessar como motorista (App Frota)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-xs text-gray-500">Resumo da sua frota</p>
        <h2 className="text-xl font-semibold">
          Olá{firstName ? `, ${firstName}` : ""}
        </h2>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-[color:var(--color-primary)] text-white px-4 py-3 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-100">Veículos</p>
              <p className="text-2xl font-semibold">{vehicles.length}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
              <Car size={20} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/vehicles")}
            className="mt-2 text-[11px] underline text-blue-100 self-start"
          >
            Ver detalhes
          </button>
        </div>

        <div className="rounded-2xl bg-white px-4 py-3 shadow-md border flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Último abastecimento</p>
              {lastRefueling ? (
                <>
                  <p className="text-sm font-semibold mt-1">
                    {getVehicleLabel(lastRefueling.vehicleId)}
                  </p>
                  <p className="text-[11px] text-gray-600">
                    {lastRefueling.liters.toFixed(2)} L • R$
                    {" "}
                    {lastRefueling.value.toFixed(2)}
                  </p>
                  {lastRefueling.date && (
                    <p className="text-[10px] text-gray-400">
                      {lastRefueling.date.toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  Nenhum abastecimento ainda.
                </p>
              )}
            </div>
            <div className="w-9 h-9 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700">
              <Fuel size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white px-4 py-3 shadow-md border flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">Última manutenção</p>
          {lastMaintenance ? (
            <>
              <p className="text-sm font-semibold mt-1">
                {getVehicleLabel(lastMaintenance.vehicleId)}
              </p>
              <p className="text-[11px] text-gray-600">
                {lastMaintenance.type === "preventiva"
                  ? "Preventiva"
                  : lastMaintenance.type === "corretiva"
                  ? "Corretiva"
                  : "Solicitação"}
                {lastMaintenance.date
                  ? ` • ${lastMaintenance.date.toLocaleDateString("pt-BR")}`
                  : ""}
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-500 mt-1">
              Nenhuma manutenção registrada.
            </p>
          )}
        </div>
        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-700">
          <Wrench size={20} />
        </div>
      </div>

      {/* Histórico de manutenções finalizadas - caixa compacta */}
      <div className="rounded-2xl bg-white px-4 py-3 shadow-md border flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">Histórico de manutenções</p>
          <button
            type="button"
            onClick={() => setShowHistoricModal(true)}
            className="mt-2 flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            <Wrench size={18} /> Histórico de manutenção
          </button>
        </div>
      </div>

      {/* Modal com lista detalhada de finalizados (igual ao histórico da aba de manutenção) */}
      {showHistoricModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-5 shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800">Histórico de manutenções</h3>
              <button onClick={() => setShowHistoricModal(false)} className="p-1 text-gray-400 hover:text-gray-600">Fechar</button>
            </div>

            <div className="space-y-3">
              {historicMaintenances.length === 0 && (
                <p className="text-sm text-gray-500">Nenhuma manutenção finalizada.</p>
              )}

              {historicMaintenances.map((m) => (
                <div key={m.id} className="rounded-xl border bg-white px-4 py-3 shadow-sm text-sm">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{getVehicleLabel(m.vehicleId)}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700`}>Finalizado</span>
                    </div>
                    <div className="text-[10px] text-gray-500">{m.date ? m.date.toLocaleDateString("pt-BR") : ""}</div>
                  </div>

                  <div className="text-[11px] text-gray-700 mb-2">
                    <p className="font-medium">{m.type === "preventiva" ? "Preventiva" : m.type === "corretiva" ? "Corretiva" : "Solicitação"} {m.km ? `• ${m.km.toLocaleString("pt-BR")} km` : ""}</p>
                    {m.items && m.items.length > 0 && (
                      <p className="mt-1">Itens: {m.items.filter(i => i.status).map(i => i.name).join(", ")}</p>
                    )}
                    {m.notes && <p className="mt-1">Obs: {m.notes}</p>}
                    {m.managerNote && <p className="mt-1">Obs (gestor): {m.managerNote}</p>}
                      {/* Histórico: usa statusHistory se existir, caso contrário monta uma linha inferida por timestamps */}
                      {((m.statusHistory && m.statusHistory.length > 0) || m.createdAt || m.scheduledForRaw || m.completedAtRaw) && (
                        <div className="mt-2 text-[12px] text-gray-600">
                          <p className="font-medium">Histórico de status:</p>
                          <ul className="mt-1 list-disc list-inside">
                            {(m.statusHistory && m.statusHistory.length > 0 ? m.statusHistory : [
                              m.createdAt ? { status: 'pending', by: m.vehicleId || undefined, at: m.createdAt } : null,
                              m.scheduledForRaw ? { status: 'scheduled', by: m.managerId || undefined, at: m.scheduledForRaw } : null,
                              m.completedAtRaw ? { status: 'done', by: m.managerId || undefined, at: m.completedAtRaw } : null,
                            ].filter(Boolean)).map((s: any, idx: number) => (
                              <li key={idx} className="mt-1">
                                <span className="font-semibold">{statusLabels[s.status] || s.status}</span>
                                {s.by ? ` • por ${s.by}` : ""} • {formatDateField(s.at)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>

                  {m.photos && m.photos.length > 0 && (
                    <div className="flex gap-2 mt-2 overflow-x-auto">
                      {m.photos.map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noreferrer" className="flex-shrink-0">
                          <img src={url} alt={`Foto ${idx + 1}`} className="w-16 h-16 object-contain rounded-lg border bg-white p-1" />
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <div className="text-left">
                        <p className="text-[11px] font-medium">Áudios</p>
                        <div className="mt-1 space-y-2">
                          {m.audioEvents && m.audioEvents.length > 0 ? (
                            m.audioEvents.map((ev: any, i: number) => (
                              <div key={i} className="flex items-center gap-2">
                                <audio controls src={ev.url} className="w-48" />
                                <div className="text-[11px] text-gray-500">
                                  <div>Duração: {formatDurationSeconds(ev.duration)}</div>
                                  <div className="text-[10px]">Enviado por: {ev.uploadedBy || "-"} • {formatDateField(ev.at)}</div>
                                </div>
                              </div>
                            ))
                          ) : m.audioUrl ? (
                            <div className="flex items-center gap-2">
                              <audio controls src={m.audioUrl} className="w-48" />
                              <div className="text-[11px] text-gray-500">
                                <div>Duração: {formatDurationSeconds(m.audioDurationSeconds)}</div>
                                <div className="text-[10px]">Enviado por: - • {m.date ? m.date.toLocaleString() : ''}</div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[11px] text-gray-500">Nenhum áudio registrado.</div>
                          )}
                        </div>
                      </div>
                      <button onClick={() => { setShowHistoricModal(false); navigate(`/maintenance?focus=${m.id}`); }} className="text-xs text-blue-600 underline">Abrir</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ações rápidas */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <button
          type="button"
          onClick={() => navigate("/refueling")}
          className="flex flex-col items-center justify-center rounded-2xl border bg-white py-2 shadow-sm"
        >
          <Fuel size={18} className="mb-1" />
          <span>Abastecer</span>
        </button>

        <button
          type="button"
          onClick={() => navigate("/maintenance")}
          className="flex flex-col items-center justify-center rounded-2xl border bg-white py-2 shadow-sm"
        >
          <Wrench size={18} className="mb-1" />
          <span>Manutenção</span>
        </button>

        <button
          type="button"
          onClick={() => navigate("/onboarding/vehicles")}
          className="flex flex-col items-center justify-center rounded-2xl border bg-white py-2 shadow-sm"
        >
          <Car size={18} className="mb-1" />
          <span>Veículo</span>
        </button>
      </div>
    </div>
  );
};

export default DashboardPage;


