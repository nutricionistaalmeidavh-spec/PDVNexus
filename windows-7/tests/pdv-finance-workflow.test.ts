import test from "node:test";
import assert from "node:assert/strict";
import { buildPdvFinanceRows, buildPdvFinanceKanban } from "../apps/pdv-demo/src/financeMatrix";
import { buildPdvFinanceReport, exportPdvFinanceCsv } from "../apps/pdv-demo/src/financeReporting";
import { emptyCommercialLedger, settleExpense, expenseOpenBalance, type CommercialLedger } from "../apps/pdv-demo/src/commercialLedger";

const stamp="2026-11-04T12:00:00.000Z";
const ledger:CommercialLedger={
 ...emptyCommercialLedger(),
 suppliers:[{id:"FOR",name:"Fornecedor",createdAt:stamp}],
 purchases:[
  {id:"C1",supplierId:"FOR",orderedAt:stamp,dueDate:"2026-11-01",status:"received",items:[{productCode:"A",quantity:3,unitCost:100}]},
  {id:"C2",supplierId:"FOR",orderedAt:stamp,dueDate:"2026-11-20",status:"received",items:[{productCode:"B",quantity:1,unitCost:40}]}
 ],
 expenses:[
  {id:"E1",description:"Energia",amount:50,category:"Operacional",occurredAt:stamp,dueDate:"2026-11-15",trackPayment:true},
  {id:"LEGACY",description:"Despesa antiga",amount:70,category:"Operacional",occurredAt:stamp}
 ],
 settlements:[
  {id:"P1",referenceId:"C1",kind:"purchase",amount:100,paidAt:stamp,method:"PIX"},
  {id:"R1",referenceId:"VD1",kind:"sale",amount:30,paidAt:stamp,method:"PIX"},
  {id:"E1P",referenceId:"E1",kind:"expense",amount:20,paidAt:stamp,method:"PIX"}
 ]
};
const sales=[
 {number:"VD1",finalizedAt:stamp,netTotal:100,dueDate:"2026-11-19",items:[],
  payments:[{method:"A PRAZO",amount:80},{method:"PIX",amount:20}]},
 {number:"VD2",finalizedAt:stamp,netTotal:10,items:[],payments:[{method:"PIX",amount:10}]}
];
const input={ledger,sales,creditMethods:["A PRAZO"]};

test("P2 Kanban é composto por colunas de lançamentos individuais; a classificação é derivada e não altera a fonte",()=>{
 const original=JSON.stringify(input);
 const board=buildPdvFinanceKanban(buildPdvFinanceRows(input),"2026-11-07");
 assert.deepEqual(board.find(col=>col.id==="vencidas")?.rows.map(x=>x.reference),["C1"]);
 assert.deepEqual(board.find(col=>col.id==="a_vencer")?.rows.map(x=>x.reference),["C2","VD1","E1"]);
 assert.deepEqual(board.find(col=>col.id==="registradas")?.rows.map(x=>x.reference),["LEGACY"]);
 assert.deepEqual(JSON.stringify(input),original);
});

test("P4 despesa com rastreamento suporta baixa parcial, bloqueia duplicidade e não inventa pagamento histórico",()=>{
 assert.equal(expenseOpenBalance(ledger,ledger.expenses[0]),30);
 assert.equal(expenseOpenBalance(ledger,ledger.expenses[1]),null);
 assert.throws(()=>settleExpense(ledger,{id:"X",referenceId:"E1",amount:31,paidAt:stamp,method:"PIX"}),/saldo|excede/i);
 assert.throws(()=>settleExpense(ledger,{id:"E1P",referenceId:"E1",amount:1,paidAt:stamp,method:"PIX"}),/duplicad/i);
 assert.throws(()=>settleExpense(ledger,{id:"X",referenceId:"LEGACY",amount:1,paidAt:stamp,method:"PIX"}),/sem controle|não habilitada|rastreamento/i);
 const next=settleExpense(ledger,{id:"E2P",referenceId:"E1",amount:30,paidAt:stamp,method:"PIX"});
 assert.equal(expenseOpenBalance(next,next.expenses[0]),0);
 assert.equal(ledger.settlements.length,3);
 assert.equal(next.settlements.length,4);
});

test("P6 fluxo realizado separa vendas imediatas de créditos e não duplica recebimentos",()=>{
 const report=buildPdvFinanceReport(input);
 assert.equal(report.realizedIn,60);
 assert.equal(report.realizedOut,120);
 assert.equal(report.netRealized,-60);
 assert.equal(report.forecastIn,50);
 assert.equal(report.forecastOut,270);
 assert.equal(report.untrackedExpenses,1);
 const day=report.daily.find(row=>row.day==="2026-11-04");
 assert.equal(day?.in,60);
 assert.equal(day?.out,120);
});

test("P6 exportação CSV escapa campos, Excel não vira fórmula executável e reporta saldo real",()=>{
 const rows=buildPdvFinanceRows(input).map(x=>({...x,party:x.party+", =HYPERLINK"}));
 const csv=exportPdvFinanceCsv(rows);
 assert.match(csv,/^\uFEFF/);
 assert.match(csv,/"Fornecedor, =HYPERLINK"/);
 assert.match(csv,/,"C1"/);
});
