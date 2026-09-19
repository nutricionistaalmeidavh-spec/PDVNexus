import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const mainPath = resolve(root, "apps/pdv-demo/src/main.tsx");
const decorPath = resolve(root, "apps/pdv-demo/src/CustomerPresentationDecor.tsx");
const cssPath = resolve(root, "apps/pdv-demo/src/pdv-e55.css");
const cashierCssPath = resolve(root, "apps/pdv-demo/src/pdv-cashier-v3.css");
const observationFixCssPath = resolve(root, "apps/pdv-demo/src/pdv-observation-layout-fix.css");
const legibilityCssPath = resolve(root, "apps/pdv-demo/src/pdv-cashier-legibility-fix.css");
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
  assert.ok(fixImport > e55Import, "observation layout fix must load after E55");
});

test("cashier summary strip remains high-contrast when sale observation inserts its anchor", () => {
  const css = read(observationFixCssPath);
  assert.match(css, /aside:has\(> div\[data-sale-observation-anchor="true"\]\) > div:nth-of-type\(4\)[\s\S]*?background:\s*#ffffff\s*!important/);
  assert.match(css, /div:nth-of-type\(4\) strong[\s\S]*?color:\s*#102642\s*!important/);
  assert.match(css, /aside:has\(> div\[data-sale-observation-anchor="true"\]\) > div:nth-of-type\(5\)[\s\S]*?background:\s*#062d57\s*!important/);
  assert.match(css, /div:nth-of-type\(5\)::before[\s\S]*?color:\s*#ffffff\s*!important/);
});

test("cashier total card is one-third shorter, centered, and shortcut area receives the freed vertical space", () => {
  const cashierCss = read(cashierCssPath);
  const observationCss = read(observationFixCssPath);

  assert.match(cashierCss, /grid-template-rows:\s*52px\s+62px\s+56px\s+210px\s+40px\s+52px\s+52px\s+30px\s+38px\s+134px\s*!important/);
  assert.match(cashierCss, /aside\s*>\s*div:last-of-type\s*\{[\s\S]*?min-height:\s*134px\s*!important[\s\S]*?height:\s*134px\s*!important/);

  assert.match(observationCss, /div:nth-of-type\(5\)\s*\{[\s\S]*?min-height:\s*62px\s*!important[\s\S]*?height:\s*62px\s*!important/);
  assert.match(observationCss, /div:nth-of-type\(5\)\s*\{[\s\S]*?display:\s*flex\s*!important[\s\S]*?align-items:\s*center\s*!important[\s\S]*?justify-content:\s*center\s*!important[\s\S]*?text-align:\s*center\s*!important/);
});

test("cashier legibility layer loads last and isolates the sale observation from the product list grid cell", () => {
  assert.ok(existsSync(legibilityCssPath), "pdv-cashier-legibility-fix.css must exist");
  const main = read(mainPath);
  const observationImport = main.indexOf('import "./pdv-observation-layout-fix.css"');
  const legibilityImport = main.indexOf('import "./pdv-cashier-legibility-fix.css"');
  assert.ok(observationImport >= 0, "observation fix import must exist");
  assert.ok(legibilityImport > observationImport, "legibility fix must load last");

  const css = read(legibilityCssPath);
  assert.match(css, /> div\[data-sale-observation-anchor="true"\]\s*\{[\s\S]*?grid-row:\s*7\s*\/\s*11\s*!important[\s\S]*?grid-column:\s*1\s*!important/);
  assert.match(css, /> div\[data-sale-observation-anchor="true"\]\s*\{[\s\S]*?height:\s*auto\s*!important[\s\S]*?border:\s*0\s*!important[\s\S]*?background:\s*transparent\s*!important/);
});

test("cashier legibility increases total, table and shortcut typography without growing the total card", () => {
  const css = read(legibilityCssPath);
  assert.match(css, /div:nth-of-type\(5\)\s*\{[\s\S]*?height:\s*62px\s*!important[\s\S]*?font-size:\s*34px\s*!important/);
  assert.match(css, /div:nth-of-type\(5\)::before[\s\S]*?font-size:\s*10px\s*!important/);
  assert.match(css, /div:nth-of-type\(3\)\s*>\s*div[\s\S]*?font-size:\s*11px\s*!important/);
  assert.match(css, /aside\s*>\s*div:last-of-type\s*>\s*button[\s\S]*?font-size:\s*11px\s*!important/);
});
