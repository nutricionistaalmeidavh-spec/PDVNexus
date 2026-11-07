import { getDesktopPdvStoreBridge } from "@nexus-core/desktop-runtime";
import { applyBatchStockEntryToSnapshot, type BatchStockEntryDraft } from "./batchInventory";
import {
  loadBatchPhysicalScanLedger,
  normalizeBatchPhysicalScanLedger,
  PRODUCT_BATCH_PHYSICAL_SCAN_STORE_KEY,
  saveBatchPhysicalScanLedger,
  type BatchPhysicalScanLedger
} from "./batchPhysicalTracking";
import {
  normalizeCatalogProductIdentity,
  normalizeProductBatchStore,
  reconcileProductIdentities,
  type LabelCatalogProduct,
  type ProductLabelBatchStore
} from "./productLabels";
import { reconcileProductBatchFefoSnapshot } from "./productBatchFefo";

const PDV_STORE_KEY = "nexus-core:pdv-store:v1";
export const PRODUCT_LABEL_BATCH_STORE_KEY = "nexus-core:pdv-label-batches:v1";

export type ProductLabelBatchCatalogProduct = LabelCatalogProduct & {
  barcodeType: "internal" | "gtin" | "manual";
  stock: number;
  unitLabel: string;
  itemType: "unit" | "weight";
  productKind?: "standard" | "parent" | "variant";
};

export type ProductLabelBatchContext = {
  products: ProductLabelBatchCatalogProduct[];
  store: ProductLabelBatchStore;
};

export async function loadProductLabelBatchContext(): Promise<ProductLabelBatchContext> {
  const products = await loadCatalogProducts();
  const stored = await loadProductLabelBatchStore();
  const now = new Date().toISOString();
  const identities = reconcileProductIdentities(products, stored.productIdentities, now);
  const identityByCode = new Map(identities.map((identity) => [identity.productCode, identity]));
  const normalizedProducts = products.map((product) => normalizeCatalogProductIdentity({
    ...product,
    barcodeType: identityByCode.get(product.productCode)?.barcodeType
  })) as ProductLabelBatchCatalogProduct[];
  const store = { ...stored, version: 2 as const, updatedAt: now, productIdentities: identities };
  await saveProductLabelBatchStore(store);
  return { products: normalizedProducts, store };
}

export async function reconcileProductBatchFefoFromCurrentSnapshot() {
  const snapshotJson = await loadMainPdvSnapshot();
  const snapshot = parseJson(snapshotJson, {});
  const store = await loadProductLabelBatchStore();
  const ledger = loadProductBatchPhysicalScanLedger();
  const result = reconcileProductBatchFefoSnapshot(snapshot, store, new Date().toISOString(), ledger);
  if (result.changed) await saveProductLabelBatchStore(result.store);
  return result;
}

export async function commitBatchStockEntry(draft: BatchStockEntryDraft) {
  const desktop = getDesktopPdvStoreBridge();
  const initialRow = desktop ? await desktop.load(PDV_STORE_KEY) : null;
  if (desktop && !initialRow?.snapshotJson) throw new Error("Dados canônicos do PDV indisponíveis; recebimento bloqueado.");
  const originalSnapshotJson = initialRow?.snapshotJson ?? await loadMainPdvSnapshot();
  const expectedRevision = initialRow?.revision ?? 0;
  const originalStore = await loadProductLabelBatchStore();
  const nowIso = new Date().toISOString();
  const result = applyBatchStockEntryToSnapshot({
    snapshotValue: parseJson(originalSnapshotJson, {}),
    store: originalStore,
    draft,
    nowIso,
    createdAt: new Date().toLocaleString("pt-BR")
  });

  // A single CAS transaction now writes stock, movement and lot metadata together.
  const originalExtensions = result.snapshot.extensions && typeof result.snapshot.extensions === "object"
    ? result.snapshot.extensions as Record<string, unknown> : {};
  const unifiedSnapshot = {
    ...result.snapshot,
    extensions: { ...originalExtensions, productLabelBatchStore: result.store }
  };
  await saveMainPdvSnapshot(unifiedSnapshot, expectedRevision);
  return { ...result, snapshot: unifiedSnapshot, store: result.store };
}

export async function saveMainPdvSnapshot(snapshot: unknown, expectedRevision: number) {
  const serialized = typeof snapshot === "string" ? snapshot : JSON.stringify(snapshot);
  const desktop = getDesktopPdvStoreBridge();
  if (desktop) {
    const result = await desktop.save(PDV_STORE_KEY, serialized, expectedRevision);
    return { serialized, revision: result.revision };
  }
  writeLocal(PDV_STORE_KEY, serialized);
  return { serialized, revision: expectedRevision + 1 };
}

export async function saveProductLabelBatchStore(store: ProductLabelBatchStore) {
  const normalized = normalizeProductBatchStore({ ...store, version: 2, updatedAt: new Date().toISOString() });
  const desktop = getDesktopPdvStoreBridge();
  if (desktop) {
    const row = await desktop.load(PDV_STORE_KEY);
    if (!row?.snapshotJson) throw new Error("Banco canônico do PDV indisponível. Lotes não foram gravados.");
    const snapshot = parseJson(row.snapshotJson, {}) as Record<string, unknown>;
    const extensions = snapshot.extensions && typeof snapshot.extensions === "object"
      ? snapshot.extensions as Record<string, unknown> : {};
    await desktop.save(PDV_STORE_KEY, JSON.stringify({
      ...snapshot,
      extensions: { ...extensions, productLabelBatchStore: normalized }
    }), row.revision);
    return normalized;
  }
  writeLocal(PRODUCT_LABEL_BATCH_STORE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function loadProductBatchPhysicalScanLedger(): BatchPhysicalScanLedger {
  if (typeof window === "undefined") return normalizeBatchPhysicalScanLedger({});
  return loadBatchPhysicalScanLedger(window.localStorage);
}

export function saveProductBatchPhysicalScanLedger(ledger: BatchPhysicalScanLedger) {
  if (typeof window === "undefined") return normalizeBatchPhysicalScanLedger(ledger);
  const normalized = saveBatchPhysicalScanLedger(ledger, window.localStorage);
  writeLocal(PRODUCT_BATCH_PHYSICAL_SCAN_STORE_KEY, JSON.stringify(normalized));
  return normalized;
}

async function loadCatalogProducts(): Promise<ProductLabelBatchCatalogProduct[]> {
  const raw = await loadMainPdvSnapshot();
  const parsed = parseJson(raw, {});
  const candidates = parsed && typeof parsed === "object" && Array.isArray((parsed as { catalogProducts?: unknown[] }).catalogProducts)
    ? (parsed as { catalogProducts: unknown[] }).catalogProducts
    : [];

  return candidates.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const product = value as Record<string, unknown>;
    const productCode = String(product.productCode ?? "").trim();
    const productName = String(product.productName ?? "").trim();
    if (!productCode || !productName) return [];
    const itemType = product.itemType === "weight" ? "weight" : "unit";
    const rawKind = String(product.productKind ?? "standard");
    const productKind = rawKind === "parent" || rawKind === "variant" ? rawKind : "standard";
    return [{
      productCode,
      productName,
      barcode: String(product.barcode ?? "").trim(),
      unitPrice: Number(product.unitPrice) || 0,
      stock: Number(product.stock) || 0,
      unitLabel: String(product.unitLabel ?? (itemType === "weight" ? "KG" : "UN")),
      itemType,
      productKind,
      barcodeType: typeof product.barcodeType === "string" ? product.barcodeType as ProductLabelBatchCatalogProduct["barcodeType"] : undefined
    } as ProductLabelBatchCatalogProduct];
  });
}

export async function loadMainPdvSnapshot() {
  const desktop = getDesktopPdvStoreBridge();
  if (desktop) {
    try {
      const row = await desktop.load(PDV_STORE_KEY);
      if (row?.snapshotJson) return row.snapshotJson;
    } catch {
      // Fallback para o snapshot local do navegador/Electron.
    }
  }
  return readLocal(PDV_STORE_KEY) ?? "{}";
}

export async function loadProductLabelBatchStore() {
  const desktop = getDesktopPdvStoreBridge();
  if (desktop) {
    const row = await desktop.load(PDV_STORE_KEY);
    if (row?.snapshotJson) {
      const snapshot = parseJson(row.snapshotJson, {}) as { extensions?: { productLabelBatchStore?: unknown } };
      if (snapshot.extensions?.productLabelBatchStore) {
        return normalizeProductBatchStore(snapshot.extensions.productLabelBatchStore);
      }
    }
    // One-time read-only fallback: old installations kept batch metadata in the app store.
    // The next explicit batch save migrates it to the canonical PDV snapshot.
  }
  const bridge = typeof window !== "undefined" ? window.nexusDesktop?.store : undefined;
  if (bridge) {
    try {
      const row = await bridge.load(PRODUCT_LABEL_BATCH_STORE_KEY);
      if (row?.snapshotJson) return normalizeProductBatchStore(parseJson(row.snapshotJson, {}));
    } catch {
      // Windows legados continuam pelo armazenamento local quando o bridge não puder ler.
    }
  }
  return normalizeProductBatchStore(parseJson(readLocal(PRODUCT_LABEL_BATCH_STORE_KEY) ?? "{}", {}));
}

function readLocal(key: string) {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function writeLocal(key: string, value: string) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, value); } catch { /* SQLite desktop permanece como camada principal */ }
}

function parseJson(value: string, fallback: unknown) {
  try { return JSON.parse(value); } catch { return fallback; }
}
