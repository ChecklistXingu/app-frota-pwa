import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../contexts/AuthContext";

type VehicleForm = {
  plate: string;
  model: string;
  year: number;
  currentKm: number;
};

const OnboardingVehiclesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<VehicleForm>();
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const onSubmit = async (data: VehicleForm) => {
    if (!user) return;

    await addDoc(collection(db, "vehicles"), {
      userId: user.uid,
      plate: data.plate,
      model: data.model,
      year: Number(data.year),
      currentKm: Number(data.currentKm),
      status: "ok",
      photoUrl: "",
      createdAt: serverTimestamp(),
    });

    setLastMessage("Veículo salvo com sucesso. Você pode cadastrar outro ou concluir.");
    reset();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[color:var(--color-background)] text-[color:var(--color-primary)]">
      <div className="w-full max-w-md space-y-5">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Cadastrar veículos</h1>
          <p className="text-sm text-gray-600">
            Adicione pelo menos um veículo da sua frota. Você poderá editar depois.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Placa</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
              {...register("plate", { required: true })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Modelo</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
              {...register("model", { required: true })}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">Ano</label>
              <input
                type="number"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
                {...register("year", { required: true, valueAsNumber: true })}
              />
            </div>

            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">KM atual</label>
              <input
                type="number"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
                {...register("currentKm", { required: true, valueAsNumber: true })}
              />
            </div>
          </div>

          {lastMessage && (
            <p className="text-xs text-green-600 text-center">{lastMessage}</p>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Salvando..." : "Salvar veículo"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => navigate("/")}
          className="w-full rounded-full border border-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-[color:var(--color-primary)] bg-white"
        >
          Concluir e ir para Dashboard
        </button>
      </div>
    </div>
  );
};

export default OnboardingVehiclesPage;
