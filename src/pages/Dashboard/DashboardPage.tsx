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

    return () => {
      unsubVehicles();
      unsubRefueling();
      unsubMaintenance();
    };
  }, [user]);

  const getVehicleLabel = (vehicleId: string) => {
    const v = vehicles.find((x) => x.id === vehicleId);
    if (!v) return "Veículo";
    return `${v.plate} • ${v.model}`;
  };

  const firstName = profile?.name?.split(" ")[0] ?? "";

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
