import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useImageUpload } from "../../hooks/useImageUpload";
import PhotoCapture from "../../components/ui/PhotoCapture";

type VehicleOption = {
  id: string;
  plate: string;
  model: string;
};

type MaintenanceType = "preventiva" | "corretiva" | "solicitacao";
type MaintenanceStatus = "pending" | "in_progress" | "completed";

type MaintenanceForm = {
  vehicleId: string;
  type: MaintenanceType;
  km: number;
  date: string;
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
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>(
    {},
  );
  const [photos, setPhotos] = useState<File[]>([]);
  const { uploadCompressedImage, uploading: uploadingPhotos } = useImageUpload();

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
          date: data.date
            ? data.date.toDate
              ? data.date.toDate()
              : data.date
            : null,
          status: data.status ?? "pending",
          items: Array.isArray(data.items) ? data.items : [],
          notes: data.notes,
          photos: Array.isArray(data.photos) ? data.photos : [],
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

    const date = data.date ? new Date(data.date) : new Date();

    // Faz upload das fotos (se houver)
    const photoUrls: string[] = [];
    for (const photo of photos) {
      const result = await uploadCompressedImage(photo, "maintenance", user.uid);
      if (result) {
        photoUrls.push(result.url);
      }
    }

    await addDoc(collection(db, "maintenance"), {
      userId: user.uid,
      vehicleId: data.vehicleId,
      date,
      km: Number(data.km),
      type: data.type,
      items,
      notes: data.notes || "",
      photos: photoUrls,
      status: "pending" as MaintenanceStatus,
    });

    setMessage("Manutenção registrada com sucesso.");

    // limpa formulário mas mantém veículo selecionado
    reset({
      vehicleId: data.vehicleId,
      type: data.type,
      km: undefined as any,
      date: "",
      notes: "",
    });

    // reseta checklist e fotos
    const initial: Record<string, boolean> = {};
    CHECKLIST_ITEMS.forEach((item) => {
      initial[item] = false;
    });
    setChecklistState(initial);
    setPhotos([]);
  };

  const getVehicleLabel = (vehicleId: string) => {
    const v = vehicles.find((x) => x.id === vehicleId);
    if (!v) return "Veículo";
    return `${v.plate} • ${v.model}`;
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
    in_progress: "Em andamento",
    completed: "Concluída",
  };

  const statusClasses: Record<MaintenanceStatus, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    in_progress: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
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
                <label className="text-xs font-medium">Data</label>
                <input
                  type="date"
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
                  {...register("date")}
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
              <p className="text-xs text-green-600 text-center">{message}</p>
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
                {m.date && (
                  <p className="text-[10px] text-gray-500 whitespace-nowrap">
                    {m.date.toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>

              {/* Detalhes */}
              <p className="text-gray-600 mb-1">
                {typeLabels[m.type]} • {m.km.toLocaleString("pt-BR")} km
              </p>

              {/* Itens do checklist */}
              {m.items.some((i) => i.status) && (
                <p className="text-[10px] text-gray-500 mb-1">
                  <span className="font-medium">Itens:</span>{" "}
                  {m.items.filter((i) => i.status).map((i) => i.name).join(", ")}
                </p>
              )}

              {/* Observações */}
              {m.notes && (
                <p className="text-[10px] text-gray-500 mb-2">
                  <span className="font-medium">Obs:</span> {m.notes}
                </p>
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
                        className="w-16 h-16 object-cover rounded-lg border"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
