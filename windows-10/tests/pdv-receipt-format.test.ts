import assert from "node:assert/strict";
import test from "node:test";
import { buildReceiptPrintHtml, normalizeReceiptPaperFormat, receiptColumnsForFormat } from "../apps/pdv-demo/src/receiptPrintFormat";

test("receipt paper formats keep thermal widths and add A4 half-page width", () => {
  assert.equal(receiptColumnsForFormat("58mm"), 32);
  assert.equal(receiptColumnsForFormat("80mm"), 42);
  assert.equal(receiptColumnsForFormat("a4-half"), 90);
});

test("legacy receipt printer settings migrate to the matching paper format", () => {
  assert.equal(normalizeReceiptPaperFormat(undefined, 32), "58mm");
  assert.equal(normalizeReceiptPaperFormat(undefined, 42), "80mm");
  assert.equal(normalizeReceiptPaperFormat(undefined, 90), "a4-half");
});

test("A4 half-page print HTML targets the upper half and escapes receipt content", () => {
  const html = buildReceiptPrintHtml("<cupom>&\"'", "a4-half");
  assert.match(html, /size: A4 portrait/);
  assert.match(html, /height: 148\.5mm/);
  assert.match(html, /width: 210mm/);
  assert.match(html, /&lt;cupom&gt;&amp;&quot;&#39;/);
});

test("thermal receipt HTML remains compact and does not force A4", () => {
  const html = buildReceiptPrintHtml("CUPOM", "58mm");
  assert.doesNotMatch(html, /size: A4 portrait/);
  assert.match(html, /font-size: 12px/);
});
