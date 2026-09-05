import { defineModule } from "@nexus-core/core";

export type BalanceBarcodeStrategy = "ean13-prefixado" | "custom";
export type BalanceDataMode = "price" | "weight";
export type PosInputSource = "barcode-scanner" | "scale" | "manual";
export type ScaleBrand = "toledo" | "urano" | "generic";
export type ScaleSerialBrand = "toledo" | "filizola" | "generic-request-response" | "generic-streaming";
export type ScaleItemType = "weight" | "unit";
export type UsbDeviceConnectionType = "keyboard-wedge" | "serial" | "hid";
export type UsbDeviceKind = "barcode-scanner" | "scale";
export type ScaleBarcodeProfileKey = "DEFAULT_WEIGHT" | "DEFAULT_PRICE" | "EXTENDED_PRODUCT";
export type BarcodeProfileMode = ScaleBarcodeProfileKey | "legacy-brasil";
export type ScaleSerialStatus = "ok" | "unstable" | "negative" | "overload" | "empty" | "unknown";

export interface UsbDeviceProfile {
  id: string;
  name: string;
  kind: UsbDeviceKind;
  connectionType: UsbDeviceConnectionType;
  vendorId?: number;
  productId?: number;
  baudRate?: number;
  enabled: boolean;
}

export interface BarcodeScannerProfile extends UsbDeviceProfile {
  kind: "barcode-scanner";
  connectionType: "keyboard-wedge" | "hid";
  submitKey: "Enter" | "Tab";
}

export interface UsbScaleDeviceProfile extends UsbDeviceProfile {
  kind: "scale";
  connectionType: "serial" | "hid" | "keyboard-wedge";
  weightUnit: "kg" | "g";
  decimalPlaces: number;
}

export interface ScaleWeightReading {
  source: "scale";
  raw: string;
  weightKg: number;
  stable: boolean;
}

export interface ScaleProfile {
  id: string;
  name: string;
  brand: ScaleBrand;
  codePrefix: string;
  barcodeStrategy: BalanceBarcodeStrategy;
  dataMode: BalanceDataMode;
  priceEmbedded: boolean;
  weightEmbedded: boolean;
  dateEmbedded: boolean;
  skuLength: number;
}

export interface ScaleProductRecord {
  productCode: string;
  productName: string;
  unitPrice: number;
  itemType: ScaleItemType;
  shelfLifeDays: number;
}

export interface WeighedProductLabel {
  productCode: string;
  productName: string;
  barcode: string;
  weightKg: number;
  unitPrice: number;
  totalPrice: number;
  packedAt: string;
}

export interface BalanceReadingResult {
  barcode: string;
  prefix: string;
  productCode: string;
  dataMode: BalanceDataMode;
  embeddedValueRaw: string;
  weightKg?: number;
  unitPrice?: number;
  totalPrice?: number;
  packedAt?: string;
}

export interface ResolvedSaleItem {
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  barcode: string;
  source: "scale";
}

export interface PosResolvedInput {
  source: PosInputSource;
  barcode?: string;
  saleItem?: ResolvedSaleItem;
  weightReading?: ScaleWeightReading;
}

export interface ToledoExportRecord {
  itemType: ScaleItemType;
  productCode: string;
  unitPrice: number;
  shelfLifeDays: number;
  productName: string;
}

export interface UranoExportRecord {
  itemType: ScaleItemType;
  productCode: string;
  productName: string;
  unitPrice: number;
}

export interface ScaleBarcodeProfile {
  key: ScaleBarcodeProfileKey;
  name: string;
  prefix: string;
  prefixLength: number;
  productCodeStart: number;
  productCodeLength: number;
  valueStart: number;
  valueLength: number;
  valueType: BalanceDataMode;
  decimalPlaces: number;
}

export interface DecodedScaleBarcode {
  isWeighted: boolean;
  barcode: string;
  valid?: boolean;
  productCode?: string;
  checkDigit?: string;
  price?: number;
  weight?: number;
}

export interface GenericRequestResponseParseOptions {
  startDelimiter?: string;
  endDelimiters?: string[];
  unstableChars?: string;
  negativeChars?: string;
  overloadChars?: string;
  decimalDivisorIfInteger?: number;
}

export interface ScaleSerialReading {
  brand: ScaleSerialBrand;
  raw: string;
  status: ScaleSerialStatus;
  stable: boolean;
  weightKg: number;
  totalPrice?: number;
  unitPrice?: number;
}

export const balancaModule = defineModule({
  key: "balanca",
  name: "Balanca e Etiquetas",
  description: "Configuracao de balancas, emissao de etiquetas e leitura de codigo de barras para vendas por peso.",
  routes: [{ key: "balanca-config", label: "Balanca", path: "/balanca", icon: "KG" }],
  entities: ["scaleProfile", "weighedProduct", "weighedLabel", "barcodeRule", "usbDeviceProfile"],
  reusable: true
});

export const keyboardWedgeScannerProfile: BarcodeScannerProfile = {
  id: "usb-scanner-keyboard",
  name: "Leitor USB modo teclado",
  kind: "barcode-scanner",
  connectionType: "keyboard-wedge",
  submitKey: "Enter",
  enabled: true
};

export const genericUsbScaleProfile: UsbScaleDeviceProfile = {
  id: "usb-scale-generic",
  name: "Balanca USB generica",
  kind: "scale",
  connectionType: "serial",
  baudRate: 9600,
  weightUnit: "kg",
  decimalPlaces: 3,
  enabled: true
};

export const defaultBrazilianScaleProfile: ScaleProfile = {
  id: "generic-br-ean13",
  name: "EAN-13 Balanca Brasil",
  brand: "generic",
  codePrefix: "2",
  barcodeStrategy: "ean13-prefixado",
  dataMode: "price",
  priceEmbedded: true,
  weightEmbedded: false,
  dateEmbedded: false,
  skuLength: 5
};

export const toledoDefaultProfile: ScaleProfile = {
  ...defaultBrazilianScaleProfile,
  id: "toledo-mgv",
  name: "Toledo MGV",
  brand: "toledo"
};

export const uranoDefaultProfile: ScaleProfile = {
  ...defaultBrazilianScaleProfile,
  id: "urano-integra",
  name: "Urano Integra",
  brand: "urano"
};

export const SCALE_BARCODE_PROFILES: Record<ScaleBarcodeProfileKey, ScaleBarcodeProfile> = {
  DEFAULT_WEIGHT: {
    key: "DEFAULT_WEIGHT",
    name: "Peso embutido",
    prefix: "2",
    prefixLength: 1,
    productCodeStart: 1,
    productCodeLength: 5,
    valueStart: 6,
    valueLength: 6,
    valueType: "weight",
    decimalPlaces: 3
  },
  DEFAULT_PRICE: {
    key: "DEFAULT_PRICE",
    name: "Preco embutido",
    prefix: "2",
    prefixLength: 1,
    productCodeStart: 1,
    productCodeLength: 5,
    valueStart: 6,
    valueLength: 6,
    valueType: "price",
    decimalPlaces: 2
  },
  EXTENDED_PRODUCT: {
    key: "EXTENDED_PRODUCT",
    name: "Produto estendido",
    prefix: "20",
    prefixLength: 2,
    productCodeStart: 2,
    productCodeLength: 4,
    valueStart: 6,
    valueLength: 6,
    valueType: "price",
    decimalPlaces: 2
  }
};

export const SCALE_REQUEST_COMMANDS: Record<ScaleSerialBrand, string> = {
  toledo: "\x05",
  filizola: "\x05",
  "generic-request-response": "\x05",
  "generic-streaming": ""
};

export function calculateTotalPrice(weightKg: number, unitPrice: number) {
  return roundCurrency(weightKg * unitPrice);
}

export function calculateWeightFromTotalPrice(totalPrice: number, unitPrice: number) {
  if (unitPrice <= 0) {
    throw new Error("Preco por kg deve ser maior que zero para calcular o peso.");
  }

  return roundWeight(totalPrice / unitPrice);
}

export function buildWeighedLabel(input: {
  productCode: string;
  productName: string;
  barcode: string;
  weightKg: number;
  unitPrice: number;
  packedAt: string;
}): WeighedProductLabel {
  return {
    ...input,
    totalPrice: calculateTotalPrice(input.weightKg, input.unitPrice)
  };
}

export function getScaleBarcodeProfile(profile: ScaleBarcodeProfileKey | ScaleBarcodeProfile) {
  if (typeof profile === "string") {
    return SCALE_BARCODE_PROFILES[profile];
  }

  return profile;
}

export function encodeScaleBarcode(productCode: string, value: number, profile: ScaleBarcodeProfileKey | ScaleBarcodeProfile) {
  const resolvedProfile = getScaleBarcodeProfile(profile);
  const paddedProduct = String(productCode).padStart(resolvedProfile.productCodeLength, "0");

  if (paddedProduct.length > resolvedProfile.productCodeLength) {
    throw new Error(`Codigo de produto ${productCode} excede ${resolvedProfile.productCodeLength} digitos.`);
  }

  const scaledValue = Math.round(value * Math.pow(10, resolvedProfile.decimalPlaces));
  const paddedValue = String(scaledValue).padStart(resolvedProfile.valueLength, "0");

  if (paddedValue.length > resolvedProfile.valueLength) {
    throw new Error(`Valor ${value} excede a capacidade do perfil ${resolvedProfile.key}.`);
  }

  const partial = `${resolvedProfile.prefix}${paddedProduct}${paddedValue}`;
  return `${partial}${calculateEan13Checksum(partial)}`;
}

export function decodeScaleBarcode(barcode: string, profile: ScaleBarcodeProfileKey | ScaleBarcodeProfile): DecodedScaleBarcode {
  const resolvedProfile = getScaleBarcodeProfile(profile);
  const normalized = barcode.trim();

  if (!/^\d{13}$/.test(normalized)) {
    throw new Error(`EAN-13 invalido: ${barcode}`);
  }

  const prefix = normalized.substring(0, resolvedProfile.prefixLength);

  if (prefix !== resolvedProfile.prefix) {
    return { isWeighted: false, barcode: normalized };
  }

  const productCode = normalized.substr(resolvedProfile.productCodeStart, resolvedProfile.productCodeLength);
  const rawValue = normalized.substr(resolvedProfile.valueStart, resolvedProfile.valueLength);
  const value = Number(rawValue) / Math.pow(10, resolvedProfile.decimalPlaces);
  const valid = validateEan13Checksum(normalized);
  const result: DecodedScaleBarcode = {
    isWeighted: true,
    barcode: normalized,
    productCode,
    checkDigit: normalized[12],
    valid
  };

  if (resolvedProfile.valueType === "price") {
    result.price = value;
  } else {
    result.weight = value;
  }

  return result;
}

export function parseScaleBarcode(
  barcode: string,
  options?: {
    expectedPrefix?: string;
    dataMode?: BalanceDataMode;
  }
): BalanceReadingResult {
  const normalized = barcode.trim();
  const expectedPrefix = options?.expectedPrefix ?? "2";
  const dataMode = options?.dataMode ?? "price";

  if (!/^\d{13}$/.test(normalized)) {
    throw new Error("Codigo de balanca invalido: esperado EAN-13 com 13 digitos numericos.");
  }

  if (normalized[0] !== expectedPrefix) {
    throw new Error(`Prefixo invalido para balanca. Esperado ${expectedPrefix}.`);
  }

  const productCode = normalized.slice(1, 6);
  const embeddedValueRaw = normalized.slice(7, 12);
  const result: BalanceReadingResult = {
    barcode: normalized,
    prefix: normalized[0],
    productCode,
    dataMode,
    embeddedValueRaw
  };

  if (dataMode === "price") {
    result.totalPrice = roundCurrency(Number(embeddedValueRaw) / 100);
    return result;
  }

  result.weightKg = roundWeight(Number(embeddedValueRaw) / 1000);
  return result;
}

export function resolveSaleItemFromBarcode(input: {
  barcode: string;
  product: ScaleProductRecord;
  profile?: Pick<ScaleProfile, "codePrefix" | "dataMode">;
}): ResolvedSaleItem {
  const parsed = parseScaleBarcode(input.barcode, {
    expectedPrefix: input.profile?.codePrefix ?? "2",
    dataMode: input.profile?.dataMode ?? "price"
  });

  if (parsed.productCode !== input.product.productCode.padStart(5, "0").slice(-5)) {
    throw new Error("Codigo lido nao corresponde ao produto informado.");
  }

  let quantity = 0;
  let totalPrice = 0;

  if (parsed.dataMode === "price") {
    totalPrice = parsed.totalPrice ?? 0;
    quantity = calculateWeightFromTotalPrice(totalPrice, input.product.unitPrice);
  } else {
    quantity = parsed.weightKg ?? 0;
    totalPrice = calculateTotalPrice(quantity, input.product.unitPrice);
  }

  return {
    productCode: input.product.productCode,
    productName: input.product.productName,
    quantity,
    unitPrice: input.product.unitPrice,
    totalPrice,
    barcode: parsed.barcode,
    source: "scale"
  };
}

export function resolvePosInputFromBarcode(input: {
  barcode: string;
  products: ScaleProductRecord[];
  profile?: Pick<ScaleProfile, "codePrefix" | "dataMode">;
}): PosResolvedInput {
  const parsed = parseScaleBarcode(input.barcode, {
    expectedPrefix: input.profile?.codePrefix ?? "2",
    dataMode: input.profile?.dataMode ?? "price"
  });
  const product = input.products.find((item) => item.productCode.padStart(5, "0").slice(-5) === parsed.productCode);

  if (!product) {
    throw new Error(`Produto ${parsed.productCode} nao encontrado para lancamento no PDV.`);
  }

  return {
    source: "barcode-scanner",
    barcode: input.barcode,
    saleItem: resolveSaleItemFromBarcode({
      barcode: input.barcode,
      product,
      profile: input.profile
    })
  };
}

export function resolvePosInputFromScaleBarcodeProfile(input: {
  barcode: string;
  products: ScaleProductRecord[];
  profile: ScaleBarcodeProfileKey | ScaleBarcodeProfile;
}): PosResolvedInput {
  const resolvedProfile = getScaleBarcodeProfile(input.profile);
  const decoded = decodeScaleBarcode(input.barcode, resolvedProfile);

  if (!decoded.isWeighted || !decoded.productCode) {
    return {
      source: "barcode-scanner",
      barcode: input.barcode
    };
  }

  if (decoded.valid === false) {
    throw new Error("Codigo EAN-13 invalido: checksum inconsistente.");
  }

  const product = input.products.find((item) => item.productCode.padStart(resolvedProfile.productCodeLength, "0").slice(-resolvedProfile.productCodeLength) === decoded.productCode);

  if (!product) {
    throw new Error(`Produto ${decoded.productCode} nao encontrado para o perfil ${resolvedProfile.key}.`);
  }

  const quantity = decoded.weight ?? calculateWeightFromTotalPrice(decoded.price ?? 0, product.unitPrice);
  const totalPrice = decoded.price ?? calculateTotalPrice(quantity, product.unitPrice);

  return {
    source: "barcode-scanner",
    barcode: input.barcode,
    saleItem: {
      productCode: product.productCode,
      productName: product.productName,
      quantity: roundWeight(quantity),
      unitPrice: product.unitPrice,
      totalPrice: roundCurrency(totalPrice),
      barcode: input.barcode,
      source: "scale"
    }
  };
}

export function parseUsbScaleWeight(raw: string, profile: Pick<UsbScaleDeviceProfile, "weightUnit" | "decimalPlaces">) {
  const normalized = raw.replace(",", ".");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);

  if (!match) {
    throw new Error("Leitura da balanca USB nao contem peso numerico.");
  }

  const numeric = Number(match[0]);
  const weightKg = profile.weightUnit === "g" ? numeric / 1000 : numeric;

  return {
    source: "scale",
    raw,
    weightKg: roundWeight(weightKg),
    stable: !/[?]/.test(raw)
  } satisfies ScaleWeightReading;
}

export function parseToledoSerialResponse(raw: string): ScaleSerialReading {
  let response = "";
  let decimalDivisor = 1000;
  let totalPrice: number | undefined;
  let unitPrice: number | undefined;

  if (raw.length > 20) {
    const statusByte = raw.charCodeAt(8);
    if ((statusByte & (1 << 3)) !== 0) {
      decimalDivisor = 100;
    }
    response = raw.substring(2, 8).trim();
    const totalRaw = raw.substring(9, 15).trim();
    const unitRaw = raw.substring(15, 21).trim();
    if (/^\d+$/.test(totalRaw)) {
      totalPrice = roundCurrency(Number(totalRaw) / 100);
    }
    if (/^\d+$/.test(unitRaw)) {
      unitPrice = roundCurrency(Number(unitRaw) / 100);
    }
  } else {
    const frame = extractDelimitedFrame(raw, "\x02", ["\x03", "\r"]);
    response = frame.payload;
  }

  return buildSerialReading("toledo", raw, response, {
    decimalDivisorIfInteger: decimalDivisor,
    totalPrice,
    unitPrice
  });
}

export function parseFilizolaSerialResponse(raw: string): ScaleSerialReading {
  const frame = extractDelimitedFrame(raw, "\x02", ["\x03", "\r"]);
  const payload = frame.payload;

  if (!payload) {
    return buildEmptySerialReading("filizola", raw);
  }

  const normalized = payload.replace(",", ".");
  let weightKg = Number.NaN;

  if (normalized.length > 10) {
    weightKg = parseFloat(normalized.substring(0, 6)) / 1000;
  } else if (normalized.includes(".")) {
    weightKg = parseFloat(normalized);
  } else {
    weightKg = parseInt(normalized, 10) / 1000;
  }

  if (!Number.isNaN(weightKg)) {
    return {
      brand: "filizola",
      raw,
      status: "ok",
      stable: true,
      weightKg: roundWeight(weightKg)
    };
  }

  return buildStatusReading("filizola", raw, normalized, "I", "N", "S");
}

export function parseGenericRequestResponseScaleResponse(raw: string, options: GenericRequestResponseParseOptions = {}): ScaleSerialReading {
  const frame = extractDelimitedFrame(raw, options.startDelimiter ?? "\x02", options.endDelimiters ?? ["\x03", "\r"]);
  return buildSerialReading("generic-request-response", raw, frame.payload, {
    decimalDivisorIfInteger: options.decimalDivisorIfInteger ?? 1000,
    unstableChars: options.unstableChars ?? "I",
    negativeChars: options.negativeChars ?? "N",
    overloadChars: options.overloadChars ?? "S"
  });
}

export function parseScaleSerialReadingByBrand(
  brand: ScaleSerialBrand,
  raw: string,
  options: GenericRequestResponseParseOptions = {}
): ScaleSerialReading {
  if (brand === "toledo") {
    return parseToledoSerialResponse(raw);
  }

  if (brand === "filizola") {
    return parseFilizolaSerialResponse(raw);
  }

  if (brand === "generic-request-response") {
    return parseGenericRequestResponseScaleResponse(raw, options);
  }

  const usbReading = parseUsbScaleWeight(raw, genericUsbScaleProfile);
  return {
    brand,
    raw,
    status: usbReading.stable ? "ok" : "unstable",
    stable: usbReading.stable,
    weightKg: usbReading.weightKg
  };
}

export function buildToledoItemLine(record: ToledoExportRecord) {
  return [
    record.itemType === "weight" ? "0" : "1",
    padNumeric(record.productCode, 6),
    padNumeric(toCents(record.unitPrice), 6),
    padNumeric(record.shelfLifeDays, 3),
    padText(record.productName, 25)
  ].join("");
}

export function buildUranoProductLine(record: UranoExportRecord) {
  return [
    padNumeric(record.productCode, 6),
    record.itemType === "weight" ? "0" : "1",
    padText(record.productName, 30),
    padNumeric(toCents(record.unitPrice), 9)
  ].join("");
}

export function exportToledoItemsFile(records: ToledoExportRecord[]) {
  return records.map(buildToledoItemLine).join("\n");
}

export function exportUranoProductsFile(records: UranoExportRecord[]) {
  return records.map(buildUranoProductLine).join("\n");
}

export function parseFallbackBarcode(barcode: string): BalanceReadingResult {
  return {
    prefix: barcode.slice(0, 1),
    productCode: barcode.slice(0, 6),
    barcode,
    dataMode: "price",
    embeddedValueRaw: barcode.slice(6, 11)
  };
}

function buildSerialReading(
  brand: ScaleSerialBrand,
  raw: string,
  payload: string,
  options: {
    decimalDivisorIfInteger: number;
    unstableChars?: string;
    negativeChars?: string;
    overloadChars?: string;
    totalPrice?: number;
    unitPrice?: number;
  }
): ScaleSerialReading {
  if (!payload) {
    return buildEmptySerialReading(brand, raw);
  }

  const normalized = payload.replace(",", ".").trim();
  const numeric = normalized.includes(".") ? parseFloat(normalized) : parseInt(normalized, 10) / options.decimalDivisorIfInteger;

  if (!Number.isNaN(numeric)) {
    return {
      brand,
      raw,
      status: "ok",
      stable: true,
      weightKg: roundWeight(numeric),
      totalPrice: options.totalPrice,
      unitPrice: options.unitPrice
    };
  }

  return buildStatusReading(
    brand,
    raw,
    normalized,
    options.unstableChars ?? "I",
    options.negativeChars ?? "N",
    options.overloadChars ?? "S"
  );
}

function buildStatusReading(
  brand: ScaleSerialBrand,
  raw: string,
  payload: string,
  unstableChars: string,
  negativeChars: string,
  overloadChars: string
): ScaleSerialReading {
  const firstChar = payload[0] ?? "";

  if (unstableChars.includes(firstChar)) {
    return { brand, raw, status: "unstable", stable: false, weightKg: 0 };
  }

  if (negativeChars.includes(firstChar)) {
    return { brand, raw, status: "negative", stable: false, weightKg: 0 };
  }

  if (overloadChars.includes(firstChar)) {
    return { brand, raw, status: "overload", stable: false, weightKg: 0 };
  }

  return { brand, raw, status: "unknown", stable: false, weightKg: 0 };
}

function buildEmptySerialReading(brand: ScaleSerialBrand, raw: string): ScaleSerialReading {
  return {
    brand,
    raw,
    status: "empty",
    stable: false,
    weightKg: 0
  };
}

function extractDelimitedFrame(raw: string, startDelimiter: string, endDelimiters: string[]) {
  const startIndex = raw.indexOf(startDelimiter);

  if (startIndex === -1) {
    return { payload: raw.trim() };
  }

  let endIndex = -1;
  for (const delimiter of endDelimiters) {
    endIndex = raw.indexOf(delimiter, startIndex + 1);
    if (endIndex !== -1) {
      break;
    }
  }

  if (endIndex === -1) {
    endIndex = raw.length;
  }

  return {
    payload: raw.substring(startIndex + 1, endIndex).trim()
  };
}

function calculateEan13Checksum(digits12: string) {
  if (!/^\d{12}$/.test(digits12)) {
    throw new Error(`Esperado 12 digitos numericos, recebido: ${digits12}`);
  }

  let sum = 0;
  for (let index = 0; index < digits12.length; index += 1) {
    const digit = Number(digits12[index]);
    sum += index % 2 === 0 ? digit : digit * 3;
  }

  return String((10 - (sum % 10)) % 10);
}

function validateEan13Checksum(digits13: string) {
  if (!/^\d{13}$/.test(digits13)) {
    return false;
  }

  return calculateEan13Checksum(digits13.substring(0, 12)) === digits13[12];
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function roundWeight(value: number) {
  return Number(value.toFixed(3));
}

function toCents(value: number) {
  return Math.round(value * 100);
}

function padNumeric(value: string | number, length: number) {
  return String(value).replace(/\D/g, "").padStart(length, "0").slice(-length);
}

function padText(value: string, length: number) {
  return value.slice(0, length).padEnd(length, " ");
}
