import { applyPdvStockMovement, type PdvStockMovement } from "@nexus-core/database";
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

export function applyBatchStockEntryToSnapshot(input: {
  snapshotValue: unknown;
  store: ProductLabelBatchStore;
  draft: BatchStockEntryDraft;
  nowIso?: string;
  createdAt?: string;
}): BatchStockEntryResult {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const snapshot = cloneObject(input.snapshotValue);
  const products = Array.isArray(snapshot.catalogProducts)
    ? snapshot.catalogProducts.filter(isCatalogProduct).map((product) => ({ ...product }))
    : [];
  const productCode = String(input.draft.productCode ?? "").trim();
  const product = products.find((item) => item.productCode === productCode);
  if (!product) throw new Error("Selecione um produto cadastrado para registrar a entrada.");
  if (String(product.productKind ?? "standard") === "parent") throw new Error("Produto principal não recebe estoque. Selecione uma variação vendável.");

  const quantity = roundQuantity(Number(input.draft.quantity));
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("A quantidade recebida deve ser maior que zero.");

  const createdAt = input.createdAt ?? new Date().toLocaleString("pt-BR");
  const movementResult = applyPdvStockMovement({
    products,
    movement: {
      id: `MOV-LOT-${Date.now()}`,
      productCode,
      productName: product.productName,
      type: "entry",
      quantityDelta: quantity,
      reason: String(input.draft.reason ?? "").trim() || `Entrada do lote ${String(input.draft.lotNumber ?? "").trim()}`,
      createdAt
    }
  });

  const normalizedStore = normalizeProductBatchStore(input.store, nowIso);
  const received = receiveProductBatchQuantity(normalizedStore.batches, {
    productCode,
    lotNumber: input.draft.lotNumber,
    manufacturedAt: input.draft.manufacturedAt,
    expiresAt: input.draft.expiresAt,
    quantity
  }, nowIso);

  const extensions = snapshot.extensions && typeof snapshot.extensions === "object"
    ? { ...(snapshot.extensions as Record<string, unknown>) }
    : {};
  const previousMovements = Array.isArray(extensions.inventoryMovements) ? extensions.inventoryMovements : [];
  extensions.inventoryMovements = [movementResult.movement, ...previousMovements].slice(0, 200);

  return {
    snapshot: {
      ...snapshot,
      updatedAt: nowIso,
      catalogProducts: movementResult.products,
      extensions
    },
    store: {
      ...normalizedStore,
      version: 2,
      updatedAt: nowIso,
      batches: received.batches
    },
    batch: received.batch,
    movement: movementResult.movement
  };
}

export function receiveProductBatchQuantity(
  batches: ProductBatch[],
  draft: {
    productCode: string;
    lotNumber: string;
    manufacturedAt?: string;
    expiresAt?: string;
    quantity: number;
  },
  nowIso = new Date().toISOString()
) {
  const productCode = String(draft.productCode ?? "").trim();
  const lotNumber = String(draft.lotNumber ?? "").trim();
  const quantity = roundQuantity(Number(draft.quantity));
  if (!productCode) throw new Error("Selecione o produto do lote.");
  if (!lotNumber) throw new Error("Informe o número do lote.");
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("A quantidade recebida deve ser maior que zero.");

  const existing = batches.find((batch) =>
    batch.productCode === productCode
    && batch.lotNumber.trim().toLocaleLowerCase("pt-BR") === lotNumber.toLocaleLowerCase("pt-BR")
  );

  if (!existing) {
    return upsertProductBatch(batches, {
      productCode,
      lotNumber,
      manufacturedAt: draft.manufacturedAt,
      expiresAt: draft.expiresAt,
      quantity,
      remainingQuantity: quantity
    }, nowIso);
  }

  const manufacturedAt = mergeBatchDate(existing.manufacturedAt, draft.manufacturedAt, "fabricação", lotNumber);
  const expiresAt = mergeBatchDate(existing.expiresAt, draft.expiresAt, "validade", lotNumber);
  return upsertProductBatch(batches, {
    id: existing.id,
    productCode,
    lotNumber: existing.lotNumber,
    manufacturedAt,
    expiresAt,
    quantity: roundQuantity(existing.quantity + quantity),
    remainingQuantity: roundQuantity(existing.remainingQuantity + quantity)
  }, nowIso);
}

export function getExpiryBucket(expiresAt: string, today = new Date().toISOString().slice(0, 10)): ProductExpiryBucket {
  const days = daysBetweenIsoDates(today, expiresAt);
  if (days < 0) return "expired";
  if (days === 0) return "today";
  if (days <= 7) return "7d";
  if (days <= 15) return "15d";
  if (days <= 30) return "30d";
  return "later";
}

export function buildProductExpiryRows(
  batches: ProductBatch[],
  products: Array<{ productCode: string; productName: string }>,
  today = new Date().toISOString().slice(0, 10)
): ProductExpiryRow[] {
  const productNames = new Map(products.map((product) => [product.productCode, product.productName]));
  return batches
    .filter((batch) => batch.remainingQuantity > 0 && Boolean(batch.expiresAt))
    .map((batch) => {
      const expiresAt = batch.expiresAt as string;
      return {
        batchId: batch.id,
        productCode: batch.productCode,
        productName: productNames.get(batch.productCode) ?? batch.productCode,
        lotNumber: batch.lotNumber,
        expiresAt,
        remainingQuantity: batch.remainingQuantity,
        daysUntilExpiry: daysBetweenIsoDates(today, expiresAt),
        bucket: getExpiryBucket(expiresAt, today)
      } satisfies ProductExpiryRow;
    })
    .sort((left, right) => left.expiresAt.localeCompare(right.expiresAt) || left.productName.localeCompare(right.productName, "pt-BR"));
}

export function summarizeProductExpiry(rows: ProductExpiryRow[]) {
  return rows.reduce((summary, row) => {
    summary[row.bucket] += 1;
    return summary;
  }, { expired: 0, today: 0, "7d": 0, "15d": 0, "30d": 0, later: 0 } as Record<ProductExpiryBucket, number>);
}

function mergeBatchDate(current: string | undefined, incoming: string | undefined, label: string, lotNumber: string) {
  const normalizedIncoming = String(incoming ?? "").trim() || undefined;
  if (current && normalizedIncoming && current !== normalizedIncoming) {
    throw new Error(`O lote ${lotNumber} já possui ${label} ${current}. Edite o lote antes de receber com outra data.`);
  }
  return current ?? normalizedIncoming;
}

function daysBetweenIsoDates(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new Error("Data de validade inválida.");
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

function cloneObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Snapshot do PDV inválido.");
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function isCatalogProduct(value: unknown): value is Record<string, unknown> & { productCode: string; productName: string; stock: number } {
  if (!value || typeof value !== "object") return false;
  const product = value as Record<string, unknown>;
  return Boolean(String(product.productCode ?? "").trim() && String(product.productName ?? "").trim() && Number.isFinite(Number(product.stock)));
}

function roundQuantity(value: number) {
  return Number(value.toFixed(3));
}
