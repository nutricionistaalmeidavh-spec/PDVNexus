import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { buildPdvFinanceRows, buildPdvFinanceKanban } from "../apps/pdv-demo/src/financeMatrix";
import { buildPdvFinanceReport } from "../apps/pdv-demo/src/financeReporting";
import type { CommercialLedger } from "../apps/pdv-demo/src/commercialLedger";

test("P7 benchmark: 2 mil vendas, 2.500 baixas e Kanban completo com valores exatos",()=>{
 const at="2026-11-04T12:00:00Z";
 const ledger:CommercialLedger={suppliers:[{id:"F",name:"Distribuidora",createdAt:at}],
 purchases:Array.from({length:500},(_,i)=>({id:"C"+i,supplierId:"F",orderedAt:at,status:"received" as const,
   dueDate:"2026-11-20",items:[{productCode:"X",quantity:2,unitCost:10}]})),
 expenses:[],
 settlements:Array.from({length:2500},(_,i)=>({id:"P"+i,referenceId:i<500?"C"+i:"V"+(i-500),amount:i<500?5:1,
  kind:i<500?"purchase" as const:"sale" as const,paidAt:at,method:"PIX"}))};
 const sales=Array.from({length:2000},(_,i)=>({number:"V"+i,finalizedAt:at,netTotal:10,items:[],
  payments:[{method:"A PRAZO",amount:10}]}));
 const creditMethods=["A PRAZO"];
 const times:number[]=[];
 for(let attempt=0;attempt<7;attempt++){
  const t=performance.now();
  const rows=buildPdvFinanceRows({ledger,sales,creditMethods});
  const board=buildPdvFinanceKanban(rows,"2026-11-07");
  const report=buildPdvFinanceReport({ledger,sales,creditMethods});
  times.push(performance.now()-t);
  assert.equal(rows.length,2500);
  assert.equal(board.reduce((n,c)=>n+c.rows.length,0),2500);
  assert.equal(report.realizedIn,2000);
  assert.equal(report.realizedOut,2500);
  assert.equal(report.forecastIn,18000);
  assert.equal(report.forecastOut,7500);
 }
 const ordered=[...times].sort((a,b)=>a-b);
 const p50=ordered[Math.floor((ordered.length-1)*0.5)],p95=ordered[Math.ceil(ordered.length*0.95)-1];
 console.info(JSON.stringify({metric:"finance-2k-sales-2500-settlements",p50_ms:+p50.toFixed(1),p95_ms:+p95.toFixed(1),iterations:times.length}));
 assert.ok(p95<12000,"benchmark excedeu limite de segurança de 12 segundos");
});
