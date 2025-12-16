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
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useImageUpload } from "../../hooks/useImageUpload";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { useAudioUpload } from "../../hooks/useAudioUpload";
import PhotoCapture from "../../components/ui/PhotoCapture";
import { Pencil, X, Mic, PauseCircle, PlayCircle, Square, RotateCcw } from "lucide-react";

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

const formatDuration = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) return "";
  const totalSeconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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
  audioUrl?: string | null;
  audioDurationSeconds?: number | null;
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
  const {
    status: recorderStatus,
    error: recorderError,
    durationSeconds: recorderDuration,
    audioBlob,
    audioUrl: recorderPreviewUrl,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
  } = useAudioRecorder();
  const { uploadAudio, uploading: uploadingAudio, error: audioUploadError } = useAudioUpload();
  const [audioDraft, setAudioDraft] = useState<{ blob: Blob; previewUrl: string; duration: number } | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Estado para edição
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [editForm, setEditForm] = useState({ km: 0, dateTime: "", notes: "" });
  const [editChecklist, setEditChecklist] = useState<Record<string, boolean>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [showEditRecorder, setShowEditRecorder] = useState(false);
  const [editAudioDraft, setEditAudioDraft] = useState<{ blob: Blob; previewUrl: string; duration: number } | null>(null);

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

  const isSaving = isSubmitting || uploadingAudio;

  // inicializa checklist com false
  useEffect(() => {
    const initial: Record<string, boolean> = {};
    CHECKLIST_ITEMS.forEach((item) => {
      initial[item] = false;
    });
    setChecklistState(initial);
  }, []);

  useEffect(() => {
    return () => {
      if (audioDraft) {
        URL.revokeObjectURL(audioDraft.previewUrl);
      }
    };
  }, [audioDraft]);

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
          audioUrl: typeof data.audioUrl === "string" ? data.audioUrl : null,
          audioDurationSeconds: typeof data.audioDurationSeconds === "number" ? data.audioDurationSeconds : null,
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

  const handleSaveAudioDraft = () => {
    if (!audioBlob) return;
    const persistedBlob = new Blob([audioBlob], { type: audioBlob.type || "audio/webm" });
    const previewUrl = URL.createObjectURL(persistedBlob);
    setAudioDraft((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return {
        blob: persistedBlob,
        previewUrl,
        duration: recorderDuration,
      };
    });
    resetRecording();
  };

  const handleDiscardRecording = () => {
    resetRecording();
  };

  const handleSaveEditAudioDraft = () => {
    if (!audioBlob) return;
    const persistedBlob = new Blob([audioBlob], { type: audioBlob.type || "audio/webm" });
    const previewUrl = URL.createObjectURL(persistedBlob);
    setEditAudioDraft((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return {
        blob: persistedBlob,
        previewUrl,
        duration: recorderDuration,
      };
    });
    resetRecording();
    setShowEditRecorder(false);
  };

  const handleDiscardEditRecording = () => {
    resetRecording();
    setShowEditRecorder(false);
  };

  const handleRemoveSavedAudio = () => {
    setAudioDraft((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return null;
    });
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
      audioDurationSeconds: audioDraft ? audioDraft.duration : null,
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
      handleRemoveSavedAudio();
      resetRecording();
    };

    const docRef = await addDoc(collection(db, "maintenance"), maintenanceData);

    const uploadPhotos = async () => {
      const uploadedUrls: string[] = [];
      for (const photo of photos) {
        const result = await uploadWithOfflineSupport(photo, "maintenance", user.uid, docRef.id);
        if (result && result.url && !result.isOffline) {
          uploadedUrls.push(result.url);
        }
      }
      if (uploadedUrls.length > 0) {
        await updateDoc(doc(db, "maintenance", docRef.id), { photos: uploadedUrls });
      }
    };

    const uploadAudioDraft = async () => {
      if (!audioDraft) return;
      const result = await uploadAudio(audioDraft.blob, "maintenance", user.uid, docRef.id, {
        extraData: { audioDurationSeconds: audioDraft.duration },
      });
      if (result && !result.isOffline) {
        await updateDoc(doc(db, "maintenance", docRef.id), {
          audioUrl: result.url,
          audioDurationSeconds: audioDraft.duration,
        });
      }
    };

    if (isOffline) {
      await uploadPhotos();
      await uploadAudioDraft();
      setMessageType("offline");
      setMessage("Salvo offline! Será enviado quando houver conexão.");
      clearForm();
      return;
    }

    await uploadPhotos();
    await uploadAudioDraft();

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

    if (!user) {
      setMessage("Usuário não autenticado.");
      setSavingEdit(false);
      return;
    }
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

      // Se houver áudio editado, processa substituição
      if (editAudioDraft) {
        const oldUrl = editingRecord.audioUrl || null;

        const result = await uploadAudio(
          editAudioDraft.blob,
          "maintenance",
          user.uid,
          editingRecord.id,
          { extraData: { audioDurationSeconds: editAudioDraft.duration, audioHistoryUnion: oldUrl } },
        );

        if (result && !result.isOffline) {
          // Atualiza documento com nova URL e adiciona o histórico do áudio antigo
          const updates: any = {
            audioUrl: result.url,
            audioDurationSeconds: editAudioDraft.duration,
          };
          if (oldUrl) {
            updates.audioHistory = arrayUnion(oldUrl);
          }
          await updateDoc(doc(db, "maintenance", editingRecord.id), updates);
        }

        // Limpa rascunho de edição
        if (editAudioDraft) {
          URL.revokeObjectURL(editAudioDraft.previewUrl);
          setEditAudioDraft(null);
        }
      }

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
              <label className="text-xs font-medium">Relato por áudio</label>
              <div className="space-y-3 rounded-md border bg-white px-3 py-3 text-xs">
                <div className="flex items-center justify-between text-[11px] text-gray-600">
                  <span className="font-semibold text-gray-700">
                    {recorderStatus === "recording"
                      ? "Gravando..."
                      : recorderStatus === "paused"
                      ? "Gravação pausada"
                      : recorderStatus === "finalized"
                      ? "Gravação pronta"
                      : recorderStatus === "unsupported"
                      ? "Recurso não suportado"
                      : recorderStatus === "error"
                      ? "Erro na gravação"
                      : audioDraft
                      ? "Áudio salvo"
                      : "Pronto para gravar"}
                  </span>
                  {audioDraft?.duration != null && (
                    <span className="text-gray-500">Duração: {formatDuration(audioDraft.duration)}</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={recorderStatus === "recording" || recorderStatus === "unsupported"}
                    className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                      recorderStatus === "recording" || recorderStatus === "unsupported"
                        ? "cursor-not-allowed border-gray-200 text-gray-400"
                        : "border-[#0d2d6c] text-[#0d2d6c] hover:bg-[#0d2d6c]/10"
                    }`}
                  >
                    <Mic size={14} /> Gravar
                  </button>
                  <button
                    type="button"
                    onClick={pauseRecording}
                    disabled={recorderStatus !== "recording"}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                  >
                    <PauseCircle size={14} /> Pausar
                  </button>
                  <button
                    type="button"
                    onClick={resumeRecording}
                    disabled={recorderStatus !== "paused"}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                  >
                    <PlayCircle size={14} /> Retomar
                  </button>
                  <button
                    type="button"
                    onClick={stopRecording}
                    disabled={recorderStatus !== "recording" && recorderStatus !== "paused"}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                  >
                    <Square size={14} /> Parar
                  </button>
                  <button
                    type="button"
                    onClick={resetRecording}
                    disabled={recorderStatus === "idle"}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                  >
                    <RotateCcw size={14} /> Limpar
                  </button>
                </div>

                {recorderStatus === "finalized" && audioBlob && recorderPreviewUrl && (
                  <div className="space-y-2">
                    <audio controls src={recorderPreviewUrl} className="w-full" />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveAudioDraft}
                        className="flex-1 rounded-md bg-[#0d2d6c] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0b2559]"
                      >
                        Salvar áudio
                      </button>
                      <button
                        type="button"
                        onClick={handleDiscardRecording}
                        className="flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                      >
                        Descartar
                      </button>
                    </div>
                  </div>
                )}

                {audioDraft && (
                  <div className="space-y-2">
                    <audio controls src={audioDraft.previewUrl} className="w-full" preload="none" />
                    <div className="flex items-center justify-between text-[11px] text-gray-600">
                      <span>Duração: {formatDuration(audioDraft.duration)}</span>
                      <button
                        type="button"
                        onClick={handleRemoveSavedAudio}
                        className="text-red-500 hover:underline"
                      >
                        Remover áudio
                      </button>
                    </div>
                  </div>
                )}

                {recorderError && <p className="text-xs text-red-600">{recorderError}</p>}
                {audioUploadError && <p className="text-xs text-red-600">{audioUploadError}</p>}
                {uploadingAudio && <p className="text-xs text-blue-600">Enviando áudio...</p>}
                {recorderStatus === "unsupported" && !recorderError && (
                  <p className="text-xs text-orange-600">
                    Seu dispositivo ou navegador não permite gravação direta de áudio. Utilize o campo de observações caso necessário.
                  </p>
                )}
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
              disabled={isSaving}
            >
              {isSaving ? "Salvando..." : "Registrar manutenção"}
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
              {m.audioUrl ? (
                <div className="mt-2 space-y-1">
                  <audio controls src={m.audioUrl} className="w-full" preload="none" />
                  {typeof m.audioDurationSeconds === "number" && (
                    <p className="text-[10px] text-gray-500">Duração: {formatDuration(m.audioDurationSeconds)}</p>
                  )}
                </div>
              ) : m.audioDurationSeconds ? (
                <p className="mt-2 text-[10px] text-gray-500">Áudio enviado offline. Será sincronizado quando houver conexão.</p>
              ) : null}
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

              {/* Áudio (editar) */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Áudio</label>

                {editingRecord?.audioUrl ? (
                  <div className="space-y-2">
                    <audio controls src={editingRecord.audioUrl} className="w-full" preload="none" />
                    <div className="flex items-center justify-between text-[11px] text-gray-600">
                      <span>Duração: {formatDuration(editingRecord.audioDurationSeconds)}</span>
                      <button
                        type="button"
                        onClick={() => setShowEditRecorder(true)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Substituir áudio
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">Sem áudio</div>
                )}

                {showEditRecorder && (
                  <div className="space-y-3 rounded-md border bg-white px-3 py-3 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-gray-600">
                      <span className="font-semibold text-gray-700">
                        {recorderStatus === "recording"
                          ? "Gravando..."
                          : recorderStatus === "paused"
                          ? "Gravação pausada"
                          : recorderStatus === "finalized"
                          ? "Gravação pronta"
                          : recorderStatus === "unsupported"
                          ? "Recurso não suportado"
                          : recorderStatus === "error"
                          ? "Erro na gravação"
                          : "Pronto para gravar"}
                      </span>
                      {recorderStatus === "finalized" && audioBlob && (
                        <span className="text-gray-500">Duração: {formatDuration(recorderDuration)}</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={startRecording}
                        disabled={recorderStatus === "recording" || recorderStatus === "unsupported"}
                        className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                          recorderStatus === "recording" || recorderStatus === "unsupported"
                            ? "cursor-not-allowed border-gray-200 text-gray-400"
                            : "border-[#0d2d6c] text-[#0d2d6c] hover:bg-[#0d2d6c]/10"
                        }`}
                      >
                        <Mic size={14} /> Gravar
                      </button>
                      <button
                        type="button"
                        onClick={pauseRecording}
                        disabled={recorderStatus !== "recording"}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                      >
                        <PauseCircle size={14} /> Pausar
                      </button>
                      <button
                        type="button"
                        onClick={resumeRecording}
                        disabled={recorderStatus !== "paused"}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                      >
                        <PlayCircle size={14} /> Retomar
                      </button>
                      <button
                        type="button"
                        onClick={stopRecording}
                        disabled={recorderStatus !== "recording" && recorderStatus !== "paused"}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                      >
                        <Square size={14} /> Parar
                      </button>
                      <button
                        type="button"
                        onClick={resetRecording}
                        disabled={recorderStatus === "idle"}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                      >
                        <RotateCcw size={14} /> Limpar
                      </button>
                    </div>

                    {recorderStatus === "finalized" && audioBlob && recorderPreviewUrl && (
                      <div className="space-y-2">
                        <audio controls src={recorderPreviewUrl} className="w-full" />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleSaveEditAudioDraft}
                            className="flex-1 rounded-md bg-[#0d2d6c] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0b2559]"
                          >
                            Salvar áudio
                          </button>
                          <button
                            type="button"
                            onClick={handleDiscardEditRecording}
                            className="flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                          >
                            Descartar
                          </button>
                        </div>
                      </div>
                    )}

                    {editAudioDraft && (
                      <div className="space-y-2">
                        <audio controls src={editAudioDraft.previewUrl} className="w-full" preload="none" />
                        <div className="flex items-center justify-between text-[11px] text-gray-600">
                          <span>Duração: {formatDuration(editAudioDraft.duration)}</span>
                          <button
                            type="button"
                            onClick={() => {
                              URL.revokeObjectURL(editAudioDraft.previewUrl);
                              setEditAudioDraft(null);
                            }}
                            className="text-red-500 hover:underline"
                          >
                            Remover áudio
                          </button>
                        </div>
                      </div>
                    )}

                    {recorderError && <p className="text-xs text-red-600">{recorderError}</p>}
                  </div>
                )}
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
