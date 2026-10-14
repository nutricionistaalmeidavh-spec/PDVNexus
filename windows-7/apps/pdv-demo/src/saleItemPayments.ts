/**
 * A financial tender is attached to the SALE, not a product. This module records
 * deliberate cashier assignments and validates them against both sides.
 * Never infer how a mixed tender was divided across products.
 */
import { allocateReportAmounts, type ReportSale } from "./salesReporting";

export interface ItemPaymentAssignment {
  itemId: string;
  method: string;
  quantity: number;
}
export interface ItemPaymentAllocation extends ItemPaymentAssignment {
  amount: number;
}
export interface AllocationSale extends Omit<ReportSale, "finalizedAt" | "items"> {
  finalizedAt?: string;
  items: Array<ReportSale["items"][number] & { id: string }>;
  paymentItemAssignments?: ItemPaymentAssignment[];
  itemPaymentAllocations?: ItemPaymentAllocation[];
}
export interface AllocationResult {
  mode: "automatic" | "explicit" | "unidentified";
  rows: ItemPaymentAllocation[];
  error?: string;
}
const cents = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100);
const money = (value: number) => Number((value / 100).toFixed(2));
const qUnits = (value: number) => Math.round(value * 1000);
const normalized = (text: string) => text.trim().toLocaleUpperCase("pt-BR");
const same = (a: string, b: string) => normalized(a) === normalized(b);
const isCash = (method: string, cashMethodNames: readonly string[]) =>
  ["DINHEIRO", "A VISTA", "ESPÉCIE", "ESPECIE", "CASH", ...cashMethodNames].some(m => same(m, method));

export function effectiveItemTenders(sale: Pick<ReportSale, "payments" | "paymentSummary" | "netTotal">, cashMethodNames: readonly string[] = []) {
  const result = new Map<string, { method: string; cents: number }>();
  let change = Math.max(0, cents(sale.paymentSummary?.changeDue ?? 0));
  for (const payment of sale.payments) {
    if (!Number.isFinite(payment.amount) || payment.amount < 0) return new Map<string, { method: string; cents: number }>();
    let amount = cents(payment.amount);
    if (change && isCash(payment.method, cashMethodNames)) {
      const returned = Math.min(change, amount);
      change -= returned;
      amount -= returned;
    }
    if (!amount) continue;
    const key = normalized(payment.method);
    const current = result.get(key);
    result.set(key, { method: current?.method ?? payment.method, cents: (current?.cents ?? 0) + amount });
  }
  return result;
}
function tenderError(tenders: Map<string, { method: string; cents: number }>, sale: Pick<ReportSale, "netTotal">): string | undefined {
  const total = [...tenders.values()].reduce((sum, tender) => sum + tender.cents, 0);
  return total === cents(sale.netTotal)
    ? undefined : "Os valores recebidos, descontado o troco, não conciliam com o total da venda.";
}
function validateQuantity(item: AllocationSale["items"][number], qty: number): boolean {
  if (!Number.isFinite(qty) || qty <= 0 || Math.abs(qUnits(qty) - qty * 1000) > 1e-6) return false;
  const unit = same(item.unitLabel ?? "UN", "UN");
  return !unit || Number.isInteger(qty);
}
function spreadCents(net: number, quantities: number[]): number[] {
  const qtyTotal = quantities.reduce((s, q) => s + qUnits(q), 0);
  if (!qtyTotal) return [];
  const shares = quantities.map((qty, index) => {
    const numerator = net * qUnits(qty);
    return { index, base: Math.floor(numerator / qtyTotal), remainder: numerator % qtyTotal };
  });
  const result = shares.map(s => s.base);
  let left = net - result.reduce((a, b) => a + b, 0);
  shares.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const entry of shares) { if (!left) break; result[entry.index]++; left--; }
  return result;
}
/**
 * For a single settled tender, every item is unambiguously paid that way.
 * For multiple tenders, a nonempty assignment is mandatory for item attribution;
 * omissions leave the sale valid but the report explicitly unidentified.
 */
export function resolveItemPayments(
  sale: AllocationSale,
  assignments: readonly ItemPaymentAssignment[] = [],
  cashMethodNames: readonly string[] = []
): AllocationResult {
  const tenders = effectiveItemTenders(sale, cashMethodNames);
  const tenderIssue = tenderError(tenders, sale);
  if (tenderIssue) return { mode: "unidentified", rows: [], error: tenderIssue };
  const methods = [...tenders.values()];
  if (!sale.items.length || !methods.length) return { mode: "unidentified", rows: [] };
  const unique = new Set(sale.items.map(i => i.id));
  if (unique.size !== sale.items.length) return { mode: "unidentified", rows: [], error: "Identificadores de itens repetidos." };
  if (!assignments.length && methods.length > 1) return { mode: "unidentified", rows: [] };

  const mapping = assignments.length
    ? assignments
    : sale.items.map(item => ({ itemId: item.id, method: methods[0].method, quantity: item.quantity }));
  const used = new Set<string>();
  const rows: ItemPaymentAllocation[] = [];
  const itemNets = allocateReportAmounts(sale);
  for (const [index, item] of sale.items.entries()) {
    const selected = mapping.filter(a => a.itemId === item.id && a.quantity !== 0);
    if (!selected.length) return { mode: "unidentified", rows: [], error: "Associe uma forma de pagamento a cada produto." };
    let assigned = 0;
    for (const entry of selected) {
      if (!validateQuantity(item, entry.quantity) || !tenders.has(normalized(entry.method))) {
        return { mode: "unidentified", rows: [], error: "Quantidade ou forma de pagamento inválida em " + item.productName + "." };
      }
      const key = item.id + ":" + normalized(entry.method);
      if (used.has(key)) return { mode: "unidentified", rows: [], error: "Forma de pagamento duplicada no mesmo item." };
      used.add(key);
      assigned += qUnits(entry.quantity);
    }
    if (assigned !== qUnits(item.quantity)) {
      return { mode: "unidentified", rows: [], error: "Distribua toda a quantidade de " + item.productName + " entre os pagamentos." };
    }
    const split = spreadCents(cents(itemNets[index] ?? 0), selected.map(e => e.quantity));
    for (let i = 0; i < selected.length; i++) {
      rows.push({ itemId: item.id, method: tenders.get(normalized(selected[i].method))!.method,
        quantity: selected[i].quantity, amount: money(split[i]) });
    }
  }
  if (mapping.some(entry => !unique.has(entry.itemId))) return {
    mode: "unidentified", rows: [], error: "Um produto foi removido; revise a divisão do pagamento."
  };
  for (const tender of tenders.values()) {
    const allocated = rows.filter(r => same(r.method, tender.method)).reduce((sum, r) => sum + cents(r.amount), 0);
    if (allocated !== tender.cents) {
      return { mode: "unidentified", rows: [],
        error: "A distribuição em " + tender.method + " soma R$ " + money(allocated).toFixed(2).replace(".", ",") +
          ", mas o pagamento registrado é R$ " + money(tender.cents).toFixed(2).replace(".", ",") + "." };
    }
  }
  return { mode: assignments.length ? "explicit" : "automatic", rows };
}
/**
 * Trust a stored item attribution only when all line and tender sums reconcile.
 * Malformed or historical data falls back to "unidentified", never invented attribution.
 */
export function verifiedStoredItemPayments(
  sale: AllocationSale, cashMethodNames: readonly string[] = []
): ItemPaymentAllocation[] | null {
  if (!Array.isArray(sale.itemPaymentAllocations) || !sale.itemPaymentAllocations.length) return null;
  const prepared = resolveItemPayments(sale, sale.itemPaymentAllocations, cashMethodNames);
  if (prepared.error || prepared.mode !== "explicit" || prepared.rows.length !== sale.itemPaymentAllocations.length) return null;
  const keyed = (list: readonly ItemPaymentAllocation[]) => list
    .map(row => [row.itemId, normalized(row.method), qUnits(row.quantity), cents(row.amount)].join("|")).sort().join(";");
  return keyed(prepared.rows) === keyed(sale.itemPaymentAllocations) ? prepared.rows : null;
}
