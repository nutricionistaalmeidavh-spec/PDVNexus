import {
  allocateProductBatchesFefo,
  restoreProductBatchAllocation,
  type ProductLabelBatchStore,
  type ProductSaleBatchAllocation
} from "./productLabels";

type SnapshotSaleItem = {
  productCode?: unknown;
  quantity?: unknown;
};

type SnapshotSale = {
  number?: unknown;
  finalizedAt?: unknown;
  items?: unknown;
};

type PdvSnapshot = {
  completedSales?: unknown;
  extensions?: unknown;
};

export type ProductBatchFefoReconcileResult = {
  store: ProductLabelBatchStore;
  changed: boolean;
  allocatedSales: string[];
  restoredSales: string[];
};

export function reconcileProductBatchFefoSnapshot(
  snapshotValue: unknown,
  currentStore: ProductLabelBatchStore,
  now = new Date().toISOString()
): ProductBatchFefoReconcileResult {
  const snapshot = snapshotValue && typeof snapshotValue === "object" ? snapshotValue as PdvSnapshot : {};
  const sales = Array.isArray(snapshot.completedSales) ? snapshot.completedSales.filter(isSnapshotSale) : [];
  const extensions = snapshot.extensions && typeof snapshot.extensions === "object" ? snapshot.extensions as { cancelledSales?: unknown } : {};
  const cancelledSales = Array.isArray(extensions.cancelledSales) ? extensions.cancelledSales.filter(isSnapshotSale) : [];
  const cancelledNumbers = new Set(cancelledSales.map((sale) => String(sale.number ?? "")).filter(Boolean));
  const allocations = currentStore.saleAllocations.map((allocation) => ({ ...allocation, allocations: allocation.allocations.map((item) => ({ ...item })) }));
  let batches = currentStore.batches.map((batch) => ({ ...batch }));
  let changed = false;
  const allocatedSales = new Set<string>();
  const restoredSales = new Set<string>();

  for (let index = 0; index < allocations.length; index += 1) {
    const allocation = allocations[index];
    if (!cancelledNumbers.has(allocation.saleNumber) || allocation.restoredAt) continue;
    batches = restoreProductBatchAllocation(batches, allocation.allocations, now);
    allocations[index] = { ...allocation, restoredAt: now };
    restoredSales.add(allocation.saleNumber);
    changed = true;
  }

  const startedAtMs = Date.parse(currentStore.fefoStartedAt);
  const existingKeys = new Set(allocations.map(allocationKey));

  for (const sale of sales) {
    const saleNumber = String(sale.number ?? "").trim();
    const finalizedAt = String(sale.finalizedAt ?? "").trim();
    if (!saleNumber || !finalizedAt || cancelledNumbers.has(saleNumber)) continue;
    const finalizedAtMs = Date.parse(finalizedAt);
    if (Number.isFinite(startedAtMs) && Number.isFinite(finalizedAtMs) && finalizedAtMs < startedAtMs) continue;

    const quantities = aggregateSaleQuantities(sale.items);
    for (const [productCode, requestedQuantity] of quantities) {
      if (!batches.some((batch) => batch.productCode === productCode)) continue;
      const key = `${saleNumber}\u0000${productCode}`;
      if (existingKeys.has(key)) continue;
      const allocationResult = allocateProductBatchesFefo(batches, productCode, requestedQuantity, finalizedAt.slice(0, 10), now);
      batches = allocationResult.batches;
      const allocation: ProductSaleBatchAllocation = {
        saleNumber,
        finalizedAt,
        productCode,
        requestedQuantity,
        allocatedQuantity: allocationResult.allocatedQuantity,
        untrackedQuantity: allocationResult.untrackedQuantity,
        allocations: allocationResult.allocations
      };
      allocations.push(allocation);
      existingKeys.add(key);
      allocatedSales.add(saleNumber);
      changed = true;
    }
  }

  return {
    store: changed ? { ...currentStore, version: 2, updatedAt: now, batches, saleAllocations: allocations } : currentStore,
    changed,
    allocatedSales: [...allocatedSales],
    restoredSales: [...restoredSales]
  };
}

function aggregateSaleQuantities(itemsValue: unknown) {
  const result = new Map<string, number>();
  if (!Array.isArray(itemsValue)) return result;
  for (const raw of itemsValue) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as SnapshotSaleItem;
    const productCode = String(item.productCode ?? "").trim();
    const quantity = Number(item.quantity);
    if (!productCode || !Number.isFinite(quantity) || quantity <= 0) continue;
    result.set(productCode, roundQuantity((result.get(productCode) ?? 0) + quantity));
  }
  return result;
}

function allocationKey(allocation: ProductSaleBatchAllocation) {
  return `${allocation.saleNumber}\u0000${allocation.productCode}`;
}

function isSnapshotSale(value: unknown): value is SnapshotSale {
  return Boolean(value && typeof value === "object" && String((value as SnapshotSale).number ?? "").trim());
}

function roundQuantity(value: number) {
  return Number(value.toFixed(3));
}
