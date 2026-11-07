import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = (platform, name) => readFileSync(resolve(root, platform, "apps/pdv-demo/src", name), "utf8");

for (const platform of ["windows-7", "windows-10"]) {
  test(`${platform}: o painel comercial não oferece emissão ou preparação fiscal`, () => {
    const panel = source(platform, "PdvCommercialPanel.tsx");
    assert.doesNotMatch(panel, /Preparação fiscal|Preparação de emissão fiscal|Salvar preparação fiscal|NFC-e|NF-e|buildFiscalReadiness|updateCommercialFiscalProfile/);
    assert.match(panel, /Compras e fornecedores/);
    assert.match(panel, /Contas e despesas/);
    assert.match(panel, /Lucratividade/);
  });

  test(`${platform}: ledger é comercial, sem cadastro ou gate de emissor fiscal`, () => {
    const ledger = source(platform, "commercialLedger.ts");
    assert.doesNotMatch(ledger, /CommercialFiscalProfile|fiscalProfile|updateCommercialFiscalProfile|FiscalReadinessInput|buildFiscalReadiness/);
    assert.match(ledger, /receivePurchase/);
    assert.match(ledger, /summarizeCommercial/);
  });

  test(`${platform}: comprovante de venda continua não fiscal`, () => {
    const app = source(platform, "PdvDemoApp.tsx");
    assert.match(app, /documentLabel:\s*"CUPOM NAO FISCAL"/);
  });
}

test("QA visual não exige tela fiscal indevida", () => {
  const flow = readFileSync(resolve(root, "windows-10/qa/flows/ui-review.json"), "utf8");
  assert.doesNotMatch(flow, /open-fiscal-readiness|fiscal-readiness-gated|fiscal-preparacao/);
});
