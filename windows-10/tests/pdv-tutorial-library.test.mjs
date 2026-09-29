import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const configPath = path.join(root, "qa", "artisys-qa.demo.config.json");

const expected = [
  ["cash-open-close-tutorial", "flows/tutorial-caixa-abertura-fechamento.json"],
  ["stock-adjustment-tutorial", "flows/tutorial-estoque-consulta-ajuste.json"],
  ["customer-register-tutorial", "flows/tutorial-cliente-cadastro.json"],
  ["sales-history-tutorial", "flows/tutorial-historico-vendas.json"],
  ["reports-dashboard-tutorial", "flows/tutorial-relatorios-dashboard.json"]
];

test("configura os cinco tutoriais comerciais", () => {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  for (const [demoId, flowFile] of expected) {
    assert.ok(config.demos?.[demoId], `demo ausente: ${demoId}`);
    assert.equal(config.demos[demoId].file, flowFile);
    assert.equal(config.demos[demoId].preset, "landscape-16x9");
    assert.equal(config.demos[demoId].durationTargetSec, 20);
    assert.ok(fs.existsSync(path.join(root, "qa", flowFile)), `flow ausente: ${flowFile}`);
  }
});

test("cada tutorial tem jornada curta, real e verificável", () => {
  for (const [, flowFile] of expected) {
    const flow = JSON.parse(fs.readFileSync(path.join(root, "qa", flowFile), "utf8"));
    assert.ok(Array.isArray(flow.steps));
    assert.ok(flow.steps.length >= 4, `${flowFile} precisa de passos reais`);
    assert.ok(flow.steps.some((step) => step.action === "expectVisible"), `${flowFile} precisa validar a UI`);
    assert.ok(flow.steps.some((step) => step.action === "screenshot"), `${flowFile} precisa capturar o estado final`);
  }
});
