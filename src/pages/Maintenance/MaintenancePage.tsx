import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useImageUpload } from "../../hooks/useImageUpload";
import PhotoCapture from "../../components/ui/PhotoCapture";
import { Pencil, X } from "lucide-react";

const parseDateField = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value?.toDate) return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);
  return null;
};

const formatDateTime = (value?: Date | null) => {
  if (!value) return "";
  return value.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

type VehicleOption = {
  id: string;
  plate: string;
  model: string;
};

type MaintenanceType = "preventiva" | "corretiva" | "solicitacao";
type MaintenanceStatus = "pending" | "in_review" | "scheduled" | "done";

type MaintenanceForm = {
  vehicleId: string;
  type: MaintenanceType;
  km: number;
  dateTime: string;
  notes: string;
};

type MaintenanceRecord = {
  id: string;
  vehicleId: string;
  type: MaintenanceType;
  km: number;
  date: Date | null;
  status: MaintenanceStatus;
  items: { name: string; status: boolean }[];
  notes?: string;
  photos?: string[];
  workshopName?: string;
  scheduledFor?: Date | null;
  forecastedCompletion?: Date | null;
  completedAt?: Date | null;
};

const CHECKLIST_ITEMS = [
  "Elétrica",
  "Iluminação",
  "Motor",
  "Freios",
  "Direção",
  "Pneus",
  "Ar-Condicionado",
  "Estética",
  "Suspensão",
  "Revisão",
  "Lavagem",
];

const MaintenancePage = () => {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [maintenanceList, setMaintenanceList] = useState<MaintenanceRecord[]>(
    [],
  );
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [loadingMaintenance, setLoadingMaintenance] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "offline">("success");
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>(
    {},
  );
  const [photos, setPhotos] = useState<File[]>([]);
  const { uploadWithOfflineSupport, uploading: uploadingPhotos } = useImageUpload();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Estado para edição
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [editForm, setEditForm] = useState({ km: 0, dateTime: "", notes: "" });
  const [editChecklist, setEditChecklist] = useState<Record<string, boolean>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Monitora status de conexão
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting },
  } = useForm<MaintenanceForm>({
    defaultValues: {
      type: "solicitacao",
    },
  });

  // inicializa checklist com false
  useEffect(() => {
    const initial: Record<string, boolean> = {};
    CHECKLIST_ITEMS.forEach((item) => {
      initial[item] = false;
    });
    setChecklistState(initial);
  }, []);

  // Carrega veículos
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "vehicles"),
      where("userId", "==", user.uid),
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: VehicleOption[] = snap.docs.map((doc) => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          plate: data.plate ?? "",
          model: data.model ?? "",
        };
      });
      setVehicles(list);
      setLoadingVehicles(false);

      if (list.length > 0) {
        setValue("vehicleId", list[0].id);
      }
    });

    return () => unsub();
  }, [user, setValue]);

  // Carrega últimas manutenções
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "maintenance"),
      where("userId", "==", user.uid),
    );

    const unsub = onSnapshot(q, (snap) => {
      // Ordena localmente por data
      const sortedDocs = snap.docs.sort((a, b) => {
        const dateA = a.data().date?.toDate?.() || new Date(0);
        const dateB = b.data().date?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      }).slice(0, 20);
      
      const list: MaintenanceRecord[] = sortedDocs.map((doc) => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          vehicleId: data.vehicleId,
          type: data.type ?? "solicitacao",
          km: data.km ?? 0,
          date: parseDateField(data.date),
          status: data.status ?? "pending",
          items: Array.isArray(data.items) ? data.items : [],
          notes: data.notes,
          photos: Array.isArray(data.photos) ? data.photos : [],
          workshopName: data.workshopName || "",
          scheduledFor: parseDateField(data.scheduledFor),
          forecastedCompletion: parseDateField(data.forecastedCompletion),
          completedAt: parseDateField(data.completedAt),
        };
      });
      setMaintenanceList(list);
      setLoadingMaintenance(false);
    });

    return () => unsub();
  }, [user]);

  const onToggleItem = (name: string) => {
    setChecklistState((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const onSubmit = async (data: MaintenanceForm) => {
    if (!user) return;

    const items = CHECKLIST_ITEMS.map((name) => ({
      name,
      status: !!checklistState[name],
    }));

    // Corrige fuso horário: input date retorna YYYY-MM-DD que é interpretado como UTC
    // Adicionamos T12:00:00 para garantir que fique no dia correto em qualquer fuso
    const dateValue = data.dateTime ? new Date(data.dateTime) : serverTimestamp();

    const maintenanceData = {
      userId: user.uid,
      vehicleId: data.vehicleId,
      date: dateValue,
      km: Number(data.km),
      type: data.type,
      items,
      notes: data.notes || "",
      photos: [],
      status: "pending" as MaintenanceStatus,
    };

    // Função para limpar o formulário
    const clearForm = () => {
      reset({
        vehicleId: data.vehicleId,
        type: data.type,
        km: undefined as any,
        dateTime: "",
        notes: "",
      });
      const initial: Record<string, boolean> = {};
      CHECKLIST_ITEMS.forEach((item) => {
        initial[item] = false;
      });
      setChecklistState(initial);
      setPhotos([]);
    };

    // Se está OFFLINE: salva localmente e libera o formulário imediatamente
    if (isOffline) {
      // Firestore vai salvar localmente e sincronizar depois
      const docRef = addDoc(collection(db, "maintenance"), maintenanceData);
      
      // Salva fotos offline
      for (const photo of photos) {
        // Gera um ID temporário para o documento
        docRef.then((ref) => {
          uploadWithOfflineSupport(photo, "maintenance", user.uid, ref.id);
        });
      }

      setMessageType("offline");
      setMessage("Salvo offline! Será enviado quando houver conexão.");
      clearForm();
      return;
    }

    // Se está ONLINE: fluxo normal com await
    const docRef = await addDoc(collection(db, "maintenance"), maintenanceData);

    // Faz upload das fotos
    const photoUrls: string[] = [];
    for (const photo of photos) {
      const result = await uploadWithOfflineSupport(
        photo,
        "maintenance",
        user.uid,
        docRef.id
      );
      if (result) {
        photoUrls.push(result.url);
      }
    }

    // Atualiza documento com URLs das fotos
    if (photoUrls.length > 0) {
      await updateDoc(doc(db, "maintenance", docRef.id), { photos: photoUrls });
    }

    setMessageType("success");
    setMessage("Manutenção registrada com sucesso!");
    clearForm();
  };

  const getVehicleLabel = (vehicleId: string) => {
    const v = vehicles.find((x) => x.id === vehicleId);
    if (!v) return "Veículo";
    return `${v.plate} • ${v.model}`;
  };

  // Abre modal de edição
  const openEditModal = (record: MaintenanceRecord) => {
    setEditingRecord(record);
    setEditForm({
      km: record.km,
      dateTime: record.date ? record.date.toISOString().slice(0, 16) : "",
      notes: record.notes || "",
    });
    // Carrega estado do checklist
    const checklistFromRecord: Record<string, boolean> = {};
    CHECKLIST_ITEMS.forEach((item) => {
      const found = record.items.find((i) => i.name === item);
      checklistFromRecord[item] = found ? found.status : false;
    });
    setEditChecklist(checklistFromRecord);
  };

  // Toggle item do checklist na edição
  const onToggleEditItem = (name: string) => {
    setEditChecklist((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  // Salva edição
  const saveEdit = async () => {
    if (!editingRecord) return;
    setSavingEdit(true);

    try {
      const date = editForm.dateTime ? new Date(editForm.dateTime) : new Date();
      
      // Monta array de itens do checklist
      const items = CHECKLIST_ITEMS.map((name) => ({
        name,
        status: !!editChecklist[name],
      }));
      
      await updateDoc(doc(db, "maintenance", editingRecord.id), {
        km: Number(editForm.km),
        date,
        notes: editForm.notes,
        items,
      });

      setEditingRecord(null);
      setMessageType("success");
      setMessage("Registro atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      setMessage("Erro ao atualizar registro.");
    } finally {
      setSavingEdit(false);
    }
  };

  const typeLabels: Record<MaintenanceType, string> = useMemo(
    () => ({
      preventiva: "Preventiva",
      corretiva: "Corretiva",
      solicitacao: "Solicitação",
    }),
    [],
  );

  const statusLabels: Record<MaintenanceStatus, string> = {
    pending: "Pendente",
    in_review: "Em análise",
    scheduled: "Agendado",
    done: "Finalizado",
  };

  const statusClasses: Record<MaintenanceStatus, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    in_review: "bg-blue-100 text-blue-700",
    scheduled: "bg-indigo-100 text-indigo-700",
    done: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">Manutenções</h2>

      <div className="space-y-3 rounded-xl border bg-white px-4 py-3 shadow-sm">
        <p className="text-sm font-medium text-gray-800">
          Registrar nova manutenção
        </p>

        {loadingVehicles ? (
          <p className="text-xs text-gray-600">Carregando veículos...</p>
        ) : vehicles.length === 0 ? (
          <p className="text-xs text-gray-600">
            Você ainda não possui veículos cadastrados. Cadastre um veículo em
            "Meus Veículos" antes de registrar manutenções.
          </p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Veículo</label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)] bg-white"
                {...register("vehicleId", { required: true })}
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{`${v.plate} • ${v.model}`}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium">Tipo</label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)] bg-white"
                  {...register("type", { required: true })}
                >
                  <option value="solicitacao">Solicitação</option>
                  <option value="preventiva">Preventiva</option>
                  <option value="corretiva">Corretiva</option>
                </select>
              </div>

              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium">KM atual</label>
                <input
                  type="number"
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
                  {...register("km", { required: true, valueAsNumber: true })}
                />
              </div>

              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium">Data e hora</label>
                <input
                  type="datetime-local"
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
                  {...register("dateTime")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-800">Checklist</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {CHECKLIST_ITEMS.map((item) => (
                  <label
                    key={item}
                    className="flex items-center gap-2 rounded-lg border px-2 py-1.5 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[color:var(--color-accent)]"
                      checked={!!checklistState[item]}
                      onChange={() => onToggleItem(item)}
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Observações</label>
              <textarea
                rows={2}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)] resize-none"
                {...register("notes")}
              />
            </div>

            {/* Captura de fotos */}
            <PhotoCapture
              onPhotosChange={setPhotos}
              maxPhotos={3}
              uploading={uploadingPhotos}
            />

            {message && (
              <p className={`text-xs text-center ${messageType === "offline" ? "text-orange-600" : "text-green-600"}`}>
                {message}
              </p>
            )}

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Salvando..." : "Registrar manutenção"}
            </button>
          </form>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-800">
          Últimas manutenções
        </h3>

        {loadingMaintenance && (
          <p className="text-xs text-gray-600">Carregando registros...</p>
        )}

        {!loadingMaintenance && maintenanceList.length === 0 && (
          <p className="text-xs text-gray-600">
            Nenhuma manutenção registrada ainda.
          </p>
        )}

        <div className="space-y-3">
          {maintenanceList.map((m) => (
            <div
              key={m.id}
              className="rounded-xl border bg-white px-4 py-3 shadow-sm text-xs"
            >
              {/* Cabeçalho */}
              <div className="flex justify-between items-start gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">{getVehicleLabel(m.vehicleId)}</p>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusClasses[m.status]}`}
                  >
                    {statusLabels[m.status]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {m.date && (
                    <p className="text-[10px] text-gray-500 whitespace-nowrap">
                      {m.date.toLocaleDateString("pt-BR")}
                    </p>
                  )}
                  <button
                    onClick={() => openEditModal(m)}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              </div>

              {/* Detalhes do motorista */}
              <div className="text-[11px] text-gray-700 mb-2 space-y-0.5">
                <p className="font-semibold">
                  {typeLabels[m.type]} • {m.km.toLocaleString("pt-BR")} km
                </p>
                {m.items.some((i) => i.status) && (
                  <p>
                    <span className="font-medium">Itens:</span>{" "}
                    {m.items.filter((i) => i.status).map((i) => i.name).join(", ")}
                  </p>
                )}
                {m.notes && (
                  <p>
                    <span className="font-medium">Obs:</span> {m.notes}
                  </p>
                )}
              </div>

              {/* Dados do gerente */}
              {(m.workshopName || m.scheduledFor || m.forecastedCompletion || m.completedAt) && (
                <div className="text-[10px] text-gray-500 mb-2 space-y-0.5 border-t border-gray-100 pt-2">
                  {m.workshopName && <p>Oficina: {m.workshopName}</p>}
                  {m.scheduledFor && <p>Agendado: {formatDateTime(m.scheduledFor)}</p>}
                  {m.forecastedCompletion && <p>Previsão: {formatDateTime(m.forecastedCompletion)}</p>}
                  {m.completedAt && <p>Finalizado: {formatDateTime(m.completedAt)}</p>}
                </div>
              )}

              {/* Fotos */}
              {m.photos && m.photos.length > 0 && (
                <div className="flex gap-2 mt-2 overflow-x-auto">
                  {m.photos.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0"
                    >
                      <img
                        src={url}
                        alt={`Foto ${idx + 1}`}
                        className="w-16 h-16 object-contain rounded-lg border bg-white p-1"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal de Edição */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-5 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800">Editar Manutenção</h3>
              <button
                onClick={() => setEditingRecord(null)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Data e hora</label>
                <input
                  type="datetime-local"
                  value={editForm.dateTime}
                  onChange={(e) => setEditForm({ ...editForm, dateTime: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">KM</label>
                <input
                  type="number"
                  value={editForm.km}
                  onChange={(e) => setEditForm({ ...editForm, km: Number(e.target.value) })}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Checklist */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">Itens do Checklist</label>
                <div className="grid grid-cols-2 gap-2">
                  {CHECKLIST_ITEMS.map((item) => (
                    <label
                      key={item}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                        editChecklist[item]
                          ? "bg-blue-50 border-blue-300 text-blue-700"
                          : "bg-gray-50 border-gray-200 text-gray-600"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!!editChecklist[item]}
                        onChange={() => onToggleEditItem(item)}
                        className="sr-only"
                      />
                      <span className={`w-4 h-4 rounded flex items-center justify-center border ${
                        editChecklist[item] ? "bg-blue-600 border-blue-600" : "border-gray-300"
                      }`}>
                        {editChecklist[item] && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                      {item}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Observações</label>
                <textarea
                  rows={2}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {savingEdit ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenancePage;
