const OBSERVATIONS_STORAGE_KEY = "nexus-core:pdv-sale-observations:v1";
const PDV_STORE_KEY = "nexus-core:pdv-store:v1";
const MAX_OBSERVATION_LENGTH = 500;
const RECEIPT_SECTION_TITLE = "OBSERVACOES DA VENDA";

export interface SaleObservationRecord {
  saleNumber: string;
  customerId?: string;
  customerName?: string;
  note: string;
  printOnReceipt: boolean;
  updatedAt: string;
}

type SaleObservationMap = Record<string, SaleObservationRecord>;
type SaleLike = {
  number?: unknown;
  customerId?: unknown;
  observation?: unknown;
  printObservation?: unknown;
};

type SnapshotLike = {
  completedSales?: unknown;
  updatedAt?: unknown;
  extensions?: {
    cancelledSales?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function safeLocalStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function sanitizeObservation(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .slice(0, MAX_OBSERVATION_LENGTH);
}

function normalizeSaleNumber(value: unknown) {
  return String(value ?? "").trim();
}

function parseObservationMap(raw: string | null): SaleObservationMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: SaleObservationMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const candidate = value as Partial<SaleObservationRecord>;
      const saleNumber = normalizeSaleNumber(candidate.saleNumber || key);
      if (!saleNumber) continue;
      result[saleNumber] = {
        saleNumber,
        customerId: candidate.customerId ? String(candidate.customerId) : undefined,
        customerName: candidate.customerName ? String(candidate.customerName) : undefined,
        note: sanitizeObservation(candidate.note),
        printOnReceipt: Boolean(candidate.printOnReceipt),
        updatedAt: candidate.updatedAt ? String(candidate.updatedAt) : new Date(0).toISOString()
      };
    }
    return result;
  } catch {
    return {};
  }
}

function loadObservationMap() {
  return parseObservationMap(safeLocalStorage()?.getItem(OBSERVATIONS_STORAGE_KEY) ?? null);
}

function writeObservationMap(map: SaleObservationMap) {
  try {
    safeLocalStorage()?.setItem(OBSERVATIONS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // A venda continua funcionando se o armazenamento do navegador estiver indisponivel.
  }
}

export function getSaleObservation(saleNumber: string) {
  const normalized = normalizeSaleNumber(saleNumber);
  if (!normalized) return undefined;
  return loadObservationMap()[normalized];
}

export function saveSaleObservationDraft(input: {
  saleNumber: string;
  customerId?: string;
  customerName?: string;
  note: string;
  printOnReceipt: boolean;
}) {
  const saleNumber = normalizeSaleNumber(input.saleNumber);
  if (!saleNumber || saleNumber === "------") return undefined;

  const map = loadObservationMap();
  const record: SaleObservationRecord = {
    saleNumber,
    customerId: input.customerId?.trim() || undefined,
    customerName: input.customerName?.trim() || undefined,
    note: sanitizeObservation(input.note),
    printOnReceipt: Boolean(input.printOnReceipt),
    updatedAt: new Date().toISOString()
  };
  map[saleNumber] = record;
  writeObservationMap(map);
  return record;
}

function recordsFromSales(value: unknown): SaleObservationMap {
  const result: SaleObservationMap = {};
  if (!Array.isArray(value)) return result;

  for (const rawSale of value) {
    if (!rawSale || typeof rawSale !== "object" || Array.isArray(rawSale)) continue;
    const sale = rawSale as SaleLike;
    const saleNumber = normalizeSaleNumber(sale.number);
    const note = sanitizeObservation(sale.observation);
    if (!saleNumber || !note) continue;
    result[saleNumber] = {
      saleNumber,
      customerId: sale.customerId ? String(sale.customerId) : undefined,
      note,
      printOnReceipt: Boolean(sale.printObservation),
      updatedAt: new Date(0).toISOString()
    };
  }
  return result;
}

function hydrateObservationCache(snapshot: SnapshotLike) {
  const current = loadObservationMap();
  const fromCompleted = recordsFromSales(snapshot.completedSales);
  const fromCancelled = recordsFromSales(snapshot.extensions?.cancelledSales);
  let changed = false;

  for (const source of [fromCompleted, fromCancelled]) {
    for (const [saleNumber, record] of Object.entries(source)) {
      const existing = current[saleNumber];
      if (existing?.note) continue;
      current[saleNumber] = record;
      changed = true;
    }
  }

  if (changed) writeObservationMap(current);
}

function hydrateObservationCacheFromBrowserStore() {
  const raw = safeLocalStorage()?.getItem(PDV_STORE_KEY);
  if (!raw) return;
  try {
    const snapshot = JSON.parse(raw) as SnapshotLike;
    if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) hydrateObservationCache(snapshot);
  } catch {
    // Snapshot invalido nao deve impedir a emissao do comprovante.
  }
}

function mergeObservationsIntoSales(value: unknown, map: SaleObservationMap) {
  if (!Array.isArray(value)) return { value, changed: false };
  let changed = false;
  const next = value.map((rawSale) => {
    if (!rawSale || typeof rawSale !== "object" || Array.isArray(rawSale)) return rawSale;
    const sale = rawSale as SaleLike & Record<string, unknown>;
    const saleNumber = normalizeSaleNumber(sale.number);
    const record = map[saleNumber];
    if (!record || !record.note.trim()) return rawSale;
    const note = sanitizeObservation(record.note);
    const printObservation = Boolean(record.printOnReceipt);
    if (sale.observation === note && sale.printObservation === printObservation) return rawSale;
    changed = true;
    return { ...sale, observation: note, printObservation };
  });
  return { value: next, changed };
}

export function mergeSaleObservationsIntoSnapshot(snapshotJson: string) {
  try {
    const snapshot = JSON.parse(snapshotJson) as SnapshotLike;
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      return { snapshotJson, changed: false };
    }

    hydrateObservationCache(snapshot);
    const map = loadObservationMap();
    const completed = mergeObservationsIntoSales(snapshot.completedSales, map);
    const cancelled = mergeObservationsIntoSales(snapshot.extensions?.cancelledSales, map);
    if (!completed.changed && !cancelled.changed) return { snapshotJson, changed: false };

    snapshot.completedSales = completed.value;
    if (snapshot.extensions && cancelled.changed) snapshot.extensions.cancelledSales = cancelled.value;
    snapshot.updatedAt = new Date().toISOString();
    return { snapshotJson: JSON.stringify(snapshot), changed: true };
  } catch {
    return { snapshotJson, changed: false };
  }
}

export function reconcileSaleObservationsToBrowserStore() {
  const storage = safeLocalStorage();
  const browserSnapshot = storage?.getItem(PDV_STORE_KEY);
  if (!browserSnapshot) return false;
  const merged = mergeSaleObservationsIntoSnapshot(browserSnapshot);
  if (!merged.changed) return false;
  try {
    storage?.setItem(PDV_STORE_KEY, merged.snapshotJson);
    return true;
  } catch {
    return false;
  }
}

function resolveReceiptWidth(receipt: string) {
  const separator = receipt.split("\n").find((line) => /^-{20,}$/.test(line.trim()));
  return Math.max(20, Math.min(separator?.trim().length ?? 42, 120));
}

function wrapLine(value: string, width: number) {
  const result: string[] = [];
  let remaining = value.trim();
  if (!remaining) return [""];
  while (remaining.length > width) {
    const candidate = remaining.slice(0, width + 1);
    const breakAt = candidate.lastIndexOf(" ");
    const index = breakAt >= Math.floor(width * 0.55) ? breakAt : width;
    result.push(remaining.slice(0, index).trimEnd());
    remaining = remaining.slice(index).trimStart();
  }
  if (remaining) result.push(remaining);
  return result;
}

function wrapObservation(note: string, width: number) {
  return note
    .split("\n")
    .flatMap((line) => wrapLine(line, width))
    .join("\n");
}

function receiptSaleNumber(receipt: string) {
  const match = receipt.match(/^Venda:\s*(.+?)\s*$/im);
  return normalizeSaleNumber(match?.[1]);
}

export function decorateReceiptWithSaleObservation(receipt: string) {
  if (!receipt || receipt.includes(RECEIPT_SECTION_TITLE)) return receipt;
  hydrateObservationCacheFromBrowserStore();
  const saleNumber = receiptSaleNumber(receipt);
  const record = getSaleObservation(saleNumber);
  if (!record?.printOnReceipt || !record.note.trim()) return receipt;

  const width = resolveReceiptWidth(receipt);
  const divider = "-".repeat(width);
  const section = `${divider}\n${RECEIPT_SECTION_TITLE}\n${wrapObservation(record.note, width)}\n${divider}`;
  const lines = receipt.trimEnd().split("\n");
  const thanksIndex = lines.findIndex((line) => /Obrigado pela preferencia/i.test(line));
  if (thanksIndex >= 0) lines.splice(thanksIndex, 0, section);
  else lines.push(section);
  return `${lines.join("\n")}\n`;
}
