import test from "node:test";
import assert from "node:assert/strict";
import { buildCommercialAuditTrail, emptyCommercialLedger, type CommercialLedger } from "../apps/pdv-demo/src/commercialLedger";

test("P5 auditoria recupera origem, operador e data das ações sem gravar base paralela",()=>{
 const at="2026-11-07T10:00:00Z";
 const ledger:CommercialLedger={
  ...emptyCommercialLedger(),
  suppliers:[{id:"F",name:"Distribuidora",createdAt:at,createdById:"GER",createdByName:"Gerente"}],
  purchases:[{id:"C",supplierId:"F",orderedAt:at,status:"received",receivedAt:at,createdById:"GER",
    createdByName:"Gerente",receivedById:"GER",receivedByName:"Gerente",items:[{productCode:"X",quantity:1,unitCost:50}]}],
  expenses:[{id:"E",description:"Energia",category:"Contas",amount:25,occurredAt:at,trackPayment:true,dueDate:"2026-11-10",createdById:"GER",createdByName:"Gerente"}],
  settlements:[{id:"P",referenceId:"C",kind:"purchase",amount:15,method:"PIX",paidAt:at,operatorId:"GER",operatorName:"Gerente"}]
 };
 const before=JSON.stringify(ledger);
 const trail=buildCommercialAuditTrail(ledger);
 assert.equal(trail.length,5);
 assert.deepEqual(new Set(trail.map(x=>x.action)),new Set(["supplier-created","purchase-created","purchase-received","expense-created","purchase-settled"]));
 assert.ok(trail.every(event=>event.operatorName==="Gerente"&&event.referenceId&&event.performedAt===at));
 assert.deepEqual(JSON.stringify(ledger),before);
});

test("P5 histórico legado não recebe operador inventado",()=>{
 const ledger:CommercialLedger={...emptyCommercialLedger(),expenses:[{id:"OLD",description:"Antiga",amount:30,category:"Geral",occurredAt:"2025-03-03"}]};
 const events=buildCommercialAuditTrail(ledger);
 assert.equal(events[0].operatorName,undefined);
 assert.equal(events[0].action,"expense-created");
});
