export interface PdvImportedProduct {
  code: string;
  barcode: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  minimumStock: number;
}

export interface PdvImportIssue {
  row: number;
  field: string;
  message: string;
}

const PRODUCT_HEADER_ALIASES: Record<keyof PdvImportedProduct, string[]> = {
  code: ["codigo", "código", "code", "sku", "produto_codigo"],
  barcode: ["ean", "barcode", "codigo_barras", "código_barras", "codigodebarras"],
  name: ["produto", "nome", "name", "descricao", "descrição"],
  category: ["categoria", "category", "grupo"],
  price: ["preco", "preço", "price", "valor", "preco_venda"],
  stock: ["estoque", "stock", "quantidade", "qtd"],
  minimumStock: ["estoque_minimo", "estoque mínimo", "minimum_stock", "minimo", "mínimo"]
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function parseDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseNumber(value: string, fallback = 0) {
  const normalized = value.trim().replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function previewPdvProductImport(raw: string, existingCodes: string[] = []) {
  const normalizedRaw = raw.replace(/^\uFEFF/, "").trim();
  if (!normalizedRaw) return { products: [] as PdvImportedProduct[], issues: [{ row: 0, field: "arquivo", message: "Arquivo vazio" }] as PdvImportIssue[], delimiter: ";" };

  const lines = normalizedRaw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const delimiter = (lines[0]?.split(";").length ?? 0) >= (lines[0]?.split(",").length ?? 0) ? ";" : ",";
  const headers = parseDelimitedLine(lines[0] ?? "", delimiter).map(normalizeHeader);
  const indexByField = new Map<keyof PdvImportedProduct, number>();

  for (const [field, aliases] of Object.entries(PRODUCT_HEADER_ALIASES) as Array<[keyof PdvImportedProduct, string[]]>) {
    const normalizedAliases = aliases.map(normalizeHeader);
    const index = headers.findIndex((header) => normalizedAliases.includes(header));
    if (index >= 0) indexByField.set(field, index);
  }

  const issues: PdvImportIssue[] = [];
  if (!indexByField.has("code")) issues.push({ row: 1, field: "code", message: "Coluna de código não encontrada" });
  if (!indexByField.has("name")) issues.push({ row: 1, field: "name", message: "Coluna de nome/produto não encontrada" });
  if (!indexByField.has("price")) issues.push({ row: 1, field: "price", message: "Coluna de preço não encontrada" });
  if (issues.length) return { products: [] as PdvImportedProduct[], issues, delimiter };

  const seen = new Set(existingCodes.map((code) => code.trim()));
  const products: PdvImportedProduct[] = [];
  const valueAt = (cells: string[], field: keyof PdvImportedProduct) => {
    const index = indexByField.get(field);
    return index === undefined ? "" : (cells[index] ?? "").trim();
  };

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const row = lineIndex + 1;
    const cells = parseDelimitedLine(lines[lineIndex], delimiter);
    const code = valueAt(cells, "code");
    const name = valueAt(cells, "name");
    const price = parseNumber(valueAt(cells, "price"));
    const stock = parseNumber(valueAt(cells, "stock"), 0);
    const minimumStock = parseNumber(valueAt(cells, "minimumStock"), 0);

    if (!code) issues.push({ row, field: "code", message: "Código obrigatório" });
    if (!name) issues.push({ row, field: "name", message: "Nome obrigatório" });
    if (!Number.isFinite(price) || price < 0) issues.push({ row, field: "price", message: "Preço inválido" });
    if (!Number.isFinite(stock) || stock < 0) issues.push({ row, field: "stock", message: "Estoque inválido" });
    if (!Number.isFinite(minimumStock) || minimumStock < 0) issues.push({ row, field: "minimumStock", message: "Estoque mínimo inválido" });
    if (code && seen.has(code)) issues.push({ row, field: "code", message: "Código duplicado ou já cadastrado" });
    if (issues.some((issue) => issue.row === row)) continue;

    seen.add(code);
    products.push({
      code,
      barcode: valueAt(cells, "barcode"),
      name,
      category: valueAt(cells, "category") || "Geral",
      price,
      stock,
      minimumStock
    });
  }

  return { products, issues, delimiter };
}

export interface PdvImportedCustomer {
  id: string;
  name: string;
  document: string;
  city: string;
  creditLimit: number;
}

export function previewPdvCustomerImport(raw: string, existingIds: string[] = []) {
  const normalizedRaw = raw.replace(/^\uFEFF/, "").trim();
  if (!normalizedRaw) return { customers: [] as PdvImportedCustomer[], issues: [{ row: 0, field: "arquivo", message: "Arquivo vazio" }] as PdvImportIssue[], delimiter: ";" };
  const lines = normalizedRaw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const delimiter = (lines[0]?.split(";").length ?? 0) >= (lines[0]?.split(",").length ?? 0) ? ";" : ",";
  const headers = parseDelimitedLine(lines[0] ?? "", delimiter).map(normalizeHeader);
  const aliases = {
    id: ["id", "codigo", "código", "cliente_codigo"],
    name: ["cliente", "nome", "name"],
    document: ["cpf", "cnpj", "documento", "document"],
    city: ["cidade", "city"],
    creditLimit: ["limite", "limite_credito", "credit_limit"]
  } as const;
  const findIndex = (items: readonly string[]) => headers.findIndex((header) => items.map(normalizeHeader).includes(header));
  const indexes = { id: findIndex(aliases.id), name: findIndex(aliases.name), document: findIndex(aliases.document), city: findIndex(aliases.city), creditLimit: findIndex(aliases.creditLimit) };
  const issues: PdvImportIssue[] = [];
  if (indexes.name < 0) issues.push({ row: 1, field: "name", message: "Coluna de cliente/nome não encontrada" });
  if (issues.length) return { customers: [] as PdvImportedCustomer[], issues, delimiter };
  const seen = new Set(existingIds.map((id) => id.trim()));
  const customers: PdvImportedCustomer[] = [];
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const row = lineIndex + 1;
    const cells = parseDelimitedLine(lines[lineIndex], delimiter);
    const read = (index: number) => index < 0 ? "" : (cells[index] ?? "").trim();
    const name = read(indexes.name);
    const id = read(indexes.id) || `CLI-${String(row - 1).padStart(4, "0")}`;
    const creditLimit = parseNumber(read(indexes.creditLimit), 0);
    if (!name) issues.push({ row, field: "name", message: "Nome obrigatório" });
    if (seen.has(id)) issues.push({ row, field: "id", message: "Cliente duplicado ou já cadastrado" });
    if (!Number.isFinite(creditLimit) || creditLimit < 0) issues.push({ row, field: "creditLimit", message: "Limite de crédito inválido" });
    if (issues.some((issue) => issue.row === row)) continue;
    seen.add(id);
    customers.push({ id, name, document: read(indexes.document), city: read(indexes.city), creditLimit });
  }
  return { customers, issues, delimiter };
}
