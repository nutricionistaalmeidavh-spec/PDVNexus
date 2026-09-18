import assert from "node:assert/strict";
import test from "node:test";
import {
  applyBatchStockEntryToSnapshot,
  buildProductExpiryRows,
  getExpiryBucket,
  summarizeProductExpiry
} from "../apps/pdv-demo/src/batchInventory.js";
import { reconcileProductBatchFefoSnapshot } from "../apps/pdv-demo/src/productBatchFefo.js";
import { normalizeProductBatchStore, upsertProductBatch } from "../apps/pdv-demo/src/productLabels.js";

function emptyStore(now = "2026-09-18T12:00:00.000Z") {
  return normalizeProductBatchStore({
    version: 2,
    updatedAt: now,
    fefoStartedAt: now,
    productIdentities: [],
    batches: [],
    saleAllocations: []
  }, now);
}

function snapshot(stock = 5) {
  return {
    version: 1,
    updatedAt: "2026-09-18T11:00:00.000Z",
    catalogProducts: [{
      productCode: "00101",
      productName: "Produto Teste",
      barcode: "7895555441971",
      stock,
      minStock: 1,
      itemType: "unit",
      unitLabel: "UN",
      productKind: "standard"
    }],
    registeredCustomers: [],
    completedSales: [],
    extensions: { inventoryMovements: [] }
  };
}

test("P6 entrada por lote aumenta estoque, registra movimento e cria saldo rastreado", () => {
  const result = applyBatchStockEntryToSnapshot({
    snapshotValue: snapshot(5),
    store: emptyStore(),
    draft: { productCode: "00101", lotNumber: "LT-001", quantity: 3, manufacturedAt: "2026-09-10", expiresAt: "2027-01-10" },
    nowIso: "2026-09-18T12:05:00.000Z",
    createdAt: "18/09/2026, 09:05:00"
  });

  const product = (result.snapshot.catalogProducts as Array<{ stock: number }>)[0];
  const movements = (result.snapshot.extensions as { inventoryMovements: Array<{ type: string; stockBefore: number; stockAfter: number }> }).inventoryMovements;
  assert.equal(product?.stock, 8);
  assert.equal(result.batch.quantity, 3);
  assert.equal(result.batch.remainingQuantity, 3);
  assert.equal(result.batch.lotNumber, "LT-001");
  assert.equal(movements[0]?.type, "entry");
  assert.equal(movements[0]?.stockBefore, 5);
  assert.equal(movements[0]?.stockAfter, 8);
});

test("P6 receber novamente o mesmo lote soma quantidade e saldo sem duplicar lote", () => {
  const first = applyBatchStockEntryToSnapshot({
    snapshotValue: snapshot(5),
    store: emptyStore(),
    draft: { productCode: "00101", lotNumber: "LT-001", quantity: 3, expiresAt: "2027-01-10" },
    nowIso: "2026-09-18T12:05:00.000Z"
  });
  const second = applyBatchStockEntryToSnapshot({
    snapshotValue: first.snapshot,
    store: first.store,
    draft: { productCode: "00101", lotNumber: "lt-001", quantity: 2, expiresAt: "2027-01-10" },
    nowIso: "2026-09-18T12:10:00.000Z"
  });

  assert.equal(second.store.batches.length, 1);
  assert.equal(second.batch.quantity, 5);
  assert.equal(second.batch.remainingQuantity, 5);
  assert.equal((second.snapshot.catalogProducts as Array<{ stock: number }>)[0]?.stock, 10);
});

test("P6 bloqueia datas conflitantes para o mesmo lote e produto principal", () => {
  const first = applyBatchStockEntryToSnapshot({
    snapshotValue: snapshot(5),
    store: emptyStore(),
    draft: { productCode: "00101", lotNumber: "LT-001", quantity: 3, expiresAt: "2027-01-10" },
    nowIso: "2026-09-18T12:05:00.000Z"
  });
  assert.throws(() => applyBatchStockEntryToSnapshot({
    snapshotValue: first.snapshot,
    store: first.store,
    draft: { productCode: "00101", lotNumber: "LT-001", quantity: 1, expiresAt: "2027-02-10" },
    nowIso: "2026-09-18T12:10:00.000Z"
  }), /já possui validade/);

  const parentSnapshot = snapshot(0);
  (parentSnapshot.catalogProducts[0] as Record<string, unknown>).productKind = "parent";
  assert.throws(() => applyBatchStockEntryToSnapshot({
    snapshotValue: parentSnapshot,
    store: emptyStore(),
    draft: { productCode: "00101", lotNumber: "LT-P", quantity: 1 },
    nowIso: "2026-09-18T12:10:00.000Z"
  }), /Produto principal não recebe estoque/);
});

test("P7 classifica vencidos, hoje e janelas de 7, 15 e 30 dias", () => {
  const today = "2026-09-18";
  assert.equal(getExpiryBucket("2026-09-17", today), "expired");
  assert.equal(getExpiryBucket("2026-09-18", today), "today");
  assert.equal(getExpiryBucket("2026-09-25", today), "7d");
  assert.equal(getExpiryBucket("2026-10-03", today), "15d");
  assert.equal(getExpiryBucket("2026-10-18", today), "30d");
  assert.equal(getExpiryBucket("2026-10-19", today), "later");
});

test("P7 painel ignora lote sem saldo e ordena pela validade", () => {
  const dates = ["2026-10-18", "2026-09-17", "2026-09-18", "2026-09-25", "2026-10-03"];
  let batches = [] as ReturnType<typeof upsertProductBatch>["batches"];
  dates.forEach((expiresAt, index) => {
    batches = upsertProductBatch(batches, { productCode: "00101", lotNumber: `L${index}`, expiresAt, quantity: 2 }, `2026-09-18T12:0${index}:00.000Z`).batches;
  });
  const zeroBalance = upsertProductBatch(batches, { productCode: "00101", lotNumber: "ZERO", expiresAt: "2026-09-20", quantity: 2, remainingQuantity: 0 }, "2026-09-18T12:10:00.000Z");
  const rows = buildProductExpiryRows(zeroBalance.batches, [{ productCode: "00101", productName: "Produto Teste" }], "2026-09-18");
  const summary = summarizeProductExpiry(rows);
  assert.equal(rows.length, 5);
  assert.equal(rows[0]?.expiresAt, "2026-09-17");
  assert.equal(summary.expired, 1);
  assert.equal(summary.today, 1);
  assert.equal(summary["7d"], 1);
  assert.equal(summary["15d"], 1);
  assert.equal(summary["30d"], 1);
});

test("P8 FEFO consome lotes por vencimento, não duplica reconciliação e restaura no cancelamento", () => {
  const now = "2026-09-18T12:00:00.000Z";
  let batches = upsertProductBatch([], { productCode: "00101", lotNumber: "L1", expiresAt: "2026-09-20", quantity: 2 }, now).batches;
  batches = upsertProductBatch(batches, { productCode: "00101", lotNumber: "L2", expiresAt: "2026-10-01", quantity: 5 }, "2026-09-18T12:01:00.000Z").batches;
  const store = normalizeProductBatchStore({ version: 2, updatedAt: now, fefoStartedAt: now, productIdentities: [], batches, saleAllocations: [] }, now);
  const sale = { number: "000010", finalizedAt: "18/09/2026, 09:05:00", items: [{ productCode: "00101", quantity: 3 }] };

  const consumed = reconcileProductBatchFefoSnapshot({ completedSales: [sale], extensions: { cancelledSales: [] } }, store, "2026-09-18T12:06:00.000Z");
  assert.deepEqual(consumed.store.saleAllocations[0]?.allocations.map((item) => [item.lotNumber, item.quantity]), [["L1", 2], ["L2", 1]]);
  assert.equal(consumed.store.batches.find((batch) => batch.lotNumber === "L1")?.remainingQuantity, 0);
  assert.equal(consumed.store.batches.find((batch) => batch.lotNumber === "L2")?.remainingQuantity, 4);

  const repeated = reconcileProductBatchFefoSnapshot({ completedSales: [sale], extensions: { cancelledSales: [] } }, consumed.store, "2026-09-18T12:07:00.000Z");
  assert.equal(repeated.changed, false);
  assert.equal(repeated.store.saleAllocations.length, 1);

  const cancelled = reconcileProductBatchFefoSnapshot({ completedSales: [], extensions: { cancelledSales: [{ number: "000010" }] } }, repeated.store, "2026-09-18T12:08:00.000Z");
  assert.equal(cancelled.store.batches.find((batch) => batch.lotNumber === "L1")?.remainingQuantity, 2);
  assert.equal(cancelled.store.batches.find((batch) => batch.lotNumber === "L2")?.remainingQuantity, 5);
  assert.ok(cancelled.store.saleAllocations[0]?.restoredAt);
});

test("P8 mantém estoques de variantes separados pelo productCode", () => {
  const now = "2026-09-18T12:00:00.000Z";
  let batches = upsertProductBatch([], { productCode: "VAR-A", lotNumber: "A1", expiresAt: "2026-10-01", quantity: 5 }, now).batches;
  batches = upsertProductBatch(batches, { productCode: "VAR-B", lotNumber: "B1", expiresAt: "2026-09-25", quantity: 5 }, now).batches;
  const store = normalizeProductBatchStore({ version: 2, updatedAt: now, fefoStartedAt: now, productIdentities: [], batches, saleAllocations: [] }, now);
  const result = reconcileProductBatchFefoSnapshot({
    completedSales: [{ number: "V-1", finalizedAt: "18/09/2026, 09:05:00", items: [{ productCode: "VAR-A", quantity: 2 }] }],
    extensions: { cancelledSales: [] }
  }, store, "2026-09-18T12:06:00.000Z");

  assert.equal(result.store.batches.find((batch) => batch.productCode === "VAR-A")?.remainingQuantity, 3);
  assert.equal(result.store.batches.find((batch) => batch.productCode === "VAR-B")?.remainingQuantity, 5);
});
