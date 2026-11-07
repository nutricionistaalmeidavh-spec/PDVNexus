import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { closePdvCashSession, generatePdvDashboardReport, exportPdvReportCsv } from "../packages/database/src/pdv";

/** Benchmark sintético dos cálculos reais do domínio; não equivale ao tempo do Electron/SQLite do cliente. */
test("benchmark PDV: 5 mil vendas com cálculo de fechamento, dashboard, CSV e snapshot", () => {
  const sales = Array.from({length:5000},(_,i)=>({
    number:String(i+1).padStart(6,"0"),
    finalizedAt:"2026-11-07T10:05:00.000Z",netTotal:10,
    items:[{productCode:"00101",productName:"Teclado",quantity:1,totalPrice:10}],
    payments:[{method:"A VISTA",amount:10}]
  }));
  const t0=performance.now();
  const snapshot=JSON.stringify({completedSales:sales,registeredCustomers:[],catalogProducts:[]});
  const encodedMs=performance.now()-t0;
  const t1=performance.now();
  const decoded=JSON.parse(snapshot);
  const parsedMs=performance.now()-t1;
  const t2=performance.now();
  const closing=closePdvCashSession({
    openedAt:"2026-11-07T09:00:00.000Z",closedAt:"2026-11-07T18:00:00.000Z",
    initialAmount:0,withdrawals:[],sales:decoded.completedSales,
    countedByMethod:{"A VISTA":50000}
  });
  const closingMs=performance.now()-t2;
  const t3=performance.now();
  const report=generatePdvDashboardReport({
    from:"2026-11-01T00:00:00.000Z",to:"2026-11-08T00:00:00.000Z",
    sales:decoded.completedSales,
    products:[{productCode:"00101",productName:"Teclado",stock:6000,minStock:10}],
    cashClosings:[]
  });
  const dashboardMs=performance.now()-t3;
  const t4=performance.now();
  const csv=exportPdvReportCsv({rows:sales.map(s=>({date:s.finalizedAt,number:s.number,customerName:"Balcão",status:"completed",paymentMethods:"A VISTA",total:s.netTotal}))});
  const csvMs=performance.now()-t4;
  assert.equal(closing.status,"balanced");
  assert.equal(report.salesCount,5000);
  assert.equal(report.salesTotal,50000);
  assert.equal(decoded.completedSales.length,5000);
  assert.ok(csv.includes("000500"));
  console.log("PDV_BENCHMARK_SYNTHETIC "+JSON.stringify({
    sales:5000,snapshotKiB:Math.ceil(snapshot.length/1024),
    stringifyMs:+encodedMs.toFixed(2),parseMs:+parsedMs.toFixed(2),
    closingMs:+closingMs.toFixed(2),dashboardMs:+dashboardMs.toFixed(2),csvMs:+csvMs.toFixed(2)
  }));
});
