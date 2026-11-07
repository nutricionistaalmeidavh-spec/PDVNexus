import test from "node:test";
import assert from "node:assert/strict";
import {buildCreditInstallments,settleReceivable,emptyCommercialLedger} from "../apps/pdv-demo/src/commercialLedger";
import {buildPdvFinanceRows,buildPdvFinanceKanban} from "../apps/pdv-demo/src/financeMatrix";

test("crediário: três parcelas mensais somam centavo a centavo, inclusive em fim de mês",()=>{
 const installments=buildCreditInstallments(100,"2026-01-31",3);
 assert.deepEqual(installments.map(x=>x.amount),[33.34,33.33,33.33]);
 assert.deepEqual(installments.map(x=>x.dueDate),["2026-01-31","2026-02-28","2026-03-31"]);
 assert.deepEqual(installments.map(x=>x.number),[1,2,3]);
 assert.equal(installments.reduce((n,x)=>n+Math.round(x.amount*100),0),10000);
 assert.deepEqual(buildCreditInstallments(0.03,"2028-02-29",3).map(x=>x.dueDate),
  ["2028-02-29","2028-03-29","2028-04-29"]);
 assert.throws(()=>buildCreditInstallments(0.02,"2026-01-30",3),/centavo|parcelas/i);
 assert.throws(()=>buildCreditInstallments(100,"2026-02-31",3),/inválid/i);
 assert.throws(()=>buildCreditInstallments(100,"2026-01-31",13),/12/);
});

test("matriz e Kanban exibem títulos independentes com baixa parcial FIFO sem duplicidade de recebimentos",()=>{
 const installments=buildCreditInstallments(100,"2026-01-31",3);
 const sale={number:"VD-TEST",finalizedAt:"2026-01-01T15:00:00Z",netTotal:100,
  payments:[{method:"A PRAZO",amount:100}],items:[],installments};
 const ledger={...emptyCommercialLedger(),settlements:[
  {id:"R1",kind:"sale" as const,referenceId:"VD-TEST",amount:20,method:"PIX",paidAt:"2026-02-02T09:00:00Z"},
  {id:"R2",kind:"sale" as const,referenceId:"VD-TEST",amount:30,method:"PIX",paidAt:"2026-02-05T09:00:00Z"}]};
 const before=JSON.stringify({sale,ledger});
 const rows=buildPdvFinanceRows({ledger,sales:[sale],creditMethods:["A PRAZO"]});
 assert.equal(rows.length,3);
 assert.equal(new Set(rows.map(x=>x.key)).size,3);
 assert.deepEqual(rows.map(x=>x.installmentLabel),["1/3","2/3","3/3"]);
 assert.deepEqual(rows.map(x=>x.original),[33.34,33.33,33.33]);
 assert.deepEqual(rows.map(x=>x.settled),[33.34,16.66,0]);
 assert.deepEqual(rows.map(x=>x.open),[0,16.67,33.33]);
 assert.equal(Math.round(rows.flatMap(x=>x.sources).reduce((n,x)=>n+x.amount,0)*100),5000);
 const board=buildPdvFinanceKanban(rows,"2026-02-02");
 assert.equal(board.reduce((n,c)=>n+c.rows.length,0),3);
 assert.deepEqual(JSON.stringify({sale,ledger}),before);
 const next=settleReceivable(ledger,{id:"R3",referenceId:"VD-TEST",amount:50,method:"PIX",paidAt:"2026-02-07T09:00:00Z"},[sale],["A PRAZO"]);
 assert.deepEqual(buildPdvFinanceRows({ledger:next,sales:[sale],creditMethods:["A PRAZO"]}).map(x=>x.open),[0,0,0]);
});
