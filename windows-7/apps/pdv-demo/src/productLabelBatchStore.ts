import { getDesktopPdvStoreBridge } from "@nexus-core/desktop-runtime";
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

export type ProductLabelBatchContext = {
  products: Array<LabelCatalogProduct & { barcodeType: "internal" | "gtin" | "manual" }>;
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
  }));
  const store = { ...stored, version: 2 as const, updatedAt: now, productIdentities: identities };
  await saveProductLabelBatchStore(store);
  return { products: normalizedProducts, store };
}

export async function reconcileProductBatchFefoFromCurrentSnapshot() {
  const snapshotJson = await loadMainPdvSnapshot();
  const snapshot = parseJson(snapshotJson, {});
  const store = await loadProductLabelBatchStore();
  const result = reconcileProductBatchFefoSnapshot(snapshot, store);
  if (result.changed) await saveProductLabelBatchStore(result.store);
  return result;
}

export async function saveProductLabelBatchStore(store: ProductLabelBatchStore) {
  const normalized = normalizeProductBatchStore({ ...store, version: 2, updatedAt: new Date().toISOString() });
  const serialized = JSON.stringify(normalized);
  writeLocal(PRODUCT_LABEL_BATCH_STORE_KEY, serialized);

  const bridge = typeof window !== "undefined" ? window.nexusDesktop?.store : undefined;
  if (bridge) {
    try {
      await bridge.save(PRODUCT_LABEL_BATCH_STORE_KEY, serialized);
    } catch {
      // Windows legados podem não expor SQLite genérico; o fallback local já foi persistido.
    }
  }
  return normalized;
}

async function loadCatalogProducts(): Promise<LabelCatalogProduct[]> {
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
    return [{
      productCode,
      productName,
      barcode: String(product.barcode ?? "").trim(),
      unitPrice: Number(product.unitPrice) || 0,
      barcodeType: typeof product.barcodeType === "string" ? product.barcodeType as LabelCatalogProduct["barcodeType"] : undefined
    }];
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
  const bridge = typeof window !== "undefined" ? window.nexusDesktop?.store : undefined;
  if (bridge) {
    try {
      const row = await bridge.load(PRODUCT_LABEL_BATCH_STORE_KEY);
      if (row?.snapshotJson) return normalizeProductBatchStore(parseJson(row.snapshotJson, {}));
    } catch {
      // Windows legados continuam pelo armazenamento local.
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
  try { window.localStorage.setItem(key, value); } catch { /* armazenamento desktop continua como segunda camada */ }
}

function parseJson(value: string, fallback: unknown) {
  try { return JSON.parse(value); } catch { return fallback; }
}
