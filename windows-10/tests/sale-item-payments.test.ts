import assert from "node:assert/strict";
import test from "node:test";
import { buildSalesReport, exportSalesReportCsv } from "../apps/pdv-demo/src/salesReporting.js";
import {
  resolveItemPayments, verifiedStoredItemPayments, effectiveItemTenders,
  type AllocationSale, type ItemPaymentAssignment
} from "../apps/pdv-demo/src/saleItemPayments.js";

const base = (patch: Partial<AllocationSale> = {}): AllocationSale & { finalizedAt: string } => ({
  number: "000123", netTotal: 30, seller: "Caixa",
  items: [
    { id: "AB-1", productCode: "ABRINCO", productName: "Farinha ABRINCO", unitLabel: "UN", quantity: 1, totalPrice: 10, unitPrice: 10 },
    { id: "CO-1", productCode: "COOAFATRE", productName: "Farinha COOAFATRE", unitLabel: "UN", quantity: 2, totalPrice: 20, unitPrice: 10 }
  ],
  payments: [{ method: "A VISTA", amount: 10 }, { method: "CREDITO", amount: 20 }],
  paymentSummary: { changeDue: 0 },
  ...patch,
  finalizedAt: patch.finalizedAt ?? "14/10/2026, 10:30:00"
});

const desired: ItemPaymentAssignment[] = [
  { itemId: "AB-1", method: "A VISTA", quantity: 1 },
  { itemId: "CO-1", method: "CREDITO", quantity: 2 }
];

test("cliente: 1 farinha ABRINCO a vista; 2 COOAFATRE credito, sem duplicar", () => {
  const sale = base();
  const allocated = resolveItemPayments(sale, desired);
  assert.equal(allocated.error, undefined);
  assert.equal(allocated.mode, "explicit");
  assert.deepEqual(allocated.rows.map(x => [x.itemId, x.method, x.quantity, x.amount]), [
    ["AB-1", "A VISTA", 1, 10], ["CO-1", "CREDITO", 2, 20]
  ]);
  const report = buildSalesReport([{ ...sale, itemPaymentAllocations: allocated.rows }], [], []);
  assert.equal(report.salesCount, 1);
  assert.equal(report.revenue, 30);
  assert.equal(report.quantity, 3);
  assert.equal(report.lines.length, 2);
  assert.deepEqual(report.lines.map(l => [l.productCode, l.quantity, l.payments, l.net]),
    [["ABRINCO", 1, "A VISTA", 10], ["COOAFATRE", 2, "CREDITO", 20]]);
  assert.equal(report.products.reduce((sum, g) => sum + g.total, 0), 30);
  assert.equal(report.payments.reduce((sum, g) => sum + g.total, 0), 30);
  assert.deepEqual(report.unidentifiedItemPayments, []);
  const csv = exportSalesReportCsv(report, "lines");
  assert.ok(csv.includes("pagamento_do_item"));
  assert.ok(csv.includes("COOAFATRE"));
  assert.ok(csv.includes("CREDITO"));
});

test("duas formas para o mesmo produto criam linhas de quantidade separadas", () => {
  const sale = base({
    items: [{ id: "CO", productCode: "COOAFATRE", productName: "Farinha COOAFATRE", unitLabel: "UN", quantity: 3, totalPrice: 30 }],
    payments: [{ method: "PIX", amount: 10 }, { method: "DEBITO", amount: 20 }]
  });
  const alloc = resolveItemPayments(sale, [
    { itemId: "CO", method: "PIX", quantity: 1 },
    { itemId: "CO", method: "DEBITO", quantity: 2 }
  ]);
  const report = buildSalesReport([{ ...sale, itemPaymentAllocations: alloc.rows }], [], []);
  assert.equal(report.lines.length, 2);
  assert.deepEqual(report.lines.map(r => [r.payments, r.quantity, r.net]),
    [["PIX", 1, 10], ["DEBITO", 2, 20]]);
  assert.equal(report.products[0].quantity, 3);
  assert.equal(report.quantity, 3);
});

test("formas mistas sem distribuição continuam fechando sem inventar atribuição", () => {
  const sale = base();
  const result = resolveItemPayments(sale);
  assert.equal(result.mode, "unidentified");
  assert.equal(result.error, undefined);
  const report = buildSalesReport([sale], [], []);
  assert.equal(report.lines.length, 2);
  assert.ok(report.lines.every(l => l.payments.includes("Não identificado por item")));
  assert.deepEqual(report.unidentifiedItemPayments, ["000123"]);
  assert.equal(report.revenue, 30);
});

test("historico de forma unica é inferido somente quando a venda concilia", () => {
  const sale = base({ payments: [{ method: "PIX", amount: 30 }] });
  const alloc = resolveItemPayments(sale);
  assert.equal(alloc.mode, "automatic");
  assert.equal(alloc.rows.length, 2);
  const legacy = { ...sale, items: sale.items.map(({ id: _id, ...item }) => item) };
  const report = buildSalesReport([legacy], [], []);
  assert.ok(report.lines.every(l => l.payments === "PIX"));
  assert.deepEqual(report.unidentifiedItemPayments, []);
});

test("alocação parcial exige todos os itens e correspondência por método", () => {
  const sale = base();
  assert.match(resolveItemPayments(sale, [desired[0]]).error ?? "", /Associe|Distribua/);
  assert.match(resolveItemPayments(sale, [
    { itemId: "AB-1", method: "CREDITO", quantity: 1 },
    { itemId: "CO-1", method: "A VISTA", quantity: 2 }
  ]).error ?? "", /soma/);
  assert.match(resolveItemPayments(sale, [
    { itemId: "AB-1", method: "PIX", quantity: 1 }, desired[1]
  ]).error ?? "", /inválida/);
});

test("mudança de quantidade ou exclusão de item invalida a divisão antiga", () => {
  const afterQuantity = base({ items: base().items.map(item => item.id === "CO-1" ?
    { ...item, quantity: 3, totalPrice: 30 } : item), netTotal: 40, payments: [
    { method: "A VISTA", amount: 10 }, { method: "CREDITO", amount: 30 }
  ] });
  assert.match(resolveItemPayments(afterQuantity, desired).error ?? "", /Distribua/);
  assert.match(resolveItemPayments(base(), [...desired, { itemId: "REMOVIDO", method: "CREDITO", quantity: 1 }]).error ?? "", /removido/);
});

test("quantidade fracionaria de unidade é recusada; peso até três decimais", () => {
  assert.match(resolveItemPayments(base(), [
    { itemId: "AB-1", method: "A VISTA", quantity: 0.5 },
    { itemId: "AB-1", method: "CREDITO", quantity: 0.5 }, desired[1]
  ]).error ?? "", /Quantidade/);
  const kg = base({
    netTotal: 5, items: [{ id: "W", productCode: "KG", productName: "Produto por peso", unitLabel: "KG", quantity: 0.5, totalPrice: 5 }],
    payments: [{ method: "PIX", amount: 2 }, { method: "DEBITO", amount: 3 }]
  });
  const res = resolveItemPayments(kg, [
    { itemId: "W", method: "PIX", quantity: 0.2 },
    { itemId: "W", method: "DEBITO", quantity: 0.3 }
  ]);
  assert.deepEqual(res.rows.map(a => a.amount), [2, 3]);
});

test("desconto percentual já refletido no liquido é dividido em centavos", () => {
  const sale = base({
    netTotal: 9.99,
    items: [{ id: "X", productCode: "X", productName: "Produto", unitLabel: "UN", quantity: 3, totalPrice: 10 }],
    payments: [{ method: "PIX", amount: 3.33 }, { method: "DEBITO", amount: 6.66 }]
  });
  const alloc = resolveItemPayments(sale, [
    { itemId: "X", method: "PIX", quantity: 1 },
    { itemId: "X", method: "DEBITO", quantity: 2 }
  ]);
  assert.deepEqual(alloc.rows.map(a => a.amount), [3.33, 6.66]);
  const report = buildSalesReport([{ ...sale, itemPaymentAllocations: alloc.rows }], [], []);
  assert.equal(Math.round(report.lines.reduce((sum, l) => sum + l.net, 0) * 100), 999);
  assert.equal(Math.round(report.lines.reduce((sum, l) => sum + l.gross, 0) * 100), 1000);
  assert.equal(Math.round(report.lines.reduce((sum, l) => sum + l.discount, 0) * 100), 1);
});

test("troco não é faturamento atribuído a produto", () => {
  const sale = base({
    netTotal: 30, payments: [{ method: "DINHEIRO", amount: 50 }],
    paymentSummary: { changeDue: 20 }
  });
  const tenders = effectiveItemTenders(sale);
  assert.equal(tenders.get("DINHEIRO")?.cents, 3000);
  assert.equal(resolveItemPayments(sale).rows.reduce((sum, l) => sum + l.amount, 0), 30);
  assert.deepEqual(buildSalesReport([sale], [], []).unidentifiedItemPayments, []);
});

test("dados adulterados nunca exibem rateio falso no relatório", () => {
  const sale = base();
  const valid = resolveItemPayments(sale, desired).rows;
  assert.ok(verifiedStoredItemPayments({ ...sale, itemPaymentAllocations: valid }));
  const tampered = valid.map(a => a.itemId === "CO-1" ? { ...a, method: "A VISTA" } : a);
  assert.equal(verifiedStoredItemPayments({ ...sale, itemPaymentAllocations: tampered }), null);
  const report = buildSalesReport([{ ...sale, itemPaymentAllocations: tampered }], [], []);
  assert.deepEqual(report.unidentifiedItemPayments, ["000123"]);
  assert.ok(report.lines.every(l => l.payments.includes("Não identificado")));
});

test("venda cancelada não entra no faturamento mas mantém a informação histórica", () => {
  const sale = base();
  const saved = { ...sale, itemPaymentAllocations: resolveItemPayments(sale, desired).rows };
  const report = buildSalesReport([], [saved], [], { status: "all" });
  assert.equal(report.revenue, 0);
  assert.equal(report.cancelledCount, 1);
  assert.equal(report.lines.length, 2);
  assert.ok(report.lines.every(line => line.net === 0));
});
