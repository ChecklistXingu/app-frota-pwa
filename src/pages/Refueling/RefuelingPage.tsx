import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../contexts/AuthContext";
import VoiceInputButton from "../../components/ui/VoiceInputButton";
import type { ExtractedData } from "../../utils/voiceDataExtractor";
import { Pencil, X } from "lucide-react";

type VehicleOption = {
  id: string;
  plate: string;
  model: string;
};

type RefuelingForm = {
  vehicleId: string;
  km: number;
  liters: number;
  value: number;
  dateTime: string;
  notes: string;
};

type RefuelingRecord = {
  id: string;
  vehicleId: string;
  km: number;
  liters: number;
  value: number;
  date: Date | null;
  notes?: string;
};

const RefuelingPage = () => {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [refuelings, setRefuelings] = useState<RefuelingRecord[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [loadingRefuelings, setLoadingRefuelings] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "offline">("success");
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // Estado para edição
  const [editingRecord, setEditingRecord] = useState<RefuelingRecord | null>(null);
  const [editForm, setEditForm] = useState({ km: 0, liters: 0, value: 0, dateTime: "" });
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
  } = useForm<RefuelingForm>();

  // Carrega veículos do usuário para o select
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

  // Carrega últimos abastecimentos do usuário
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "refueling"),
      where("userId", "==", user.uid),
    );

    const unsub = onSnapshot(q, (snap) => {
      // Ordena localmente por data
      const sortedDocs = snap.docs.sort((a, b) => {
        const dateA = a.data().date?.toDate?.() || new Date(0);
        const dateB = b.data().date?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      }).slice(0, 20);
      
      const list: RefuelingRecord[] = sortedDocs.map((doc) => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          vehicleId: data.vehicleId,
          km: data.km,
          liters: data.liters,
          value: data.value,
          date: data.date ? (data.date.toDate ? data.date.toDate() : data.date) : null,
          notes: data.notes,
        };
      });
      setRefuelings(list);
      setLoadingRefuelings(false);
    });

    return () => unsub();
  }, [user]);

  const onSubmit = async (data: RefuelingForm) => {
    if (!user) return;

    const selectedVehicle = vehicles.find((v) => v.id === data.vehicleId);

    const dateValue = data.dateTime ? new Date(data.dateTime) : serverTimestamp();

    const refuelingData = {
      userId: user.uid,
      vehicleId: data.vehicleId,
      date: dateValue,
      km: Number(data.km),
      liters: Number(data.liters),
      value: Number(data.value),
      photoUrl: "",
      notes: data.notes || "",
    };

    const clearForm = () => {
      reset({
        vehicleId: data.vehicleId,
        km: undefined as any,
        liters: undefined as any,
        value: undefined as any,
        dateTime: "",
        notes: "",
      });
    };

    // Se está OFFLINE: salva localmente e libera o formulário imediatamente
    if (isOffline) {
      // Firestore vai salvar localmente e sincronizar depois (não aguarda)
      addDoc(collection(db, "refueling"), refuelingData);
      
      setMessageType("offline");
      setMessage("Salvo offline! Será enviado quando houver conexão.");
      clearForm();
      return;
    }

    // Se está ONLINE: fluxo normal com await
    await addDoc(collection(db, "refueling"), refuelingData);

    setMessageType("success");
    setMessage(
      `Abastecimento registrado para ${
        selectedVehicle?.plate ?? "veículo"
      } com sucesso.`,
    );
    clearForm();
  };

  const getVehicleLabel = (vehicleId: string) => {
    const v = vehicles.find((x) => x.id === vehicleId);
    if (!v) return "Veículo";
    return `${v.plate} • ${v.model}`;
  };

  // Processa dados extraídos da voz
  const handleVoiceData = useCallback((data: ExtractedData) => {
    if (data.km) setValue("km", data.km);
    if (data.liters) setValue("liters", data.liters);
    if (data.value) setValue("value", data.value);
  }, [setValue]);

  // Abre modal de edição
  const openEditModal = (record: RefuelingRecord) => {
    setEditingRecord(record);
    setEditForm({
      km: record.km,
      liters: record.liters,
      value: record.value,
      dateTime: record.date ? record.date.toISOString().slice(0, 16) : "",
    });
  };

  // Salva edição
  const saveEdit = async () => {
    if (!editingRecord) return;
    setSavingEdit(true);

    try {
      const date = editForm.dateTime ? new Date(editForm.dateTime) : new Date();
      
      await updateDoc(doc(db, "refueling", editingRecord.id), {
        km: Number(editForm.km),
        liters: Number(editForm.liters),
        value: Number(editForm.value),
        date,
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

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">Abastecimentos</h2>

      <div className="space-y-3 rounded-xl border bg-white px-4 py-3 shadow-sm">
        <p className="text-sm text-gray-700 font-medium">
          Registrar novo abastecimento
        </p>

        {loadingVehicles ? (
          <p className="text-xs text-gray-600">Carregando veículos...</p>
        ) : vehicles.length === 0 ? (
          <p className="text-xs text-gray-600">
            Você ainda não possui veículos cadastrados. Cadastre um veículo em
            "Meus Veículos" antes de registrar abastecimentos.
          </p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            {/* Botão de entrada por voz */}
            <VoiceInputButton onDataExtracted={handleVoiceData} />

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

            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium">Litros</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
                  {...register("liters", { required: true, valueAsNumber: true })}
                />
              </div>

              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
                  {...register("value", { required: true, valueAsNumber: true })}
                />
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
              {isSubmitting ? "Salvando..." : "Registrar abastecimento"}
            </button>
          </form>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-800">
          Últimos abastecimentos
        </h3>

        {loadingRefuelings && (
          <p className="text-xs text-gray-600">Carregando registros...</p>
        )}

        {!loadingRefuelings && refuelings.length === 0 && (
          <p className="text-xs text-gray-600">
            Nenhum abastecimento registrado ainda.
          </p>
        )}

        <div className="space-y-3 pb-4">
          {refuelings.map((r) => {
            const pricePerLiter = r.liters ? r.value / r.liters : 0;
            return (
              <div
                key={r.id}
                className="rounded-xl border bg-white px-4 py-3 shadow-sm text-xs"
              >
                {/* Cabeçalho */}
                <div className="flex justify-between items-start gap-2 mb-2">
                  <p className="font-semibold">{getVehicleLabel(r.vehicleId)}</p>
                  <div className="flex items-center gap-2">
                    {r.date && (
                      <p className="text-[10px] text-gray-500 whitespace-nowrap">
                        {r.date.toLocaleDateString("pt-BR")}
                      </p>
                    )}
                    <button
                      onClick={() => openEditModal(r)}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>

                {/* Detalhes */}
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-gray-600">
                      {r.liters.toFixed(2)} L • R$ {r.value.toFixed(2)} ({pricePerLiter.toFixed(2)} R$/L)
                    </p>
                    {r.notes && (
                      <p className="text-[10px] text-gray-500">{r.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500">KM</p>
                    <p className="font-semibold">{r.km.toLocaleString("pt-BR")} km</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Edição */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-5 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800">Editar Abastecimento</h3>
              <button
                onClick={() => setEditingRecord(null)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
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

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Litros</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.liters}
                  onChange={(e) => setEditForm({ ...editForm, liters: Number(e.target.value) })}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.value}
                  onChange={(e) => setEditForm({ ...editForm, value: Number(e.target.value) })}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
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

export default RefuelingPage;
