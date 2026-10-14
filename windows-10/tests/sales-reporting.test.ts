import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateReportAmounts, buildSalesReport, exportSalesReportCsv, reportDate,
  type ReportSale
} from "../apps/pdv-demo/src/salesReporting.js";

import { changeSaleReportExclusion } from "../apps/pdv-demo/src/reportTraining.js";
import { buildSalesPdf, buildSalesXlsx, type ExportContext } from "../apps/pdv-demo/src/reportDocuments.js";
import { saveReportFavorite, removeReportFavorite, parseReportFavorites,
  previousComparablePeriod, comparisonDelta } from "../apps/pdv-demo/src/reportPreferences.js";

function unpackStoredZip(data: Uint8Array): Map<string, string> {
  const files = new Map<string, string>();
  let offset = 0;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const decoder = new TextDecoder();
  while (offset + 30 <= data.length && view.getUint32(offset, true) === 0x04034B50) {
    const compressed = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const path = decoder.decode(data.subarray(offset + 30, offset + 30 + nameLength));
    const start = offset + 30 + nameLength + extraLength;
    files.set(path, decoder.decode(data.subarray(start, start + compressed)));
    offset = start + compressed;
  }
  return files;
}

const sale = (patch: Partial<ReportSale> = {}): ReportSale => ({
  number: "123", finalizedAt: "06/10/2026, 09:35:17", seller: "Gerente",
  customerId: "C1", netTotal: 30,
  items: [
    { productCode: "F1", productName: "Farinha A", quantity: 2, unitLabel: "UN", unitPrice: 10, totalPrice: 20 },
    { productCode: "T1", productName: "Tapioca", quantity: 1, unitLabel: "UN", unitPrice: 12, totalPrice: 12 }
  ],
  payments: [{ method: "CREDITO", amount: 20 }, { method: "DEBITO", amount: 10 }],
  ...patch
});

test("P0: uma linha por item e centavos líquidos conciliados", () => {
  const report = buildSalesReport([sale()], [], [{ id: "C1", name: "Cliente Teste" }]);
  assert.equal(report.salesCount, 1);
  assert.equal(report.revenue, 30);
  assert.equal(report.quantity, 3);
  assert.equal(report.ticket, 30);
  assert.equal(report.lines.length, 2);
  assert.equal(report.lines[0].customer, "Cliente Teste");
  assert.equal(report.lines[0].payments.includes("Não identificado por item"), true);
  assert.equal(report.lines[0].net + report.lines[1].net, 30);
  assert.equal(report.products.reduce((s, v) => s + v.total, 0), 30);
});

test("P0: rateio proporcional da diferença com centavos sem perda", () => {
  const input = sale({ netTotal: 10, items: [
    { productCode: "A", productName: "A", quantity: 1, totalPrice: 3.34 },
    { productCode: "B", productName: "B", quantity: 1, totalPrice: 3.33 },
    { productCode: "C", productName: "C", quantity: 1, totalPrice: 3.33 }
  ], payments: [{ method: "PIX", amount: 10 }] });
  const lines = allocateReportAmounts(input);
  assert.equal(lines.length, 3);
  assert.equal(Math.round(lines.reduce((s, v) => s + v, 0) * 100), 1000);
});

test("P1: pagamentos mistos somam a venda uma só vez e não atribuem produtos a cartões", () => {
  const report = buildSalesReport([sale()], [], []);
  assert.equal(report.products.length, 2);
  assert.equal(report.payments.length, 2);
  assert.equal(report.payments.reduce((s, p) => s + p.total, 0), 30);
  assert.equal(report.products.reduce((s, p) => s + p.total, 0), 30);
  assert.equal(report.unmatched.length, 0);
  const filtered = buildSalesReport([sale()], [], [], { paymentMethod: "DEBITO" });
  assert.equal(filtered.revenue, 30); // Whole sale matched; NOT debit-only product revenue.
  assert.equal(filtered.products.length, 2);
});

test("P1: troco registrado é subtraído do dinheiro, sem alterar faturamento", () => {
  const report = buildSalesReport([sale({
    netTotal: 30, payments: [{ method: "DINHEIRO", amount: 50 }],
    paymentSummary: { changeDue: 20 }
  })], [], []);
  assert.equal(report.revenue, 30);
  assert.equal(report.payments[0].total, 30);
  assert.equal(report.tenderDifference, 0);
  assert.deepEqual(report.unmatched, []);
});

test("P1: divergência de pagamento fica explícita em vez de forçar conciliação", () => {
  const report = buildSalesReport([sale({ payments: [{ method: "PIX", amount: 29 }] })], [], []);
  assert.equal(report.tenderDifference, -1);
  assert.deepEqual(report.unmatched, ["123"]);
  assert.equal(report.revenue, 30);
});

test("P1: venda cancelada aparece somente no filtro apropriado e não conta no faturamento", () => {
  const original = sale();
  const all = buildSalesReport([original], [original], [], { status: "all" });
  assert.equal(all.salesCount, 0);
  assert.equal(all.cancelledCount, 1);
  assert.equal(all.revenue, 0);
  assert.equal(all.lines.length, 2);
  assert.ok(all.lines.every(line => line.net === 0));
  const completed = buildSalesReport([original], [original], [], { status: "completed" });
  assert.equal(completed.salesCount, 0);
  assert.equal(buildSalesReport([], [original], [], { status: "cancelled" }).cancelledCount, 1);
});

test("P1: filtros por período, operador, produto, pesquisa e cliente", () => {
  const other = sale({ number: "124", finalizedAt: "11/09/2026, 08:00:00", seller: "Caixa" });
  const filters = { from: "2026-10-01", to: "2026-10-07", operator: "gerente", productCode: "F1", query: "Cliente Teste" };
  const report = buildSalesReport([sale(), other], [], [{ id: "C1", name: "Cliente Teste" }], filters);
  assert.equal(report.salesCount, 1);
  assert.equal(report.sales[0].number, "123");
  assert.equal(reportDate("2026-10-06T15:12:00.000Z"), "2026-10-06");
  assert.equal(reportDate("06/10/2026, 09:35:17"), "2026-10-06");
});

test("P0: exportação CSV utiliza pt-BR, escapamento, BOM e não executa fórmulas", () => {
  const report = buildSalesReport([sale({
    items: [{ productCode: "X", productName: "=FORMULA();injetada", quantity: 1, totalPrice: 30 }],
    payments: [{ method: "PIX", amount: 30 }]
  })], [], []);
  const csv = exportSalesReportCsv(report, "lines");
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("'=FORMULA"));
  assert.ok(csv.includes("30,00"));
  assert.ok(csv.includes("\r\n"));
  assert.ok(exportSalesReportCsv(report, "payments").includes("PIX"));
  assert.ok(exportSalesReportCsv(report, "operators").includes("Gerente"));
});

test("P0: mesmo número em dois terminais permanece duas vendas distintas", () => {
  const report = buildSalesReport([sale({ terminalId: "A" }), sale({ terminalId: "B" })], [], []);
  assert.equal(report.salesCount, 2);
  assert.equal(report.products[0].count, 2);
  assert.equal(report.revenue, 60);
});

test("P0: vendas sem itens permanecem auditáveis, nunca somem do faturamento", () => {
  const report = buildSalesReport([sale({ items: [], netTotal: 10, payments: [{ method: "PIX", amount: 10 }] })], [], []);
  assert.deepEqual(report.missingItems, ["123"]);
  assert.equal(report.revenue, 10);
  assert.equal(report.lines.length, 0);
});

test("P2: XLSX válido, abas canônicas, números e planilha segura para Excel", () => {
  const original = sale({
    items: [{ productCode: "X", productName: "=SOMA(1;2) & açúcar", quantity: 1, totalPrice: 30 }],
    payments: [{ method: "PIX", amount: 30 }]
  });
  const report = buildSalesReport([original], [], []);
  const context: ExportContext = { storeName: "Loja & Filhos", generatedAt: "13/10/2026 19:30:00",
    filters: { from: "2026-10-01", to: "2026-10-13" }, view: "products" };
  const bytes = buildSalesXlsx(report, context);
  assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b);
  const files = unpackStoredZip(bytes);
  for (const name of ["xl/workbook.xml", "xl/styles.xml", "xl/worksheets/sheet1.xml",
    "xl/worksheets/sheet2.xml", "xl/worksheets/sheet3.xml", "xl/worksheets/sheet4.xml",
    "xl/worksheets/sheet5.xml", "xl/worksheets/sheet6.xml"]) {
    assert.ok(files.has(name), name + " presente");
  }
  const workbook = files.get("xl/workbook.xml") ?? "";
  assert.match(workbook, /name="Resumo"/);
  assert.match(workbook, /name="Itens"/);
  assert.match(workbook, /name="Vendas"/);
  assert.match(workbook, /name="Produtos"/);
  assert.match(workbook, /name="Pagamentos"/);
  assert.match(workbook, /name="Operadores"/);
  const overview = files.get("xl/worksheets/sheet1.xml") ?? "";
  assert.match(overview, /Loja &amp; Filhos/);
  assert.match(overview, /Faturamento/);
  const details = files.get("xl/worksheets/sheet2.xml") ?? "";
  assert.match(details, /&amp; açúcar/);
  assert.match(details, /<v>30<\/v>/);
  assert.ok(!details.includes("<f>"), "nomes de produtos não viram fórmulas");
});

test("P2: PDF A4 paginado, com indicação gerencial e codificação PT-BR", () => {
  const many = Array.from({ length: 100 }, (_, i) => sale({
    number: String(i + 1),
    items: [{ productCode: "CAFE", productName: "Açúcar e café", quantity: 1, totalPrice: 30 }],
    payments: [{ method: "PIX", amount: 30 }]
  }));
  const report = buildSalesReport(many, [], []);
  const pdf = buildSalesPdf(report, {
    storeName: "Mercado São José", generatedAt: "13/10/2026, 20:00:00",
    filters: { from: "2026-10-01", to: "2026-10-13" }, view: "lines"
  });
  const content = new TextDecoder().decode(pdf);
  assert.ok(content.startsWith("%PDF-1.4"));
  assert.ok(content.endsWith("%%EOF\n"));
  assert.ok((content.match(/\/Type \/Page \/Parent/g) ?? []).length > 1);
  assert.match(content, /\/MediaBox \[0 0 595 842\]/);
  assert.match(content, /\/WinAnsiEncoding/);
  assert.match(content, /startxref/);
});

test("P3: período anterior tem a mesma duração, incluindo virada de ano", () => {
  assert.deepEqual(previousComparablePeriod("2026-10-01", "2026-10-07"),
    { from: "2026-09-24", to: "2026-09-30", days: 7 });
  assert.deepEqual(previousComparablePeriod("2026-01-01", "2026-01-31"),
    { from: "2025-12-01", to: "2025-12-31", days: 31 });
  assert.equal(previousComparablePeriod("", "2026-10-13"), null);
  assert.equal(previousComparablePeriod("2026-10-15", "2026-10-01"), null);
  assert.equal(comparisonDelta(150, 100).percentage, 50);
  assert.equal(comparisonDelta(15, 0).percentage, null);
});

test("P3: favoritos aceitam apenas filtros, nomes limitados e status reconhecidos", () => {
  const original = saveReportFavorite([], { name: "Semanal", view: "products",
    filters: { from: "2026-10-01", to: "2026-10-07", paymentMethod: "PIX" } },
    "2026-10-13T22:00:00Z", "a1");
  assert.equal(original.length, 1);
  const updated = saveReportFavorite(original, { name: "semanal", view: "sales",
    filters: { status: "all" } }, "2026-10-14T22:00:00Z", "a2");
  assert.equal(updated.length, 1);
  assert.equal(updated[0].id, "a1");
  assert.equal(updated[0].view, "sales");
  assert.deepEqual(removeReportFavorite(updated, "a1"), []);
  assert.equal(parseReportFavorites("not json").length, 0);
  assert.equal(parseReportFavorites(JSON.stringify([{ id: "u", name: "Teste",
    view: "products", filters: { status: "injected", from: "bad" } }]))[0].filters.status, "completed");
  assert.throws(() => saveReportFavorite([], { name: "   ", view: "sales", filters: {} }, "", "x"));
});

test("P3: relatórios volumosos não perdem valores nem misturam terminais", () => {
  const many = Array.from({ length: 1200 }, (_, i) => sale({
    terminalId: i % 2 ? "CAIXA-A" : "CAIXA-B", number: String(i + 1),
    finalizedAt: "13/10/2026, 14:00:00", netTotal: 30,
    items: [{ productCode: "F", productName: "Farinha", quantity: 3, totalPrice: 30 }]
  }));
  const report = buildSalesReport(many, [], []);
  assert.equal(report.salesCount, 1200);
  assert.equal(report.revenue, 36000);
  assert.equal(report.products[0].count, 1200);
  const xlsx = buildSalesXlsx(report, { storeName: "PDV", generatedAt: "13/10/2026", filters: {}, view: "sales" });
  const files = unpackStoredZip(xlsx);
  assert.match(files.get("xl/worksheets/sheet3.xml") ?? "", /r="1201"/);
  assert.equal(exportSalesReportCsv(report, "sales").split("\r\n").length, 1202);
});

test("marca e empreendimento são canônicos na venda, CSV e filtros históricos", () => {
  const branded = sale({
    items: [{ id:"A", productCode:"001", productName:"Farinha", brand:"ABRINCO", producer:"Cooperativa Norte", unitLabel:"UN", quantity:1, totalPrice:12 }],
    netTotal:12, payments:[{method:"PIX",amount:12}]
  });
  const other = sale({
    number:"124", items:[{ id:"B", productCode:"002", productName:"Farinha", brand:"COOAFATRE", producer:"Cooperativa Sul",unitLabel:"UN",quantity:2,totalPrice:20 }],
    netTotal:20,payments:[{method:"DEBITO",amount:20}]
  });
  const result = buildSalesReport([branded,other],[],[]);
  assert.equal(result.products.length,2);
  assert.deepEqual(result.lines.map(row=>[row.productName,row.brand,row.producer]),[
    ["Farinha","ABRINCO","Cooperativa Norte"],["Farinha","COOAFATRE","Cooperativa Sul"]
  ]);
  assert.equal(buildSalesReport([branded,other],[],[],{brand:"abrinco"}).salesCount,1);
  assert.equal(buildSalesReport([branded,other],[],[],{producer:"Cooperativa Sul"}).revenue,20);
  const csv=exportSalesReportCsv(result,"lines");
  assert.match(csv,/empreendimento/);
  assert.match(csv,/marca/);
  assert.match(csv,/Cooperativa Norte/);
  const groups=exportSalesReportCsv(result,"products");
  assert.match(groups,/ABRINCO/);
  const xlsx=buildSalesXlsx(result,{storeName:"Mercado",generatedAt:"14/10/2026",filters:{},view:"lines"});
  const files=unpackStoredZip(xlsx);
  assert.match(files.get("xl/worksheets/sheet2.xml")||"",/Cooperativa Norte/);
  assert.match(files.get("xl/worksheets/sheet4.xml")||"",/COOAFATRE/);
});

test("marca ausente no histórico não é inventada com base no cadastro atual",()=>{
  const result=buildSalesReport([sale()],[],[]);
  assert.ok(result.lines.every(line=>line.brand===""&&line.producer===""));
  assert.equal(result.salesCount,1);
});

test("vendas de treinamento não aparecem em nenhum total gerencial nem nas exportações",()=>{
  const first=sale({number:"111",reportExclusion:{reason:"Simulação com cliente",excludedAt:"2026-10-14T12:00:00.000Z",excludedBy:"GER-001"}});
  const real=sale({number:"112"});
  const report=buildSalesReport([first,real],[],[]);
  assert.equal(report.salesCount,1);
  assert.equal(report.revenue,30);
  assert.equal(report.sales[0].number,"112");
  assert.equal(report.lines.length,2);
  assert.equal(report.payments.reduce((sum,p)=>sum+p.total,0),30);
  assert.equal(report.products.reduce((sum,p)=>sum+p.total,0),30);
  assert.ok(!exportSalesReportCsv(report,"sales").includes('"111"'));
  assert.ok(!exportSalesReportCsv(report,"lines").includes('"111"'));
  const workbook=unpackStoredZip(buildSalesXlsx(report,
    {storeName:"Loja",generatedAt:"14/10/2026",filters:{},view:"sales"}));
  assert.ok(!(workbook.get("xl/worksheets/sheet3.xml")||"").includes(">111<"));
});

test("desconsiderar e reincluir é reversível, auditado e não altera venda original",()=>{
  const original=sale({number:"888"});
  const identity={number:original.number,finalizedAt:original.finalizedAt,terminalId:original.terminalId};
  const actor={id:"GER-001",role:"manager",active:true};
  const excluded=changeSaleReportExclusion([original],identity,"exclude",actor,
    "Venda simulada no treinamento","2026-10-14T11:20:00.000Z");
  assert.equal(excluded[0].reportExclusion?.reason,"Venda simulada no treinamento");
  assert.equal(excluded[0].netTotal,original.netTotal);
  assert.deepEqual(excluded[0].payments,original.payments);
  assert.deepEqual(excluded[0].items,original.items);
  assert.equal(buildSalesReport(excluded,[],[]).salesCount,0);
  assert.deepEqual(original, sale({number:"888"}));
  const restored=changeSaleReportExclusion(excluded,identity,"restore",actor,
    "Reinclusão após conferência","2026-10-14T11:25:00.000Z");
  assert.equal(restored[0].reportExclusion,undefined);
  assert.deepEqual(restored[0].reportExclusionEvents?.map(e=>e.action),["exclude","restore"]);
  assert.equal(buildSalesReport(restored,[],[]).salesCount,1);
});

test("somente gestor ativo consegue desconsiderar vendas e exige motivo",()=>{
  const original=sale({number:"987"});
  const identity={number:original.number,finalizedAt:original.finalizedAt,terminalId:original.terminalId};
  const ts="2026-10-14T11:20:00.000Z";
  assert.throws(()=>changeSaleReportExclusion([original],identity,"exclude",
    {id:"OP-001",role:"cashier",active:true},"Treinamento",ts),/Somente um gerente/);
  assert.throws(()=>changeSaleReportExclusion([original],identity,"exclude",
    {id:"GER-001",role:"manager",active:false},"Treinamento",ts),/Somente um gerente/);
  assert.throws(()=>changeSaleReportExclusion([original],identity,"exclude",
    {id:"GER-001",role:"manager",active:true},"",ts),/motivo/);
  assert.throws(()=>changeSaleReportExclusion([original],{...identity,terminalId:"OUTRO"},"exclude",
    {id:"GER-001",role:"manager",active:true},"Treinamento",ts),/não foi encontrada/);
});
