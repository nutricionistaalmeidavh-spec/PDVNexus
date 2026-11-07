import {
  purchaseOpenBalance, purchaseTotal, saleCreditTotal, saleOpenBalance, expenseOpenBalance,
  type CommercialLedger, type CommercialSale
} from "./commercialLedger";

export type PdvFinanceKind = "payable" | "receivable" | "expense";
export type PdvFinanceStatus = "pendente" | "parcial" | "liquidada" | "registrada";
export interface PdvFinanceSource {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
  operatorName?: string;
}
export interface PdvFinanceRow {
  key: string;
  kind: PdvFinanceKind;
  reference: string;
  /** Optional for sales with a canonical installment schedule. */
  installmentLabel?: string;
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
  const sources = (kind: "purchase" | "sale" | "expense", reference: string): PdvFinanceSource[] =>
    ledger.settlements.filter(row => row.kind === kind && row.referenceId === reference)
      .map(row => ({ id: row.id, amount: row.amount, method: row.method, paidAt: row.paidAt, operatorName:row.operatorName }));

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

  const receivable: PdvFinanceRow[] = sales.flatMap(sale => {
    const original = saleCreditTotal(sale, creditMethods);
    if (original <= 0) return [];
    const customerId = (sale as CommercialSale & { customerId?: string }).customerId;
    const party = (customerId ? customers.get(customerId) : undefined) ??
      (customerId ? "Cliente " + customerId : "Cliente não informado");
    // Old sales and incomplete imports remain a single credit title, without invented maturity.
    const documented = sale.installments;
    const useSchedule = Array.isArray(documented) && documented.length > 0 &&
      documented.every((item,i) => item.number===i+1 && item.amount>0 &&
        Number.isFinite(item.amount) && pdvFinanceDay(item.dueDate)===item.dueDate) &&
      Math.round(documented.reduce((sum,item)=>sum+item.amount,0)*100)===Math.round(original*100);
    const titles = useSchedule ? documented! : [{number:1,amount:original,dueDate:sale.dueDate}];
    const payments = sources("sale",sale.number);
    let cursor=0, paymentRemaining=payments[0]?.amount ?? 0;
    return titles.map((title,index) => {
      let open=money(title.amount);
      const allocations:PdvFinanceSource[]=[];
      while (open>0 && cursor<payments.length) {
        if(paymentRemaining<=0){cursor++;paymentRemaining=payments[cursor]?.amount??0;continue;}
        const applied=money(Math.min(open,paymentRemaining));
        if(applied<=0)break;
        allocations.push({...payments[cursor],amount:applied});
        open=money(open-applied);
        paymentRemaining=money(paymentRemaining-applied);
      }
      const settled=money(title.amount-open);
      const installmentLabel = useSchedule ? String(title.number)+"/"+String(titles.length) : undefined;
      return {
        key:"receivable:"+sale.number+(useSchedule?":installment:"+String(index+1):""),
        kind:"receivable" as const, reference:sale.number, party,
        installmentLabel, date:sale.finalizedAt, dueDate:title.dueDate,
        original:money(title.amount), settled, open, status:statusFor(open,settled),
        sources:allocations
      };
    });
  });

  const expenses: PdvFinanceRow[] = ledger.expenses.map(row => {
    const open=expenseOpenBalance(ledger,row);
    const settled=open===null?null:money(row.amount-open);
    return {
      key:`expense:${row.id}`,kind:"expense",reference:row.id,party:row.description,
      date:row.occurredAt,dueDate:row.dueDate,original:row.amount,settled,open,
      status:open===null?"registrada":statusFor(open,settled ?? 0),
      sources:sources("expense",row.id)
    };
  });
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

export type PdvKanbanColumnId = "vencidas" | "a_vencer" | "parciais" | "liquidadas" | "sem_vencimento" | "registradas";
export interface PdvFinanceKanbanColumn { id:PdvKanbanColumnId; title:string; rows:PdvFinanceRow[] }
/** Every item occurs exactly once. Dragging never generates a settlement: only source events change its status. */
export function buildPdvFinanceKanban(rows: readonly PdvFinanceRow[], today: string): PdvFinanceKanbanColumn[] {
  const columns:PdvFinanceKanbanColumn[]=[
    {id:"vencidas",title:"Vencidas",rows:[]},
    {id:"a_vencer",title:"A vencer",rows:[]},
    {id:"parciais",title:"Parciais",rows:[]},
    {id:"liquidadas",title:"Liquidadas",rows:[]},
    {id:"sem_vencimento",title:"Sem vencimento",rows:[]},
    {id:"registradas",title:"Registradas",rows:[]}
  ];
  for (const row of rows) {
    let target:PdvKanbanColumnId;
    if (row.status==="registrada") target="registradas";
    else if (row.open===0) target="liquidadas";
    else if (row.dueDate && row.dueDate<today) target="vencidas";
    else if (row.dueDate) target="a_vencer";
    else if (row.status==="parcial") target="parciais";
    else target="sem_vencimento";
    columns.find(column=>column.id===target)!.rows.push(row);
  }
  return columns;
}
