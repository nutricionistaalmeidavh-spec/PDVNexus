import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shortManifestPath = resolve(root, "qa/artisys-qa.demo.config.json");
const demo90ManifestPath = resolve(root, "qa/artisys-qa.demo90.config.json");
const flowPath = resolve(root, "qa/flows/pdv-demo-90s.json");
const fixturePath = resolve(root, "qa/fixtures/pdv-demo-90s-seed.json");
const desktopQaMainPath = resolve(root, "apps/nexus-desktop/main.qa.cjs");
const workflowPath = resolve(root, "../.github/workflows/pdv-demo-90s.yml");

const shortManifest = JSON.parse(readFileSync(shortManifestPath, "utf8"));
const manifest90 = JSON.parse(readFileSync(demo90ManifestPath, "utf8"));

test("demo de 90s possui manifesto dedicado e preserva o checkout curto", () => {
  assert.ok(shortManifest.demos?.["checkout-flow"], "checkout-flow curto deve continuar existindo");
  assert.equal(shortManifest.demos?.["full-90s"], undefined, "demo longo nao deve contaminar o manifesto curto");
  assert.ok(manifest90.demos?.["full-90s"], "demo full-90s ausente");
  assert.equal(manifest90.demos["full-90s"].file, "flows/pdv-demo-90s.json");
  assert.equal(manifest90.demos["full-90s"].durationTargetSec, 90);
  assert.deepEqual(manifest90.demos["full-90s"].captureViewport, { width: 1440, height: 960 });
});

test("dataset demo completo fica isolado em fixture temporaria", () => {
  assert.ok(existsSync(fixturePath), "fixture demo ausente");
  const seed = JSON.parse(readFileSync(fixturePath, "utf8"));
  assert.ok(seed.catalogProducts.length >= 10, "catalogo demo precisa de pelo menos 10 produtos");
  assert.ok(seed.registeredCustomers.length >= 5, "demo precisa de pelo menos 5 clientes");
  assert.ok(seed.completedSales.length >= 3, "demo precisa de historico de vendas");
  assert.ok(seed.extensions.inventoryMovements.length >= 3, "demo precisa de historico de estoque");
  assert.ok(seed.extensions.cashClosings.length >= 2, "demo precisa de historico de fechamento de caixa");
  assert.equal(seed.extensions.storeSettings.showOnReceipt, true);
  assert.equal(manifest90.environments.local.env.NEXUS_QA_PDV_SEED_FILE, "fixtures/pdv-demo-90s-seed.json");
  assert.equal(manifest90.environments.local.env.NEXUS_USER_DATA_DIR, ".artisys-qa/pdv-demo-90s-isolated");
});

test("flow real de 90s percorre produtos, estoque, clientes, caixa e financeiro sem reload", () => {
  assert.ok(existsSync(flowPath), "qa/flows/pdv-demo-90s.json ausente");
  const flow = JSON.parse(readFileSync(flowPath, "utf8"));
  assert.equal(flow.steps.some((step) => step.action === "desktopStoreSet"), false);
  assert.equal(flow.steps.some((step) => step.action === "reload"), false);
  const selectors = flow.steps.map((step) => step.selector || "").join("\n");
  assert.match(selectors, /#\/produtos/);
  assert.match(selectors, /#\/clientes/);
  assert.match(selectors, /#\/caixa/);
  assert.match(selectors, /#\/financeiro/);
});

test("Electron de QA pre-carrega SQLite somente no perfil isolado", () => {
  assert.equal(manifest90.electron.entry, "../apps/nexus-desktop/main.qa.cjs");
  const source = readFileSync(desktopQaMainPath, "utf8");
  assert.match(source, /NEXUS_USER_DATA_DIR/);
  assert.match(source, /NEXUS_QA_PDV_SEED_FILE/);
  assert.match(source, /app\.setPath\(["']userData["']/);
  assert.match(source, /pdv-nexus\.sqlite/);
  assert.match(source, /node:sqlite/);
  assert.match(source, /require\(["']\.\/main\.cjs["']\)/);
});

test("workflow dedicado gera e publica apenas o artefato do demo 90s", () => {
  assert.ok(existsSync(workflowPath), ".github/workflows/pdv-demo-90s.yml ausente");
  const workflow = readFileSync(workflowPath, "utf8");
  assert.match(workflow, /artisys-qa\.demo90\.config\.json/);
  assert.match(workflow, /--demo full-90s/);
  assert.match(workflow, /PDV-Nexus-Demo-90s/);
  assert.match(workflow, /qa-demo-90s-artifacts/);
  assert.match(workflow, /ffprobe/);
});
