import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPdvInventoryDelta,
  buildPdvOperationsReport,
  canPdvRole,
  createPdvEventBus,
  createPdvPrintQueue,
  previewPdvCustomerImport,
  previewPdvProductImport,
  publishPdvSnapshotDiff,
  resolvePdvPrice,
  rotatePdvBackups
} from "../packages/modules/pdv-ops/src/index.js";

test("RepoUteis P0: eventbus publica mudancas de venda e auditoria", () => {
  const bus = createPdvEventBus(() => "2026-09-19T12:00:00.000Z");
  const events: string[] = [];
  bus.subscribe("*", (event) => { events.push(event.type); });
  publishPdvSnapshotDiff(
    bus,
    JSON.stringify({ completedSales: [], extensions: { auditLogs: [] } }),
    JSON.stringify({ completedSales: [{}], extensions: { auditLogs: [{}] } })
  );
  assert.deepEqual(events, ["pdv.snapshot.saved", "pdv.sale.completed", "pdv.audit.changed"]);
});

test("RepoUteis P0: fila de impressao tenta novamente sem duplicar fluxo", async () => {
  let attempts = 0;
  const queue = createPdvPrintQueue({
    maxAttempts: 2,
    print: async () => {
      attempts += 1;
      return attempts === 1 ? { success: false, failureReason: "offline" } : { success: true };
    }
  });
  const job = await queue.enqueue({ text: "cupom" });
  assert.equal(job.status, "printed");
  assert.equal(job.attempts, 2);
});

test("RepoUteis P0: importador entende CSV pt-BR de produto e cliente", () => {
  const products = previewPdvProductImport("codigo;ean;produto;preco;estoque;estoque_minimo\n10;789;Cafe;12,50;8;2");
  assert.equal(products.issues.length, 0);
  assert.equal(products.products[0]?.price, 12.5);

  const customers = previewPdvCustomerImport("id;nome;cpf;cidade;limite_credito\nC10;Joao;123;Ribeirao Preto;500,00");
  assert.equal(customers.issues.length, 0);
  assert.equal(customers.customers[0]?.creditLimit, 500);
});

test("RepoUteis P1: pricing preserva combo e exige autorizacao no preco manual", () => {
  assert.equal(resolvePdvPrice({ baseUnitPrice: 3.99, quantity: 3, quantityRules: [{ quantity: 3, bundlePrice: 10 }] }).total, 10);
  assert.equal(resolvePdvPrice({ baseUnitPrice: 3.99, quantity: 3, manualUnitPrice: 3, manualOverrideAuthorized: false }).total, 11.97);
  assert.equal(resolvePdvPrice({ baseUnitPrice: 3.99, quantity: 3, manualUnitPrice: 3, manualOverrideAuthorized: true }).total, 9);
});

test("RepoUteis P1: RBAC e estoque bloqueiam operacoes indevidas", () => {
  assert.equal(canPdvRole("cashier", "manual-price"), false);
  assert.equal(canPdvRole("manager", "manual-price"), true);
  const result = applyPdvInventoryDelta({
    products: [{ productCode: "A", productName: "Produto A", stock: 5 }],
    productCode: "A",
    delta: -2
  });
  assert.equal(result.after, 3);
  assert.throws(() => applyPdvInventoryDelta({
    products: [{ productCode: "A", productName: "Produto A", stock: 1 }],
    productCode: "A",
    delta: -2
  }));
});

test("RepoUteis P0/P1: reporting e backup continuam locais", () => {
  const report = buildPdvOperationsReport([{ number: "1", finalizedAt: "2026-09-19", netTotal: 25, seller: "Ana", payments: [{ method: "PIX", amount: 25 }] }]);
  assert.equal(report.total, 25);
  assert.equal(report.bySeller.Ana, 25);
  assert.equal(report.byPayment.PIX, 25);

  const backups = rotatePdvBackups({
    backups: [
      { id: "b1", createdAt: "1", reason: "old", snapshotJson: "{}" },
      { id: "b2", createdAt: "2", reason: "old", snapshotJson: "{}" }
    ],
    snapshotJson: "{}",
    reason: "sale",
    retention: 2,
    createdAt: "3"
  });
  assert.equal(backups.length, 2);
  assert.equal(backups[0]?.createdAt, "3");
});
