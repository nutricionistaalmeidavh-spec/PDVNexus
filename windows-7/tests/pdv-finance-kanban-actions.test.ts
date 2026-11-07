import test from "node:test";
import assert from "node:assert/strict";
import {emptyCommercialLedger,buildCreditInstallments, type CommercialLedger} from "../apps/pdv-demo/src/commercialLedger";
import {buildPdvFinanceRows,buildPdvFinanceKanban} from "../apps/pdv-demo/src/financeMatrix";
import {applyPdvFinanceKanbanMove} from "../apps/pdv-demo/src/financeKanbanActions";
import {buildPdvFinanceReport} from "../apps/pdv-demo/src/financeReporting";
const at="2026-11-07T14:00:00.000Z",today="2026-11-07";
const paid=()=>{
 const ledger:CommercialLedger={...emptyCommercialLedger(),
 suppliers:[{id:"F1",name:"Distribuidora",createdAt:at}],
 purchases:[{id:"C1",supplierId:"F1",orderedAt:at,status:"received",dueDate:"2026-11-05",items:[{productCode:"X",quantity:1,unitCost:100}]}],
 expenses:[
  {id:"E1",description:"Energia",amount:50,occurredAt:at,category:"Operacional",dueDate:"2026-11-09",trackPayment:true},
  {id:"LEG",description:"Despesa antiga",amount:40,occurredAt:at,category:"Geral"}
 ]};
 const sales=[{number:"VD1",finalizedAt:at,netTotal:100,items:[],
  payments:[{method:"A PRAZO",amount:100}],installments:buildCreditInstallments(100,"2026-11-10",3)}];
 return {ledger,sales,creditMethods:["A PRAZO"]};
};
const opts=(base:ReturnType<typeof paid>,rowKey:string,target:"vencidas"|"a_vencer"|"parciais"|"liquidadas"|"sem_vencimento"|"registradas",extra:Record<string,unknown>={})=>({
 ...base,rowKey,target,today,now:at,eventId:"evt-"+Math.random().toString(36),operator:{id:"GER",name:"Gerente"},allowed:true,...extra
});
const lane=(base:ReturnType<typeof paid>,key:string)=>
 buildPdvFinanceKanban(buildPdvFinanceRows(base),today).find(col=>col.rows.some(row=>row.key===key))?.id;
test("Kanban: vencida para a vencer altera vencimento canônico e inclui evento auditável",()=>{
 const base=paid(),snapshot=JSON.stringify(base);
 const next=applyPdvFinanceKanbanMove(opts(base,"payable:C1","a_vencer",{dueDate:"2026-11-20",reason:"Renegociado com fornecedor"}));
 assert.equal(next.ledger.purchases[0].dueDate,"2026-11-20");
 assert.equal(lane(next,"payable:C1"),"a_vencer");
 assert.equal(next.ledger.financeActions?.[0].referenceId,"C1");
 assert.equal(next.ledger.financeActions?.[0].operatorId,"GER");
 assert.equal(JSON.stringify(base),snapshot);
});
test("Kanban: baixas parciais e totais registram pagamento real na fonte e mudam colunas",()=>{
 const base=paid();
 const partial=applyPdvFinanceKanbanMove(opts(base,"payable:C1","parciais",{amount:30,method:"PIX"}));
 assert.equal(lane(partial,"payable:C1"),"parciais");
 assert.equal(partial.ledger.settlements[0].amount,30);
 const paidOff=applyPdvFinanceKanbanMove(opts(partial,"payable:C1","liquidadas",{amount:70,method:"PIX"}));
 assert.equal(lane(paidOff,"payable:C1"),"liquidadas");
 assert.equal(paidOff.ledger.settlements.length,2);
 assert.equal(buildPdvFinanceReport(paidOff).realizedOut,100);
 assert.throws(()=>applyPdvFinanceKanbanMove(opts(paidOff,"payable:C1","vencidas",{dueDate:"2026-11-02"})),/estorno|liquid/i);
});
test("Kanban: parcela 2 é liquidada sem baixar a parcela 1 e sem duplicar recebimento",()=>{
 const base=paid();
 const key="receivable:VD1:installment:2";
 const row=buildPdvFinanceRows(base).find(x=>x.key===key)!;
 const next=applyPdvFinanceKanbanMove(opts(base,key,"liquidadas",{amount:row.open,method:"PIX"}));
 const rows=buildPdvFinanceRows(next).filter(x=>x.kind==="receivable");
 assert.deepEqual(rows.map(x=>x.open),[33.34,0,33.33]);
 assert.deepEqual(rows.map(x=>x.status),["pendente","liquidada","pendente"]);
 assert.equal(next.ledger.settlements[0].installmentNumber,2);
 assert.equal(buildPdvFinanceReport(next).realizedIn,33.33);
 assert.equal(lane(next,key),"liquidadas");
});
test("Kanban: parcela 1 com baixa genérica anterior e parcela 2 direcionada respeitam saldos",()=>{
 const base=paid();
 const direct=applyPdvFinanceKanbanMove(opts(base,"receivable:VD1:installment:2","liquidadas",{amount:33.33,method:"PIX"}));
 const generic={...direct,ledger:{...direct.ledger,settlements:[
 ...direct.ledger.settlements,{id:"GEN",referenceId:"VD1",amount:20,kind:"sale" as const,method:"PIX",paidAt:at}]}};
 assert.deepEqual(buildPdvFinanceRows(generic).filter(x=>x.kind==="receivable").map(x=>x.open),[13.34,0,33.33]);
 assert.throws(()=>applyPdvFinanceKanbanMove(opts(generic,"receivable:VD1:installment:2","parciais",{amount:1,method:"PIX"})),/liquid|saldo|estorno/i);
});
test("Kanban: históricos sem baixa exigem confirmação explícita antes de passar a títulos devidos",()=>{
 const base=paid();
 assert.throws(()=>applyPdvFinanceKanbanMove(opts(base,"expense:LEG","a_vencer",{dueDate:"2026-11-10"})),/históric|comprov|confirm/i);
 const next=applyPdvFinanceKanbanMove(opts(base,"expense:LEG","a_vencer",{dueDate:"2026-11-10",assumeUnpaid:true,reason:"Conferido com comprovantes"}));
 assert.equal(next.ledger.expenses.find(x=>x.id==="LEG")?.trackPayment,true);
 assert.equal(lane(next,"expense:LEG"),"a_vencer");
});
test("Kanban: sem vencimento remove somente data permitida; não apaga parcela ou histórico financeiro",()=>{
 const base=paid();
 const next=applyPdvFinanceKanbanMove(opts(base,"payable:C1","sem_vencimento",{reason:"Vencimento pendente de acordo"}));
 assert.equal(next.ledger.purchases[0].dueDate,undefined);
 assert.equal(lane(next,"payable:C1"),"sem_vencimento");
 assert.throws(()=>applyPdvFinanceKanbanMove(opts(base,"receivable:VD1:installment:1","sem_vencimento")),/parcel|vencimento/i);
 assert.throws(()=>applyPdvFinanceKanbanMove(opts(base,"expense:E1","registradas")),/rastreamento|históric|não/i);
});
test("Kanban: data incoerente, valor excedente, evento duplicado e operador não autorizado são rejeitados",()=>{
 const base=paid();
 assert.throws(()=>applyPdvFinanceKanbanMove(opts(base,"payable:C1","a_vencer",{dueDate:"2026-10-01"})),/data|venc/i);
 assert.throws(()=>applyPdvFinanceKanbanMove(opts(base,"payable:C1","parciais",{amount:100,method:"PIX"})),/parcial|menor/i);
 assert.throws(()=>applyPdvFinanceKanbanMove(opts(base,"payable:C1","liquidadas",{amount:90,method:"PIX"})),/saldo|total|integral/i);
 assert.throws(()=>applyPdvFinanceKanbanMove(opts(base,"payable:C1","liquidadas",{amount:100,method:"PIX",allowed:false})),/permiss|autoriz/i);
 const first=applyPdvFinanceKanbanMove(opts(base,"payable:C1","parciais",{amount:10,method:"PIX",eventId:"SAME"}));
 assert.throws(()=>applyPdvFinanceKanbanMove(opts(first,"payable:C1","liquidadas",{amount:90,method:"PIX",eventId:"SAME"})),/duplicad/i);
});
