import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const edition of ["windows-10", "windows-7"]) {
  const guide = readFileSync(new URL(`../../${edition}/apps/pdv-demo/src/PdvFirstUseGuide.tsx`, import.meta.url), "utf8");
  const app = readFileSync(new URL(`../../${edition}/apps/pdv-demo/src/PdvDemoApp.tsx`, import.meta.url), "utf8");

  test(`${edition}: tutorial de primeiro acesso tem cinco etapas e progresso acessível`, () => {
    for (const step of ["Dados da loja", "Segurança e gerente", "Cadastrar produto", "Abrir o caixa", "Primeira venda"]) {
      assert.ok(guide.includes(step), step);
    }
    assert.match(guide, /role="progressbar"/);
    assert.match(guide, /PdvGuidedDialog/);
    assert.match(guide, /Tutorial guiado/);
    assert.match(guide, /Troco inicial \(R\$\)/);
    assert.match(guide, /onOpenCash\(initialAmount\)/);
    assert.match(guide, /onAddProduct/);
    assert.match(guide, /onConfigureStore/);
    assert.match(guide, /onConfigureManager/);
    assert.match(guide, /onStartSale/);
    assert.match(guide, /onDismiss/);
  });

  test(`${edition}: prontidão é canônica, sem concluir etapas por cliques ou por dados de exemplo`, () => {
    assert.match(app, /storeSettings\.storeName\.trim\(\)/);
    assert.match(app, /needsManagerSetup/);
    assert.match(app, /!seedProducts\.some/);
    assert.match(app, /cashSession/);
    assert.match(app, /completedSales\.length > 0/);
    assert.match(app, /onOpenCash=\{\(amount\) => openCash\(amount\)\}/);
    assert.doesNotMatch(guide, /localStorage|sessionStorage|fetch\(/);
  });

  test(`${edition}: usuário pode dispensar e reabrir roteiro nas configurações`, () => {
    assert.match(app, /pdv-nexus:first-use-guide-dismissed:v1/);
    assert.match(app, /Reabrir tutorial de primeiro acesso/);
    assert.match(app, /setGuideDismissed\(false\)/);
    assert.match(app, /setGuideDismissed\(true\)/);
    assert.match(app, /data-pdv-first-use-guide/);
  });
}
