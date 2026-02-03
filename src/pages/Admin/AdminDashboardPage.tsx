import { useEffect, useMemo, useState } from "react";
import { listenMaintenances, type Maintenance } from "../../services/maintenanceService";
import { listenAllVehicles, type Vehicle } from "../../services/vehiclesService";
import { listenUsers, type AppUser } from "../../services/usersService";
import { listenRefuelings, type Refueling } from "../../services/refuelingService";

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

const AdminDashboardPage = () => {
  const [maint, setMaint] = useState<Maintenance[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [refuelings, setRefuelings] = useState<Refueling[]>([]);

  useEffect(() => {
    const unsub1 = listenMaintenances({}, setMaint);
    const unsub2 = listenAllVehicles({}, setVehicles);
    const unsub3 = listenUsers(setUsers);
    const unsub4 = listenRefuelings(setRefuelings);
    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, []);

  const today = useMemo(() => new Date(), []);
  const startRange = useMemo(() => {
    const ref = new Date();
    ref.setDate(ref.getDate() - 14);
    return ref;
  }, []);

  const statusSummary = useMemo(
    () => ({
      total: maint.length,
      pending: maint.filter((m) => m.status === "pending").length,
      inReview: maint.filter((m) => m.status === "in_review").length,
      scheduled: maint.filter((m) => m.status === "scheduled").length,
      done: maint.filter((m) => m.status === "done").length,
      vehicles: vehicles.length,
      users: users.length,
    }),
    [maint, vehicles.length, users.length]
  );

  // Calcular maiores consumidores
  const topConsumers = useMemo(() => {
    // Agrupar gastos por veículo para combustível
    const fuelByVehicle = refuelings.reduce((acc, refuel) => {
      if (!acc[refuel.vehicleId]) {
        acc[refuel.vehicleId] = 0;
      }
      acc[refuel.vehicleId] += refuel.value || 0;
      return acc;
    }, {} as Record<string, number>);

    // Agrupar gastos por veículo para manutenção
    const maintenanceByVehicle = maint.reduce((acc, m) => {
      if (!acc[m.vehicleId]) {
        acc[m.vehicleId] = 0;
      }
      acc[m.vehicleId] += m.finalCost || m.forecastedCost || 0;
      return acc;
    }, {} as Record<string, number>);

    // Encontrar veículo que mais gasta com combustível
    const topFuelVehicle = Object.entries(fuelByVehicle).reduce(
      (max, [vehicleId, value]) => (value > (max?.value || 0) ? { vehicleId, value } : max),
      null as { vehicleId: string; value: number } | null
    );

    // Encontrar veículo que mais gasta com manutenção
    const topMaintenanceVehicle = Object.entries(maintenanceByVehicle).reduce(
      (max, [vehicleId, value]) => (value > (max?.value || 0) ? { vehicleId, value } : max),
      null as { vehicleId: string; value: number } | null
    );

    return {
      topFuelVehicle,
      topMaintenanceVehicle,
    };
  }, [refuelings, maint]);

  const getVehicleLabel = (vehicleId: string) => {
    const v = vehicles.find((x) => x.id === vehicleId);
    if (!v) return "Veículo não identificado";
    return `${v.plate} • ${v.model}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const cards = [
    {
      title: "Fluxo de Manutenções",
      subtitle: "Resumo consolidado",
      emptyState: statusSummary.total === 0,
      metrics: [
        { label: "Em aberto", value: statusSummary.pending + statusSummary.inReview, color: "bg-[#fde4cf] text-[#b45309]" },
        { label: "Agendadas", value: statusSummary.scheduled, color: "bg-[#dbeafe] text-[#1d4ed8]" },
        { label: "Finalizadas", value: statusSummary.done, color: "bg-[#dcfce7] text-[#15803d]" },
      ],
    },
    {
      title: "Equipe & Veículos",
      subtitle: "Capacidade operacional",
      emptyState: statusSummary.vehicles === 0 && statusSummary.users === 0,
      metrics: [
        { label: "Veículos ativos", value: statusSummary.vehicles, color: "bg-[#e0f2fe] text-[#0369a1]" },
        { label: "Usuários cadastrados", value: statusSummary.users, color: "bg-[#fef9c3] text-[#a16207]" },
        { label: "Tarefas totais", value: statusSummary.total, color: "bg-[#ede9fe] text-[#6d28d9]" },
      ],
    },
    {
      title: "Pendências imediatas",
      subtitle: "Acompanhe prioridades",
      emptyState: statusSummary.pending + statusSummary.inReview === 0,
      metrics: [
        { label: "Pendente", value: statusSummary.pending, color: "bg-[#fee2e2] text-[#b91c1c]" },
        { label: "Em análise", value: statusSummary.inReview, color: "bg-[#e0e7ff] text-[#4338ca]" },
        { label: "Agendado", value: statusSummary.scheduled, color: "bg-[#cffafe] text-[#0f766e]" },
      ],
    },
    {
      title: "Entrega do mês",
      subtitle: "Monitoramento",
      emptyState: statusSummary.done === 0,
      metrics: [
        { label: "Finalizadas", value: statusSummary.done, color: "bg-[#dcfce7] text-[#15803d]" },
        { label: "Em aberto", value: statusSummary.pending + statusSummary.inReview, color: "bg-[#fde4cf] text-[#b45309]" },
        { label: "Total", value: statusSummary.total, color: "bg-[#f1f5f9] text-[#0f172a]" },
      ],
    },
    {
      title: "Maior Consumo",
      subtitle: "Top consumidores",
      emptyState: !topConsumers.topFuelVehicle && !topConsumers.topMaintenanceVehicle,
      metrics: [
        { 
          label: "Combustível", 
          value: topConsumers.topFuelVehicle ? getVehicleLabel(topConsumers.topFuelVehicle.vehicleId).substring(0, 15) + "..." : "—",
          color: "bg-[#fef3c7] text-[#92400e]" 
        },
        { 
          label: "Manutenção", 
          value: topConsumers.topMaintenanceVehicle ? getVehicleLabel(topConsumers.topMaintenanceVehicle.vehicleId).substring(0, 15) + "..." : "—",
          color: "bg-[#fce7f3] text-[#9f1239]" 
        },
      ],
      customContent: (
        <div className="mt-3 pt-3 border-t border-[#e2e8f0] space-y-2">
          {topConsumers.topFuelVehicle && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#64748b]">Combustível:</span>
              <span className="font-semibold text-[#92400e]">{formatCurrency(topConsumers.topFuelVehicle.value)}</span>
            </div>
          )}
          {topConsumers.topMaintenanceVehicle && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#64748b]">Manutenção:</span>
              <span className="font-semibold text-[#9f1239]">{formatCurrency(topConsumers.topMaintenanceVehicle.value)}</span>
            </div>
          )}
          {(!topConsumers.topFuelVehicle && !topConsumers.topMaintenanceVehicle) && (
            <div className="text-xs text-[#94a3b8] text-center py-2">
              Sem dados de consumo disponíveis
            </div>
          )}
        </div>
      ),
    },
  ];

  const highlightMaint = maint.slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.3em] text-[#7c8da5]">Dashboard</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-[#0a1633]">Visão consolidada da frota</h2>
          <div className="flex items-center gap-2 text-sm text-[#4b5a78]">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            Atualização em tempo real
          </div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5">
        {cards.map((card) => (
          <SummaryCard
            key={card.title}
            title={card.title}
            subtitle={card.subtitle}
            metrics={card.metrics}
            emptyState={card.emptyState}
            from={formatDateInput(startRange)}
            to={formatDateInput(today)}
            customContent={card.customContent}
          />
        ))}
      </div>

      <section className="rounded-3xl border border-[#e2e8f0] bg-white/90 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-[#0a1633]">Últimas solicitações</h3>
            <p className="text-sm text-[#7c8da5]">Acompanhe as movimentações mais recentes da equipe</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#94a3b8]">
            <span>Mostrar</span>
            <select className="rounded-full border border-[#e2e8f0] px-3 py-1 text-xs text-[#0a1633]">
              <option>Últimos 15 registros</option>
              <option>Últimos 30 registros</option>
            </select>
          </div>
        </div>
        <div className="divide-y divide-[#f1f5f9]">
          {highlightMaint.map((m) => (
            <div key={m.id} className="py-3 flex items-center justify-between text-sm">
              <div className="min-w-0 pr-4">
                <p className="font-medium text-[#0f172a] line-clamp-1">
                  {m.description || "Checklist de manutenção"}
                </p>
                <p className="text-[#94a3b8] text-xs">
                  Veículo: {m.vehicleId || "—"} • Usuário: {m.userId || "—"}
                </p>
              </div>
              <StatusBadge status={m.status} />
            </div>
          ))}
          {highlightMaint.length === 0 && (
            <p className="text-[#94a3b8] text-sm py-4">Sem dados ainda.</p>
          )}
        </div>
      </section>
    </div>
  );
};

const SummaryCard = ({
  title,
  subtitle,
  metrics,
  emptyState,
  from,
  to,
  customContent,
}: {
  title: string;
  subtitle: string;
  metrics: { label: string; value: number | string; color: string }[];
  emptyState: boolean;
  from: string;
  to: string;
  customContent?: React.ReactNode;
}) => (
  <div className="rounded-3xl bg-white/90 border border-[#dfe6f2] p-4 flex flex-col gap-4 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm text-[#7c8da5]">{subtitle}</p>
        <h4 className="text-lg font-semibold text-[#0a1633]">{title}</h4>
      </div>
      <div className="text-right text-xs text-[#94a3b8]">
        <label className="block text-[10px] uppercase tracking-[0.3em]">Período</label>
        <select className="mt-1 rounded-xl border border-[#d7dfea] bg-[#f8fafc] px-2 py-1 text-xs text-[#0a1633]">
          <option>Últimos 15 dias</option>
          <option>Mês atual</option>
          <option>Último trimestre</option>
        </select>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3 text-xs text-[#64748b]">
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-[0.3em]">De</label>
        <input type="date" defaultValue={from} className="w-full rounded-xl border border-[#e2e8f0] px-3 py-2" />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-[0.3em]">Até</label>
        <input type="date" defaultValue={to} className="w-full rounded-xl border border-[#e2e8f0] px-3 py-2" />
      </div>
    </div>
    <div className="space-y-2">
      {emptyState ? (
        <p className="text-sm text-[#94a3b8]">Sem dados para comparar</p>
      ) : (
        metrics.map((metric) => (
          <div key={metric.label} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded ${metric.color}`}></span>
              <span className="text-[#0f172a]">{metric.label}</span>
            </div>
            <span className="font-semibold text-[#0a1633]">{metric.value}</span>
          </div>
        ))
      )}
    </div>
    {customContent}
  </div>
);

const StatusBadge = ({ status }: { status: Maintenance["status"] }) => {
  const map: Record<string, string> = {
    pending: "bg-[#fde4cf] text-[#b45309]",
    in_review: "bg-[#e0e7ff] text-[#4338ca]",
    scheduled: "bg-[#cffafe] text-[#0f766e]",
    done: "bg-[#dcfce7] text-[#15803d]",
  };
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${map[status]}`}>{status}</span>;
};

export default AdminDashboardPage;
