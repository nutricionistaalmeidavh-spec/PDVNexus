import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8").replace(/^\uFEFF/, "");
}

function write(path, text) {
  fs.writeFileSync(path, text, "utf8");
}

function replaceRequired(text, search, replacement, label) {
  if (!text.includes(search)) throw new Error(`Required patch target not found: ${label}`);
  return text.replace(search, replacement);
}

function replaceOptional(text, search, replacement) {
  return text.includes(search) ? text.replace(search, replacement) : text;
}

function patchApp(path) {
  let text = read(path);

  text = replaceRequired(
    text,
    'import { useHashRoute } from "../../meu-engenheiro/src/lib/useHashRoute";',
    'import { useHashRoute } from "../../meu-engenheiro/src/lib/useHashRoute";\nimport { resolveReceiptStoreHeader } from "./storeReceiptSettings";',
    `${path}: store receipt import`
  );

  text = replaceRequired(
    text,
    'type StoreSettings = { storeName: string; document: string; phone: string; address: string; };',
    'type StoreSettings = { storeName: string; document: string; phone: string; address: string; showOnReceipt: boolean; };',
    `${path}: StoreSettings type`
  );

  text = replaceRequired(
    text,
    'const defaultStoreSettings: StoreSettings = { storeName: "PDV Nexus", document: "Nao informado", phone: "", address: "" };',
    'const defaultStoreSettings: StoreSettings = { storeName: "PDV Nexus", document: "Nao informado", phone: "", address: "", showOnReceipt: false };',
    `${path}: store defaults`
  );

  text = replaceOptional(
    text,
    'renderReceiptForSale(latestSale, latestCustomerName, paperWidth)',
    'renderReceiptForSale(latestSale, latestCustomerName, paperWidth, storeSettings)'
  );

  text = replaceRequired(
    text,
    'renderReceiptForSale(result.completedSale, activeCustomer.name, receiptPrinterConfig.paperWidth)',
    'renderReceiptForSale(result.completedSale, activeCustomer.name, receiptPrinterConfig.paperWidth, storeSettings)',
    `${path}: finalize receipt call`
  );

  text = replaceRequired(
    text,
    'renderReceiptForSale(completedSales[0], registeredCustomers.find((customer) => customer.id === completedSales[0].customerId)?.name ?? "Cliente", receiptPrinterConfig.paperWidth)',
    'renderReceiptForSale(completedSales[0], registeredCustomers.find((customer) => customer.id === completedSales[0].customerId)?.name ?? "Cliente", receiptPrinterConfig.paperWidth, storeSettings)',
    `${path}: regenerate receipt call`
  );

  text = replaceRequired(
    text,
    'function renderReceiptForSale(sale: CompletedSale, customerName: string, width: number) {\n  return renderPdvReceipt({\n    storeName: "PDV Nexus",',
    'function renderReceiptForSale(sale: CompletedSale, customerName: string, width: number, storeSettings: StoreSettings) {\n  const storeHeader = resolveReceiptStoreHeader(storeSettings);\n  return renderPdvReceipt({\n    ...storeHeader,',
    `${path}: receipt renderer`
  );

  text = replaceRequired(
    text,
    'placeholder="Endereco" style={styles.input} /></div>',
    'placeholder="Endereco" style={styles.input} /><label style={styles.label}><span><input type="checkbox" checked={storeSettings.showOnReceipt} onChange={(event) => setStoreSettings((current) => ({ ...current, showOnReceipt: event.target.checked }))} /> Exibir nome, endereço e telefone no cupom não fiscal</span></label></div>',
    `${path}: store receipt opt-in`
  );

  write(path, text);
}

function patchDatabase(path) {
  let text = read(path);
  text = replaceRequired(
    text,
    'export interface PdvReceiptInput {\n  storeName: string;\n  documentLabel: string;\n  sale: PdvReceiptSale;\n  width?: number;\n}',
    'export interface PdvReceiptInput {\n  storeName: string;\n  address?: string;\n  phone?: string;\n  documentLabel: string;\n  sale: PdvReceiptSale;\n  width?: number;\n}',
    `${path}: receipt input`
  );
  text = replaceRequired(
    text,
    '  const lines = [\n    centerText(input.storeName, width),\n    centerText(input.documentLabel, width),',
    '  const lines = [\n    centerText(input.storeName, width),\n    ...(input.address?.trim() ? [centerText(input.address.trim(), width)] : []),\n    ...(input.phone?.trim() ? [centerText(`Telefone: ${input.phone.trim()}`, width)] : []),\n    centerText(input.documentLabel, width),',
    `${path}: receipt header lines`
  );
  write(path, text);
}

function patchTests(path, helperImport) {
  let text = read(path);
  if (!text.includes('resolveReceiptStoreHeader')) {
    text = replaceRequired(
      text,
      'import test from "node:test";',
      `import test from "node:test";\nimport { resolveReceiptStoreHeader } from "${helperImport}";`,
      `${path}: test import`
    );
  }

  if (!text.includes('store receipt header keeps legacy branding until opt-in')) {
    text += `\n\ntest("store receipt header keeps legacy branding until opt-in", () => {\n  const header = resolveReceiptStoreHeader({\n    storeName: "Loja Exemplo",\n    address: "Rua Central, 123",\n    phone: "(16) 99999-0000",\n    showOnReceipt: false\n  });\n\n  assert.deepEqual(header, { storeName: "PDV Nexus" });\n});\n\ntest("store receipt header exposes optional data after opt-in", () => {\n  const header = resolveReceiptStoreHeader({\n    storeName: "  Loja Exemplo  ",\n    address: "  Rua Central, 123  ",\n    phone: "  (16) 99999-0000  ",\n    showOnReceipt: true\n  });\n\n  assert.deepEqual(header, {\n    storeName: "Loja Exemplo",\n    address: "Rua Central, 123",\n    phone: "(16) 99999-0000"\n  });\n});\n\ntest("renderPdvReceipt prints optional store address and phone", () => {\n  const receipt = renderPdvReceipt({\n    storeName: "Loja Exemplo",\n    address: "Rua Central, 123",\n    phone: "(16) 99999-0000",\n    documentLabel: "CUPOM NAO FISCAL",\n    sale: {\n      number: "000999",\n      finalizedAt: "2026-09-11 13:00",\n      seller: "Operador",\n      customerName: "Cliente",\n      netTotal: 10,\n      paymentSummary: { paidTotal: 10, changeDue: 0 },\n      items: [{ productName: "Produto", quantity: 1, unitLabel: "UN", unitPrice: 10, totalPrice: 10 }],\n      payments: [{ method: "PIX", amount: 10 }]\n    },\n    width: 42\n  });\n\n  assert.match(receipt, /Loja Exemplo/);\n  assert.match(receipt, /Rua Central, 123/);\n  assert.match(receipt, /Telefone: \\(16\\) 99999-0000/);\n});\n`;
  }
  write(path, text);
}

for (const root of ["windows-10", "windows-7"]) {
  patchApp(`${root}/apps/pdv-demo/src/PdvDemoApp.tsx`);
  patchDatabase(`${root}/packages/database/src/pdv.ts`);
  patchTests(`${root}/tests/pdv-payment.test.ts`, "../apps/pdv-demo/src/storeReceiptSettings");
}

console.log("Store receipt feature patched in Windows 10 and legacy Windows bases.");
