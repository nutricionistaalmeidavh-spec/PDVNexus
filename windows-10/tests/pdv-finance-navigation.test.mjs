import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const edition of ["windows-10", "windows-7"]) {
  const app = readFileSync(new URL(`../../${edition}/apps/pdv-demo/src/PdvDemoApp.tsx`, import.meta.url), "utf8");
  const panel = readFileSync(new URL(`../../${edition}/apps/pdv-demo/src/PdvCommercialPanel.tsx`, import.meta.url), "utf8");

  test(`${edition}: menu Financeiro renderiza contas a pagar/receber, não uma página vazia`, () => {
    assert.match(app, /route === "\/gestao" \|\| route === "\/financeiro"/);
    assert.match(app, /mode=\{route === "\/financeiro" \? "financeiro" : "gestao"\}/);
    assert.match(panel, /const activeView = mode === "financeiro" \? "financeiro" : view/);
    assert.match(panel, /activeView === "financeiro"/);
    assert.match(panel, /A pagar/);
    assert.match(panel, /A receber/);
  });

  test(`${edition}: relatórios de lucratividade e compras seguem em Gestão Comercial`, () => {
    assert.match(panel, /mode === "financeiro" \? \[\] : \["compras", "relatorios"\]/);
    assert.match(panel, /activeView === "compras"/);
    assert.match(panel, /activeView === "relatorios"/);
  });
}
