import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateReportAmounts, buildSalesReport, exportSalesReportCsv, reportDate,
  type ReportSale
} from "../apps/pdv-demo/src/salesReporting.js";

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
  assert.equal(report.lines[0].payments.includes("CREDITO"), true);
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
  assert.ok(csv.includes(";'=FORMULA"));
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
