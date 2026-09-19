import type { PdvPrintJobStatus } from "./eventbus.js";

export type PdvAlertSeverity = "info" | "warning" | "critical";
export interface PdvOperationalAlert {
  id: string;
  kind: "low-stock" | "cash-divergence" | "print-failure" | "backup-stale" | "open-cash";
  severity: PdvAlertSeverity;
  message: string;
  entityId?: string;
}

export function buildPdvOperationalAlerts(input: {
  products?: Array<{ productCode?: string; code?: string; productName?: string; name?: string; stock: number; minStock?: number; minimumStock?: number }>;
  cashClosings?: Array<{ status?: string; closedAt?: string; divergenceByMethod?: Record<string, number> }>;
  printJobs?: Array<{ id: string; status: PdvPrintJobStatus; failureReason?: string }>;
  lastBackupAt?: string;
  backupMaxAgeHours?: number;
  cashSessionOpenedAt?: string;
  now?: string;
}) {
  const alerts: PdvOperationalAlert[] = [];
  for (const product of input.products ?? []) {
    const minStock = product.minStock ?? product.minimumStock ?? 0;
    if (minStock > 0 && product.stock <= minStock) {
      const id = product.productCode ?? product.code ?? "produto";
      alerts.push({ id: `low-stock-${id}`, kind: "low-stock", severity: product.stock <= 0 ? "critical" : "warning", message: `${product.productName ?? product.name ?? id}: estoque ${product.stock} (mínimo ${minStock})`, entityId: id });
    }
  }
  for (const closing of input.cashClosings ?? []) {
    if (closing.status !== "divergent") continue;
    const divergence = Object.values(closing.divergenceByMethod ?? {}).reduce((sum, value) => sum + Math.abs(Number(value) || 0), 0);
    alerts.push({ id: `cash-${closing.closedAt ?? alerts.length}`, kind: "cash-divergence", severity: "critical", message: `Fechamento de caixa divergente${divergence ? `: R$ ${divergence.toFixed(2)}` : ""}` });
  }
  for (const job of input.printJobs ?? []) {
    if (job.status === "error") alerts.push({ id: `print-${job.id}`, kind: "print-failure", severity: "warning", message: job.failureReason || "Falha de impressão", entityId: job.id });
  }
  if (input.lastBackupAt) {
    const nowMs = Date.parse(input.now ?? new Date().toISOString());
    const backupMs = Date.parse(input.lastBackupAt);
    const maxAge = (input.backupMaxAgeHours ?? 24) * 60 * 60 * 1000;
    if (Number.isFinite(nowMs) && Number.isFinite(backupMs) && nowMs - backupMs > maxAge) {
      alerts.push({ id: "backup-stale", kind: "backup-stale", severity: "warning", message: "Backup automático está atrasado" });
    }
  }
  if (input.cashSessionOpenedAt) {
    alerts.push({ id: "open-cash", kind: "open-cash", severity: "info", message: `Caixa aberto desde ${input.cashSessionOpenedAt}` });
  }
  return alerts;
}

export interface PdvReportingSale {
  number: string;
  finalizedAt: string;
  netTotal: number;
  seller?: string;
  discountPercent?: number;
  status?: "completed" | "cancelled";
  items?: Array<{ productCode: string; productName: string; quantity: number; totalPrice: number; category?: string }>;
  payments?: Array<{ method: string; amount: number }>;
}

export function buildPdvOperationsReport(sales: PdvReportingSale[]) {
  const active = sales.filter((sale) => sale.status !== "cancelled");
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const bySeller: Record<string, number> = {};
  const byProduct: Record<string, { name: string; quantity: number; total: number }> = {};
  const byPayment: Record<string, number> = {};
  let discountedSales = 0;

  for (const sale of active) {
    const seller = sale.seller?.trim() || "Não informado";
    bySeller[seller] = (bySeller[seller] ?? 0) + sale.netTotal;
    if ((sale.discountPercent ?? 0) > 0) discountedSales += 1;
    for (const item of sale.items ?? []) {
      const current = byProduct[item.productCode] ?? { name: item.productName, quantity: 0, total: 0 };
      current.quantity += item.quantity;
      current.total += item.totalPrice;
      byProduct[item.productCode] = current;
    }
    for (const payment of sale.payments ?? []) byPayment[payment.method] = (byPayment[payment.method] ?? 0) + payment.amount;
  }

  const total = sum(active.map((sale) => sale.netTotal));
  return {
    salesCount: active.length,
    cancelledCount: sales.length - active.length,
    total,
    averageTicket: active.length ? total / active.length : 0,
    discountedSales,
    bySeller,
    byPayment,
    topProducts: Object.entries(byProduct)
      .map(([productCode, value]) => ({ productCode, ...value }))
      .sort((left, right) => right.total - left.total)
  };
}

export function exportPdvOperationsReportCsv(sales: PdvReportingSale[]) {
  const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = [["data", "venda", "vendedor", "status", "total"]];
  for (const sale of sales) rows.push([sale.finalizedAt, sale.number, sale.seller ?? "", sale.status ?? "completed", sale.netTotal.toFixed(2)]);
  return rows.map((row) => row.map(quote).join(";")).join("\n");
}
