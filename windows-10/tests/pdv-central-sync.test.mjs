import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
async function mod(edition) {
  const file = new URL(edition === "windows-10" ? "../apps/pdv-demo/src/centralSync.ts" : "../../windows-7/apps/pdv-demo/src/centralSync.ts", import.meta.url);
  const source = fs.readFileSync(file, "utf8");
  const code = ts.transpileModule(source, { compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext} }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
}
for (const edition of ["windows-10","windows-7"]) {
  test(edition + ": outbox offline determinística e idempotente", async () => {
    const m=await mod(edition);
    const snapshot={catalogProducts:[{productCode:"A",productName:"Produto",stock:5}],
      completedSales:[{number:"V-01",terminalId:"C01",netTotal:50,items:[]}],
      extensions:{inventoryMovements:[{id:"M-01",productCode:"A",type:"exit",quantityDelta:-1}]}};
    const first=m.collectPendingEvents(snapshot,"matriz","C01",[]);
    assert.equal(first.some((event)=>event.kind==="sale.completed"),true);
    assert.equal(first.some((event)=>event.kind==="stock.movement"),true);
    const second=m.collectPendingEvents(snapshot,"matriz","C01",first.map((event)=>event.eventId));
    assert.equal(second.length,0);
    assert.deepEqual(m.collectPendingEvents(snapshot,"matriz","C01",[]),first);
  });
  test(edition + ": aplica vendas e estoque remoto uma única vez; conflito bloqueia",async()=>{
    const m=await mod(edition);
    const snapshot={catalogProducts:[{productCode:"A",productName:"Produto",stock:5}],
      completedSales:[],extensions:{inventoryMovements:[],centralSync:{ackedIds:[],receivedIds:[],cursor:"0"}}};
    const sales={sequence:"1",eventId:"sale:caixa-b:1",branchId:"matriz",terminalId:"caixa-b",entityId:"1",kind:"sale.completed",payload:{number:"1",terminalId:"caixa-b",netTotal:20,items:[]}};
    const stock={sequence:"2",eventId:"stock:caixa-b:m1",branchId:"matriz",terminalId:"caixa-b",entityId:"m1",kind:"stock.movement",payload:{id:"m1",productCode:"A",quantityDelta:-2,type:"exit"}};
    const once=m.applyRemoteEvents(snapshot,[sales,stock],"matriz","CAIXA-A");
    assert.equal(once.catalogProducts[0].stock,3);
    assert.equal(once.extensions.inventoryMovements[0].stockBefore,5);
    assert.equal(once.extensions.inventoryMovements[0].stockAfter,3);
    assert.equal(once.completedSales.length,1);
    const twice=m.applyRemoteEvents(once,[sales,stock],"matriz","CAIXA-A");
    assert.deepEqual(twice.catalogProducts,once.catalogProducts);
    assert.equal(twice.completedSales.length,1);
    assert.throws(()=>m.applyRemoteEvents(snapshot,[{...stock,payload:{...stock.payload,quantityDelta:-10}}],"matriz","CAIXA-A"),/estoque|saldo/i);
    assert.throws(()=>m.applyRemoteEvents(snapshot,[{...sales,branchId:"outra"}],"matriz","CAIXA-A"),/filial/i);
  });
}

for(const edition of ["windows-10","windows-7"]){
  test(edition+": cancelamento remoto substitui venda sem ressuscitar operação",async()=>{
    const m=await mod(edition);
    const snapshot={
      catalogProducts:[{productCode:"A",productName:"Item",stock:4}],
      completedSales:[{number:"22",terminalId:"CX-REMOTO",netTotal:20,status:"completed",items:[]}],
      extensions:{inventoryMovements:[],cancelledSales:[],centralSync:{enabled:true,endpointUrl:"https://example.invalid",ackedIds:[],receivedIds:[],cursor:"0"}}
    };
    const cancel={sequence:"2",eventId:"cancel:CX-REMOTO:22",branchId:"matriz",terminalId:"CX-REMOTO",entityId:"22",kind:"sale.cancelled",payload:{number:"22",terminalId:"CX-REMOTO",netTotal:20,status:"cancelled",items:[]}};
    const result=m.applyRemoteEvents(snapshot,[cancel],"matriz","CX-LOCAL");
    assert.equal(result.completedSales.length,0);
    assert.equal(result.extensions.cancelledSales.length,1);
    assert.equal(m.collectPendingEvents(result,"matriz","CX-LOCAL",[]).length,0);
  });
  test(edition+": venda recebida sem terminal no payload não é reenviada como local",async()=>{
    const m=await mod(edition);
    const snapshot={catalogProducts:[],completedSales:[],extensions:{inventoryMovements:[],centralSync:{ackedIds:[],receivedIds:[],cursor:"0"}}};
    const event={sequence:"1",eventId:"sale:CX-B:100",branchId:"matriz",terminalId:"CX-B",entityId:"100",kind:"sale.completed",payload:{number:"100",netTotal:50,items:[]}};
    const imported=m.applyRemoteEvents(snapshot,[event],"matriz","CX-A");
    assert.equal(imported.completedSales[0].terminalId,"CX-B");
    assert.equal(m.collectPendingEvents(imported,"matriz","CX-A",[]).length,0);
  });
}
