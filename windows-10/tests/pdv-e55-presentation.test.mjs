import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const mainPath = resolve(root, "apps/pdv-demo/src/main.tsx");
const decorPath = resolve(root, "apps/pdv-demo/src/CustomerPresentationDecor.tsx");
const cssPath = resolve(root, "apps/pdv-demo/src/pdv-e55.css");
const observationFixCssPath = resolve(root, "apps/pdv-demo/src/pdv-observation-layout-fix.css");
const demoFlowPath = resolve(root, "qa/flows/pdv-demo.json");

function read(path) {
  return readFileSync(path, "utf8");
}

test("E55 mounts a dedicated customer presentation layer", () => {
  assert.ok(existsSync(decorPath), "CustomerPresentationDecor.tsx must exist");
  assert.ok(existsSync(cssPath), "pdv-e55.css must exist");

  const main = read(mainPath);
  assert.match(main, /CustomerPresentationDecor/);
  assert.match(main, /pdv-e55\.css/);
});

test("E55 makes the non-fiscal nature explicit in the visible application chrome", () => {
  assert.ok(existsSync(decorPath), "CustomerPresentationDecor.tsx must exist");
  const decor = read(decorPath);
  assert.match(decor, /NÃO FISCAL/);
  assert.match(decor, /data-e55-non-fiscal/);
});

test("E55 keeps protocol and diagnostic controls out of the normal customer view", () => {
  assert.ok(existsSync(cssPath), "pdv-e55.css must exist");
  const css = read(cssPath);
  assert.match(css, /data-view="balanca"/);
  assert.match(css, /data-view="administracao"/);
  assert.match(css, /e55-technical/);
});

test("E55 keeps customer-facing peripheral cards useful after hiding diagnostics", () => {
  const decor = read(decorPath);
  assert.match(decor, /Selecione a marca do equipamento/);
  assert.match(decor, /Sem integração automática/);
  assert.match(decor, /Maquininha integrada/);
  assert.match(decor, /Ver backups salvos/);
  assert.match(decor, /Sistema pronto/);
});

test("E55 demo flow captures a realistic multi-item retail sale", () => {
  const flow = read(demoFlowPath);
  assert.match(flow, /00021/);
  assert.match(flow, /00034/);
  assert.match(flow, /00103/);
  assert.match(flow, /100,89/);
});

test("cashier observation layout fix loads after presentation layers", () => {
  assert.ok(existsSync(observationFixCssPath), "pdv-observation-layout-fix.css must exist");
  const main = read(mainPath);
  const e55Import = main.indexOf('import "./pdv-e55.css"');
  const fixImport = main.indexOf('import "./pdv-observation-layout-fix.css"');
  assert.ok(e55Import >= 0, "pdv-e55.css import must exist");
  assert.ok(fixImport > e55Import, "observation layout fix must load last");
});

test("cashier summary strip remains high-contrast when sale observation inserts its anchor", () => {
  const css = read(observationFixCssPath);
  assert.match(css, /aside:has\(> div\[data-sale-observation-anchor="true"\]\) > div:nth-of-type\(4\)[\s\S]*?background:\s*#ffffff\s*!important/);
  assert.match(css, /div:nth-of-type\(4\) strong[\s\S]*?color:\s*#102642\s*!important/);
  assert.match(css, /aside:has\(> div\[data-sale-observation-anchor="true"\]\) > div:nth-of-type\(5\)[\s\S]*?background:\s*#062d57\s*!important/);
  assert.match(css, /div:nth-of-type\(5\)::before[\s\S]*?color:\s*#ffffff\s*!important/);
});
