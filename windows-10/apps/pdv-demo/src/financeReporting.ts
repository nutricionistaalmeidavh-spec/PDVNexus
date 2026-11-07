import { saleCreditTotal, type CommercialLedger, type CommercialSale } from "./commercialLedger";
import { buildPdvFinanceRows, pdvFinanceDay, type PdvFinanceRow } from "./financeMatrix";
export interface PdvFinanceDaily {day:string;in:number;out:number;net:number}
export interface PdvFinanceReport {
  realizedIn:number;
  realizedOut:number;
  netRealized:number;
  forecastIn:number;
  forecastOut:number;
  untrackedExpenses:number;
  missingDueDates:number;
  daily:PdvFinanceDaily[];
  categories:Array<{category:string;registered:number;pending:number|null}>;
}
const money=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export function buildPdvFinanceReport(input:{
  ledger:CommercialLedger;
  sales:CommercialSale[];
  creditMethods:string[];
  from?:string;
  to?:string;
}):PdvFinanceReport {
  const {ledger,sales,creditMethods}=input;
  const creditMethodsNormalized=new Set(creditMethods.map(s=>s.toLocaleLowerCase("pt-BR").trim()));
  const inPeriod=(day:string | null)=>day!==null&&(!input.from||day>=input.from)&&(!input.to||day<=input.to);
  const daily=new Map<string,{in:number;out:number}>();
  const record=(date:string,kind:"in"|"out",amount:number)=>{
    const day=pdvFinanceDay(date);
    if(!inPeriod(day)||amount<=0||!Number.isFinite(amount))return;
    const value=daily.get(day!)??{in:0,out:0};
    value[kind]=money(value[kind]+amount);
    daily.set(day!,value);
  };
  // Operational entry at sale time only for non-credit tenders. Credit enters once, at settlement.
  for(const sale of sales) {
    for(const payment of sale.payments) {
      if(!creditMethodsNormalized.has(payment.method.toLocaleLowerCase("pt-BR").trim()))
        record(sale.finalizedAt,"in",payment.amount);
    }
  }
  for(const settlement of ledger.settlements)
    record(settlement.paidAt,settlement.kind==="sale"?"in":"out",settlement.amount);
  const dailyRows=[...daily.entries()].sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([day,v])=>({day,in:money(v.in),out:money(v.out),net:money(v.in-v.out)}));
  const realizedIn=money(dailyRows.reduce((sum,row)=>sum+row.in,0));
  const realizedOut=money(dailyRows.reduce((sum,row)=>sum+row.out,0));

  const rows=buildPdvFinanceRows({ledger,sales,creditMethods});
  const forecastIn=money(rows.filter(x=>x.kind==="receivable").reduce((n,x)=>n+(x.open??0),0));
  const forecastOut=money(rows.filter(x=>x.kind==="payable"||(x.kind==="expense"&&x.open!==null)).reduce((n,x)=>n+(x.open??0),0));
  const missingDueDates=rows.filter(x=>x.open!==null&&x.open>0&&!x.dueDate).length;
  const untrackedExpenses=rows.filter(x=>x.kind==="expense"&&x.open===null).length;
  const categoriesMap=new Map<string,{registered:number;pending:number|null}>();
  for(const expense of ledger.expenses) {
    const current=categoriesMap.get(expense.category)??{registered:0,pending:0};
    current.registered=money(current.registered+expense.amount);
    const projected=rows.find(r=>r.key==="expense:"+expense.id);
    current.pending=current.pending===null||projected?.open===null?null:money(current.pending+(projected?.open??0));
    categoriesMap.set(expense.category,current);
  }
  return {realizedIn,realizedOut,netRealized:money(realizedIn-realizedOut),forecastIn,forecastOut,
    missingDueDates,untrackedExpenses,daily:dailyRows,
    categories:[...categoriesMap.entries()].map(([category,v])=>({category,...v})).sort((a,b)=>b.registered-a.registered)};
}
function safeCsvCell(value:unknown):string {
  let text=String(value??"");
  // CSV formula injection on Excel/LibreOffice: leading formula controls become literal text.
  if (/^[\s]*[=+@-]/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
/** RFC 4180 CSV with BOM, escaped fields, no spreadsheet formula execution. */
export function exportPdvFinanceCsv(rows:readonly PdvFinanceRow[]):string {
  const head=["Natureza","Documento","Cliente / fornecedor / despesa","Data","Vencimento",
    "Valor original","Liquidado","Saldo em aberto","Situação","Referências das baixas"];
  const lines=rows.map(row=>[
    row.kind,row.reference+(row.installmentLabel?" · Parcela "+row.installmentLabel:""),row.party,row.date,row.dueDate??"",row.original.toFixed(2),
    row.settled===null?"":row.settled.toFixed(2),row.open===null?"":row.open.toFixed(2),row.status,
    row.sources.map(source=>source.id).join(" | ")
  ]);
  return "\uFEFF"+[head,...lines].map(row=>row.map(safeCsvCell).join(",")).join("\r\n");
}
