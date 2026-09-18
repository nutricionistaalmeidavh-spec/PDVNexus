import {
  allocateProductBatchesFefo,
  restoreProductBatchAllocation,
  type ProductBatchAllocationItem,
  type ProductLabelBatchStore,
  type ProductSaleBatchAllocation
} from "./productLabels";
import {
  allocateProductBatchExact,
  getBatchPhysicalScansForSaleProduct,
  isBatchPhysicalSaleProductAmbiguous,
  normalizeBatchPhysicalScanLedger,
  type BatchPhysicalScanLedger
} from "./batchPhysicalTracking";

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

export type ProductBatchTrackingMode = "confirmed" | "mixed" | "presumed-fefo" | "exception";
export type TrackedProductSaleBatchAllocation = ProductSaleBatchAllocation & {
  trackingMode: ProductBatchTrackingMode;
  physicallyTrackedQuantity: number;
  trackingExceptionQuantity: number;
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
  now = new Date().toISOString(),
  physicalLedgerValue?: BatchPhysicalScanLedger | unknown
): ProductBatchFefoReconcileResult {
  const snapshot = snapshotValue && typeof snapshotValue === "object" ? snapshotValue as PdvSnapshot : {};
  const physicalLedger = physicalLedgerValue == null ? undefined : normalizeBatchPhysicalScanLedger(physicalLedgerValue, now);
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

  const startedAtMs = parseSnapshotTimestamp(currentStore.fefoStartedAt);
  const existingKeys = new Set(allocations.map(allocationKey));

  for (const sale of sales) {
    const saleNumber = String(sale.number ?? "").trim();
    const finalizedAt = String(sale.finalizedAt ?? "").trim();
    if (!saleNumber || !finalizedAt || cancelledNumbers.has(saleNumber)) continue;
    const finalizedAtMs = parseSnapshotTimestamp(finalizedAt);
    if (Number.isFinite(startedAtMs) && Number.isFinite(finalizedAtMs) && finalizedAtMs < startedAtMs) continue;

    const quantities = aggregateSaleQuantities(sale.items);
    for (const [productCode, requestedQuantity] of quantities) {
      if (!batches.some((batch) => batch.productCode === productCode)) continue;
      const key = `${saleNumber}\u0000${productCode}`;
      if (existingKeys.has(key)) continue;

      const ambiguous = isBatchPhysicalSaleProductAmbiguous(physicalLedger, saleNumber, productCode);
      const scans = ambiguous ? [] : getBatchPhysicalScansForSaleProduct(physicalLedger, saleNumber, productCode).slice(0, Math.ceil(requestedQuantity));
      const exactRequestedQuantity = Math.min(scans.length, requestedQuantity);
      const groupedScans = groupPhysicalScans(scans.slice(0, exactRequestedQuantity));
      const exactAllocations: ProductBatchAllocationItem[] = [];
      let physicallyTrackedQuantity = 0;
      let trackingExceptionQuantity = 0;

      for (const [batchId, quantity] of groupedScans) {
        const exactBatch = batches.find((batch) => batch.id === batchId);
        if (!exactBatch || exactBatch.productCode !== productCode) {
          trackingExceptionQuantity = roundQuantity(trackingExceptionQuantity + quantity);
          continue;
        }
        const exactResult = allocateProductBatchExact(batches, batchId, quantity, now);
        batches = exactResult.batches;
        exactAllocations.push(...exactResult.allocations);
        physicallyTrackedQuantity = roundQuantity(physicallyTrackedQuantity + exactResult.allocatedQuantity);
        trackingExceptionQuantity = roundQuantity(trackingExceptionQuantity + exactResult.untrackedQuantity);
      }

      const genericRequestedQuantity = roundQuantity(Math.max(0, requestedQuantity - exactRequestedQuantity));
      const fefoResult = allocateProductBatchesFefo(
        batches,
        productCode,
        genericRequestedQuantity,
        snapshotDateOnly(finalizedAt, now),
        now
      );
      batches = fefoResult.batches;
      const allAllocations = mergeAllocationItems([...exactAllocations, ...fefoResult.allocations]);
      const allocatedQuantity = roundQuantity(physicallyTrackedQuantity + fefoResult.allocatedQuantity);
      const untrackedQuantity = roundQuantity(trackingExceptionQuantity + fefoResult.untrackedQuantity);
      const trackingMode = resolveTrackingMode({
        ambiguous,
        exactRequestedQuantity,
        genericRequestedQuantity,
        trackingExceptionQuantity
      });
      const allocation: TrackedProductSaleBatchAllocation = {
        saleNumber,
        finalizedAt,
        productCode,
        requestedQuantity,
        allocatedQuantity,
        untrackedQuantity,
        allocations: allAllocations,
        trackingMode,
        physicallyTrackedQuantity,
        trackingExceptionQuantity
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

export function parseSnapshotTimestamp(value: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return Number.NaN;
  if (/^\d{4}-\d{2}-\d{2}T/.test(normalized)) return Date.parse(normalized);
  const brazilian = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (brazilian) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = brazilian;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)).getTime();
  }
  return Date.parse(normalized);
}

function resolveTrackingMode(input: {
  ambiguous: boolean;
  exactRequestedQuantity: number;
  genericRequestedQuantity: number;
  trackingExceptionQuantity: number;
}): ProductBatchTrackingMode {
  if (input.trackingExceptionQuantity > 0) return "exception";
  if (input.ambiguous || input.exactRequestedQuantity <= 0) return "presumed-fefo";
  if (input.genericRequestedQuantity > 0) return "mixed";
  return "confirmed";
}

function groupPhysicalScans(scans: Array<{ batchId: string }>) {
  const grouped = new Map<string, number>();
  for (const scan of scans) grouped.set(scan.batchId, roundQuantity((grouped.get(scan.batchId) ?? 0) + 1));
  return grouped;
}

function mergeAllocationItems(items: ProductBatchAllocationItem[]) {
  const merged = new Map<string, ProductBatchAllocationItem>();
  for (const item of items) {
    const previous = merged.get(item.batchId);
    merged.set(item.batchId, previous ? { ...previous, quantity: roundQuantity(previous.quantity + item.quantity) } : { ...item });
  }
  return [...merged.values()];
}

function snapshotDateOnly(value: string, fallbackIso: string) {
  const normalized = String(value ?? "").trim();
  const isoDate = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDate) return isoDate[1];
  const brazilian = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brazilian) {
    const [, day, month, year] = brazilian;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return String(fallbackIso || new Date().toISOString()).slice(0, 10);
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
