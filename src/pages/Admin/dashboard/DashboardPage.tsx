import { Fuel, Filter, AlertTriangle } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card.tsx";
import { Skeleton } from "../../../components/ui/skeleton.tsx";
import { useDashboardData } from "./hooks/useDashboardData";
import type { Maintenance } from "../../../services/maintenanceService";
import type { DashboardData, DashboardFilters } from "./types/dashboard.types";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ReferenceLine,
  CartesianGrid,
} from "recharts";

const BRANCHES = [
  { label: "Todas", value: "all" },
  { label: "Água Boa", value: "Água Boa" },
  { label: "Querência", value: "Querência" },
  { label: "Canarana", value: "Canarana" },
  { label: "Confresa", value: "Confresa" },
];

const BENCHMARK_COST_PER_KM = 4;

const BRANCH_COLOR_MAP: Record<string, string> = {
  "Água Boa": "#2563eb",
  "Querência": "#16a34a",
  "Canarana": "#dc2626",
  "Confresa": "#f97316",
};

const FALLBACK_COLORS = ["#2563eb", "#16a34a", "#dc2626", "#f97316", "#9333ea", "#0ea5e9"];

const DashboardPage = () => {
  const [filters, setFilters] = useState<DashboardFilters>({
    branch: "all",
    startDate: undefined,
    endDate: undefined,
  });
  const { data, loading } = useDashboardData(filters);

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

  const { maintenanceStats, refuelingStats, monthlyCosts, costsByBranch, costPerKmTimeline, timelineBranches } = data;
  const branchSummary = costsByBranch.length
    ? costsByBranch.reduce((max, current) => (current.maintenance > max.maintenance ? current : max), costsByBranch[0])
    : null;

  const interpretiveText = useMemo(() => {
    if (!timelineBranches.length || !costPerKmTimeline.length) {
      return "Ainda não há dados suficientes para avaliar a tendência de custo por km.";
    }

    const branchStats = timelineBranches.map((branch) => {
      const values = costPerKmTimeline
        .map((point) => point[branch] as number | undefined)
        .filter((value): value is number => typeof value === "number");
      if (!values.length) return null;
      const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
      const aboveBenchmark = values.filter((value) => value > BENCHMARK_COST_PER_KM).length;
      const trend = values.length >= 2 ? values[values.length - 1] - values[0] : 0;
      return { branch, avg, aboveBenchmark, total: values.length, trend };
    }).filter(Boolean) as Array<{ branch: string; avg: number; aboveBenchmark: number; total: number; trend: number }>;

    if (!branchStats.length) {
      return "Ainda não há dados suficientes para avaliar a tendência de custo por km.";
    }

    const worstBranch = branchStats.reduce((worst, current) => (current.avg > worst.avg ? current : worst));
    const trendText = Math.abs(worstBranch.trend) < 0.05
      ? "mantém estabilidade"
      : worstBranch.trend > 0
        ? `está em tendência de alta (+${worstBranch.trend.toFixed(2)} R$/km)`
        : `apresenta queda (-${Math.abs(worstBranch.trend).toFixed(2)} R$/km)`;

    return `${worstBranch.branch} apresenta custo médio de R$ ${worstBranch.avg.toFixed(2)}/km nos últimos ${worstBranch.total} meses, acima da meta em ${worstBranch.aboveBenchmark} deles e ${trendText}.`;
  }, [timelineBranches, costPerKmTimeline]);

  const handleFilterChange = (key: keyof DashboardFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === "" ? undefined : value,
    }));
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Painel de gestão</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Resumo em tempo real de manutenção, frota e abastecimentos</p>
      </header>

      <section className="rounded-2xl border bg-white/50 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
          <Filter className="w-4 h-4" />
          Filtros
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Período inicial</label>
            <input
              type="date"
              value={filters.startDate ?? ""}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Período final</label>
            <input
              type="date"
              value={filters.endDate ?? ""}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-xs text-gray-500">Filial</label>
            <select
              value={filters.branch ?? "all"}
              onChange={(e) => handleFilterChange("branch", e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              {BRANCHES.map((branch) => (
                <option key={branch.value} value={branch.value}>
                  {branch.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <CompactMaintCard stats={maintenanceStats} />
        <CompactPendenciesCard maintenances={data.maintenances} stats={maintenanceStats} />
        <CompactFuelCard stats={refuelingStats} monthlyCosts={data.monthlyCosts} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
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
          <CardHeader className="space-y-1">
            <CardTitle>Combustível x Manutenção por loja</CardTitle>
            <CardDescription>Diagnóstico por filial (stacked)</CardDescription>
          </CardHeader>
          <CardContent>
            {costsByBranch.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados suficientes para exibir o comparativo.</p>
            ) : (
              <div className="space-y-4">
                <div className="w-full h-72">
                  <ResponsiveContainer>
                    <BarChart data={costsByBranch.map((item) => ({
                      loja: item.branch,
                      combustivel: item.fuel,
                      manutencao: item.maintenance,
                    }))}>
                      <XAxis dataKey="loja" tick={{ fontSize: 12 }} />
                      <YAxis
                        tickFormatter={(value) =>
                          value.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                            maximumFractionDigits: 0,
                          })
                        }
                        width={80}
                      />
                      <Tooltip
                        formatter={(value: number) =>
                          value.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })
                        }
                      />
                      <Legend />
                      <Bar dataKey="combustivel" name="Combustível" stackId="custo" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="manutencao" name="Manutenção" stackId="custo" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {branchSummary && (
                  <div className="flex items-start gap-3 rounded-xl border border-orange-100 bg-orange-50/50 p-3 text-sm text-orange-900">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <p>
                      <strong>{branchSummary.branch}</strong> lidera o custo de manutenção no período, indicando possível excesso de falhas ou frota envelhecida.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Evolução do custo por km</CardTitle>
              <CardDescription>Últimos meses por filial (R$/km)</CardDescription>
            </div>
            <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">Meta R$ {BENCHMARK_COST_PER_KM.toFixed(2)}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {costPerKmTimeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há dados suficientes para projetar a tendência.</p>
          ) : (
            <>
              <div className="w-full" style={{ height: '320px', minHeight: '320px' }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <LineChart data={costPerKmTimeline} margin={{ left: 8, right: 16, top: 16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis
                      width={80}
                      tickFormatter={(value) => `R$ ${value.toFixed(2)}`}
                    />
                    <Tooltip
                      formatter={(value: number) => `R$ ${value.toFixed(2)} / km`}
                    />
                    <Legend />
                    <ReferenceLine y={BENCHMARK_COST_PER_KM} stroke="#d97706" strokeDasharray="4 4" label="Meta" />
                    {timelineBranches.map((branch, index) => (
                      <Line
                        key={branch}
                        type="monotone"
                        dot={false}
                        strokeWidth={2}
                        activeDot={{ r: 5 }}
                        dataKey={branch}
                        name={branch}
                        stroke={BRANCH_COLOR_MAP[branch] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-sm text-muted-foreground leading-6">{interpretiveText}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

/* Removed legacy StatsCard (replaced by CompactMaintCard) */

const Sparkline = ({ values }: { values: number[] }) => {
  if (!values || values.length === 0 || !values.every(v => typeof v === 'number' && !isNaN(v))) {
    return <div className="h-6" />;
  }
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

const CompactPendenciesCard = ({ stats }: { maintenances: Maintenance[]; stats: any }) => {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardDescription>Tempo das manutenções</CardDescription>
          <CardTitle>Processo</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-gray-50 px-3 py-2 flex flex-col gap-1">
          <span className="text-gray-600">Média até análise</span>
          <span className="text-lg font-semibold">{stats.avgAnalysisTime}</span>
          <span className="text-xs text-gray-400">De pendente até em análise/agendada</span>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2 flex flex-col gap-1">
          <span className="text-gray-600">Média até finalização</span>
          <span className="text-lg font-semibold">{stats.avgCompletionTime}</span>
          <span className="text-xs text-gray-400">Do pedido até finalizada</span>
        </div>
        <div className="col-span-2 flex items-center justify-between text-xs text-gray-600 mt-1">
          <span>Pendentes: <strong>{stats.pending}</strong></span>
          <span>Em análise: <strong>{stats.inReview}</strong></span>
          <span>Agendadas: <strong>{stats.scheduled}</strong></span>
          <span>Finalizadas: <strong>{stats.done}</strong></span>
        </div>
      </CardContent>
    </Card>
  );
};

const CompactFuelCard = ({ stats, monthlyCosts }: { stats: DashboardData['refuelingStats']; monthlyCosts: { month: string; maintenance: number; fuel: number }[] }) => {
  const sparkValues = monthlyCosts.map((m) => m.fuel + m.maintenance);
  const hasInsufficientData = stats.totalDistance === 0 && stats.totalLiters > 0;

  const rows = [
    { label: 'Consumo', value: `${stats.averageConsumption.toFixed(1)} km/L` },
    { label: 'Litros', value: `${stats.totalLiters.toFixed(2)} L` },
    { label: 'Custo/km', value: `R$ ${stats.costPerKm.toFixed(2)}` },
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
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          {rows.map(r => (
            <div key={r.label} className="rounded-xl bg-gray-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{r.label}</p>
              <p className="text-base font-semibold text-gray-900 whitespace-nowrap">{r.value}</p>
            </div>
          ))}
        </div>
        
        {hasInsufficientData && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold mb-1">Dados insuficientes para calcular consumo</p>
              <p className="text-amber-800">
                {stats.vehiclesWithInsufficientData > 0 && `${stats.vehiclesWithInsufficientData} veículo(s) com menos de 2 abastecimentos. `}
                {stats.skippedVehicles > 0 && `${stats.skippedVehicles} registro(s) sem quilometragem válida. `}
                Preencha o campo KM em cada abastecimento para calcular o consumo médio.
              </p>
            </div>
          </div>
        )}
        
        <div className="text-right">
          <a href="/admin/refueling" className="text-sm text-blue-600 hover:underline">Ver detalhes</a>
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
export default DashboardPage;
