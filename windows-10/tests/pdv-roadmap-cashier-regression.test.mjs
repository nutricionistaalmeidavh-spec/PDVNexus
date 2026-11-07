import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const editions = [
  "../apps/pdv-demo/src/PdvDemoApp.tsx",
  "../../windows-7/apps/pdv-demo/src/PdvDemoApp.tsx"
];

for (const edition of editions) {
  const source = readFileSync(new URL(edition, import.meta.url), "utf8");

  test(`${edition}: crédito e débito usam contagens distintas no fechamento`, () => {
    assert.match(source, /buildPdvCashCount\(\{/);
    assert.match(source, /credit: countedCreditDraft, debit: countedDebitDraft/);
    assert.match(source, /placeholder="Crédito conferido"/);
    assert.match(source, /placeholder="Débito conferido"/);
    assert.doesNotMatch(source, /CREDITO:\s*Number\(countedCardDraft\)/);
    assert.doesNotMatch(source, /DEBITO:\s*Number\(countedCardDraft\)/);
  });

  test(`${edition}: atalhos não removem itens ao apagar textos nem vazam para outros módulos`, () => {
    assert.match(source, /shouldHandlePdvHotkey\(event\.key/);
    assert.match(source, /modifiers: event\.ctrlKey/);
    assert.match(source, /dialogOpen/);
    assert.match(source, /if \(event\.key === "F8"\) finalizeSale\(\)/);
  });
}
