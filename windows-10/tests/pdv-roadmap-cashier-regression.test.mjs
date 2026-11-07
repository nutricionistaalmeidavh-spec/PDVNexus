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
    assert.match(source, /CREDITO:\s*Number\(countedCreditDraft\)/);
    assert.match(source, /DEBITO:\s*Number\(countedDebitDraft\)/);
    assert.match(source, /placeholder="Crédito conferido"/);
    assert.match(source, /placeholder="Débito conferido"/);
    assert.doesNotMatch(source, /CREDITO:\s*Number\(countedCardDraft\)/);
    assert.doesNotMatch(source, /DEBITO:\s*Number\(countedCardDraft\)/);
  });

  test(`${edition}: atalhos não removem itens ao apagar textos nem vazam para outros módulos`, () => {
    assert.match(source, /if \(event\.isComposing \|\| event\.repeat\) return/);
    assert.match(source, /if \(isTyping && !isBarcodeField\) return/);
    assert.match(source, /if \(event\.key === "Delete" && isTyping\) return/);
    assert.match(source, /window\.location\.hash\.startsWith\("#\/caixa"\)/);
    assert.match(source, /event\.key === "F8"/);
  });
}
