import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(resolve(root, "qa/artisys-qa.demo.config.json"), "utf8"));
const flow = JSON.parse(readFileSync(resolve(root, "qa/flows/pdv-demo-90s.json"), "utf8"));
const workflowSource = readFileSync(resolve(root, "../.github/workflows/pdv-demo-90s.yml"), "utf8");
const entrySource = readFileSync(resolve(root, "qa/pdv-demo-ephemeral-entry.cjs"), "utf8");

const seedStep = flow.steps.find((step) => step.action === "desktopStoreSet" && step.name === "carregar-dados-demo");
const seed = seedStep?.value;

test("demo comercial tem perfil dedicado de 90 segundos", () => {
  const demo = config.demos["commercial-flow-90s"];
  assert.equal(demo.durationTargetSec, 90);
  assert.equal(demo.file, "flows/pdv-demo-90s.json");
  assert.equal(demo.preset, "landscape-16x9");
});

test("seed demo cobre catalogo, clientes, vendas e operacao sem depender de dados reais", () => {
  assert.ok(seed);
  assert.ok(seed.catalogProducts.length >= 10);
  assert.ok(seed.registeredCustomers.length >= 6);
  assert.ok(seed.completedSales.length >= 6);
  assert.ok(seed.paymentOptions.length >= 7);
  assert.ok(seed.extensions.inventoryMovements.length >= 3);
  assert.ok(seed.extensions.users.length >= 2);
  assert.ok(seed.extensions.promotionGroups.length >= 1);
  assert.equal(seed.extensions.storeSettings.showOnReceipt, true);
});

test("dados demo usam userData isolado e sao limpos ao fim do fluxo", () => {
  const cleanup = flow.steps.at(-1);
  assert.equal(cleanup.action, "desktopStoreSet");
  assert.equal(cleanup.name, "limpar-dados-demo");
  assert.deepEqual(cleanup.value, {});
  assert.equal(config.electron.entry, "pdv-demo-ephemeral-entry.cjs");
  assert.match(entrySource, /mkdtempSync/);
  assert.match(entrySource, /app\.setPath\(["']userData["']/);
  assert.match(workflowSource, /runs-on: windows-latest/);
});

test("fluxo comercial demonstra telas e conclui venda real", () => {
  const actions = flow.steps.map((step) => `${step.action}:${step.name || ""}`);
  for (const marker of [
    "click:abrir-produtos",
    "click:abrir-clientes",
    "click:abrir-caixa",
    "fill:observacao-venda",
    "press:finalizar-venda",
    "click:abrir-financeiro"
  ]) {
    assert.ok(actions.includes(marker), `passo ausente: ${marker}`);
  }
});
