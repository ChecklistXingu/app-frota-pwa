import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../contexts/AuthContext";

type Vehicle = {
  id: string;
  plate: string;
  model: string;
  year: number;
  currentKm: number;
  status: "ok" | "attention" | "critical";
  latestKm?: number; // KM mais recente de manutenção, abastecimento ou histórico
};

const statusColors: Record<Vehicle["status"], string> = {
  ok: "bg-green-100 text-green-700",
  attention: "bg-yellow-100 text-yellow-700",
  critical: "bg-red-100 text-red-700",
};

const VehiclesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [vehicleLatestKm, setVehicleLatestKm] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "vehicles"),
      where("userId", "==", user.uid),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Vehicle[] = snap.docs.map((doc) => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            plate: data.plate ?? "",
            model: data.model ?? "",
            year: data.year ?? 0,
            currentKm: data.currentKm ?? 0,
            status: (data.status as Vehicle["status"]) ?? "ok",
          };
        });
        setVehicles(list);
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao carregar veículos:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  // Listener contínuo para KM mais recente de cada veículo
  useEffect(() => {
    if (!user || vehicles.length === 0) return;

    const unsubscribers: (() => void)[] = [];

    vehicles.forEach((vehicle) => {
      const vehicleKms: { [key: string]: number } = {};

      // Listener para manutenções ativas
      const qActive = query(
        collection(db, "maintenance"),
        where("userId", "==", user.uid),
        where("vehicleId", "==", vehicle.id),
        where("status", "in", ["pending", "in_review", "scheduled"]),
        orderBy("km", "desc"),
        limit(1)
      );

      const unsubActive = onSnapshot(qActive, (snap) => {
        vehicleKms.activeKm = snap.empty ? 0 : (snap.docs[0].data().km ?? 0);
        updateVehicleKm(vehicle.id, vehicleKms);
      });

      // Listener para manutenções finalizadas
      const qDone = query(
        collection(db, "maintenance"),
        where("userId", "==", user.uid),
        where("vehicleId", "==", vehicle.id),
        where("status", "==", "done"),
        orderBy("completedAt", "desc"),
        limit(1)
      );

      const unsubDone = onSnapshot(qDone, (snap) => {
        vehicleKms.doneKm = snap.empty ? 0 : (snap.docs[0].data().km ?? 0);
        updateVehicleKm(vehicle.id, vehicleKms);
      });

      // Listener para abastecimentos
      const qRefueling = query(
        collection(db, "refueling"),
        where("userId", "==", user.uid),
        where("vehicleId", "==", vehicle.id),
        orderBy("date", "desc"),
        limit(1)
      );

      const unsubRefueling = onSnapshot(qRefueling, (snap) => {
        vehicleKms.refuelingKm = snap.empty ? 0 : (snap.docs[0].data().km ?? 0);
        updateVehicleKm(vehicle.id, vehicleKms);
      });

      unsubscribers.push(unsubActive, unsubDone, unsubRefueling);
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [user, vehicles]);

  // Atualiza o KM do veículo com o maior valor
  const updateVehicleKm = (vehicleId: string, kms: { [key: string]: number }) => {
    const latestKm = Math.max(
      kms.activeKm ?? 0,
      kms.doneKm ?? 0,
      kms.refuelingKm ?? 0
    );
    if (latestKm > 0) {
      setVehicleLatestKm((prev) => ({ ...prev, [vehicleId]: latestKm }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Meus Veículos</h2>
        <button
          type="button"
          className="btn-primary text-xs px-3 py-1.5"
          onClick={() => navigate("/onboarding/vehicles")}
        >
          Adicionar veículo
        </button>
      </div>

      {loading && (
        <p className="text-sm text-gray-600">Carregando veículos...</p>
      )}

      {!loading && vehicles.length === 0 && (
        <div className="text-sm text-gray-600 space-y-2">
          <p>Nenhum veículo cadastrado ainda.</p>
          <p>Clique em "Adicionar veículo" para registrar o primeiro.</p>
        </div>
      )}

      <div className="space-y-3">
        {vehicles.map((v) => (
          <div
            key={v.id}
            className="rounded-xl border bg-white px-4 py-3 shadow-sm flex items-center justify-between gap-3"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold uppercase tracking-wide">
                  {v.plate || "SEM PLACA"}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusColors[v.status]}`}
                >
                  {v.status === "ok"
                    ? "OK"
                    : v.status === "attention"
                    ? "Atenção"
                    : "Crítico"}
                </span>
              </div>
              <p className="text-xs text-gray-600">
                {v.model} • {v.year || "Ano não informado"}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[10px] text-gray-500">KM atual</p>
              <p className="text-sm font-semibold">
                {(vehicleLatestKm[v.id] ?? v.currentKm).toLocaleString("pt-BR")} km
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VehiclesPage;
