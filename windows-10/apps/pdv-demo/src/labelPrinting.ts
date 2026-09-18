import {
  buildProductBarcodeRenderModel,
  type LabelCatalogProduct,
  type ProductLabelPreview,
  type ProductBarcodeRenderModel
} from "./productLabels";

export type ProductLabelPrintPayload = {
  product: LabelCatalogProduct;
  preview: ProductLabelPreview;
};

export function buildProductBarcodeSvgMarkup(model: ProductBarcodeRenderModel) {
  const quietZone = 10;
  const totalWidth = model.moduleCount + quietZone * 2;
  const bars = model.bars
    .map((bar) => `<rect x="${bar.x + quietZone}" y="0" width="${bar.width}" height="62"/>`)
    .join("");
  return `<svg class="pdv-label-barcode" viewBox="0 0 ${totalWidth} 78" role="img" aria-label="Código de barras ${escapeHtml(model.humanReadable)}" preserveAspectRatio="none"><g fill="#000">${bars}</g><text x="${totalWidth / 2}" y="75" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" fill="#000">${escapeHtml(model.humanReadable)}</text></svg>`;
}

export function buildProductLabelPrintHtml(payload: ProductLabelPrintPayload) {
  const { product, preview } = payload;
  const barcode = buildProductBarcodeRenderModel(product);
  const barcodeSvg = buildProductBarcodeSvgMarkup(barcode);
  const copies = Math.max(1, Math.min(999, Math.floor(preview.copies || 1)));
  const label = buildSingleLabelMarkup(preview, barcodeSvg);
  const pages = Array.from({ length: copies }, () => `<section class="label-page">${label}</section>`).join("");
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>Etiquetas PDV Nexus</title>
<style>
@page { size: ${preview.widthMm}mm ${preview.heightMm}mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: Arial, sans-serif; }
.label-page { width: ${preview.widthMm}mm; height: ${preview.heightMm}mm; page-break-after: always; break-after: page; padding: 1.6mm; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; }
.label-page:last-child { page-break-after: auto; break-after: auto; }
.product-name { font-size: 9pt; line-height: 1.05; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pdv-label-barcode { width: 100%; height: min(12mm, 48%); display: block; }
.label-meta { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.8mm 2mm; font-size: 7.5pt; line-height: 1; }
.label-meta strong { font-size: 9pt; }
</style>
</head>
<body>${pages}</body>
</html>`;
}

export async function printProductLabels(payload: ProductLabelPrintPayload) {
  if (typeof document === "undefined") throw new Error("A impressão de etiquetas requer a interface desktop.");
  const html = buildProductLabelPrintHtml(payload);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  try {
    const frameDocument = iframe.contentDocument;
    const frameWindow = iframe.contentWindow;
    if (!frameDocument || !frameWindow) throw new Error("Não foi possível abrir a impressão de etiquetas.");
    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();
    await new Promise<void>((resolve) => setTimeout(resolve, 80));
    frameWindow.focus();
    frameWindow.print();
    return { success: true, copies: payload.preview.copies };
  } finally {
    setTimeout(() => iframe.remove(), 1500);
  }
}

function buildSingleLabelMarkup(preview: ProductLabelPreview, barcodeSvg: string) {
  const meta: string[] = [];
  if (preview.priceText) meta.push(`<strong>${escapeHtml(preview.priceText)}</strong>`);
  if (preview.lotText) meta.push(`<span>Lote: ${escapeHtml(preview.lotText)}</span>`);
  if (preview.expiryText) meta.push(`<span>Val.: ${escapeHtml(preview.expiryText)}</span>`);
  return `<div class="product-name">${escapeHtml(preview.productName)}</div>${barcodeSvg}<div class="label-meta">${meta.join("")}</div>`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
