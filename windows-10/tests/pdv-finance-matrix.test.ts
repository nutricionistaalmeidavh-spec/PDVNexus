import test from "node:test";
import assert from "node:assert/strict";
import { buildPdvFinanceRows, filterPdvFinanceRows } from "../apps/pdv-demo/src/financeMatrix";
import { emptyCommercialLedger, type CommercialLedger } from "../apps/pdv-demo/src/commercialLedger";

const ledger: CommercialLedger = {
  ...emptyCommercialLedger(),
  suppliers: [{id:"FOR-1",name:"Distribuidora Central",createdAt:"2026-11-01T10:00:00.000Z"}],
  purchases: [
    {id:"COM-1",supplierId:"FOR-1",orderedAt:"2026-11-02T10:00:00.000Z",dueDate:"2026-11-20",status:"received",items:[{productCode:"X",quantity:3,unitCost:100}]},
    {id:"COM-DRAFT",supplierId:"FOR-1",orderedAt:"2026-11-02T10:00:00.000Z",status:"draft",items:[{productCode:"X",quantity:1,unitCost:100}]}
  ],
  settlements: [
    {id:"PAG-1",kind:"purchase",referenceId:"COM-1",amount:100,paidAt:"2026-11-04T10:00:00.000Z",method:"PIX"},
    {id:"REC-1",kind:"sale",referenceId:"VD-1",amount:30,paidAt:"2026-11-05T10:00:00.000Z",method:"DINHEIRO"}
  ],
  expenses: [{id:"DES-1",description:"Energia",category:"Operacional",amount:50,occurredAt:"2026-11-05T10:00:00.000Z"}]
};
const sales = [
  {number:"VD-1",customerId:"CLI-1",finalizedAt:"06/11/2026, 09:30:00",netTotal:100,
    payments:[{method:"A PRAZO",amount:80},{method:"PIX",amount:20}],items:[]},
  {number:"VD-PIX",customerId:"CLI-1",finalizedAt:"2026-11-06T10:00:00.000Z",netTotal:40,
    payments:[{method:"PIX",amount:40}],items:[]}
];
const input = {ledger,sales,creditMethods:["A PRAZO"],customers:[{id:"CLI-1",name:"Maria Oliveira"}]};

test("matriz deriva saldo de compras recebidas, sem promover rascunho a obrigação", () => {
  const rows=buildPdvFinanceRows(input);
  const pay=rows.find(row=>row.kind==="payable");
  assert.equal(pay?.party,"Distribuidora Central");
  assert.equal(pay?.original,300);
  assert.equal(pay?.settled,100);
  assert.equal(pay?.open,200);
  assert.equal(pay?.status,"parcial");
  assert.equal(pay?.dueDate,"2026-11-20");
  assert.deepEqual(pay?.sources.map(source=>source.id),["PAG-1"]);
  assert.ok(!rows.some(row=>row.reference==="COM-DRAFT"));
});

test("recebível considera somente A PRAZO e nunca soma novamente PIX da venda", () => {
  const rows=buildPdvFinanceRows(input);
  const receive=rows.find(row=>row.kind==="receivable");
  assert.equal(receive?.party,"Maria Oliveira");
  assert.equal(receive?.original,80);
  assert.equal(receive?.settled,30);
  assert.equal(receive?.open,50);
  assert.equal(receive?.status,"parcial");
  assert.equal(receive?.dueDate,undefined);
  assert.ok(!rows.some(row=>row.reference==="VD-PIX"));
});

test("despesa registrada não ganha saldo a pagar nem baixa fictícia", () => {
  const expense=buildPdvFinanceRows(input).find(row=>row.kind==="expense");
  assert.equal(expense?.original,50);
  assert.equal(expense?.settled,null);
  assert.equal(expense?.open,null);
  assert.equal(expense?.status,"registrada");
  assert.deepEqual(expense?.sources,[]);
});

test("filtros por pesquisa, tipo, período e situação não alteram a base canônica", () => {
  const before=JSON.stringify(input);
  const rows=buildPdvFinanceRows(input);
  assert.deepEqual(filterPdvFinanceRows(rows,{kind:"receivable",status:"parcial",search:"Maria",from:"2026-11-01",to:"2026-11-30"}).map(row=>row.reference),["VD-1"]);
  assert.equal(filterPdvFinanceRows(rows,{kind:"payable",status:"liquidada",search:"",from:"",to:""}).length,0);
  assert.deepEqual(filterPdvFinanceRows(rows,{kind:"payable",status:"all",search:"central",from:"2026-12-01",to:""}),[]);
  assert.equal(JSON.stringify(input),before);
});
