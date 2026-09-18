import { applyPdvStockMovement, type PdvStockMovement } from "../../../packages/database/src/pdv.js";
import {
  normalizeProductBatchStore,
  upsertProductBatch,
  type ProductBatch,
  type ProductLabelBatchStore
} from "./productLabels";

export type BatchStockEntryDraft = {
  productCode: string;
  lotNumber: string;
  quantity: number;
  manufacturedAt?: string;
  expiresAt?: string;
  reason?: string;
};

export type BatchStockEntryResult = {
  snapshot: Record<string, unknown>;
  store: ProductLabelBatchStore;
  batch: ProductBatch;
  movement: PdvStockMovement;
};

export type ProductExpiryBucket = "expired" | "today" | "7d" | "15d" | "30d" | "later";

export type ProductExpiryRow = {
  batchId: string;
  productCode: string;
  productName: string;
  lotNumber: string;
  expiresAt: string;
  remainingQuantity: number;
  daysUntilExpiry: number;
  bucket: ProductExpiryBucket;
};

export type ProductExpirySummary = {
  expired: number;
  today: number;
  sevenDays: number;
  fifteenDays: number;
  thirtyDays: number;
};

type SnapshotCatalogProduct = {
  productCode: string;
  productName: string;
  stock: number;
  minStock: number;
  itemType?: string;
  productKind?: string;
};

type SnapshotValue = Record<string, unknown> & {
  catalogProducts?: SnapshotCatalogProduct[];
  extensions?: Record<string, unknown> & { inventoryMovements?: unknown[] };
};

export function applyBatchStockEntryToSnapshot(input: {
  snapshotValue: unknown;
  store: ProductLabelBatchStore;
  draft: BatchStockEntryDraft;
  nowIso?: string;
  createdAt?: string;
}): BatchStockEntryResult {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const createdAt = input.createdAt ?? new Date().toLocaleString("pt-BR");
  const snapshot = normalizeSnapshot(input.snapshotValue);
  const productCode = String(input.draft.productCode ?? "").trim();
  const lotNumber = String(input.draft.lotNumber ?? "").trim();
  const quantity = roundQuantity(Number(input.draft.quantity));
  if (!productCode) throw new Error("Selecione o produto para a entrada de estoque.");
  if (!lotNumber) throw new Error("Informe o lote recebido.");
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("A quantidade recebida deve ser maior que zero.");

  const product = snapshot.catalogProducts?.find((item) => item.productCode === productCode);
  if (!product) throw new Error("Produto não encontrado no estoque principal do PDV.");
  if (product.productKind === "parent") throw new Error("Produto principal não recebe estoque. Faça a entrada em uma variação vendável.");

  const existingBatch = input.store.batches.find((batch) =>
    batch.productCode === productCode
    && batch.lotNumber.trim().toLocaleLowerCase("pt-BR") === lotNumber.toLocaleLowerCase("pt-BR")
  );
  const manufacturedAt = normalizeOptionalDate(input.draft.manufacturedAt) ?? existingBatch?.manufacturedAt;
  const expiresAt = normalizeOptionalDate(input.draft.expiresAt) ?? existingBatch?.expiresAt;
  if (existingBatch?.manufacturedAt && manufacturedAt && existingBatch.manufacturedAt !== manufacturedAt) {
    throw new Error(`O lote ${existingBatch.lotNumber} já possui fabricação ${formatDate(existingBatch.manufacturedAt)}.`);
  }
  if (existingBatch?.expiresAt && expiresAt && existingBatch.expiresAt !== expiresAt) {
    throw new Error(`O lote ${existingBatch.lotNumber} já possui validade ${formatDate(existingBatch.expiresAt)}.`);
  }

  const stockResult = applyPdvStockMovement({
    products: snapshot.catalogProducts ?? [],
    movement: {
      id: createMovementId(productCode, lotNumber, nowIso),
      productCode,
      productName: product.productName,
      type: "entry",
      quantityDelta: quantity,
      reason: String(input.draft.reason ?? `Entrada do lote ${lotNumber}`).trim() || `Entrada do lote ${lotNumber}`,
      createdAt
    }
  });

  const previousQuantity = existingBatch?.quantity ?? 0;
  const previousRemaining = existingBatch?.remainingQuantity ?? 0;
  const upsert = upsertProductBatch(input.store.batches, {
    id: existingBatch?.id,
    productCode,
    lotNumber,
    manufacturedAt,
    expiresAt,
    quantity: roundQuantity(previousQuantity + quantity),
    remainingQuantity: roundQuantity(previousRemaining + quantity)
  }, nowIso);

  const previousExtensions = snapshot.extensions && typeof snapshot.extensions === "object" ? snapshot.extensions : {};
  const previousMovements = Array.isArray(previousExtensions.inventoryMovements) ? previousExtensions.inventoryMovements : [];
  const nextSnapshot: SnapshotValue = {
    ...snapshot,
    catalogProducts: stockResult.products as SnapshotCatalogProduct[],
    extensions: {
      ...previousExtensions,
      inventoryMovements: [stockResult.movement, ...previousMovements].slice(0, 200)
    }
  };
  return {
    snapshot: nextSnapshot,
    store: { ...input.store, updatedAt: nowIso, batches: upsert.batches },
    batch: upsert.batch,
    movement: stockResult.movement
  };
}

export function buildProductExpiryRows(
  batches: ProductBatch[],
  products: Array<{ productCode: string; productName: string }>,
  today = new Date().toISOString().slice(0, 10)
): ProductExpiryRow[] {
  const productNames = new Map(products.map((product) => [product.productCode, product.productName]));
  return batches
    .filter((batch) => Boolean(batch.expiresAt) && batch.remainingQuantity > 0)
    .map((batch) => {
      const expiresAt = batch.expiresAt!;
      const daysUntilExpiry = dateDifferenceDays(today, expiresAt);
      return {
        batchId: batch.id,
        productCode: batch.productCode,
        productName: productNames.get(batch.productCode) ?? batch.productCode,
        lotNumber: batch.lotNumber,
        expiresAt,
        remainingQuantity: batch.remainingQuantity,
        daysUntilExpiry,
        bucket: expiryBucket(daysUntilExpiry)
      };
    })
    .sort((left, right) => left.expiresAt.localeCompare(right.expiresAt) || left.productName.localeCompare(right.productName, "pt-BR"));
}

export function summarizeProductExpiry(rows: ProductExpiryRow[]): ProductExpirySummary {
  return rows.reduce<ProductExpirySummary>((summary, row) => {
    if (row.daysUntilExpiry < 0) summary.expired += 1;
    if (row.daysUntilExpiry === 0) summary.today += 1;
    if (row.daysUntilExpiry >= 0 && row.daysUntilExpiry <= 7) summary.sevenDays += 1;
    if (row.daysUntilExpiry >= 0 && row.daysUntilExpiry <= 15) summary.fifteenDays += 1;
    if (row.daysUntilExpiry >= 0 && row.daysUntilExpiry <= 30) summary.thirtyDays += 1;
    return summary;
  }, { expired: 0, today: 0, sevenDays: 0, fifteenDays: 0, thirtyDays: 0 });
}

function normalizeSnapshot(value: unknown): SnapshotValue {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as SnapshotValue : {};
  const catalogProducts = Array.isArray(source.catalogProducts)
    ? source.catalogProducts.filter(isSnapshotProduct).map((product) => ({ ...product }))
    : [];
  return { ...source, catalogProducts };
}

function isSnapshotProduct(value: unknown): value is SnapshotCatalogProduct {
  if (!value || typeof value !== "object") return false;
  const product = value as SnapshotCatalogProduct;
  return Boolean(product.productCode && product.productName && Number.isFinite(Number(product.stock)));
}

function expiryBucket(days: number): ProductExpiryBucket {
  if (days < 0) return "expired";
  if (days === 0) return "today";
  if (days <= 7) return "7d";
  if (days <= 15) return "15d";
  if (days <= 30) return "30d";
  return "later";
}

function dateDifferenceDays(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

function normalizeOptionalDate(value?: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || !Number.isFinite(Date.parse(`${normalized}T00:00:00Z`))) throw new Error("Informe uma data válida para o lote.");
  return normalized;
}

function createMovementId(productCode: string, lotNumber: string, nowIso: string) {
  const compact = `${productCode}-${lotNumber}`.replace(/[^a-z0-9-]/gi, "").slice(0, 30) || "LOTE";
  return `MOV-LOT-${compact}-${String(Date.parse(nowIso) || Date.now())}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function roundQuantity(value: number) {
  return Number(value.toFixed(3));
}
