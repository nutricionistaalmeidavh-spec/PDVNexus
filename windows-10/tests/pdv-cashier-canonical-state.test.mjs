import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../apps/pdv-demo/src/PdvDemoApp.tsx", import.meta.url), "utf8");
const footer = fs.readFileSync(new URL("../apps/pdv-demo/src/CashierReferenceDecor.tsx", import.meta.url), "utf8");

test("sale footer gets canonical item and quantity counts, not text scraped from DOM", () => {
  assert.match(app, /data-pdv-order-items="true"/);
  assert.match(app, /data-pdv-item-count=\{sale\?\.items\.length \?\? 0\}/);
  assert.match(app, /data-pdv-item-quantity=\{itemCount\.toFixed\(3\)\}/);
  assert.match(app, /data-pdv-sale-active=\{sale \? "true" : "false"\}/);
  assert.match(footer, /getAttribute\("data-pdv-item-count"\)/);
  assert.match(footer, /getAttribute\("data-pdv-sale-active"\)/);
  assert.doesNotMatch(footer, /itemRows\.length/);
  assert.doesNotMatch(footer, /itemAreaText\.includes\("Pressione F2"\)/);
});
