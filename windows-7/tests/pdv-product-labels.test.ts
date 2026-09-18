import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateProductBatchesFefo,
  buildProductBarcodeRenderModel,
  buildProductLabelPreview,
  createInternalBarcodeFromProductCode,
  getBatchExpiryStatus,
  inferBarcodeType,
  normalizeProductBatchStore,
  reconcileProductIdentities,
  restoreProductBatchAllocation,
  upsertProductBatch
} from "../apps/pdv-demo/src/productLabels.js";
import { buildProductLabelPrintHtml } from "../apps/pdv-demo/src/labelPrinting.js";
import { parseSnapshotTimestamp, reconcileProductBatchFefoSnapshot } from "../apps/pdv-demo/src/productBatchFefo.js";

test("classifica codigo gerado pelo PDV como interno", () => {
  const barcode = createInternalBarcodeFromProductCode("00123");
  assert.equal(barcode.length, 13);
  assert.equal(inferBarcodeType("00123", barcode), "internal");
});

test("classifica EAN valido informado como GTIN e outros codigos como manuais", () => {
  assert.equal(inferBarcodeType("00101", "7895555441971"), "gtin");
  assert.equal(inferBarcodeType("00101", "ABC-123"), "manual");
});

test("recalcula a identidade quando o codigo de barras do produto muda", () => {
  const internal = createInternalBarcodeFromProductCode("00123");
  const identities = reconcileProductIdentities(
    [{ productCode: "00123", productName: "Produto", barcode: internal, unitPrice: 10 }],
    [{ productCode: "00123", barcode: "ABC-123", barcodeType: "manual", updatedAt: "2026-01-01T00:00:00.000Z" }],
    "2026-09-18T12:00:00.000Z"
  );
  assert.equal(identities[0]?.barcodeType, "internal");
});

test("permite varios lotes por produto e validade opcional", () => {
  const first = upsertProductBatch([], {
    productCode: "TANG-LAR",
    lotNumber: "L001",
    quantity: 12
  }, "2026-09-18T12:00:00.000Z");
  assert.equal(first.batch.remainingQuantity, 12);
  assert.equal(first.batch.expiresAt, undefined);

  const second = upsertProductBatch(first.batches, {
    productCode: "TANG-LAR",
    lotNumber: "L002",
    manufacturedAt: "2026-09-18",
    expiresAt: "2027-03-18",
    quantity: 24
  }, "2026-09-18T12:01:00.000Z");
  assert.equal(second.batches.length, 2);
  assert.equal(second.batch.expiresAt, "2027-03-18");
});

test("bloqueia lote duplicado e validade anterior a fabricacao", () => {
  const first = upsertProductBatch([], { productCode: "A", lotNumber: "L1", quantity: 5 }, "2026-09-18T12:00:00.000Z");
  assert.throws(() => upsertProductBatch(first.batches, { productCode: "A", lotNumber: "l1", quantity: 3 }), /Já existe um lote/);
  assert.throws(() => upsertProductBatch([], {
    productCode: "A",
    lotNumber: "L2",
    manufacturedAt: "2026-09-20",
    expiresAt: "2026-09-19",
    quantity: 3
  }), /validade não pode ser anterior/);
});

test("gera previa de etiqueta usando lote, validade, preco e quantidade de copias", () => {
  const saved = upsertProductBatch([], {
    productCode: "TANG-UVA",
    lotNumber: "TU-09",
    expiresAt: "2027-03-18",
    quantity: 30
  }, "2026-09-18T12:00:00.000Z");
  const product = {
    productCode: "TANG-UVA",
    productName: "Tang Uva",
    barcode: createInternalBarcodeFromProductCode("TANG-UVA"),
    unitPrice: 3.99,
    barcodeType: "internal" as const
  };
  const preview = buildProductLabelPreview(product, {
    productCode: product.productCode,
    batchId: saved.batch.id,
    copies: 10,
    sizePreset: "40x25",
    showPrice: true,
    showLot: true,
    showExpiry: true
  }, saved.batch);
  assert.equal(preview.lotText, "TU-09");
  assert.equal(preview.expiryText, "18/03/2027");
  assert.equal(preview.copies, 10);
  assert.equal(preview.widthMm, 40);
  assert.equal(preview.heightMm, 25);
  assert.match(preview.priceText ?? "", /3,99/);
});

test("P3 renderiza EAN-13 real para codigo interno e Code 128 para codigo manual", () => {
  const internal = buildProductBarcodeRenderModel({
    productCode: "123",
    barcode: createInternalBarcodeFromProductCode("123"),
    barcodeType: "internal"
  });
  assert.equal(internal.symbology, "ean13");
  assert.equal(internal.moduleCount, 95);
  assert.ok(internal.bars.length > 20);

  const manual = buildProductBarcodeRenderModel({ productCode: "ABC", barcode: "ABC-123", barcodeType: "manual" });
  assert.equal(manual.symbology, "code128");
  assert.equal(manual.humanReadable, "ABC-123");
  assert.ok(manual.moduleCount > 60);
  assert.ok(manual.bars.length > 10);
});

test("P4 gera paginas fisicas no tamanho exato e repete a quantidade de etiquetas", () => {
  const product = {
    productCode: "123",
    productName: "Produto <Teste>",
    barcode: createInternalBarcodeFromProductCode("123"),
    unitPrice: 9.9,
    barcodeType: "internal" as const
  };
  const preview = buildProductLabelPreview(product, {
    productCode: product.productCode,
    copies: 2,
    sizePreset: "40x25",
    showPrice: true,
    showLot: false,
    showExpiry: false
  });
  const html = buildProductLabelPrintHtml({ product, preview });
  assert.match(html, /@page \{ size: 40mm 25mm; margin: 0; \}/);
  assert.equal((html.match(/class="label-page"/g) ?? []).length, 2);
  assert.match(html, /pdv-label-barcode/);
  assert.doesNotMatch(html, /Produto <Teste>/);
  assert.match(html, /Produto &lt;Teste&gt;/);
});

test("P5 FEFO ignora vencido e consome primeiro o lote valido com menor vencimento", () => {
  const now = "2026-09-18T12:00:00.000Z";
  const batches = [
    upsertProductBatch([], { productCode: "A", lotNumber: "VENCIDO", expiresAt: "2026-09-17", quantity: 9 }, now).batch,
    upsertProductBatch([], { productCode: "A", lotNumber: "L2", expiresAt: "2026-12-01", quantity: 10 }, now).batch,
    upsertProductBatch([], { productCode: "A", lotNumber: "L1", expiresAt: "2026-10-01", quantity: 5 }, now).batch
  ];
  const result = allocateProductBatchesFefo(batches, "A", 6, "2026-09-18", "2026-09-18T12:05:00.000Z");
  assert.deepEqual(result.allocations.map((item) => [item.lotNumber, item.quantity]), [["L1", 5], ["L2", 1]]);
  assert.equal(result.untrackedQuantity, 0);
  assert.equal(result.batches.find((batch) => batch.lotNumber === "VENCIDO")?.remainingQuantity, 9);
  assert.equal(getBatchExpiryStatus(batches[0]!, "2026-09-18"), "expired");
});

test("P5 cancelamento restaura exatamente os lotes consumidos", () => {
  const now = "2026-09-18T12:00:00.000Z";
  const first = upsertProductBatch([], { productCode: "A", lotNumber: "L1", expiresAt: "2026-10-01", quantity: 5 }, now).batch;
  const second = upsertProductBatch([], { productCode: "A", lotNumber: "L2", expiresAt: "2026-11-01", quantity: 5 }, now).batch;
  const allocated = allocateProductBatchesFefo([first, second], "A", 7, "2026-09-18", "2026-09-18T12:01:00.000Z");
  const restored = restoreProductBatchAllocation(allocated.batches, allocated.allocations, "2026-09-18T12:02:00.000Z");
  assert.equal(restored.find((batch) => batch.lotNumber === "L1")?.remainingQuantity, 5);
  assert.equal(restored.find((batch) => batch.lotNumber === "L2")?.remainingQuantity, 5);
});

test("P5 migra store v1 sem consumir vendas historicas", () => {
  const migrated = normalizeProductBatchStore({ version: 1, updatedAt: "2026-09-01T00:00:00.000Z", productIdentities: [], batches: [] }, "2026-09-18T12:00:00.000Z");
  assert.equal(migrated.version, 2);
  assert.equal(migrated.fefoStartedAt, "2026-09-18T12:00:00.000Z");
  assert.deepEqual(migrated.saleAllocations, []);
});

test("P5 reconcilia venda nova e restaura os mesmos lotes ao cancelar", () => {
  const batch = upsertProductBatch([], {
    productCode: "TANG",
    lotNumber: "NOVO",
    expiresAt: "2026-12-31",
    quantity: 10
  }, "2026-09-18T12:00:00.000Z").batch;
  const store = normalizeProductBatchStore({
    version: 2,
    updatedAt: "2026-09-18T12:00:00.000Z",
    fefoStartedAt: "2026-09-18T12:00:00.000Z",
    productIdentities: [],
    batches: [batch],
    saleAllocations: []
  }, "2026-09-18T12:00:00.000Z");
  const sale = { number: "000001", finalizedAt: "2026-09-18T12:05:00.000Z", items: [{ productCode: "TANG", quantity: 3 }] };
  const consumed = reconcileProductBatchFefoSnapshot({ completedSales: [sale], extensions: { cancelledSales: [] } }, store, "2026-09-18T12:06:00.000Z");
  assert.equal(consumed.changed, true);
  assert.equal(consumed.store.batches[0]?.remainingQuantity, 7);
  assert.equal(consumed.store.saleAllocations[0]?.allocatedQuantity, 3);

  const cancelled = reconcileProductBatchFefoSnapshot({ completedSales: [], extensions: { cancelledSales: [{ number: "000001" }] } }, consumed.store, "2026-09-18T12:07:00.000Z");
  assert.equal(cancelled.store.batches[0]?.remainingQuantity, 10);
  assert.ok(cancelled.store.saleAllocations[0]?.restoredAt);
});

test("P5 entende finalizedAt no formato pt-BR usado pelo desktop", () => {
  const before = parseSnapshotTimestamp("18/09/2026, 12:04:59");
  const after = parseSnapshotTimestamp("18/09/2026, 12:05:01");
  assert.ok(Number.isFinite(before));
  assert.ok(after > before);

  const batch = upsertProductBatch([], { productCode: "A", lotNumber: "L1", expiresAt: "2026-10-01", quantity: 5 }, "2026-09-18T12:00:00.000Z").batch;
  const store = normalizeProductBatchStore({
    version: 2,
    updatedAt: "2026-09-18T12:05:00.000Z",
    fefoStartedAt: new Date(parseSnapshotTimestamp("18/09/2026, 12:05:00")).toISOString(),
    productIdentities: [],
    batches: [batch],
    saleAllocations: []
  });
  const result = reconcileProductBatchFefoSnapshot({
    completedSales: [{ number: "BR-1", finalizedAt: "18/09/2026, 12:05:01", items: [{ productCode: "A", quantity: 2 }] }],
    extensions: { cancelledSales: [] }
  }, store, "2026-09-18T12:06:00.000Z");
  assert.equal(result.store.batches[0]?.remainingQuantity, 3);
});
