import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const edition of ["windows-10", "windows-7"]) {
  const app = readFileSync(new URL(`../../${edition}/apps/pdv-demo/src/PdvDemoApp.tsx`, import.meta.url), "utf8");
  const commercial = readFileSync(new URL(`../../${edition}/apps/pdv-demo/src/PdvCommercialPanel.tsx`, import.meta.url), "utf8");
  const dialog = readFileSync(new URL(`../../${edition}/apps/pdv-demo/src/PdvGuidedDialog.tsx`, import.meta.url), "utf8");

  test(`${edition}: diálogo guia ações com título, descrição, teclado e foco`, () => {
    assert.match(dialog, /role="dialog" aria-modal="true"/);
    assert.match(dialog, /aria-labelledby=/);
    assert.match(dialog, /event.key === "Escape"/);
    assert.match(dialog, /event.key !== "Tab"/);
    assert.match(dialog, /previousFocus\?\.focus\(\)/);
  });

  test(`${edition}: baixa financeira e despesas exigem revisão em diálogo`, () => {
    assert.match(commercial, /PdvGuidedDialog/);
    assert.match(commercial, /dialog === "settlement"/);
    assert.match(commercial, /dialog === "expense"/);
    assert.match(commercial, /reviewStep === "review"/);
    assert.match(commercial, /settlementBalance/);
    assert.match(commercial, /setDialog\("settlement"\)/);
  });

  test(`${edition}: recebimento físico e cadastro de compras são confirmados antes da mutação`, () => {
    assert.match(commercial, /dialog === "purchase-review"/);
    assert.match(commercial, /dialog === "purchase-receipt"/);
    assert.match(commercial, /receiptPurchaseId/);
    assert.match(commercial, /setDialog\("purchase-review"\)/);
  });

  test(`${edition}: estorno, estoque, fechamento cego e restauração usam confirmação guiada`, () => {
    assert.match(app, /pendingSensitiveAction === "stock"/);
    assert.match(app, /pendingSensitiveAction === "cancel"/);
    assert.match(app, /pendingSensitiveAction === "close"/);
    assert.match(app, /pendingRestore/);
    assert.match(app, /await runAutoBackup\("manual"\)/);
    assert.match(app, /PdvGuidedDialog/);
  });
}
