import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, "qa/artisys-qa.demo.config.json");
const flowPath = resolve(root, "qa/flows/pdv-demo-90s.json");
const desktopQaMainPath = resolve(root, "apps/nexus-desktop/main.qa.cjs");
const workflowPath = resolve(root, "../.github/workflows/pdv-demo-90s.yml");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

test("demo completo de 90s possui perfil dedicado sem substituir checkout curto", () => {
  assert.ok(manifest.demos?.["full-90s"], "demo full-90s ausente");
  assert.ok(manifest.demos?.["checkout-flow"], "checkout-flow curto deve continuar existindo");
  assert.equal(manifest.demos["full-90s"].file, "flows/pdv-demo-90s.json");
  assert.equal(manifest.demos["full-90s"].durationTargetSec, 90);
  assert.deepEqual(manifest.demos["full-90s"].captureViewport, { width: 1440, height: 960 });
});

test("flow de 90s usa dataset demo completo e percorre produtos, estoque, caixa e financeiro", () => {
  assert.ok(existsSync(flowPath), "qa/flows/pdv-demo-90s.json ausente");
  const flow = JSON.parse(readFileSync(flowPath, "utf8"));
  const seed = flow.steps.find((step) => step.action === "desktopStoreSet" && step.key === "nexus-core:pdv-store:v1");
  assert.ok(seed, "seed temporario do PDV ausente");
  assert.ok(seed.value.catalogProducts.length >= 10, "catalogo demo precisa de pelo menos 10 produtos");
  assert.ok(seed.value.registeredCustomers.length >= 5, "demo precisa de pelo menos 5 clientes");
  assert.ok(seed.value.completedSales.length >= 3, "demo precisa de historico de vendas");
  assert.ok(seed.value.extensions.inventoryMovements.length >= 3, "demo precisa de historico de estoque");
  assert.equal(seed.value.extensions.storeSettings.showOnReceipt, true);
  const selectors = flow.steps.map((step) => step.selector || "").join("\n");
  assert.match(selectors, /#\/produtos/);
  assert.match(selectors, /#\/caixa/);
  assert.match(selectors, /#\/financeiro/);
});

test("Electron do QA usa userData isolado e nunca o perfil normal do cliente", () => {
  assert.equal(manifest.electron.entry, "../apps/nexus-desktop/main.qa.cjs");
  assert.equal(manifest.environments.local.env.NEXUS_USER_DATA_DIR, ".artisys-qa/pdv-demo-isolated");
  const source = readFileSync(desktopQaMainPath, "utf8");
  assert.match(source, /NEXUS_USER_DATA_DIR/);
  assert.match(source, /app\.setPath\(["']userData["']/);
  assert.match(source, /require\(["']\.\/main\.cjs["']\)/);
});

test("workflow dedicado gera e publica apenas o artefato do demo 90s", () => {
  assert.ok(existsSync(workflowPath), ".github/workflows/pdv-demo-90s.yml ausente");
  const workflow = readFileSync(workflowPath, "utf8");
  assert.match(workflow, /--demo full-90s/);
  assert.match(workflow, /PDV-Nexus-Demo-90s/);
  assert.match(workflow, /qa-demo-90s-artifacts/);
  assert.match(workflow, /ffprobe/);
});
