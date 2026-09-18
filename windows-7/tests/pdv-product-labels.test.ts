import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductLabelPreview,
  createInternalBarcodeFromProductCode,
  inferBarcodeType,
  reconcileProductIdentities,
  upsertProductBatch
} from "../apps/pdv-demo/src/productLabels.js";

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
