import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(resolve(root, "qa/artisys-qa.demo.config.json"), "utf8"));
const flowPath = resolve(root, "qa/flows/pdv-tutorial-20s.json");
const workflowSource = readFileSync(resolve(root, "../.github/workflows/pdv-tutorial-20s.yml"), "utf8");

test("tutorial usa perfil dedicado de 20 segundos", () => {
  const demo = config.demos["quick-sale-tutorial-20s"];
  assert.ok(demo, "demo quick-sale-tutorial-20s ausente");
  assert.equal(demo.durationTargetSec, 20);
  assert.equal(demo.file, "flows/pdv-tutorial-20s.json");
  assert.equal(demo.preset, "landscape-16x9");
  assert.deepEqual(demo.captureViewport, { width: 1440, height: 960 });
});

test("tutorial executa cadastro, abertura de caixa e venda real", () => {
  assert.equal(existsSync(flowPath), true, "fluxo pdv-tutorial-20s.json ausente");
  const flow = JSON.parse(readFileSync(flowPath, "utf8"));
  const actions = flow.steps.map((step) => `${step.action}:${step.name || ""}`);

  for (const marker of [
    "click:abrir-produtos",
    "click:novo-produto",
    "fill:preencher-codigo",
    "fill:preencher-descricao",
    "fill:preencher-preco",
    "click:cadastrar-produto",
    "click:abrir-caixa-tutorial",
    "click:abrir-caixa",
    "click:nova-venda",
    "fill:digitar-produto",
    "press:adicionar-produto",
    "press:pagamento-a-vista",
    "press:finalizar-venda"
  ]) {
    assert.ok(actions.includes(marker), `passo ausente: ${marker}`);
  }
});

test("workflow gera e publica MP4 final do tutorial", () => {
  assert.match(workflowSource, /demo --config qa\/artisys-qa\.demo\.config\.json --demo quick-sale-tutorial-20s/);
  assert.match(workflowSource, /PDV-Nexus-Tutorial-20s\.mp4/);
  assert.match(workflowSource, /videoDurationSec/);
  assert.match(workflowSource, /upload-artifact@v4/);
});
