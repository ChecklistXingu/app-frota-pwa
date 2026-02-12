import {
  getTopFuelSpendingVehicle,
  getTopMaintenanceSpendingVehicle,
  getMaintenanceTotals,
  getTopDriverFuelConsumption,
  getTopDriverMaintenanceSpending,
} from "./queries";

const BRANCH_NAMES = ["Água Boa", "Querência", "Canarana", "Confresa"];

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9\s]/g, "");

const detectBranch = (text: string): string | undefined => {
  const normalized = normalize(text);
  for (const branch of BRANCH_NAMES) {
    const normBranch = normalize(branch);
    if (normalized.includes(normBranch)) return branch;
  }
  return undefined;
};

const extractDays = (text: string): number => {
  const normalized = normalize(text);
  if (normalized.includes("últimos 90 dias") || normalized.includes("90 dias")) return 90;
  if (normalized.includes("últimos 60 dias") || normalized.includes("60 dias")) return 60;
  if (normalized.includes("últimos 30 dias") || normalized.includes("30 dias")) return 30;
  if (normalized.includes("últimos 7 dias") || normalized.includes("7 dias")) return 7;
  return 30; // padrão
};

// === INTENÇÕES ===

interface AnswerContext {
  userName?: string;
}

type IntentHandler = (text: string, context: AnswerContext) => Promise<string | null>;

const isGreeting = (text: string): boolean => {
  const normalized = normalize(text);
  return /(bom dia|boa tarde|boa noite|ola\b|olá|oi\b)/.test(normalized);
};

const isFuelSpendingQuestion = (text: string): boolean => {
  const normalized = normalize(text);
  const hasVehicleWord = /(veiculo|carro|frota)/.test(normalized);
  const hasFuelWord = /(abastecimento|combustivel|gasto|gastando|gasolina|diesel)/.test(normalized);
  return hasVehicleWord && hasFuelWord;
};

const isTopDriverFuelQuestion = (text: string): boolean => {
  const normalized = normalize(text);
  const hasDriverWord = /(motorista|condutor|usuario|usuário)/.test(normalized);
  const hasFuelWord = /(abastecimento|combustivel|combustível|litros|gasolina|diesel)/.test(normalized);
  const hasRankingWord = /(top|maior|mais|quem mais|top 3)/.test(normalized);
  return hasDriverWord && hasFuelWord && hasRankingWord;
};

const isMaintenanceQuestion = (text: string): boolean => {
  const normalized = normalize(text);
  const hasVehicleWord = /(veiculo|carro|frota)/.test(normalized);
  const hasMaintenanceWord = /(manutenção|revisão|troca|óleo|pneu|pastilha|oficina)/.test(normalized);
  return hasVehicleWord && hasMaintenanceWord;
};

const isTopDriverMaintenanceQuestion = (text: string): boolean => {
  const normalized = normalize(text);
  const hasDriverWord = /(motorista|condutor|usuario|usuário)/.test(normalized);
  const hasMaintenanceWord = /(manutenção|revisão|oficina|pneu|óleo|freio|pastilha)/.test(normalized);
  const hasRankingWord = /(top|maior|mais|quem mais|top 3|maior custo|mais gastou)/.test(normalized);
  return hasDriverWord && hasMaintenanceWord && hasRankingWord;
};

const isMaintenanceTotalsQuestion = (text: string): boolean => {
  const normalized = normalize(text);
  const hasMaintenanceWord = /(manutenção|revisão|troca|óleo|pneu|pastilha|oficina)/.test(normalized);
  const hasMetricWord = /(total|custo|gasto|média|quantidade)/.test(normalized);
  return hasMaintenanceWord && hasMetricWord;
};

// === HANDLERS ===

const handleGreeting: IntentHandler = async (_text, context) => {
  const firstName = context.userName?.trim() || "";
  if (firstName) {
    return `Olá, ${firstName}! Eu sou a Naya, assistente da frota Xingu. Como posso te ajudar hoje?`;
  }
  return "Olá! Eu sou a Naya, assistente da frota Xingu. Como posso te ajudar hoje?";
};

const handleFuelSpending: IntentHandler = async (text, _context) => {
  const branch = detectBranch(text);
  const days = extractDays(text);

  const result = await getTopFuelSpendingVehicle({ branch, days });

  if (!result) {
    if (branch) {
      return `Não encontrei abastecimentos recentes para a filial ${branch} nos últimos ${days} dias.`;
    }
    return `Não encontrei abastecimentos recentes nos últimos ${days} dias.`;
  }

  const { plate, model, branch: resultBranch, totalValue, totalLiters, refuelingsCount } = result;

  const totalValueStr = totalValue.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });

  const litersStr = totalLiters.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const branchText = resultBranch && resultBranch !== "--" ? `na filial ${resultBranch}` : "considerando todas as filiais";

  return `Neste período, o veículo ${plate} • ${model} foi o que mais gastou com abastecimento ${branchText}, somando ${totalValueStr} em ${refuelingsCount} abastecimentos, com um total de ${litersStr} litros.`;
};

const extractFuelMetric = (text: string): "liters" | "value" => {
  const normalized = normalize(text);
  if (/(gasto|custo|dinheiro|reais|valor)/.test(normalized)) {
    return "value";
  }
  return "liters";
};

const handleTopDriverFuelConsumption: IntentHandler = async (text, _context) => {
  const branch = detectBranch(text);
  const days = extractDays(text);
  const metric = extractFuelMetric(text);

  const { items, metric: usedMetric } = await getTopDriverFuelConsumption({
    branch,
    days,
    metric,
  });

  if (!items.length) {
    if (branch) {
      return `Não encontrei abastecimentos recentes para a filial ${branch} nos últimos ${days} dias.`;
    }
    return `Não encontrei abastecimentos recentes nos últimos ${days} dias.`;
  }

  const unitLabel = usedMetric === "value" ? "em gastos" : "em litros";

  const metricFormatter =
    usedMetric === "value"
      ? (v: number) =>
          v.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
            maximumFractionDigits: 2,
          })
      : (v: number) =>
          v.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) + " L";

  const branchText = branch ? ` na filial ${branch}` : "";

  const lines = items.map((item, index) => {
    const mainValue = usedMetric === "value" ? item.totalValue : item.totalLiters;
    const metricStr = metricFormatter(mainValue);
    return `${index + 1}. ${item.name} — ${metricStr} em ${item.refuelingsCount} abastecimentos`;
  });

  return (
    `Nos últimos ${days} dias${branchText}, estes foram os 3 motoristas com maior consumo de combustível ${unitLabel}:\n` +
    lines.join("\n")
  );
};

const handleMaintenanceTopSpending: IntentHandler = async (text, _context) => {
  const branch = detectBranch(text);
  const days = extractDays(text);

  const result = await getTopMaintenanceSpendingVehicle({ branch, days });

  if (!result) {
    if (branch) {
      return `Não encontrei manutenções recentes para a filial ${branch} nos últimos ${days} dias.`;
    }
    return `Não encontrei manutenções recentes nos últimos ${days} dias.`;
  }

  const { plate, model, branch: resultBranch, totalCost, maintenanceCount, forecastedCost } = result;

  const totalCostStr = totalCost.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });

  const forecastedStr = forecastedCost
    ? forecastedCost.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
      })
    : null;

  const branchText = resultBranch && resultBranch !== "--" ? `na filial ${resultBranch}` : "considerando todas as filiais";

  let forecastText = "";
  if (forecastedStr) {
    forecastText = ` (custo previsto ${forecastedStr})`;
  }

  return `Nos últimos ${days} dias, o veículo ${plate} • ${model} teve o maior custo com manutenção ${branchText}: ${totalCostStr} em ${maintenanceCount} manutenções${forecastText}.`;
};

const handleTopDriverMaintenanceSpending: IntentHandler = async (text, _context) => {
  const branch = detectBranch(text);
  const days = extractDays(text);

  const items = await getTopDriverMaintenanceSpending({ branch, days });

  if (!items.length) {
    if (branch) {
      return `Não encontrei manutenções recentes para a filial ${branch} nos últimos ${days} dias.`;
    }
    return `Não encontrei manutenções recentes nos últimos ${days} dias.`;
  }

  const branchText = branch ? ` na filial ${branch}` : "";

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 2,
    });

  const lines = items.map((item, index) => {
    const totalStr = formatCurrency(item.totalCost);
    const forecastStr = item.forecastedCost
      ? ` (previsto ${formatCurrency(item.forecastedCost)})`
      : "";
    return `${index + 1}. ${item.name} — ${totalStr}${forecastStr} em ${item.maintenanceCount} manutenções`;
  });

  return (
    `Nos últimos ${days} dias${branchText}, estes foram os 3 motoristas com maior custo de manutenção:\n` +
    lines.join("\n")
  );
};

const handleMaintenanceTotals: IntentHandler = async (text, _context) => {
  const branch = detectBranch(text);
  const days = extractDays(text);

  const result = await getMaintenanceTotals({ branch, days });

  if (!result) {
    if (branch) {
      return `Não encontrei manutenções recentes para a filial ${branch} nos últimos ${days} dias.`;
    }
    return `Não encontrei manutenções recentes nos últimos ${days} dias.`;
  }

  const { totalCost, forecastedCost, count, avgCost } = result;

  const totalCostStr = totalCost.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });

  const forecastedStr = forecastedCost
    ? forecastedCost.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
      })
    : null;

  const avgCostStr = avgCost.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });

  const branchText = branch ? `na filial ${branch}` : "considerando todas as filiais";

  let forecastText = "";
  if (forecastedStr) {
    forecastText = ` (custo previsto ${forecastedStr})`;
  }

  return `Nos últimos ${days} dias, foram ${count} manutenções ${branchText}, com custo total de ${totalCostStr}${forecastText} e média de ${avgCostStr} por manutenção.`;
};

// === MAPA DE INTENÇÕES ===

const INTENT_HANDLERS: Array<{
  intent: string;
  detect: (text: string) => boolean;
  handle: IntentHandler;
}> = [
  { intent: "greeting", detect: isGreeting, handle: handleGreeting },
  { intent: "fuel_spending", detect: isFuelSpendingQuestion, handle: handleFuelSpending },
  { intent: "top_driver_fuel", detect: isTopDriverFuelQuestion, handle: handleTopDriverFuelConsumption },
  { intent: "maintenance_top_spending", detect: isMaintenanceQuestion, handle: handleMaintenanceTopSpending },
  { intent: "top_driver_maintenance_spending", detect: isTopDriverMaintenanceQuestion, handle: handleTopDriverMaintenanceSpending },
  { intent: "maintenance_totals", detect: isMaintenanceTotalsQuestion, handle: handleMaintenanceTotals },
];

// === EXPORT ===

export const answerQuestion = async (
  question: string,
  context: AnswerContext = {},
): Promise<string> => {
  const trimmed = question.trim();
  const firstName = context.userName?.trim() || "";

  if (!trimmed) {
    const namePart = firstName ? `, ${firstName}` : "";
    return `Não entendi sua pergunta${namePart}. Tente perguntar, por exemplo: qual veículo mais gastou com abastecimento nos últimos 30 dias?`;
  }

  for (const { detect, handle } of INTENT_HANDLERS) {
    if (detect(trimmed)) {
      const result = await handle(trimmed, context);
      if (result) return result;
    }
  }

  // fallback genérico
  const namePart = firstName ? `, ${firstName}` : "";
  return `Ainda não aprendi a responder esse tipo de pergunta${namePart}. Você pode perguntar, por exemplo: qual veículo da filial Água Boa mais gastou com abastecimento nos últimos 30 dias?`;
};
