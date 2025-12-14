import { Activity, Fuel, Wrench, Users, Clock } from "lucide-react";
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          label="Manutenções"
          value={maintenanceStats.total}
          icon={Wrench}
          accent="bg-blue-500/10 text-blue-600"
        />
        <StatusBreakdownCard maintenances={data.maintenances} />
        <FuelSummaryCard stats={refuelingStats} />
        <StatsCard
          label="Usuários"
          value={data.users.length}
          icon={Users}
          accent="bg-purple-500/10 text-purple-600"
        />
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

const StatsCard = ({ label, value, icon: Icon, accent }: {
  label: string;
  value: number;
  icon: typeof Activity;
  accent: string;
}) => (
  <Card className="relative overflow-hidden">
    <CardHeader className="pb-2">
      <div className={cn("mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl", accent)}>
        <Icon className="h-5 w-5" />
      </div>
      <CardDescription>{label}</CardDescription>
      <CardTitle className="text-3xl">{value}</CardTitle>
    </CardHeader>
  </Card>
);

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

const StatusBreakdownCard = ({ maintenances }: { maintenances: Maintenance[] }) => {
  const counts = maintenances.reduce<Record<MaintenanceStatus, number>>((acc, current) => {
    const status = (current.status ?? "pending") as MaintenanceStatus;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, Object.fromEntries(STATUS_ORDER.map((status) => [status, 0])) as Record<MaintenanceStatus, number>);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardDescription>Status das solicitações</CardDescription>
        <CardTitle className="text-xl">Pendências</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {STATUS_ORDER.map((status) => (
          <div key={status} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5">
            <span className="text-gray-600">{STATUS_LABELS[status]}</span>
            <span className="font-semibold text-gray-900">{counts[status]}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

const FuelSummaryCard = ({ stats }: { stats: DashboardData["refuelingStats"] }) => {
  const averagePricePerLiter = stats.totalLiters ? stats.monthlyTotal / stats.totalLiters : 0;

  const rows = [
    { label: "Consumo médio", value: `${stats.averageConsumption.toFixed(1)} km/L` },
    { label: "Total de litros", value: `${stats.totalLiters.toFixed(2)} L` },
    { label: "Total gasto", value: `R$ ${stats.monthlyTotal.toFixed(2)}` },
    { label: "Valor médio por litro", value: `R$ ${averagePricePerLiter.toFixed(2)}` },
    { label: "Média de km por abastecimento", value: `${stats.averageDistancePerRefueling.toFixed(0)} km` },
    { label: "Custo por km", value: `R$ ${stats.costPerKm.toFixed(2)}` },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardDescription>Performance de consumo</CardDescription>
        <CardTitle className="text-xl flex items-center gap-2">
          <Fuel className="h-5 w-5 text-emerald-600" />
          Combustível
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
            <span className="text-gray-600">{row.label}</span>
            <span className="font-semibold text-gray-900">{row.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

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
