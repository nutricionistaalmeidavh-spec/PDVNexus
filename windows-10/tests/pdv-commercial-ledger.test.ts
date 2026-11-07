import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyCommercialLedger, registerSupplier, registerPurchase, receivePurchase,
  settlePayable, settleReceivable, registerExpense, summarizeCommercial,
  saleGrossProfit, normalizeCommercialLedger
} from "../apps/pdv-demo/src/commercialLedger";

const at = "2026-11-06T20:00:00-03:00";
const catalog = [
  {productCode:"A01",productName:"Café",stock:10,minStock:1,unitPrice:15,costPrice:5,active:true},
  {productCode:"B01",productName:"Leite",stock:0,minStock:1,unitPrice:10,active:true}
];
const supplier = {id:"FOR-1",name:"Distribuidora Regional",document:"123",createdAt:at};
const invoice = {id:"COM-1",supplierId:"FOR-1",orderedAt:at,dueDate:"2026-11-20",status:"draft" as const,items:[
  {productCode:"A01",quantity:10,unitCost:7},
  {productCode:"B01",quantity:4,unitCost:4}
]};
const sale = {number:"VEN-1",finalizedAt:at,netTotal:50,discountPercent:0,
  payments:[{method:"A PRAZO",amount:30},{method:"PIX",amount:20}],
  items:[{productCode:"A01",productName:"Café",quantity:2,unitPrice:15,unitCostAtSale:6,totalPrice:30},
    {productCode:"B01",productName:"Leite",quantity:2,unitPrice:10,unitCostAtSale:4,totalPrice:20}]};

test("purchase receipt updates canonical stock and cost exactly once and creates payable from its own lines",()=>{
 const led = registerPurchase(registerSupplier(emptyCommercialLedger(),supplier),invoice,catalog);
 assert.equal(led.purchases[0].status,"draft");
 assert.equal(catalog[0].stock,10);
 const result = receivePurchase({ledger:led,catalog,movements:[],purchaseId:"COM-1",receivedAt:at});
 assert.equal(result.catalog[0].stock,20);
 assert.equal(result.catalog[0].costPrice,6);
 assert.equal(result.catalog[1].stock,4);
 assert.equal(result.movements.length,2);
 assert.equal(result.movements[0].stockBefore,10);
 assert.equal(result.movements[0].stockAfter,20);
 const summary=summarizeCommercial({ledger:result.ledger,sales:[]});
 assert.equal(summary.payableOpen,86);
 assert.throws(()=>receivePurchase({...result,purchaseId:"COM-1",receivedAt:at}),/recebida|recebido|duplicad/i);
});

test("payments do not mutate sale or purchase totals; duplicate settlement rejected",()=>{
 let ledger=receivePurchase({ledger:registerPurchase(registerSupplier(emptyCommercialLedger(),supplier),invoice,catalog),
   catalog,movements:[],purchaseId:"COM-1",receivedAt:at}).ledger;
 ledger=settlePayable(ledger,{id:"PAG-1",referenceId:"COM-1",amount:20,paidAt:at,method:"PIX"});
 assert.equal(summarizeCommercial({ledger,sales:[]}).payableOpen,66);
 assert.throws(()=>settlePayable(ledger,{id:"PAG-2",referenceId:"COM-1",amount:67,paidAt:at,method:"PIX"}),/excede|saldo/i);
 assert.throws(()=>settlePayable(ledger,{id:"PAG-1",referenceId:"COM-1",amount:2,paidAt:at,method:"PIX"}),/duplicad/i);
 ledger=settleReceivable(ledger,{id:"REC-1",referenceId:"VEN-1",amount:12,paidAt:at,method:"PIX"},[sale],["A PRAZO"]);
 assert.equal(summarizeCommercial({ledger,sales:[sale],creditMethods:["A PRAZO"]}).receivableOpen,18);
 assert.throws(()=>settleReceivable(ledger,{id:"REC-2",referenceId:"VEN-1",amount:19,paidAt:at,method:"PIX"},[sale],["A PRAZO"]),/excede|saldo/i);
});

test("gross profit uses immutable cost at time of sale, not current catalog cost",()=>{
 const margin=saleGrossProfit(sale);
 assert.equal(margin.revenue,50);assert.equal(margin.cost,20);assert.equal(margin.grossProfit,30);
 assert.equal(saleGrossProfit({...sale,items:[{...sale.items[0],unitCostAtSale:undefined}]}).grossProfit,null);
 const withDiscount=saleGrossProfit({...sale,netTotal:45,discountPercent:10});
 assert.equal(withDiscount.grossProfit,25);
});

test("expense records are immutable inputs and dashboard uses derived entries",()=>{
 const led=registerExpense(emptyCommercialLedger(),{id:"DESP-1",description:"Energia",amount:100,occurredAt:at,category:"Operacional"});
 const summary=summarizeCommercial({ledger:led,sales:[]});
 assert.equal(summary.expensesTotal,100);
 assert.throws(()=>registerExpense(led,{id:"DESP-1",description:"Outra",amount:1,occurredAt:at,category:"Operacional"}),/duplicad/i);
});

test("commercial ledger retains only authorized commercial state", () => {
  const normalized = normalizeCommercialLedger({ ...emptyCommercialLedger(),
    fiscalProfile: { uf: "MG", stateRegistration: "123", taxRegime: "simples" }
  });
  assert.deepEqual(Object.keys(normalized).sort(), ["expenses", "purchases", "settlements", "suppliers"]);
  assert.deepEqual(normalized, emptyCommercialLedger());
});
