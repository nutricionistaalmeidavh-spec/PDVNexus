import {
  purchaseOpenBalance, purchaseTotal, saleCreditTotal, saleOpenBalance,
  type CommercialLedger, type CommercialSale
} from "./commercialLedger";

export type PdvFinanceKind = "payable" | "receivable" | "expense";
export type PdvFinanceStatus = "pendente" | "parcial" | "liquidada" | "registrada";
export interface PdvFinanceSource {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
}
export interface PdvFinanceRow {
  key: string;
  kind: PdvFinanceKind;
  reference: string;
  party: string;
  date: string;
  dueDate?: string;
  original: number;
  settled: number | null;
  open: number | null;
  status: PdvFinanceStatus;
  sources: PdvFinanceSource[];
}
export interface PdvFinanceFilters {
  kind: PdvFinanceKind | "all";
  status: PdvFinanceStatus | "all";
  search: string;
  from: string;
  to: string;
}
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function statusFor(open: number, settled: number): PdvFinanceStatus {
  if (open <= 0) return "liquidada";
  return settled > 0 ? "parcial" : "pendente";
}

/** Só datas conhecidas. Não inventa vencimento de vendas legadas. */
export function pdvFinanceDay(value: string | undefined): string | null {
  if (!value) return null;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (iso) return iso[1];
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(value);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

/** Projeção imutável dos registros originais; nenhum estado financeiro paralelo. */
export function buildPdvFinanceRows(input: {
  ledger: CommercialLedger;
  sales: CommercialSale[];
  creditMethods: string[];
  customers?: ReadonlyArray<{ id: string; name: string }>;
}): PdvFinanceRow[] {
  const { ledger, sales, creditMethods } = input;
  const customers = new Map((input.customers ?? []).map(row => [row.id, row.name]));
  const sources = (kind: "purchase" | "sale", reference: string): PdvFinanceSource[] =>
    ledger.settlements.filter(row => row.kind === kind && row.referenceId === reference)
      .map(row => ({ id: row.id, amount: row.amount, method: row.method, paidAt: row.paidAt }));

  const payable: PdvFinanceRow[] = ledger.purchases
    .filter(row => row.status === "received")
    .map(row => {
      const original = purchaseTotal(row);
      const open = purchaseOpenBalance(ledger, row);
      const settled = money(original - open);
      return {
        key: `payable:${row.id}`, kind: "payable", reference: row.id,
        party: ledger.suppliers.find(s => s.id === row.supplierId)?.name ?? row.supplierId,
        date: row.orderedAt, dueDate: row.dueDate,
        original, settled, open, status: statusFor(open, settled),
        sources: sources("purchase", row.id)
      };
    });

  const receivable: PdvFinanceRow[] = sales.map(sale => {
    const original = saleCreditTotal(sale, creditMethods);
    if (original <= 0) return null;
    const open = saleOpenBalance(ledger, sale, creditMethods);
    const settled = money(original - open);
    const customerId = (sale as CommercialSale & { customerId?: string }).customerId;
    return {
      key: `receivable:${sale.number}`, kind: "receivable" as const, reference: sale.number,
      party: (customerId ? customers.get(customerId) : undefined) ?? (customerId ? `Cliente ${customerId}` : "Cliente não informado"),
      date: sale.finalizedAt, original, settled, open, status: statusFor(open, settled),
      sources: sources("sale", sale.number)
    };
  }).filter((row): row is NonNullable<typeof row> => row !== null);

  const expenses: PdvFinanceRow[] = ledger.expenses.map(row => ({
    key: `expense:${row.id}`, kind: "expense", reference: row.id,
    party: row.description, date: row.occurredAt,
    original: row.amount, settled: null, open: null, status: "registrada", sources: []
  }));
  return [...payable, ...receivable, ...expenses].sort((a, b) =>
    (pdvFinanceDay(b.date) ?? "").localeCompare(pdvFinanceDay(a.date) ?? "") || a.key.localeCompare(b.key));
}

export function filterPdvFinanceRows(rows: readonly PdvFinanceRow[], filters: PdvFinanceFilters): PdvFinanceRow[] {
  const search = filters.search.trim().toLocaleLowerCase("pt-BR");
  return rows.filter(row => {
    if (filters.kind !== "all" && row.kind !== filters.kind) return false;
    if (filters.status !== "all" && row.status !== filters.status) return false;
    if (search && ![` ${row.party}`, row.reference, row.kind].join(" ").toLocaleLowerCase("pt-BR").includes(search)) return false;
    if (filters.from || filters.to) {
      const date = pdvFinanceDay(row.date);
      if (!date || (filters.from && date < filters.from) || (filters.to && date > filters.to)) return false;
    }
    return true;
  });
}
