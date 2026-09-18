export type ProductBarcodeType = "internal" | "gtin" | "manual";
export type ProductBarcodeSymbology = "ean8" | "ean13" | "code128";

export type LabelCatalogProduct = {
  productCode: string;
  productName: string;
  barcode: string;
  unitPrice: number;
  barcodeType?: ProductBarcodeType;
};

export type ProductIdentityMetadata = {
  productCode: string;
  barcode: string;
  barcodeType: ProductBarcodeType;
  updatedAt: string;
};

export type ProductBatch = {
  id: string;
  productCode: string;
  lotNumber: string;
  manufacturedAt?: string;
  expiresAt?: string;
  quantity: number;
  remainingQuantity: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductBatchDraft = {
  id?: string;
  productCode: string;
  lotNumber: string;
  manufacturedAt?: string;
  expiresAt?: string;
  quantity: number;
  remainingQuantity?: number;
};

export type ProductBatchAllocationItem = {
  batchId: string;
  lotNumber: string;
  quantity: number;
  expiresAt?: string;
};

export type ProductSaleBatchAllocation = {
  saleNumber: string;
  finalizedAt: string;
  productCode: string;
  requestedQuantity: number;
  allocatedQuantity: number;
  untrackedQuantity: number;
  allocations: ProductBatchAllocationItem[];
  restoredAt?: string;
};

export type ProductLabelBatchStore = {
  version: 2;
  updatedAt: string;
  fefoStartedAt: string;
  productIdentities: ProductIdentityMetadata[];
  batches: ProductBatch[];
  saleAllocations: ProductSaleBatchAllocation[];
};

export type ProductLabelSizePreset = "40x25" | "50x30" | "60x40" | "custom";

export type ProductLabelDraft = {
  productCode: string;
  batchId?: string;
  lotNumber?: string;
  expiresAt?: string;
  copies: number;
  sizePreset: ProductLabelSizePreset;
  customWidthMm?: number;
  customHeightMm?: number;
  showPrice: boolean;
  showLot: boolean;
  showExpiry: boolean;
};

export type ProductLabelPreview = {
  productCode: string;
  productName: string;
  barcode: string;
  barcodeType: ProductBarcodeType;
  priceText?: string;
  lotText?: string;
  expiryText?: string;
  copies: number;
  widthMm: number;
  heightMm: number;
};

export type ProductBarcodeBar = {
  x: number;
  width: number;
};

export type ProductBarcodeRenderModel = {
  value: string;
  humanReadable: string;
  symbology: ProductBarcodeSymbology;
  moduleCount: number;
  bars: ProductBarcodeBar[];
};

export type ProductBatchExpiryStatus = "expired" | "expiring" | "valid" | "no-expiry";

const BARCODE_TYPES = new Set<ProductBarcodeType>(["internal", "gtin", "manual"]);
const EAN_L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const EAN_G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const EAN_R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const EAN13_PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
];

export function createInternalBarcodeFromProductCode(productCode: string) {
  const base = `789${String(productCode ?? "").replace(/\D/g, "").padStart(9, "0").slice(-9)}`;
  const sum = base.split("").reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return `${base}${(10 - (sum % 10)) % 10}`;
}

export function isValidGtin(barcode: string) {
  const normalized = String(barcode ?? "").trim();
  if (!/^(?:\d{8}|\d{13})$/.test(normalized)) return false;
  const body = normalized.slice(0, -1);
  const expected = Number(normalized.at(-1));
  let sum = 0;
  for (let index = body.length - 1, position = 0; index >= 0; index -= 1, position += 1) {
    sum += Number(body[index]) * (position % 2 === 0 ? 3 : 1);
  }
  return ((10 - (sum % 10)) % 10) === expected;
}

export function inferBarcodeType(productCode: string, barcode: string, declared?: unknown): ProductBarcodeType {
  if (typeof declared === "string" && BARCODE_TYPES.has(declared as ProductBarcodeType)) return declared as ProductBarcodeType;
  const normalized = String(barcode ?? "").trim();
  if (normalized && normalized === createInternalBarcodeFromProductCode(productCode)) return "internal";
  if (isValidGtin(normalized)) return "gtin";
  return "manual";
}

export function normalizeCatalogProductIdentity<T extends LabelCatalogProduct>(product: T): T & { barcodeType: ProductBarcodeType } {
  return {
    ...product,
    barcode: String(product.barcode ?? "").trim(),
    barcodeType: inferBarcodeType(product.productCode, product.barcode, product.barcodeType)
  };
}

export function reconcileProductIdentities(
  products: LabelCatalogProduct[],
  current: ProductIdentityMetadata[],
  updatedAt = new Date().toISOString()
) {
  const previous = new Map(current.map((identity) => [identity.productCode, identity]));
  return products.map((product) => {
    const stored = previous.get(product.productCode);
    const barcode = String(product.barcode ?? "").trim();
    const barcodeType = stored?.barcode === barcode
      ? inferBarcodeType(product.productCode, barcode, stored.barcodeType)
      : inferBarcodeType(product.productCode, barcode, product.barcodeType);
    return { productCode: product.productCode, barcode, barcodeType, updatedAt } satisfies ProductIdentityMetadata;
  });
}

export function normalizeProductBatchStore(value: unknown, updatedAt = new Date().toISOString()): ProductLabelBatchStore {
  const source = value && typeof value === "object" ? value as Partial<ProductLabelBatchStore> & { version?: number } : {};
  const identities = Array.isArray(source.productIdentities)
    ? source.productIdentities.filter(isProductIdentityMetadata).map((identity) => ({ ...identity }))
    : [];
  const batches = Array.isArray(source.batches)
    ? source.batches.filter(isProductBatch).map((batch) => ({ ...batch }))
    : [];
  const saleAllocations = Array.isArray(source.saleAllocations)
    ? source.saleAllocations.filter(isProductSaleBatchAllocation).map((allocation) => ({
      ...allocation,
      allocations: allocation.allocations.map((item) => ({ ...item }))
    }))
    : [];
  const migratedFromV1 = Number(source.version ?? 1) < 2;
  return {
    version: 2,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : updatedAt,
    fefoStartedAt: !migratedFromV1 && typeof source.fefoStartedAt === "string" ? source.fefoStartedAt : updatedAt,
    productIdentities: identities,
    batches,
    saleAllocations
  };
}

export function upsertProductBatch(
  batches: ProductBatch[],
  draft: ProductBatchDraft,
  now = new Date().toISOString()
) {
  const productCode = String(draft.productCode ?? "").trim();
  const lotNumber = String(draft.lotNumber ?? "").trim();
  const quantity = Number(draft.quantity);
  const remainingQuantity = draft.remainingQuantity == null ? quantity : Number(draft.remainingQuantity);
  const manufacturedAt = normalizeDate(draft.manufacturedAt);
  const expiresAt = normalizeDate(draft.expiresAt);

  if (!productCode) throw new Error("Selecione o produto do lote.");
  if (!lotNumber) throw new Error("Informe o número do lote.");
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("A quantidade do lote deve ser maior que zero.");
  if (!Number.isFinite(remainingQuantity) || remainingQuantity < 0 || remainingQuantity > quantity) throw new Error("O saldo do lote deve ficar entre zero e a quantidade recebida.");
  if (manufacturedAt && expiresAt && Date.parse(expiresAt) < Date.parse(manufacturedAt)) throw new Error("A validade não pode ser anterior à fabricação.");

  const duplicate = batches.find((batch) =>
    batch.productCode === productCode
    && batch.lotNumber.trim().toLocaleLowerCase("pt-BR") === lotNumber.toLocaleLowerCase("pt-BR")
    && batch.id !== draft.id
  );
  if (duplicate) throw new Error("Já existe um lote com este número para o produto selecionado.");

  const previous = draft.id ? batches.find((batch) => batch.id === draft.id) : undefined;
  const batch: ProductBatch = {
    id: previous?.id ?? createBatchId(productCode, lotNumber, now),
    productCode,
    lotNumber,
    manufacturedAt,
    expiresAt,
    quantity: roundQuantity(quantity),
    remainingQuantity: roundQuantity(remainingQuantity),
    createdAt: previous?.createdAt ?? now,
    updatedAt: now
  };

  return {
    batch,
    batches: previous ? batches.map((item) => item.id === batch.id ? batch : item) : [batch, ...batches]
  };
}

export function buildProductLabelPreview(
  product: LabelCatalogProduct,
  draft: ProductLabelDraft,
  batch?: ProductBatch
): ProductLabelPreview {
  const size = resolveProductLabelSize(draft.sizePreset, draft.customWidthMm, draft.customHeightMm);
  const lotNumber = String(draft.lotNumber ?? batch?.lotNumber ?? "").trim();
  const expiresAt = normalizeDate(draft.expiresAt ?? batch?.expiresAt);
  return {
    productCode: product.productCode,
    productName: product.productName,
    barcode: String(product.barcode ?? "").trim(),
    barcodeType: inferBarcodeType(product.productCode, product.barcode, product.barcodeType),
    priceText: draft.showPrice ? formatCurrency(product.unitPrice) : undefined,
    lotText: draft.showLot && lotNumber ? lotNumber : undefined,
    expiryText: draft.showExpiry && expiresAt ? formatDateForLabel(expiresAt) : undefined,
    copies: Math.max(1, Math.min(999, Math.floor(Number(draft.copies) || 1))),
    widthMm: size.widthMm,
    heightMm: size.heightMm
  };
}

export function buildProductBarcodeRenderModel(product: Pick<LabelCatalogProduct, "productCode" | "barcode" | "barcodeType">): ProductBarcodeRenderModel {
  const barcodeType = inferBarcodeType(product.productCode, product.barcode, product.barcodeType);
  const rawBarcode = String(product.barcode ?? "").trim();
  const value = rawBarcode || createInternalBarcodeFromProductCode(product.productCode);
  const symbology: ProductBarcodeSymbology = barcodeType !== "manual" && isValidGtin(value)
    ? value.length === 8 ? "ean8" : "ean13"
    : "code128";
  const bits = symbology === "ean13"
    ? encodeEan13(value)
    : symbology === "ean8"
      ? encodeEan8(value)
      : encodeCode128B(value);
  return {
    value,
    humanReadable: value,
    symbology,
    moduleCount: bits.length,
    bars: bitsToBars(bits)
  };
}

export function allocateProductBatchesFefo(
  batches: ProductBatch[],
  productCode: string,
  requestedQuantity: number,
  today = new Date().toISOString().slice(0, 10),
  updatedAt = new Date().toISOString()
) {
  const requested = roundQuantity(Math.max(0, Number(requestedQuantity) || 0));
  let remaining = requested;
  const candidates = batches
    .filter((batch) => batch.productCode === productCode && batch.remainingQuantity > 0 && !isBatchExpired(batch, today))
    .sort(compareBatchesForFefo);
  const allocated = new Map<string, number>();
  const allocations: ProductBatchAllocationItem[] = [];

  for (const batch of candidates) {
    if (remaining <= 0) break;
    const quantity = roundQuantity(Math.min(batch.remainingQuantity, remaining));
    if (quantity <= 0) continue;
    allocated.set(batch.id, quantity);
    allocations.push({ batchId: batch.id, lotNumber: batch.lotNumber, quantity, expiresAt: batch.expiresAt });
    remaining = roundQuantity(Math.max(0, remaining - quantity));
  }

  const nextBatches = batches.map((batch) => {
    const quantity = allocated.get(batch.id);
    if (!quantity) return batch;
    return { ...batch, remainingQuantity: roundQuantity(Math.max(0, batch.remainingQuantity - quantity)), updatedAt };
  });
  const allocatedQuantity = roundQuantity(requested - remaining);
  return { batches: nextBatches, allocations, allocatedQuantity, untrackedQuantity: remaining };
}

export function restoreProductBatchAllocation(
  batches: ProductBatch[],
  allocations: ProductBatchAllocationItem[],
  updatedAt = new Date().toISOString()
) {
  const byId = new Map(allocations.map((item) => [item.batchId, Number(item.quantity) || 0]));
  return batches.map((batch) => {
    const restore = byId.get(batch.id);
    if (!restore) return batch;
    return {
      ...batch,
      remainingQuantity: roundQuantity(Math.min(batch.quantity, batch.remainingQuantity + restore)),
      updatedAt
    };
  });
}

export function isBatchExpired(batch: Pick<ProductBatch, "expiresAt">, today = new Date().toISOString().slice(0, 10)) {
  return Boolean(batch.expiresAt && batch.expiresAt < today);
}

export function getBatchExpiryStatus(
  batch: Pick<ProductBatch, "expiresAt">,
  today = new Date().toISOString().slice(0, 10),
  warningDays = 30
): ProductBatchExpiryStatus {
  if (!batch.expiresAt) return "no-expiry";
  if (batch.expiresAt < today) return "expired";
  const diffDays = Math.ceil((Date.parse(`${batch.expiresAt}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  return diffDays <= warningDays ? "expiring" : "valid";
}

export function sortBatchesForFefo(batches: ProductBatch[]) {
  return [...batches].sort(compareBatchesForFefo);
}

export function resolveProductLabelSize(
  preset: ProductLabelSizePreset,
  customWidthMm?: number,
  customHeightMm?: number
) {
  if (preset === "50x30") return { widthMm: 50, heightMm: 30 };
  if (preset === "60x40") return { widthMm: 60, heightMm: 40 };
  if (preset === "custom") {
    const widthMm = Number(customWidthMm);
    const heightMm = Number(customHeightMm);
    return {
      widthMm: Number.isFinite(widthMm) && widthMm >= 20 && widthMm <= 150 ? widthMm : 40,
      heightMm: Number.isFinite(heightMm) && heightMm >= 15 && heightMm <= 100 ? heightMm : 25
    };
  }
  return { widthMm: 40, heightMm: 25 };
}

export function formatDateForLabel(value: string) {
  const normalized = normalizeDate(value);
  if (!normalized) return "";
  const [year, month, day] = normalized.split("-");
  return `${day}/${month}/${year}`;
}

function encodeEan13(value: string) {
  if (!/^\d{13}$/.test(value) || !isValidGtin(value)) throw new Error("EAN-13 inválido para a etiqueta.");
  const first = Number(value[0]);
  const parity = EAN13_PARITY[first];
  let bits = "101";
  for (let index = 1; index <= 6; index += 1) {
    const digit = Number(value[index]);
    bits += parity[index - 1] === "G" ? EAN_G[digit] : EAN_L[digit];
  }
  bits += "01010";
  for (let index = 7; index <= 12; index += 1) bits += EAN_R[Number(value[index])];
  return `${bits}101`;
}

function encodeEan8(value: string) {
  if (!/^\d{8}$/.test(value) || !isValidGtin(value)) throw new Error("EAN-8 inválido para a etiqueta.");
  let bits = "101";
  for (let index = 0; index < 4; index += 1) bits += EAN_L[Number(value[index])];
  bits += "01010";
  for (let index = 4; index < 8; index += 1) bits += EAN_R[Number(value[index])];
  return `${bits}101`;
}

function encodeCode128B(input: string) {
  const normalized = String(input ?? "").trim();
  if (!normalized) throw new Error("Informe um código para gerar a etiqueta.");
  const values = Array.from(normalized).map((character) => {
    const code = character.charCodeAt(0);
    if (code < 32 || code > 126) throw new Error("Code 128 aceita caracteres ASCII imprimíveis neste PDV.");
    return code - 32;
  });
  const startCode = 104;
  const checksum = (startCode + values.reduce((sum, code, index) => sum + code * (index + 1), 0)) % 103;
  const sequence = [startCode, ...values, checksum, 106];
  let bits = "";
  for (const code of sequence) {
    const pattern = CODE128_PATTERNS[code];
    let black = true;
    for (const widthText of pattern) {
      bits += (black ? "1" : "0").repeat(Number(widthText));
      black = !black;
    }
  }
  return bits;
}

function bitsToBars(bits: string) {
  const bars: ProductBarcodeBar[] = [];
  let index = 0;
  while (index < bits.length) {
    if (bits[index] !== "1") {
      index += 1;
      continue;
    }
    const start = index;
    while (index < bits.length && bits[index] === "1") index += 1;
    bars.push({ x: start, width: index - start });
  }
  return bars;
}

function compareBatchesForFefo(left: ProductBatch, right: ProductBatch) {
  const leftExpiry = left.expiresAt || "9999-12-31";
  const rightExpiry = right.expiresAt || "9999-12-31";
  if (leftExpiry !== rightExpiry) return leftExpiry.localeCompare(rightExpiry);
  const leftManufactured = left.manufacturedAt || "9999-12-31";
  const rightManufactured = right.manufacturedAt || "9999-12-31";
  if (leftManufactured !== rightManufactured) return leftManufactured.localeCompare(rightManufactured);
  if (left.createdAt !== right.createdAt) return left.createdAt.localeCompare(right.createdAt);
  return left.lotNumber.localeCompare(right.lotNumber, "pt-BR");
}

function isProductIdentityMetadata(value: unknown): value is ProductIdentityMetadata {
  if (!value || typeof value !== "object") return false;
  const item = value as ProductIdentityMetadata;
  return Boolean(item.productCode && typeof item.barcode === "string" && BARCODE_TYPES.has(item.barcodeType));
}

function isProductBatch(value: unknown): value is ProductBatch {
  if (!value || typeof value !== "object") return false;
  const item = value as ProductBatch;
  return Boolean(
    item.id
    && item.productCode
    && item.lotNumber
    && Number.isFinite(Number(item.quantity))
    && Number(item.quantity) > 0
    && Number.isFinite(Number(item.remainingQuantity))
    && Number(item.remainingQuantity) >= 0
  );
}

function isProductSaleBatchAllocation(value: unknown): value is ProductSaleBatchAllocation {
  if (!value || typeof value !== "object") return false;
  const item = value as ProductSaleBatchAllocation;
  return Boolean(
    item.saleNumber
    && item.productCode
    && Number.isFinite(Number(item.requestedQuantity))
    && Array.isArray(item.allocations)
  );
}

function normalizeDate(value?: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error("Informe as datas no formato válido.");
  const timestamp = Date.parse(`${normalized}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) throw new Error("Informe uma data válida.");
  return normalized;
}

function createBatchId(productCode: string, lotNumber: string, now: string) {
  const productPart = productCode.replace(/[^a-z0-9]/gi, "").slice(-12) || "PROD";
  const lotPart = lotNumber.replace(/[^a-z0-9]/gi, "").slice(-12) || "LOTE";
  const timePart = String(Date.parse(now) || Date.now());
  return `LOT-${productPart}-${lotPart}-${timePart}`;
}

function roundQuantity(value: number) {
  return Number(value.toFixed(3));
}

function formatCurrency(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
