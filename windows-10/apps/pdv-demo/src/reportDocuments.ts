import type { ReportFilters, ReportResult, ReportView } from "./salesReporting";

/** Native OOXML workbook and PDF, fully offline, no paid or remote dependency. */
export type ExportContext = { storeName: string; generatedAt: string; filters: ReportFilters; view: ReportView };
const utf8 = (text: string) => new TextEncoder().encode(text);
const xml = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const money = (value: number) => Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
const groupTable = (values: ReportResult["products"], withQty: boolean) =>
  values.map(g => withQty ? [g.label, g.brand ?? "", g.producer ?? "", g.count, g.quantity, money(g.total)] : [g.label, g.count, money(g.total)]);

export interface WorkbookTable { name: string; headers: string[]; rows: Array<Array<string | number>>; widths: number[]; moneyColumns?: number[] }
export function reportWorkbookTables(report: ReportResult, context: ExportContext): WorkbookTable[] {
  const range = (context.filters.from || "início") + " a " + (context.filters.to || "data atual");
  return [
    { name: "Resumo", headers: ["Indicador", "Valor"], widths: [36, 25], rows: [
      ["Estabelecimento", context.storeName || "PDV Nexus"], ["Período consultado", range],
      ["Gerado em", context.generatedAt], ["Situação", context.filters.status || "completed"],
      ["Filtro de pagamento", context.filters.paymentMethod || "Todas"],
      ["Filtro de operador", context.filters.operator || "Todos"],
      ["Filtro de produto", context.filters.productCode || "Todos"],
      ["Busca", context.filters.query || "Sem busca"], ["Vendas concluídas", report.salesCount],
      ["Vendas canceladas incluídas", report.cancelledCount], ["Faturamento", money(report.revenue)],
      ["Ticket médio", money(report.ticket)], ["Quantidade de produtos", report.quantity],
      ["Divergência de pagamentos", money(report.tenderDifference)],
      ["Vendas com divergência", report.unmatched.join(", ") || "Nenhuma"],
      ["Vendas sem itens", report.missingItems.join(", ") || "Nenhuma"],
      ["Vendas sem pagamento por item", report.unidentifiedItemPayments.join(", ") || "Nenhuma"],
      ["Atenção", "Pagamentos são vinculados à venda, não atribuídos individualmente ao produto."],
      ["Cobertura", "Apenas vendas existentes no histórico local; instalações legadas podem ter limite de 100 vendas."]
    ], moneyColumns: [] },
    { name: "Itens", headers: ["Data", "Venda", "Operador", "Cliente", "Situação", "Código",
      "Produto", "Marca", "Empreendimento", "Unidade", "Quantidade", "Unitário", "Bruto", "Desconto", "Líquido", "Pagamento do item"],
      widths: [23, 15, 20, 25, 16, 16, 39, 23, 29, 12, 14, 16, 16, 16, 16, 55],
      moneyColumns: [12, 13, 14, 15],
      rows: report.lines.map(r => [r.date, r.number, r.operator, r.customer, r.status, r.productCode,
        r.productName, r.brand, r.producer, r.unit, r.quantity, money(r.unitPrice), money(r.gross), money(r.discount),
        money(r.net), r.payments]) },
    { name: "Vendas", headers: ["Data", "Venda", "Operador", "Cliente", "Situação", "Quantidade", "Pagamentos", "Total válido"],
      widths: [23, 15, 20, 25, 16, 16, 55, 18], moneyColumns: [8],
      rows: report.sales.map(r => [r.date, r.number, r.operator, r.customer, r.status, r.quantity, r.payments, money(r.total)]) },
    { name: "Produtos", headers: ["Produto", "Marca", "Empreendimento", "Vendas", "Quantidade", "Faturamento"],
      widths: [40, 23, 29, 16, 16, 20], moneyColumns: [6], rows: groupTable(report.products, true) },
    { name: "Pagamentos", headers: ["Forma", "Vendas", "Total"],
      widths: [38, 16, 20], moneyColumns: [3], rows: groupTable(report.payments, false) },
    { name: "Operadores", headers: ["Operador", "Vendas", "Total"],
      widths: [38, 16, 20], moneyColumns: [3], rows: groupTable(report.operators, false) }
  ];
}
const refColumn = (index: number) => {
  let n = index, label = "";
  while (n > 0) { n--; label = String.fromCharCode(65 + n % 26) + label; n = Math.floor(n / 26); }
  return label;
};
const cell = (value: string | number, col: number, row: number, style = 0) => {
  const ref = refColumn(col) + row;
  if (typeof value === "number") return '<c r="' + ref + '" s="' + style + '"><v>' +
    (Number.isFinite(value) ? String(value) : "0") + "</v></c>";
  return '<c r="' + ref + '" s="' + style + '" t="inlineStr"><is><t xml:space="preserve">' +
    xml(value) + "</t></is></c>";
};
function worksheet(table: WorkbookTable): Uint8Array {
  const widths = table.widths.map((width, i) =>
    '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + width + '" customWidth="1"/>').join("");
  const header = "<row r=\"1\">" + table.headers.map((v, i) => cell(v, i + 1, 1, 1)).join("") + "</row>";
  const rows = table.rows.map((row, i) => "<row r=\"" + (i + 2) + "\">" +
    row.map((v, j) => cell(v, j + 1, i + 2, typeof v === "number" && (table.moneyColumns?.includes(j + 1) || (table.name === "Resumo" && j === 1 && ["Faturamento", "Ticket médio", "Divergência de pagamentos"].includes(String(row[0])))) ? 2 : 0)).join("") +
    "</row>").join("");
  const lastCol = refColumn(table.headers.length);
  return utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="17"/><cols>' + widths + '</cols><sheetData>' + header + rows + '</sheetData>' +
    '<autoFilter ref="A1:' + lastCol + Math.max(1, table.rows.length + 1) + '"/>' +
    '<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>' +
    '</worksheet>');
}
const styles = utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;R$ &quot;#,##0.00"/></numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF185A9D"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
  '</styleSheet>');
const crcTable = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
})();
function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function zipStored(files: Array<{ path: string; data: Uint8Array }>): Uint8Array {
  const local: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = utf8(file.path), size = file.data.length, checksum = crc32(file.data);
    const header = new Uint8Array(30 + name.length);
    const h = new DataView(header.buffer);
    h.setUint32(0, 0x04034B50, true);
    h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); // UTF-8 entry names
    h.setUint32(14, checksum, true); h.setUint32(18, size, true); h.setUint32(22, size, true);
    h.setUint16(26, name.length, true); header.set(name, 30);
    local.push(header, file.data);
    const dir = new Uint8Array(46 + name.length), d = new DataView(dir.buffer);
    d.setUint32(0, 0x02014B50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true);
    d.setUint16(8, 0x0800, true);
    d.setUint32(16, checksum, true); d.setUint32(20, size, true); d.setUint32(24, size, true);
    d.setUint16(28, name.length, true); d.setUint32(42, offset, true); dir.set(name, 46);
    central.push(dir);
    offset += header.length + size;
  }
  const centralSize = central.reduce((sum, b) => sum + b.length, 0);
  const end = new Uint8Array(22), view = new DataView(end.buffer);
  view.setUint32(0, 0x06054B50, true);
  view.setUint16(8, files.length, true); view.setUint16(10, files.length, true);
  view.setUint32(12, centralSize, true); view.setUint32(16, offset, true);
  const result = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const part of [...local, ...central, end]) { result.set(part, cursor); cursor += part.length; }
  return result;
}
export function buildSalesXlsx(report: ReportResult, context: ExportContext): Uint8Array {
  const tables = reportWorkbookTables(report, context);
  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    tables.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) +
      '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("") + '</Types>';
  const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets>' + tables.map((t, i) => '<sheet name="' + xml(t.name) + '" sheetId="' + (i + 1) +
      '" r:id="rId' + (i + 1) + '"/>').join("") + '</sheets></workbook>';
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    tables.map((_, i) => '<Relationship Id="rId' + (i + 1) +
      '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"' +
      ' Target="worksheets/sheet' + (i + 1) + '.xml"/>').join("") +
    '<Relationship Id="rId' + (tables.length + 1) +
      '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"' +
      ' Target="styles.xml"/></Relationships>';
  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"' +
    ' Target="xl/workbook.xml"/></Relationships>';
  return zipStored([
    { path: "[Content_Types].xml", data: utf8(contentTypes) },
    { path: "_rels/.rels", data: utf8(rootRels) },
    { path: "xl/workbook.xml", data: utf8(workbook) },
    { path: "xl/_rels/workbook.xml.rels", data: utf8(rels) },
    { path: "xl/styles.xml", data: styles },
    ...tables.map((t, i) => ({ path: "xl/worksheets/sheet" + (i + 1) + ".xml", data: worksheet(t) }))
  ]);
}

/** A4 paginated standard PDF. Text is encoded as WinAnsi hex, preserving Portuguese characters. */
function winAnsi(text: string): string {
  const specials: Record<string, number> = {
    "€": 128, "‚": 130, "ƒ": 131, "„": 132, "…": 133, "†": 134, "‡": 135,
    "ˆ": 136, "‰": 137, "Š": 138, "‹": 139, "Œ": 140, "Ž": 142,
    "‘": 145, "’": 146, "“": 147, "”": 148, "•": 149, "–": 150, "—": 151,
    "˜": 152, "™": 153, "š": 154, "›": 155, "œ": 156, "ž": 158, "Ÿ": 159
  };
  let hex = "";
  for (const char of text) {
    const n = char.codePointAt(0) ?? 63;
    const code = n <= 127 || (n >= 160 && n <= 255) ? n : specials[char] ?? 63;
    hex += code.toString(16).padStart(2, "0");
  }
  return hex.toUpperCase();
}
type PdfPage = { commands: string[] };
function pdfText(page: PdfPage, text: string, x: number, y: number, size = 9, bold = false) {
  page.commands.push("BT /" + (bold ? "F2" : "F1") + " " + size +
    " Tf 1 0 0 1 " + x + " " + y + " Tm <" + winAnsi(text) + "> Tj ET");
}
function pdfLine(page: PdfPage, x: number, y: number, width: number) {
  page.commands.push("0.83 G 0.5 w " + x + " " + y + " m " + (x + width) + " " + y + " l S");
}
const truncate = (text: string, limit: number) => text.length > limit ? text.slice(0, Math.max(0, limit - 3)) + "..." : text;
const brl = (n: number) => "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const viewTitle: Record<ReportView, string> = {
  lines: "Itens vendidos", sales: "Vendas", products: "Produtos", payments: "Formas de pagamento", operators: "Operadores"
};
export function buildSalesPdf(report: ReportResult, context: ExportContext): Uint8Array {
  const pages: PdfPage[] = [];
  const rows: Array<{ left: string; right: string; subtitle?: string }> =
    context.view === "lines" ? report.lines.map(r => ({
      left: r.date + " | Venda " + r.number + " | " + r.productName + " | " + r.quantity + " " + r.unit,
      right: brl(r.net),
      subtitle: "Marca: " + (r.brand || "Não informada") + " | Empreendimento: " + (r.producer || "Não informado") + " | " + r.operator + " | " + r.status + " | Pagamento: " + r.payments
    })) : context.view === "sales" ? report.sales.map(r => ({
      left: r.date + " | Venda " + r.number + " | " + r.operator,
      right: brl(r.total), subtitle: r.customer + " | " + r.status + " | " + r.payments
    })) : (context.view === "products" ? report.products : context.view === "payments" ?
      report.payments : report.operators).map(g => ({
        left: g.label, right: brl(g.total),
        subtitle: g.count + " venda(s)" + (context.view === "products" ? " | Marca: " + (g.brand || "Não informada") + " | Empreendimento: " + (g.producer || "Não informado") + " | Qtd. " + g.quantity : "")
      }));
  const newPage = () => {
    const page: PdfPage = { commands: [] };
    pages.push(page);
    pdfText(page, truncate(context.storeName || "PDV Nexus", 58), 44, 796, 17, true);
    pdfText(page, "RELATORIO DE VENDAS - " + viewTitle[context.view], 44, 771, 12, true);
    pdfText(page, "Periodo: " + (context.filters.from || "inicio") + " a " + (context.filters.to || "atual"), 44, 753);
    pdfText(page, "Gerado: " + context.generatedAt, 44, 739, 8);
    pdfLine(page, 44, 730, 507);
    pdfText(page, "Vendas: " + report.salesCount + "   Faturamento: " + brl(report.revenue), 44, 709, 10, true);
    pdfText(page, "Ticket medio: " + brl(report.ticket) + "   Produtos: " + report.quantity, 44, 692, 9);
    pdfText(page, "Pagamentos por item sao registrados ou de venda com forma unica.", 44, 672, 8);
    pdfText(page, "Apenas vendas do historico disponivel nesta instalacao.", 44, 659, 8);
    pdfLine(page, 44, 648, 507);
    return page;
  };
  let page = newPage(), y = 624;
  for (const row of rows) {
    const height = row.subtitle ? 42 : 29;
    if (y - height < 56) { page = newPage(); y = 624; }
    pdfText(page, truncate(row.left, 76), 44, y, 9, true);
    pdfText(page, truncate(row.right, 22), 447, y, 9, true);
    if (row.subtitle) pdfText(page, truncate(row.subtitle, 118), 44, y - 15, 8);
    pdfLine(page, 44, y - height + 9, 507);
    y -= height;
  }
  if (!rows.length) pdfText(page, "Nenhum registro para os filtros selecionados.", 44, y, 11);
  pages.forEach((p, index) => pdfText(p, "Pagina " + (index + 1) + " de " + pages.length +
    " - Relatorio gerencial, nao fiscal", 44, 28, 8));
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [" + pages.map((_, i) => (5 + 2 * i) + " 0 R").join(" ") +
    "] /Count " + pages.length + " >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  for (let i = 0; i < pages.length; i++) {
    const pageNo = 5 + 2 * i, contentNo = pageNo + 1;
    objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + contentNo + " 0 R >>");
    const stream = pages[i].commands.join("\n") + "\n";
    objects.push("<< /Length " + utf8(stream).length + " >>\nstream\n" + stream + "endstream");
  }
  const parts: Uint8Array[] = [utf8("%PDF-1.4\n")], offsets = [0];
  let offset = parts[0].length;
  for (let i = 0; i < objects.length; i++) {
    offsets.push(offset);
    const chunk = utf8((i + 1) + " 0 obj\n" + objects[i] + "\nendobj\n");
    parts.push(chunk); offset += chunk.length;
  }
  const xrefOffset = offset;
  const xref = "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n" +
    offsets.slice(1).map(v => String(v).padStart(10, "0") + " 00000 n \n").join("") +
    "trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xrefOffset + "\n%%EOF\n";
  parts.push(utf8(xref));
  const result = new Uint8Array(parts.reduce((sum, b) => sum + b.length, 0));
  let position = 0;
  for (const chunk of parts) { result.set(chunk, position); position += chunk.length; }
  return result;
}
