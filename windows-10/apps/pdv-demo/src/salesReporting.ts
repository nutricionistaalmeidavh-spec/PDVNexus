/** Read-only reports from canonical recorded sales: no per-item payment attribution. */
export interface ReportSale {
  number: string; finalizedAt: string; seller?: string; customerId?: string; terminalId?: string;
  status?: "completed" | "cancelled"; netTotal: number;
  items: Array<{ productCode: string; productName: string; unitLabel?: string; quantity: number; unitPrice?: number; totalPrice: number }>;
  payments: Array<{ method: string; amount: number }>;
  paymentSummary?: { changeDue?: number };
}
export type ReportView = "lines" | "sales" | "products" | "payments" | "operators";
export interface ReportFilters {
  from?: string; to?: string; query?: string;
  status?: "completed" | "cancelled" | "all";
  paymentMethod?: string; operator?: string; productCode?: string;
}
export interface ReportLine {
  date: string; number: string; terminalId: string; operator: string; customer: string; status: string;
  productCode: string; productName: string; unit: string; quantity: number;
  unitPrice: number; gross: number; discount: number; net: number; payments: string;
}
export interface ReportSaleRow {
  date: string; number: string; terminalId: string; operator: string; customer: string; status: string;
  quantity: number; payments: string; total: number;
}
export interface ReportGroup { key: string; label: string; quantity: number; count: number; total: number }
export interface ReportResult {
  lines: ReportLine[]; sales: ReportSaleRow[]; products: ReportGroup[];
  payments: ReportGroup[]; operators: ReportGroup[];
  salesCount: number; cancelledCount: number; revenue: number; quantity: number; ticket: number;
  tenderDifference: number; unmatched: string[]; missingItems: string[];
}
const asCents = (v: number) => Math.round((Number.isFinite(v) ? v : 0) * 100);
const asAmount = (v: number) => Number((v / 100).toFixed(2));
const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
export function reportDate(raw: string): string {
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(raw.trim());
  if (br) return br[3] + "-" + br[2] + "-" + br[1];
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
  return iso ? iso[1] : "";
}
export function allocateReportAmounts(sale: ReportSale): number[] {
  const gross = sale.items.map(i => Math.max(0, asCents(i.totalPrice)));
  const total = gross.reduce((a, b) => a + b, 0);
  const net = Math.max(0, asCents(sale.netTotal));
  if (!gross.length) return [];
  if (!total) return gross.map((_, i) => i === 0 ? asAmount(net) : 0);
  const portions = gross.map((v, i) => ({ i, floor: Math.floor(net * v / total), remainder: (net * v) % total }));
  const values = portions.map(p => p.floor);
  let remaining = net - values.reduce((a, b) => a + b, 0);
  portions.sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (const portion of portions) { if (!remaining) break; values[portion.i]++; remaining--; }
  return values.map(asAmount);
}
function collectPayments(sale: ReportSale, cashNames: readonly string[]) {
  const cash = new Set(["A VISTA", "DINHEIRO", "ESPECIE", "CASH", ...cashNames.map(norm)]);
  const values = sale.payments.map(p => ({ method: p.method, cents: Math.max(0, asCents(p.amount)) }));
  let change = Math.max(0, asCents(sale.paymentSummary?.changeDue ?? 0));
  for (const value of values) {
    if (change && cash.has(norm(value.method))) {
      const used = Math.min(change, value.cents);
      change -= used; value.cents -= used;
    }
  }
  return { values, difference: values.reduce((sum, p) => sum + p.cents, 0) - asCents(sale.netTotal) };
}
export function buildSalesReport(
  completed: readonly ReportSale[], cancelled: readonly ReportSale[],
  customers: readonly { id: string; name: string }[],
  filters: ReportFilters = {}, cashNames: readonly string[] = []
): ReportResult {
  const names = new Map(customers.map(c => [c.id, c.name]));
  const indexed = new Map<string, { sale: ReportSale; status: "completed" | "cancelled" }>();
  const add = (sale: ReportSale, status: "completed" | "cancelled") => {
    const key = [sale.terminalId ?? "", sale.number, sale.finalizedAt].join("|");
    indexed.set(key, { sale, status });
  };
  for (const sale of completed) add(sale, sale.status === "cancelled" ? "cancelled" : "completed");
  for (const sale of cancelled) add(sale, "cancelled");
  const filterStatus = filters.status ?? "completed";
  const query = norm(filters.query ?? "");
  const payment = norm(filters.paymentMethod ?? "");
  const operator = norm(filters.operator ?? "");
  const productCode = norm(filters.productCode ?? "");
  const selected = [...indexed.values()].filter(({ sale, status }) => {
    if (filterStatus !== "all" && filterStatus !== status) return false;
    const date = reportDate(sale.finalizedAt);
    if (!date || (filters.from && date < filters.from) || (filters.to && date > filters.to)) return false;
    if (payment && !sale.payments.some(p => norm(p.method) === payment && asCents(p.amount) > 0)) return false;
    if (operator && norm(sale.seller ?? "") !== operator) return false;
    if (productCode && !sale.items.some(i => norm(i.productCode) === productCode)) return false;
    if (query) {
      const terms = [sale.number, sale.seller ?? "", names.get(sale.customerId ?? "") ?? sale.customerId ?? "",
        ...sale.items.flatMap(i => [i.productCode, i.productName])];
      if (!terms.some(t => norm(t).includes(query))) return false;
    }
    return true;
  }).sort((a, b) => reportDate(b.sale.finalizedAt).localeCompare(reportDate(a.sale.finalizedAt)) || b.sale.finalizedAt.localeCompare(a.sale.finalizedAt));
  const lines: ReportLine[] = [], sales: ReportSaleRow[] = [];
  const products = new Map<string, { label: string; cents: number; quantity: number; ids: Set<string> }>();
  const payments = new Map<string, { label: string; cents: number; ids: Set<string> }>();
  const operators = new Map<string, { label: string; cents: number; ids: Set<string> }>();
  const unmatched: string[] = [], missingItems: string[] = [];
  let salesCount = 0, cancelledCount = 0, revenue = 0, quantity = 0, tenderDifference = 0;
  for (const { sale, status } of selected) {
    const active = status === "completed";
    const id = [sale.terminalId ?? "", sale.number, sale.finalizedAt].join("|");
    const customer = names.get(sale.customerId ?? "") ?? sale.customerId ?? "Consumidor não identificado";
    const seller = sale.seller ?? "Não informado";
    const paymentsLabel = sale.payments.filter(p => asCents(p.amount) > 0)
      .map(p => p.method + ": R$ " + asAmount(asCents(p.amount)).toFixed(2)).join(" + ") || "Sem pagamentos";
    const allocated = allocateReportAmounts(sale);
    sales.push({ date: sale.finalizedAt, number: sale.number, terminalId: sale.terminalId ?? "", operator: seller, customer,
      status, quantity: sale.items.reduce((s, i) => s + i.quantity, 0),
      payments: paymentsLabel, total: active ? sale.netTotal : 0 });
    if (active) { salesCount++; revenue += asCents(sale.netTotal); if (!sale.items.length) missingItems.push(sale.number); }
    else cancelledCount++;
    sale.items.forEach((item, idx) => {
      const gross = asCents(item.totalPrice);
      const net = asCents(allocated[idx] ?? 0);
      lines.push({ date: sale.finalizedAt, number: sale.number, terminalId: sale.terminalId ?? "", operator: seller,
        customer, status, productCode: item.productCode, productName: item.productName,
        unit: item.unitLabel ?? "UN", quantity: item.quantity, unitPrice: item.unitPrice ?? 0,
        gross: asAmount(gross), discount: asAmount(gross - net),
        net: active ? asAmount(net) : 0, payments: paymentsLabel });
      if (!active) return;
      quantity += item.quantity;
      const key = item.productCode || item.productName;
      const group = products.get(key) ?? { label: item.productName, cents: 0, quantity: 0, ids: new Set<string>() };
      group.cents += net; group.quantity += item.quantity; group.ids.add(id);
      products.set(key, group);
    });
    if (!active) continue;
    const pay = collectPayments(sale, cashNames);
    tenderDifference += pay.difference;
    if (pay.difference) unmatched.push(sale.number);
    for (const value of pay.values) {
      if (!value.cents) continue;
      const key = norm(value.method);
      const group = payments.get(key) ?? { label: value.method, cents: 0, ids: new Set<string>() };
      group.cents += value.cents; group.ids.add(id);
      payments.set(key, group);
    }
    const group = operators.get(seller) ?? { label: seller, cents: 0, ids: new Set<string>() };
    group.cents += asCents(sale.netTotal); group.ids.add(id); operators.set(seller, group);
  }
  const groupResults = (map: Map<string, { label: string; cents: number; ids: Set<string>; quantity?: number }>) =>
    [...map.entries()].map(([key, g]) => ({
      key, label: g.label, quantity: g.quantity ?? 0, count: g.ids.size, total: asAmount(g.cents)
    })).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  return { lines, sales, products: groupResults(products), payments: groupResults(payments),
    operators: groupResults(operators), salesCount, cancelledCount, revenue: asAmount(revenue),
    quantity, ticket: salesCount ? asAmount(Math.round(revenue / salesCount)) : 0,
    tenderDifference: asAmount(tenderDifference), unmatched, missingItems };
}
function escapeCell(value: string | number): string {
  let text = String(value ?? "");
  if (typeof value === "string" && /^\s*[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
const money = (value: number) => value.toFixed(2).replace(".", ",");
function writeCsv(headers: string[], rows: Array<Array<string | number>>) {
  return "\uFEFF" + [headers, ...rows].map(r => r.map(escapeCell).join(";")).join("\r\n") + "\r\n";
}
export function exportSalesReportCsv(report: ReportResult, view: ReportView): string {
  if (view === "lines") return writeCsv(
    ["data", "venda", "operador", "cliente", "status", "codigo", "produto", "unidade", "quantidade",
      "preco_unitario", "bruto", "desconto", "total_liquido", "pagamentos_da_venda"],
    report.lines.map(r => [r.date, r.number, r.operator, r.customer, r.status, r.productCode, r.productName,
      r.unit, String(r.quantity).replace(".", ","), money(r.unitPrice), money(r.gross),
      money(r.discount), money(r.net), r.payments])
  );
  if (view === "sales") return writeCsv(
    ["data", "venda", "operador", "cliente", "status", "quantidade", "pagamentos_da_venda", "total_valido"],
    report.sales.map(r => [r.date, r.number, r.operator, r.customer, r.status,
      String(r.quantity).replace(".", ","), r.payments, money(r.total)])
  );
  const groups = view === "products" ? report.products : view === "payments" ? report.payments : report.operators;
  return writeCsv(["agrupamento", "vendas", ...(view === "products" ? ["quantidade"] : []), "total"],
    groups.map(g => [g.label, g.count, ...(view === "products" ? [String(g.quantity).replace(".", ",")] : []), money(g.total)]));
}
