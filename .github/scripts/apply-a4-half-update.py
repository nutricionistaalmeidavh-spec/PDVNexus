from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8-sig")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one match in {path} but found {count}: {old[:120]!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def replace_between(path: Path, start: str, end: str, replacement: str) -> None:
    text = path.read_text(encoding="utf-8-sig")
    if text.count(start) != 1 or text.count(end) != 1:
        raise RuntimeError(f"Could not uniquely locate replacement block in {path}")
    start_index = text.index(start)
    end_index = text.index(end, start_index)
    path.write_text(text[:start_index] + replacement + text[end_index:], encoding="utf-8")


pdv = ROOT / "windows-10/apps/pdv-demo/src/PdvDemoApp.tsx"
main = ROOT / "windows-10/apps/nexus-desktop/main.cjs"
runtime = ROOT / "windows-10/packages/desktop-runtime/src/index.ts"
tsconfig_test = ROOT / "windows-10/tsconfig.test.json"
package_json = ROOT / "windows-10/package.json"

replace_once(
    pdv,
    'import { useHashRoute } from "../../meu-engenheiro/src/lib/useHashRoute";\n',
    'import { useHashRoute } from "../../meu-engenheiro/src/lib/useHashRoute";\nimport { buildReceiptPrintHtml, normalizeReceiptPaperFormat, receiptColumnsForFormat, type ReceiptPaperFormat } from "./receiptPrintFormat";\n'
)
replace_once(
    pdv,
    'type ReceiptPrinterConfig = { paperWidth: number; autoPrint: boolean; printerName: string; };',
    'type ReceiptPrinterConfig = { paperFormat: ReceiptPaperFormat; paperWidth: number; autoPrint: boolean; printerName: string; };'
)
replace_once(
    pdv,
    'const defaultPrinterConfig: ReceiptPrinterConfig = { paperWidth: 32, autoPrint: false, printerName: "Impressora termica 58/80mm" };',
    'const defaultPrinterConfig: ReceiptPrinterConfig = { paperFormat: "58mm", paperWidth: receiptColumnsForFormat("58mm"), autoPrint: false, printerName: "Impressora 58/80mm ou A4" };'
)
replace_once(
    pdv,
    '  const desktopPrintingBridge = getDesktopPrintingBridge();\n\n  const activeCustomer =',
    '''  const desktopPrintingBridge = getDesktopPrintingBridge();\n\n  const updateReceiptPaperFormat = (paperFormat: ReceiptPaperFormat) => {\n    const paperWidth = receiptColumnsForFormat(paperFormat);\n    setReceiptPrinterConfig((current) => ({ ...current, paperFormat, paperWidth }));\n    const latestSale = completedSales[0];\n    if (!latestSale) return;\n    const latestCustomerName = registeredCustomers.find((customer) => customer.id === latestSale.customerId)?.name ?? "Cliente";\n    setLastReceiptText(renderReceiptForSale(latestSale, latestCustomerName, paperWidth));\n  };\n\n  const activeCustomer ='''
)
replace_once(
    pdv,
    '<SectionCard title="Comprovante e impressão" subtitle="Pronto para impressora 58/80 mm; teste físico pendente">',
    '<SectionCard title="Comprovante e impressão" subtitle="Bobina 58/80 mm ou cupom não fiscal na metade superior da A4">'
)
replace_once(
    pdv,
    '<select value={String(receiptPrinterConfig.paperWidth)} onChange={(event) => setReceiptPrinterConfig((current) => ({ ...current, paperWidth: Number(event.target.value) || 32 }))} style={styles.input}><option value="32">58mm</option><option value="42">80mm</option></select>',
    '<select value={receiptPrinterConfig.paperFormat} onChange={(event) => updateReceiptPaperFormat(event.target.value as ReceiptPaperFormat)} style={styles.input}><option value="58mm">58mm (bobina)</option><option value="80mm">80mm (bobina)</option><option value="a4-half">A4 meia folha</option></select>'
)
replace_once(
    pdv,
    '  const candidate = value && typeof value === "object" ? value as Partial<PdvExtensions> : {};\n  return {',
    '''  const candidate = value && typeof value === "object" ? value as Partial<PdvExtensions> : {};\n  const rawPrinterConfig = candidate.receiptPrinterConfig as Partial<ReceiptPrinterConfig> | undefined;\n  const paperFormat = normalizeReceiptPaperFormat(rawPrinterConfig?.paperFormat, rawPrinterConfig?.paperWidth);\n  const receiptPrinterConfig: ReceiptPrinterConfig = rawPrinterConfig\n    ? { ...defaultPrinterConfig, ...rawPrinterConfig, paperFormat, paperWidth: receiptColumnsForFormat(paperFormat) }\n    : defaultPrinterConfig;\n  return {'''
)
replace_once(
    pdv,
    '    receiptPrinterConfig: candidate.receiptPrinterConfig ?? defaultPrinterConfig,',
    '    receiptPrinterConfig,'
)

new_renderer_print = '''async function requestReceiptPrint(receipt: string, desktopPrintingBridge: ReturnType<typeof getDesktopPrintingBridge>, config: ReceiptPrinterConfig) {\n  if (desktopPrintingBridge) {\n    await desktopPrintingBridge.receipt({ text: receipt, width: config.paperWidth, paperFormat: config.paperFormat, printerName: config.printerName });\n    return;\n  }\n  const printWindowFeatures = config.paperFormat === "a4-half" ? "width=840,height=600" : "width=420,height=640";\n  const printWindow = window.open("", "pdv-receipt-print", printWindowFeatures);\n  if (!printWindow) return;\n  printWindow.document.write(buildReceiptPrintHtml(receipt, config.paperFormat));\n  printWindow.document.close();\n  printWindow.focus();\n  printWindow.print();\n}\n'''
replace_between(pdv, 'async function requestReceiptPrint(', 'function resolvePaymentView(', new_renderer_print)

replace_once(
    runtime,
    '''export interface DesktopReceiptPrintOptions {\n  text: string;\n  width?: number;\n  printerName?: string;\n}''',
    '''export interface DesktopReceiptPrintOptions {\n  text: string;\n  width?: number;\n  paperFormat?: "58mm" | "80mm" | "a4-half";\n  printerName?: string;\n}'''
)

new_main_print = '''ipcMain.handle("nexus-print:receipt", async (_event, options) => {\n  const receipt = String(options?.text ?? "");\n  const width = Number(options?.width ?? 32);\n  const requestedPaperFormat = String(options?.paperFormat ?? "");\n  const paperFormat = ["58mm", "80mm", "a4-half"].includes(requestedPaperFormat)\n    ? requestedPaperFormat\n    : width >= 80 ? "a4-half" : width >= 42 ? "80mm" : "58mm";\n  const isA4Half = paperFormat === "a4-half";\n  const printWindow = new BrowserWindow({\n    width: isA4Half ? 840 : width <= 32 ? 320 : 420,\n    height: isA4Half ? 600 : 640,\n    show: false,\n    webPreferences: { sandbox: true }\n  });\n  const safeReceipt = receipt.replace(/[&<>\\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" }[char]));\n  const printHtml = isA4Half\n    ? `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><style>@page { size: A4 portrait; margin: 0; } html, body { margin: 0; padding: 0; background: #fff; color: #000; } .receipt-half { width: 210mm; height: 148.5mm; box-sizing: border-box; padding: 8mm 10mm; overflow: visible; } pre { margin: 0; font-family: Consolas, "Courier New", monospace; font-size: 9pt; line-height: 1.15; white-space: pre-wrap; overflow-wrap: anywhere; }</style></head><body><section class="receipt-half"><pre>${safeReceipt}</pre></section></body></html>`\n    : `<pre style="font-family: Consolas, monospace; font-size: 12px; white-space: pre-wrap;">${safeReceipt}</pre>`;\n  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(printHtml)}`);\n  const printOptions = isA4Half\n    ? { silent: false, printBackground: false, pageSize: "A4", margins: { marginType: "none" } }\n    : { silent: false, printBackground: false };\n  const result = await new Promise((resolve) => {\n    printWindow.webContents.print(printOptions, (success, failureReason) => {\n      resolve({ success, failureReason: failureReason || "" });\n    });\n  });\n  printWindow.close();\n  return result;\n});\n\n'''
replace_between(main, 'ipcMain.handle("nexus-print:receipt"', 'ipcMain.handle("nexus-serial:list"', new_main_print)

helper = ROOT / "windows-10/apps/pdv-demo/src/receiptPrintFormat.ts"
helper.write_text('''export type ReceiptPaperFormat = "58mm" | "80mm" | "a4-half";\n\nconst RECEIPT_COLUMNS: Record<ReceiptPaperFormat, number> = {\n  "58mm": 32,\n  "80mm": 42,\n  "a4-half": 90\n};\n\nexport function receiptColumnsForFormat(format: ReceiptPaperFormat) {\n  return RECEIPT_COLUMNS[format];\n}\n\nexport function normalizeReceiptPaperFormat(value: unknown, legacyWidth?: number): ReceiptPaperFormat {\n  if (value === "58mm" || value === "80mm" || value === "a4-half") return value;\n  if ((legacyWidth ?? 0) >= 80) return "a4-half";\n  if ((legacyWidth ?? 0) >= 42) return "80mm";\n  return "58mm";\n}\n\nexport function buildReceiptPrintHtml(receipt: string, format: ReceiptPaperFormat) {\n  const safeReceipt = escapeReceiptHtml(receipt);\n  if (format !== "a4-half") {\n    return `<pre style="font-family: Consolas, monospace; font-size: 12px; white-space: pre-wrap;">${safeReceipt}</pre>`;\n  }\n\n  return `<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8" />\n<style>\n@page { size: A4 portrait; margin: 0; }\nhtml, body { margin: 0; padding: 0; background: #fff; color: #000; }\n.receipt-half { width: 210mm; height: 148.5mm; box-sizing: border-box; padding: 8mm 10mm; overflow: visible; }\npre { margin: 0; font-family: Consolas, "Courier New", monospace; font-size: 9pt; line-height: 1.15; white-space: pre-wrap; overflow-wrap: anywhere; }\n</style>\n</head>\n<body><section class="receipt-half"><pre>${safeReceipt}</pre></section></body>\n</html>`;\n}\n\nfunction escapeReceiptHtml(value: string) {\n  return value\n    .replaceAll("&", "&amp;")\n    .replaceAll("<", "&lt;")\n    .replaceAll(">", "&gt;")\n    .replaceAll('"', "&quot;")\n    .replaceAll("'", "&#39;");\n}\n''', encoding="utf-8")

test_file = ROOT / "windows-10/tests/pdv-receipt-format.test.ts"
test_file.write_text('''import assert from "node:assert/strict";\nimport test from "node:test";\nimport { buildReceiptPrintHtml, normalizeReceiptPaperFormat, receiptColumnsForFormat } from "../apps/pdv-demo/src/receiptPrintFormat";\n\ntest("receipt paper formats keep thermal widths and add A4 half-page width", () => {\n  assert.equal(receiptColumnsForFormat("58mm"), 32);\n  assert.equal(receiptColumnsForFormat("80mm"), 42);\n  assert.equal(receiptColumnsForFormat("a4-half"), 90);\n});\n\ntest("legacy receipt printer settings migrate to the matching paper format", () => {\n  assert.equal(normalizeReceiptPaperFormat(undefined, 32), "58mm");\n  assert.equal(normalizeReceiptPaperFormat(undefined, 42), "80mm");\n  assert.equal(normalizeReceiptPaperFormat(undefined, 90), "a4-half");\n});\n\ntest("A4 half-page print HTML targets the upper half and escapes receipt content", () => {\n  const html = buildReceiptPrintHtml("<cupom>&\\\"'", "a4-half");\n  assert.match(html, /size: A4 portrait/);\n  assert.match(html, /height: 148\\.5mm/);\n  assert.match(html, /width: 210mm/);\n  assert.match(html, /&lt;cupom&gt;&amp;&quot;&#39;/);\n});\n\ntest("thermal receipt HTML remains compact and does not force A4", () => {\n  const html = buildReceiptPrintHtml("CUPOM", "58mm");\n  assert.doesNotMatch(html, /size: A4 portrait/);\n  assert.match(html, /font-size: 12px/);\n});\n''', encoding="utf-8")

replace_once(
    tsconfig_test,
    '  "include": ["tests/**/*.ts", "packages/database/src/pdv.ts"]',
    '  "include": ["tests/**/*.ts", "packages/database/src/pdv.ts", "apps/pdv-demo/src/receiptPrintFormat.ts"]'
)
replace_once(
    package_json,
    '"test:pdv-payments":  "tsc -p tsconfig.test.json && node --test .tmp-tests/tests/pdv-payment.test.js"',
    '"test:pdv-payments":  "tsc -p tsconfig.test.json && node --test .tmp-tests/tests/pdv-payment.test.js .tmp-tests/tests/pdv-receipt-format.test.js"'
)

print("A4 half-page receipt update applied successfully.")
