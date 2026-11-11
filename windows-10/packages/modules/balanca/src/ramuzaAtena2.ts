/**
 * Ramuza Atena II: carga de produtos via formato Filizola (CADTXT/SETORTXT).
 * A transferencia Ethernet/Wi-Fi dos PLUs e feita no software gratuito Atena II.
 * Nao envia comandos TCP proprietarios sem protocolo homologado pelo fabricante.
 */
export interface RamuzaAtena2Product {
  productCode: string;
  productName: string;
  unitPrice: number;
  itemType: "weight" | "unit";
  shelfLifeDays: number;
  category?: string;
  active?: boolean;
}

export interface RamuzaAtena2File {
  filename: "CADTXT.TXT" | "SETORTXT.TXT";
  text: string;
  bytes: Uint8Array;
}

export interface RamuzaAtena2Load {
  productCount: number;
  sectorCount: number;
  productsFile: RamuzaAtena2File;
  sectorsFile: RamuzaAtena2File;
}

export const RAMUZA_ATENA2_DEFAULT_PORT = 33581;

/** Padrão Windows-1252 exigido pelo importador FILIZOLA do software Atena II. */
const CP1252_SPECIAL: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84,
  0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
  0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
  0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f
};

export function encodeRamuzaWindows1252(value: string): Uint8Array {
  const bytes: number[] = [];
  for (const char of value.normalize("NFC")) {
    const code = char.codePointAt(0)!;
    if (code < 128 || (code >= 160 && code <= 255)) {
      bytes.push(code);
    } else if (CP1252_SPECIAL[code] !== undefined) {
      bytes.push(CP1252_SPECIAL[code]);
    } else {
      throw new Error(`Caracter ${JSON.stringify(char)} nao suportado em Windows-1252. Edite a descricao do produto ou setor.`);
    }
  }
  return Uint8Array.from(bytes);
}

function fixedText(value: string, width: number, label: string): string {
  const clean = String(value ?? "").normalize("NFC").replace(/[\t\r\n]+/g, " ").replace(/ +/g, " ").trim();
  if (!clean) throw new Error(`${label} nao pode ficar vazio.`);
  const truncated = [...clean].slice(0, width).join("").padEnd(width, " ");
  encodeRamuzaWindows1252(truncated);
  return truncated;
}

function normalizeCode(value: string): string {
  const text = String(value ?? "").trim();
  if (!/^\d{1,6}$/.test(text)) throw new Error(`Produto ${text}: codigo deve conter de 1 a 6 digitos numericos para a Atena II.`);
  return text.padStart(6, "0");
}

function normalizePrice(value: number, code: string): string {
  if (!Number.isFinite(value) || value < 0 || Math.round(value * 100) > 9999999) {
    throw new Error(`Produto ${code}: preco fora do limite do formato Filizola (0 a 99.999,99).`);
  }
  return String(Math.round((value + Number.EPSILON) * 100)).padStart(7, "0");
}

function normalizeExpiry(value: number, code: string): string {
  if (!Number.isSafeInteger(value) || value < 0 || value > 999) {
    throw new Error(`Produto ${code}: validade deve estar entre 0 e 999 dias.`);
  }
  return String(value).padStart(3, "0");
}

export function buildRamuzaAtena2Load(
  products: readonly RamuzaAtena2Product[],
  options: { includeUnitProducts?: boolean } = {}
): RamuzaAtena2Load {
  const active = products.filter((product) => product.active !== false && (product.itemType === "weight" || (options.includeUnitProducts === true && product.itemType === "unit")));
  if (!active.length) throw new Error("Nao ha nenhum produto ativo para exportar a Ramuza Atena II.");

  const normalized = active.map((product) => ({
    code: normalizeCode(product.productCode),
    kind: product.itemType === "weight" ? "P" : "U",
    name: fixedText(product.productName, 22, "Descricao do produto"),
    price: normalizePrice(product.unitPrice, product.productCode),
    expiry: normalizeExpiry(product.shelfLifeDays, product.productCode),
    sector: fixedText((product.category || "GERAL").toLocaleUpperCase("pt-BR"), 12, "Setor")
  })).sort((a, b) => a.code.localeCompare(b.code));

  if (normalized.length > 10000) throw new Error("A Ramuza Atena II suporta no maximo 10.000 produtos.");
  const seen = new Set<string>();
  const productsLines: string[] = [];
  const sectorRows = new Map<string, string[]>();

  for (const product of normalized) {
    if (seen.has(product.code)) throw new Error(`Codigo duplicado no arquivo de balanca: ${product.code}.`);
    seen.add(product.code);
    productsLines.push(`${product.code}${product.kind}${product.name}${product.price}${product.expiry}`);
    const group = sectorRows.get(product.sector) ?? [];
    if (group.length >= 9999) throw new Error(`Setor ${product.sector.trim()} excede 9999 itens.`);
    const index = String(group.length + 1).padStart(4, "0");
    group.push(`${product.sector}${product.code}${index}000`);
    sectorRows.set(product.sector, group);
  }

  const productText = productsLines.join("\r\n") + "\r\n";
  const sectorsText = [...sectorRows.entries()].sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([, rows]) => rows).join("\r\n") + "\r\n";
  return {
    productCount: normalized.length,
    sectorCount: sectorRows.size,
    productsFile: { filename: "CADTXT.TXT", text: productText, bytes: encodeRamuzaWindows1252(productText) },
    sectorsFile: { filename: "SETORTXT.TXT", text: sectorsText, bytes: encodeRamuzaWindows1252(sectorsText) }
  };
}
