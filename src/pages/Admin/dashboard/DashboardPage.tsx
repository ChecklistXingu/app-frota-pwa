import { Activity, Fuel, Wrench, Clock } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card.tsx";
import { Skeleton } from "../../../components/ui/skeleton.tsx";
import { cn } from "../../../lib/utils";
import { useDashboardData } from "./hooks/useDashboardData";
import type { Maintenance, MaintenanceStatus } from "../../../services/maintenanceService";
import type { DashboardData } from "./types/dashboard.types";

const DashboardPage = () => {
  const { data, loading } = useDashboardData();

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-2 h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  const { maintenanceStats, refuelingStats, recentActivities, maintenanceByType, monthlyCosts } = data;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Painel de gestão</p>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Resumo em tempo real de manutenção, frota e abastecimentos</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <CompactMaintCard stats={maintenanceStats} />
        <CompactPendenciesCard maintenances={data.maintenances} stats={maintenanceStats} />
        <CompactFuelCard stats={refuelingStats} monthlyCosts={data.monthlyCosts} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Custo mensal</CardTitle>
              <CardDescription>Comparativo entre manutenção e combustível</CardDescription>
            </div>
            <Button variant="ghost" size="sm">Ver relatórios</Button>
          </CardHeader>
          <CardContent>
            <ChartPlaceholder data={monthlyCosts} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manutenções por tipo</CardTitle>
            <CardDescription>Distribuição dos últimos 90 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {maintenanceByType.map((item) => (
                <div key={item.type} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.type}</p>
                    <p className="text-sm text-muted-foreground">{((item.count / Math.max(1, maintenanceStats.total)) * 100).toFixed(0)}%</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold">{item.count}</span>
                    <span className="h-2.5 w-20 rounded-full bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Fluxo recente</CardTitle>
              <CardDescription>Últimas atividades registradas</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <a href="/admin/maintenance">Ver tudo</a>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivities.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma atividade nos últimos dias.</p>
            )}
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-center gap-3 rounded-xl border p-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", activity.type === "maintenance" ? "bg-blue-500/10 text-blue-600" : "bg-emerald-500/10 text-emerald-600") }>
                  {activity.type === "maintenance" ? <Wrench className="h-5 w-5" /> : <Fuel className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  <p className="font-semibold leading-none">{activity.title}</p>
                  <p className="text-sm text-muted-foreground">{activity.description}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{activity.date.toLocaleDateString()}</p>
                  <p>{activity.vehicleId}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Indicadores operacionais</CardTitle>
            <CardDescription>Resumo dos últimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <InsightCard
              title="Tempo médio de resolução"
              value={maintenanceStats.averageResolutionTime}
              icon={Clock}
              trend="-12% vs mês anterior"
            />
            <InsightCard
              title="Consumo médio"
              value={`${refuelingStats.averageConsumption} km/L`}
              icon={Fuel}
              trend="+5% eficiência"
            />
            <InsightCard
              title="Custo por km"
              value={`R$ ${refuelingStats.costPerKm.toFixed(2)}`}
              icon={Activity}
              trend="-3% custo"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

/* Removed legacy StatsCard (replaced by CompactMaintCard) */

const Sparkline = ({ values }: { values: number[] }) => {
  if (!values || values.length === 0) return <div className="h-6" />;
  const width = 80;
  const height = 24;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg className="inline-block" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" stroke="#10b981" strokeWidth={2} points={points} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const CompactMaintCard = ({ stats }: { stats: any }) => (
  <Card>
    <CardHeader>
      <div>
        <CardDescription>Resumo</CardDescription>
        <CardTitle>Manutenções</CardTitle>
      </div>
    </CardHeader>
    <CardContent>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-4xl font-semibold">{stats.total}</p>
          <p className="text-sm text-muted-foreground">Total de solicitações</p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <a className="inline-flex items-center gap-2 rounded-full bg-[#fde4cf] px-3 py-1 text-xs font-semibold text-[#b45309]" href="/admin/maintenance?status=pending">Pendentes {stats.pending}</a>
            <a className="inline-flex items-center gap-2 rounded-full bg-[#e0e7ff] px-3 py-1 text-xs font-semibold text-[#4338ca]" href="/admin/maintenance?status=in_review">Análise {stats.inReview}</a>
          </div>
          <div className="flex gap-2">
            <a className="inline-flex items-center gap-2 rounded-full bg-[#cffafe] px-3 py-1 text-xs font-semibold text-[#0f766e]" href="/admin/maintenance?status=scheduled">Agendadas {stats.scheduled}</a>
            <a className="inline-flex items-center gap-2 rounded-full bg-[#dcfce7] px-3 py-1 text-xs font-semibold text-[#15803d]" href="/admin/maintenance?status=done">Finalizadas {stats.done}</a>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

const CompactPendenciesCard = ({ maintenances, stats }: { maintenances: Maintenance[]; stats: any }) => {
  const total = stats.total || Math.max(1, maintenances.length);
  const counts = maintenances.reduce<Record<string, number>>((acc, cur) => {
    acc[cur.status] = (acc[cur.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardDescription>Status das solicitações</CardDescription>
          <CardTitle>Pendências</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {STATUS_ORDER.map((status) => {
          const count = counts[status] || 0;
          const pct = Math.round((count / Math.max(1, total)) * 100);
          return (
            <div key={status} className="flex items-center gap-3">
              <div className="w-36 text-sm text-gray-600">{STATUS_LABELS[status]}</div>
              <div className="flex-1">
                <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div className={`h-full rounded-full ${status === 'pending' ? 'bg-[#fde4cf]' : status === 'in_review' ? 'bg-[#e0e7ff]' : status === 'scheduled' ? 'bg-[#cffafe]' : 'bg-[#dcfce7]'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="w-10 text-right font-semibold">{count}</div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

const CompactFuelCard = ({ stats, monthlyCosts }: { stats: DashboardData['refuelingStats']; monthlyCosts: { month: string; maintenance: number; fuel: number }[] }) => {
  const sparkValues = monthlyCosts.map((m) => m.fuel + m.maintenance);

  const rows = [
    { label: 'Consumo', value: `${stats.averageConsumption.toFixed(1)} km/L` },
    { label: 'Litros', value: `${stats.totalLiters.toFixed(2)} L` },
    { label: 'Gasto', value: `R$ ${stats.monthlyTotal.toFixed(2)}` },
  ];

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardDescription>Performance de consumo</CardDescription>
          <CardTitle className="text-lg flex items-center gap-2"><Fuel className="h-5 w-5 text-emerald-600"/>Combustível</CardTitle>
        </div>
        <div className="text-sm text-muted-foreground"><Sparkline values={sparkValues} /></div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 text-sm">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
            <span className="text-gray-600">{r.label}</span>
            <span className="font-semibold text-gray-900">{r.value}</span>
          </div>
        ))}
        <div className="col-span-2 text-right">
          <a href="/admin/refueling" className="text-sm text-blue-600">Ver detalhes</a>
        </div>
      </CardContent>
    </Card>
  );
};

const ChartPlaceholder = ({ data }: { data: { month: string; maintenance: number; fuel: number }[] }) => (
  <div className="space-y-4">
    {data.map((item) => (
      <div key={item.month} className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <p className="font-medium">{item.month}</p>
          <p className="text-muted-foreground">R$ {(item.maintenance + item.fuel).toLocaleString("pt-BR")}</p>
        </div>
        <div className="space-y-2">
          <div className="h-2 rounded-full bg-blue-500/20">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${(item.maintenance / (item.maintenance + item.fuel)) * 100}%` }} />
          </div>
          <div className="h-2 rounded-full bg-emerald-500/20">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(item.fuel / (item.maintenance + item.fuel)) * 100}%` }} />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const STATUS_ORDER: MaintenanceStatus[] = ["pending", "in_review", "scheduled", "done"];
const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  pending: "Pendentes",
  in_review: "Em análise",
  scheduled: "Agendadas",
  done: "Finalizadas",
};

/* Removed legacy StatusBreakdownCard (replaced by CompactPendenciesCard) */

/* Removed legacy FuelSummaryCard (replaced by CompactFuelCard) */

const InsightCard = ({ title, value, trend, icon: Icon }: {
  title: string;
  value: string;
  trend: string;
  icon: typeof Activity;
}) => (
  <div className="flex items-center gap-4 rounded-2xl border p-4">
    <div className="rounded-2xl bg-muted p-3">
      <Icon className="h-5 w-5" />
    </div>
    <div className="flex-1">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-2xl font-semibold leading-tight">{value}</p>
      <p className="text-sm text-emerald-600">{trend}</p>
    </div>
  </div>
);

export default DashboardPage;
