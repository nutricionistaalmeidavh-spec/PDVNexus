import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductLabelPreview,
  normalizeProductBatchStore,
  upsertProductBatch,
  type LabelCatalogProduct,
  type ProductLabelBatchStore
} from "../apps/pdv-demo/src/productLabels.js";
import {
  allocateProductBatchExact,
  createProductBatchTrackingBarcode,
  markBatchPhysicalSaleProductAmbiguous,
  normalizeBatchPhysicalScanLedger,
  recordBatchPhysicalScan,
  resolveProductBatchTrackingScan
} from "../apps/pdv-demo/src/batchPhysicalTracking.js";
import { reconcileProductBatchFefoSnapshot } from "../apps/pdv-demo/src/productBatchFefo.js";
import { applyBatchStockEntryToSnapshot } from "../apps/pdv-demo/src/batchInventory.js";
import { buildProductLabelPrintHtml } from "../apps/pdv-demo/src/labelPrinting.js";

const NOW = "2026-09-18T12:00:00.000Z";
const PRODUCT: LabelCatalogProduct = {
  productCode: "00103",
  productName: "Coca-Cola 2,5L",
  barcode: "7894900011110",
  unitPrice: 12,
  barcodeType: "gtin"
};

function createStore(): ProductLabelBatchStore {
  const first = upsertProductBatch([], {
    productCode: PRODUCT.productCode,
    lotNumber: "LOTE-A",
    expiresAt: "2026-09-25",
    quantity: 5
  }, NOW).batch;
  const second = upsertProductBatch([first], {
    productCode: PRODUCT.productCode,
    lotNumber: "LOTE-B",
    expiresAt: "2027-06-30",
    quantity: 5
  }, NOW).batch;
  return normalizeProductBatchStore({
    version: 2,
    updatedAt: NOW,
    fefoStartedAt: NOW,
    productIdentities: [],
    batches: [first, second],
    saleAllocations: []
  }, NOW);
}

function saleSnapshot(number: string, quantity: number) {
  return {
    completedSales: [{
      number,
      finalizedAt: "2026-09-18T12:05:00.000Z",
      items: [{ productCode: PRODUCT.productCode, quantity }]
    }],
    extensions: { cancelledSales: [] }
  };
}

test("etiqueta fisica gera codigo unico por lote e resolve exatamente o lote escaneado", () => {
  const store = createStore();
  const lotA = store.batches.find((batch) => batch.lotNumber === "LOTE-A")!;
  const lotB = store.batches.find((batch) => batch.lotNumber === "LOTE-B")!;
  const codeA = createProductBatchTrackingBarcode(lotA.id);
  const codeB = createProductBatchTrackingBarcode(lotB.id);
  assert.notEqual(codeA, codeB);
  assert.match(codeB, /^NXL1:/);
  const resolved = resolveProductBatchTrackingScan(codeB, store, "2026-09-18");
  assert.equal(resolved?.batchId, lotB.id);
  assert.equal(resolved?.lotNumber, "LOTE-B");
  assert.equal(resolved?.productCode, PRODUCT.productCode);
});

test("scanner bloqueia lote vencido e lote fisico sem saldo", () => {
  const store = createStore();
  const lotA = store.batches.find((batch) => batch.lotNumber === "LOTE-A")!;
  const expired: ProductLabelBatchStore = {
    ...store,
    batches: store.batches.map((batch) => batch.id === lotA.id ? { ...batch, expiresAt: "2026-09-17" } : batch)
  };
  assert.throws(
    () => resolveProductBatchTrackingScan(createProductBatchTrackingBarcode(lotA.id), expired, "2026-09-18"),
    /vencido/i
  );
  const depleted: ProductLabelBatchStore = {
    ...store,
    batches: store.batches.map((batch) => batch.id === lotA.id ? { ...batch, remainingQuantity: 0 } : batch)
  };
  assert.throws(
    () => resolveProductBatchTrackingScan(createProductBatchTrackingBarcode(lotA.id), depleted, "2026-09-18"),
    /sem saldo/i
  );
});

test("baixa exata nao troca silenciosamente o lote fisico pelo FEFO", () => {
  const store = createStore();
  const lotA = store.batches.find((batch) => batch.lotNumber === "LOTE-A")!;
  const lotB = store.batches.find((batch) => batch.lotNumber === "LOTE-B")!;
  const exact = allocateProductBatchExact(store.batches, lotB.id, 1, "2026-09-18T12:05:00.000Z");
  assert.equal(exact.allocatedQuantity, 1);
  assert.equal(exact.untrackedQuantity, 0);
  assert.equal(exact.batches.find((batch) => batch.id === lotA.id)?.remainingQuantity, 5);
  assert.equal(exact.batches.find((batch) => batch.id === lotB.id)?.remainingQuantity, 4);
});

test("venda com etiqueta do lote B baixa B mesmo quando A vence antes", () => {
  const store = createStore();
  const lotA = store.batches.find((batch) => batch.lotNumber === "LOTE-A")!;
  const lotB = store.batches.find((batch) => batch.lotNumber === "LOTE-B")!;
  const ledger = recordBatchPhysicalScan(normalizeBatchPhysicalScanLedger({}), {
    saleNumber: "000101",
    productCode: PRODUCT.productCode,
    batchId: lotB.id,
    lotNumber: lotB.lotNumber,
    expiresAt: lotB.expiresAt,
    barcode: createProductBatchTrackingBarcode(lotB.id),
    scannedAt: "2026-09-18T12:04:00.000Z"
  });
  const result = reconcileProductBatchFefoSnapshot(saleSnapshot("000101", 1), store, "2026-09-18T12:06:00.000Z", ledger);
  assert.equal(result.store.batches.find((batch) => batch.id === lotA.id)?.remainingQuantity, 5);
  assert.equal(result.store.batches.find((batch) => batch.id === lotB.id)?.remainingQuantity, 4);
  const allocation = result.store.saleAllocations[0] as ProductLabelBatchStore["saleAllocations"][number] & { trackingMode?: string; physicallyTrackedQuantity?: number };
  assert.equal(allocation.trackingMode, "confirmed");
  assert.equal(allocation.physicallyTrackedQuantity, 1);
  assert.equal(allocation.allocations[0]?.batchId, lotB.id);
});

test("EAN generico continua FEFO presumido e baixa o lote que vence primeiro", () => {
  const store = createStore();
  const lotA = store.batches.find((batch) => batch.lotNumber === "LOTE-A")!;
  const lotB = store.batches.find((batch) => batch.lotNumber === "LOTE-B")!;
  const result = reconcileProductBatchFefoSnapshot(saleSnapshot("000102", 1), store, "2026-09-18T12:06:00.000Z");
  assert.equal(result.store.batches.find((batch) => batch.id === lotA.id)?.remainingQuantity, 4);
  assert.equal(result.store.batches.find((batch) => batch.id === lotB.id)?.remainingQuantity, 5);
  const allocation = result.store.saleAllocations[0] as ProductLabelBatchStore["saleAllocations"][number] & { trackingMode?: string };
  assert.equal(allocation.trackingMode, "presumed-fefo");
});

test("venda mista usa lote fisico primeiro e FEFO apenas para o restante generico", () => {
  const store = createStore();
  const lotA = store.batches.find((batch) => batch.lotNumber === "LOTE-A")!;
  const lotB = store.batches.find((batch) => batch.lotNumber === "LOTE-B")!;
  const ledger = recordBatchPhysicalScan(normalizeBatchPhysicalScanLedger({}), {
    saleNumber: "000103",
    productCode: PRODUCT.productCode,
    batchId: lotB.id,
    lotNumber: lotB.lotNumber,
    expiresAt: lotB.expiresAt,
    barcode: createProductBatchTrackingBarcode(lotB.id),
    scannedAt: "2026-09-18T12:04:00.000Z"
  });
  const result = reconcileProductBatchFefoSnapshot(saleSnapshot("000103", 2), store, "2026-09-18T12:06:00.000Z", ledger);
  assert.equal(result.store.batches.find((batch) => batch.id === lotA.id)?.remainingQuantity, 4);
  assert.equal(result.store.batches.find((batch) => batch.id === lotB.id)?.remainingQuantity, 4);
  const allocation = result.store.saleAllocations[0] as ProductLabelBatchStore["saleAllocations"][number] & { trackingMode?: string; physicallyTrackedQuantity?: number };
  assert.equal(allocation.trackingMode, "mixed");
  assert.equal(allocation.physicallyTrackedQuantity, 1);
});

test("edicao ambigua do carrinho nunca declara rastreamento fisico confirmado", () => {
  const store = createStore();
  const lotB = store.batches.find((batch) => batch.lotNumber === "LOTE-B")!;
  let ledger = recordBatchPhysicalScan(normalizeBatchPhysicalScanLedger({}), {
    saleNumber: "000104",
    productCode: PRODUCT.productCode,
    batchId: lotB.id,
    lotNumber: lotB.lotNumber,
    expiresAt: lotB.expiresAt,
    barcode: createProductBatchTrackingBarcode(lotB.id),
    scannedAt: "2026-09-18T12:04:00.000Z"
  });
  ledger = markBatchPhysicalSaleProductAmbiguous(ledger, "000104", PRODUCT.productCode);
  const result = reconcileProductBatchFefoSnapshot(saleSnapshot("000104", 1), store, "2026-09-18T12:06:00.000Z", ledger);
  const allocation = result.store.saleAllocations[0] as ProductLabelBatchStore["saleAllocations"][number] & { trackingMode?: string; physicallyTrackedQuantity?: number };
  assert.equal(allocation.trackingMode, "presumed-fefo");
  assert.equal(allocation.physicallyTrackedQuantity, 0);
});

test("falta de saldo no lote escaneado vira excecao e nao toma outro lote no lugar", () => {
  const store = createStore();
  const lotA = store.batches.find((batch) => batch.lotNumber === "LOTE-A")!;
  const lotB = store.batches.find((batch) => batch.lotNumber === "LOTE-B")!;
  const exhaustedStore: ProductLabelBatchStore = {
    ...store,
    batches: store.batches.map((batch) => batch.id === lotB.id ? { ...batch, remainingQuantity: 0 } : batch)
  };
  const ledger = recordBatchPhysicalScan(normalizeBatchPhysicalScanLedger({}), {
    saleNumber: "000105",
    productCode: PRODUCT.productCode,
    batchId: lotB.id,
    lotNumber: lotB.lotNumber,
    expiresAt: lotB.expiresAt,
    barcode: createProductBatchTrackingBarcode(lotB.id),
    scannedAt: "2026-09-18T12:04:00.000Z"
  });
  const result = reconcileProductBatchFefoSnapshot(saleSnapshot("000105", 1), exhaustedStore, "2026-09-18T12:06:00.000Z", ledger);
  assert.equal(result.store.batches.find((batch) => batch.id === lotA.id)?.remainingQuantity, 5);
  const allocation = result.store.saleAllocations[0] as ProductLabelBatchStore["saleAllocations"][number] & { trackingMode?: string; trackingExceptionQuantity?: number };
  assert.equal(allocation.trackingMode, "exception");
  assert.equal(allocation.trackingExceptionQuantity, 1);
});

test("cancelamento restaura exatamente o lote fisicamente vendido", () => {
  const store = createStore();
  const lotB = store.batches.find((batch) => batch.lotNumber === "LOTE-B")!;
  const ledger = recordBatchPhysicalScan(normalizeBatchPhysicalScanLedger({}), {
    saleNumber: "000106",
    productCode: PRODUCT.productCode,
    batchId: lotB.id,
    lotNumber: lotB.lotNumber,
    expiresAt: lotB.expiresAt,
    barcode: createProductBatchTrackingBarcode(lotB.id),
    scannedAt: "2026-09-18T12:04:00.000Z"
  });
  const sold = reconcileProductBatchFefoSnapshot(saleSnapshot("000106", 1), store, "2026-09-18T12:06:00.000Z", ledger);
  assert.equal(sold.store.batches.find((batch) => batch.id === lotB.id)?.remainingQuantity, 4);
  const cancelled = reconcileProductBatchFefoSnapshot({
    completedSales: [],
    extensions: { cancelledSales: [{ number: "000106" }] }
  }, sold.store, "2026-09-18T12:07:00.000Z", ledger);
  assert.equal(cancelled.store.batches.find((batch) => batch.id === lotB.id)?.remainingQuantity, 5);
});

test("etiqueta de lote imprime o identificador fisico em Code 128 e nao o GTIN generico", () => {
  const store = createStore();
  const lotB = store.batches.find((batch) => batch.lotNumber === "LOTE-B")!;
  const preview = buildProductLabelPreview(PRODUCT, {
    productCode: PRODUCT.productCode,
    batchId: lotB.id,
    copies: 1,
    sizePreset: "40x25",
    showPrice: true,
    showLot: true,
    showExpiry: true
  }, lotB);
  const html = buildProductLabelPrintHtml({ product: PRODUCT, preview, batch: lotB });
  assert.match(html, new RegExp(createProductBatchTrackingBarcode(lotB.id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(html, />7894900011110</);
});

test("entrada por lote + venda fisica mantem estoque do SKU e saldo do lote coerentes", () => {
  const baseSnapshot = {
    catalogProducts: [{ ...PRODUCT, stock: 0, minStock: 0, itemType: "unit", unitLabel: "UN", category: "Bebidas" }],
    extensions: { inventoryMovements: [] }
  };
  let store = normalizeProductBatchStore({ version: 2, updatedAt: NOW, fefoStartedAt: NOW, productIdentities: [], batches: [], saleAllocations: [] }, NOW);
  const receipt = applyBatchStockEntryToSnapshot({
    snapshotValue: baseSnapshot,
    store,
    draft: { productCode: PRODUCT.productCode, lotNumber: "L-FISICO", quantity: 3, expiresAt: "2027-01-01" },
    nowIso: NOW,
    createdAt: "18/09/2026, 09:00:00"
  });
  store = receipt.store;
  assert.equal((receipt.snapshot.catalogProducts as Array<{ stock: number }>)[0]?.stock, 3);
  const ledger = recordBatchPhysicalScan(normalizeBatchPhysicalScanLedger({}), {
    saleNumber: "000107",
    productCode: PRODUCT.productCode,
    batchId: receipt.batch.id,
    lotNumber: receipt.batch.lotNumber,
    expiresAt: receipt.batch.expiresAt,
    barcode: createProductBatchTrackingBarcode(receipt.batch.id),
    scannedAt: "2026-09-18T12:04:00.000Z"
  });
  const result = reconcileProductBatchFefoSnapshot(saleSnapshot("000107", 1), store, "2026-09-18T12:06:00.000Z", ledger);
  assert.equal(result.store.batches[0]?.remainingQuantity, 2);
});
