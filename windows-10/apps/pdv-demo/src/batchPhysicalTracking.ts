import {
  isBatchExpired,
  type ProductBatch,
  type ProductBatchAllocationItem,
  type ProductLabelBatchStore
} from "./productLabels";

export const PRODUCT_BATCH_TRACKING_PREFIX = "NXL1:";
export const PRODUCT_BATCH_PHYSICAL_SCAN_STORE_KEY = "nexus-core:pdv-batch-physical-scans:v1";

export type BatchPhysicalScanRecord = {
  id: string;
  saleNumber: string;
  productCode: string;
  batchId: string;
  lotNumber: string;
  expiresAt?: string;
  barcode: string;
  scannedAt: string;
};

export type BatchPhysicalScanLedger = {
  version: 1;
  updatedAt: string;
  records: BatchPhysicalScanRecord[];
  ambiguousSaleProducts: string[];
};

export type ProductBatchTrackingScan = {
  batchId: string;
  productCode: string;
  lotNumber: string;
  expiresAt?: string;
  barcode: string;
  remainingQuantity: number;
};

export function createProductBatchTrackingBarcode(batchId: string) {
  const normalized = String(batchId ?? "").trim();
  if (!normalized) throw new Error("Lote inválido para gerar código de rastreio.");
  if (!/^[\x20-\x7E]+$/.test(normalized)) throw new Error("O identificador do lote contém caracteres incompatíveis com Code 128.");
  return `${PRODUCT_BATCH_TRACKING_PREFIX}${normalized}`;
}

export function parseProductBatchTrackingBarcode(value: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized.startsWith(PRODUCT_BATCH_TRACKING_PREFIX)) return null;
  const batchId = normalized.slice(PRODUCT_BATCH_TRACKING_PREFIX.length).trim();
  if (!batchId) throw new Error("Etiqueta física de lote inválida.");
  return { batchId, barcode: normalized };
}

export function resolveProductBatchTrackingScan(
  value: string,
  store: ProductLabelBatchStore,
  today = new Date().toISOString().slice(0, 10),
  reservedQuantity = 0
): ProductBatchTrackingScan | null {
  const parsed = parseProductBatchTrackingBarcode(value);
  if (!parsed) return null;
  const batch = store.batches.find((item) => item.id === parsed.batchId);
  if (!batch) throw new Error("A etiqueta identifica um lote que não existe mais neste PDV.");
  if (isBatchExpired(batch, today)) throw new Error(`Lote ${batch.lotNumber} vencido. A venda foi bloqueada para conferência.`);
  const available = roundQuantity(batch.remainingQuantity - Math.max(0, Number(reservedQuantity) || 0));
  if (available <= 0) throw new Error(`Lote ${batch.lotNumber} sem saldo disponível para outra unidade.`);
  return {
    batchId: batch.id,
    productCode: batch.productCode,
    lotNumber: batch.lotNumber,
    expiresAt: batch.expiresAt,
    barcode: parsed.barcode,
    remainingQuantity: available
  };
}

export function allocateProductBatchExact(
  batches: ProductBatch[],
  batchId: string,
  requestedQuantity: number,
  updatedAt = new Date().toISOString()
) {
  const requested = roundQuantity(Math.max(0, Number(requestedQuantity) || 0));
  const batch = batches.find((item) => item.id === batchId);
  if (!batch || requested <= 0) {
    return { batches, allocations: [] as ProductBatchAllocationItem[], allocatedQuantity: 0, untrackedQuantity: requested };
  }
  const allocatedQuantity = roundQuantity(Math.min(batch.remainingQuantity, requested));
  const allocations: ProductBatchAllocationItem[] = allocatedQuantity > 0 ? [{
    batchId: batch.id,
    lotNumber: batch.lotNumber,
    quantity: allocatedQuantity,
    expiresAt: batch.expiresAt
  }] : [];
  const nextBatches = allocatedQuantity > 0 ? batches.map((item) => item.id === batch.id ? {
    ...item,
    remainingQuantity: roundQuantity(Math.max(0, item.remainingQuantity - allocatedQuantity)),
    updatedAt
  } : item) : batches;
  return {
    batches: nextBatches,
    allocations,
    allocatedQuantity,
    untrackedQuantity: roundQuantity(Math.max(0, requested - allocatedQuantity))
  };
}

export function normalizeBatchPhysicalScanLedger(value: unknown, updatedAt = new Date().toISOString()): BatchPhysicalScanLedger {
  const source = value && typeof value === "object" ? value as Partial<BatchPhysicalScanLedger> : {};
  const records = Array.isArray(source.records) ? source.records.filter(isScanRecord).map((record) => ({ ...record })) : [];
  const ambiguousSaleProducts = Array.isArray(source.ambiguousSaleProducts)
    ? [...new Set(source.ambiguousSaleProducts.map((item) => String(item)).filter(Boolean))]
    : [];
  return {
    version: 1,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : updatedAt,
    records: records.slice(-2000),
    ambiguousSaleProducts
  };
}

export function recordBatchPhysicalScan(
  ledger: BatchPhysicalScanLedger,
  draft: Omit<BatchPhysicalScanRecord, "id">
): BatchPhysicalScanLedger {
  const saleNumber = String(draft.saleNumber ?? "").trim();
  const productCode = String(draft.productCode ?? "").trim();
  const batchId = String(draft.batchId ?? "").trim();
  if (!saleNumber || !productCode || !batchId) throw new Error("Venda, produto e lote são obrigatórios no rastreio físico.");
  const scannedAt = String(draft.scannedAt ?? "").trim() || new Date().toISOString();
  const record: BatchPhysicalScanRecord = {
    ...draft,
    saleNumber,
    productCode,
    batchId,
    lotNumber: String(draft.lotNumber ?? "").trim(),
    barcode: String(draft.barcode ?? "").trim(),
    scannedAt,
    id: `SCAN-${saleNumber}-${batchId}-${scannedAt}-${ledger.records.length + 1}`
  };
  return { ...ledger, updatedAt: scannedAt, records: [...ledger.records, record].slice(-2000) };
}

export function markBatchPhysicalSaleProductAmbiguous(
  ledger: BatchPhysicalScanLedger,
  saleNumber: string,
  productCode: string,
  updatedAt = new Date().toISOString()
) {
  const key = batchPhysicalSaleProductKey(saleNumber, productCode);
  if (!saleNumber || !productCode || ledger.ambiguousSaleProducts.includes(key)) return ledger;
  return { ...ledger, updatedAt, ambiguousSaleProducts: [...ledger.ambiguousSaleProducts, key] };
}

export function markBatchPhysicalSaleAmbiguous(
  ledger: BatchPhysicalScanLedger,
  saleNumber: string,
  updatedAt = new Date().toISOString()
) {
  const productCodes = [...new Set(ledger.records.filter((record) => record.saleNumber === saleNumber).map((record) => record.productCode))];
  return productCodes.reduce((current, productCode) => markBatchPhysicalSaleProductAmbiguous(current, saleNumber, productCode, updatedAt), ledger);
}

export function clearBatchPhysicalSale(
  ledger: BatchPhysicalScanLedger,
  saleNumber: string,
  updatedAt = new Date().toISOString()
) {
  const prefix = `${String(saleNumber ?? "").trim()}\u0000`;
  return {
    ...ledger,
    updatedAt,
    records: ledger.records.filter((record) => record.saleNumber !== saleNumber),
    ambiguousSaleProducts: ledger.ambiguousSaleProducts.filter((key) => !key.startsWith(prefix))
  };
}

export function getBatchPhysicalScansForSaleProduct(
  ledger: BatchPhysicalScanLedger | undefined,
  saleNumber: string,
  productCode: string
) {
  if (!ledger) return [];
  return ledger.records.filter((record) => record.saleNumber === saleNumber && record.productCode === productCode);
}

export function isBatchPhysicalSaleProductAmbiguous(
  ledger: BatchPhysicalScanLedger | undefined,
  saleNumber: string,
  productCode: string
) {
  return Boolean(ledger?.ambiguousSaleProducts.includes(batchPhysicalSaleProductKey(saleNumber, productCode)));
}

export function countReservedPhysicalScans(ledger: BatchPhysicalScanLedger, batchId: string, saleNumber?: string) {
  return ledger.records.filter((record) => record.batchId === batchId && (!saleNumber || record.saleNumber === saleNumber)).length;
}

export function batchPhysicalSaleProductKey(saleNumber: string, productCode: string) {
  return `${String(saleNumber ?? "").trim()}\u0000${String(productCode ?? "").trim()}`;
}

export function loadBatchPhysicalScanLedger(storage: Pick<Storage, "getItem"> = window.localStorage) {
  try {
    const raw = storage.getItem(PRODUCT_BATCH_PHYSICAL_SCAN_STORE_KEY);
    return normalizeBatchPhysicalScanLedger(raw ? JSON.parse(raw) : {});
  } catch {
    return normalizeBatchPhysicalScanLedger({});
  }
}

export function saveBatchPhysicalScanLedger(ledger: BatchPhysicalScanLedger, storage: Pick<Storage, "setItem"> = window.localStorage) {
  const normalized = normalizeBatchPhysicalScanLedger({ ...ledger, updatedAt: new Date().toISOString() });
  storage.setItem(PRODUCT_BATCH_PHYSICAL_SCAN_STORE_KEY, JSON.stringify(normalized));
  return normalized;
}

function isScanRecord(value: unknown): value is BatchPhysicalScanRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as BatchPhysicalScanRecord;
  return Boolean(record.id && record.saleNumber && record.productCode && record.batchId && record.barcode && record.scannedAt);
}

function roundQuantity(value: number) {
  return Number(value.toFixed(3));
}
