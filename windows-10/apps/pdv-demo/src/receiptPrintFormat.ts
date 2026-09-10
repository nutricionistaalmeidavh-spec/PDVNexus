export type ReceiptPaperFormat = "58mm" | "80mm" | "a4-half";

const RECEIPT_COLUMNS: Record<ReceiptPaperFormat, number> = {
  "58mm": 32,
  "80mm": 42,
  "a4-half": 90
};

export function receiptColumnsForFormat(format: ReceiptPaperFormat) {
  return RECEIPT_COLUMNS[format];
}

export function normalizeReceiptPaperFormat(value: unknown, legacyWidth?: number): ReceiptPaperFormat {
  if (value === "58mm" || value === "80mm" || value === "a4-half") return value;
  if ((legacyWidth ?? 0) >= 80) return "a4-half";
  if ((legacyWidth ?? 0) >= 42) return "80mm";
  return "58mm";
}

export function buildReceiptPrintHtml(receipt: string, format: ReceiptPaperFormat) {
  const safeReceipt = escapeReceiptHtml(receipt);
  if (format !== "a4-half") {
    return `<pre style="font-family: Consolas, monospace; font-size: 12px; white-space: pre-wrap;">${safeReceipt}</pre>`;
  }

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
@page { size: A4 portrait; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
.receipt-half { width: 210mm; height: 148.5mm; box-sizing: border-box; padding: 8mm 10mm; overflow: visible; }
pre { margin: 0; font-family: Consolas, "Courier New", monospace; font-size: 9pt; line-height: 1.15; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
</head>
<body><section class="receipt-half"><pre>${safeReceipt}</pre></section></body>
</html>`;
}

function escapeReceiptHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
