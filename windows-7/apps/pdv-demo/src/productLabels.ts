export type ProductBarcodeType = "internal" | "gtin" | "manual";

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

export type ProductLabelBatchStore = {
  version: 1;
  updatedAt: string;
  productIdentities: ProductIdentityMetadata[];
  batches: ProductBatch[];
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

const BARCODE_TYPES = new Set<ProductBarcodeType>(["internal", "gtin", "manual"]);

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
  const source = value && typeof value === "object" ? value as Partial<ProductLabelBatchStore> : {};
  const identities = Array.isArray(source.productIdentities)
    ? source.productIdentities.filter(isProductIdentityMetadata).map((identity) => ({ ...identity }))
    : [];
  const batches = Array.isArray(source.batches)
    ? source.batches.filter(isProductBatch).map((batch) => ({ ...batch }))
    : [];
  return { version: 1, updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : updatedAt, productIdentities: identities, batches };
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
