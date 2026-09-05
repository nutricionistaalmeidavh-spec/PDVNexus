import { defineModule } from "@nexus-core/core";

export type DashboardIntent = "operational" | "analytical" | "executive" | "academic";
export type DashboardStyle = "enterprise" | "glassmorphism" | "minimalism" | "bento" | "dark-professional" | "academic";
export type DashboardTrendDirection = "up" | "down" | "flat";
export type DashboardFilterType = "date-range" | "select" | "multi-select" | "search";
export type DashboardChartType = "line" | "bar" | "donut" | "area" | "metric-list";

export interface DashboardDefinition {
  key: string;
  name: string;
  description: string;
  intent: DashboardIntent;
  recommendedStyle: DashboardStyle;
  kpis: DashboardKpi[];
  charts: DashboardChart[];
  filters: DashboardFilter[];
  quickActions: DashboardQuickAction[];
  table?: DashboardTable;
  summary?: DashboardSummary;
}

export interface DashboardKpi {
  key: string;
  label: string;
  value: number;
  formattedValue: string;
  previousValue?: number;
  trend?: DashboardTrend;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}

export interface DashboardTrend {
  direction: DashboardTrendDirection;
  percentage: number;
  label: string;
}

export interface DashboardChart {
  key: string;
  title: string;
  type: DashboardChartType;
  data: DashboardDataPoint[];
}

export interface DashboardDataPoint {
  label: string;
  value: number;
  group?: string;
}

export interface DashboardFilter {
  key: string;
  label: string;
  type: DashboardFilterType;
  value?: string | string[];
  options?: Array<{ label: string; value: string }>;
}

export interface DashboardQuickAction {
  key: string;
  label: string;
  intent: "primary" | "secondary" | "danger";
  target: string;
}

export interface DashboardTable {
  title: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string | number>>;
}

export interface DashboardSummary {
  title: string;
  items: Array<{ label: string; value: string; tone?: DashboardKpi["tone"] }>;
}

export const dashboardModule = defineModule({
  key: "dashboard",
  name: "Dashboards",
  description: "KPIs, graficos, filtros, tabelas, indicadores, resumos e acoes rapidas reutilizaveis.",
  routes: [{ key: "dashboard", label: "Dashboard", path: "/dashboard", icon: "BI" }],
  entities: ["dashboard", "kpi", "chart", "filter", "quickAction"],
  reusable: true
});

export function buildTrend(current: number, previous?: number): DashboardTrend | undefined {
  if (previous === undefined || previous === 0) {
    return undefined;
  }

  const variation = ((current - previous) / previous) * 100;
  const percentage = Number(Math.abs(variation).toFixed(1));

  return {
    direction: variation > 0 ? "up" : variation < 0 ? "down" : "flat",
    percentage,
    label: `${percentage}%`
  };
}

export function createKpi(input: Omit<DashboardKpi, "trend">): DashboardKpi {
  return {
    ...input,
    trend: buildTrend(input.value, input.previousValue)
  };
}

export function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatNumber(value: number) {
  return value.toLocaleString("pt-BR");
}

export function buildPdvDashboard(input: {
  revenue: number;
  previousRevenue: number;
  salesCount: number;
  averageTicket: number;
  stockAlerts: number;
  scaleSales: number;
}): DashboardDefinition {
  return {
    key: "pdv-operacional",
    name: "Painel do Caixa",
    description: "Visao operacional para vendas, estoque e itens por peso.",
    intent: "operational",
    recommendedStyle: "dark-professional",
    filters: [
      { key: "period", label: "Periodo", type: "date-range", value: "today" },
      { key: "cashier", label: "Caixa", type: "select", value: "all" }
    ],
    quickActions: [
      { key: "new-sale", label: "Nova venda", intent: "primary", target: "/pdv" },
      { key: "close-cashier", label: "Fechar caixa", intent: "secondary", target: "/caixa/fechamento" },
      { key: "scale-config", label: "Balanca", intent: "secondary", target: "/balanca" }
    ],
    kpis: [
      createKpi({ key: "revenue", label: "Vendido hoje", value: input.revenue, previousValue: input.previousRevenue, formattedValue: formatCurrency(input.revenue), tone: "success" }),
      createKpi({ key: "sales", label: "Vendas", value: input.salesCount, formattedValue: formatNumber(input.salesCount), tone: "info" }),
      createKpi({ key: "ticket", label: "Ticket medio", value: input.averageTicket, formattedValue: formatCurrency(input.averageTicket), tone: "neutral" }),
      createKpi({ key: "stock", label: "Alertas estoque", value: input.stockAlerts, formattedValue: formatNumber(input.stockAlerts), tone: input.stockAlerts > 0 ? "warning" : "success" }),
      createKpi({ key: "scale", label: "Itens por peso", value: input.scaleSales, formattedValue: formatNumber(input.scaleSales), tone: "neutral" })
    ],
    charts: [
      { key: "hourly-sales", title: "Vendas por hora", type: "bar", data: [{ label: "08h", value: 320 }, { label: "10h", value: 740 }, { label: "12h", value: 1180 }, { label: "14h", value: 860 }, { label: "16h", value: 1320 }] },
      { key: "categories", title: "Categorias", type: "donut", data: [{ label: "Acougue", value: 38 }, { label: "Hortifruti", value: 27 }, { label: "Mercearia", value: 35 }] }
    ],
    summary: {
      title: "Resumo operacional",
      items: [
        { label: "Balanca", value: "Serial pronta", tone: "success" },
        { label: "Leitor", value: "USB teclado", tone: "success" },
        { label: "Estoque", value: `${input.stockAlerts} alertas`, tone: input.stockAlerts > 0 ? "warning" : "success" }
      ]
    }
  };
}

export function buildAcademicDashboard(input: {
  disciplines: number;
  materials: number;
  artifacts: number;
  conversations: number;
}): DashboardDefinition {
  return {
    key: "academico",
    name: "Progresso Academico",
    description: "Visao de estudos, materiais, artefatos e conversas com IA.",
    intent: "academic",
    recommendedStyle: "academic",
    filters: [
      { key: "semester", label: "Semestre", type: "select", value: "all" },
      { key: "search", label: "Busca", type: "search", value: "" }
    ],
    quickActions: [
      { key: "new-discipline", label: "Nova disciplina", intent: "primary", target: "/disciplinas" },
      { key: "ask-ai", label: "Perguntar", intent: "secondary", target: "/dr-engenheiro" },
      { key: "artifact", label: "Gerar artefato", intent: "secondary", target: "/artefatos" }
    ],
    kpis: [
      createKpi({ key: "disciplines", label: "Disciplinas", value: input.disciplines, formattedValue: formatNumber(input.disciplines), tone: "info" }),
      createKpi({ key: "materials", label: "Materiais", value: input.materials, formattedValue: formatNumber(input.materials), tone: "neutral" }),
      createKpi({ key: "artifacts", label: "Artefatos", value: input.artifacts, formattedValue: formatNumber(input.artifacts), tone: "success" }),
      createKpi({ key: "conversations", label: "Conversas", value: input.conversations, formattedValue: formatNumber(input.conversations), tone: "neutral" })
    ],
    charts: [
      { key: "materials", title: "Materiais por semestre", type: "bar", data: [{ label: "1o", value: 5 }, { label: "Eletivas", value: 26 }] },
      { key: "artifacts", title: "Artefatos", type: "metric-list", data: [{ label: "Resumo", value: 1 }, { label: "Mapa mental", value: 2 }, { label: "Infografico", value: 2 }] }
    ],
    table: {
      title: "Atividades recentes",
      columns: [{ key: "name", label: "Atividade" }, { key: "area", label: "Area" }, { key: "date", label: "Data" }],
      rows: [
        { name: "Mapa mental gerado", area: "Hidrossanitaria", date: "10/05/2026" },
        { name: "Resumo revisado", area: "Seguranca do trabalho", date: "24/05/2026" }
      ]
    }
  };
}