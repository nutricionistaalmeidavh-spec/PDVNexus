import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const files = [
  "../apps/pdv-demo/src/PdvDemoApp.tsx",
  "../../windows-7/apps/pdv-demo/src/PdvDemoApp.tsx",
  "../apps/pdv-demo/src/batchInventory.ts",
  "../../windows-7/apps/pdv-demo/src/batchInventory.ts"
];
test("nunca descartar vendas, estornos, logs ou movimentos após 100/200 eventos", () => {
  for(const name of files) {
    const source = fs.readFileSync(new URL(name, import.meta.url), "utf8");
    assert.doesNotMatch(source, /maxCompletedSales:\s*100/);
    assert.doesNotMatch(source, /\.slice\(0,\s*(?:100|200)\)/);
  }
});
test("cadastro simples, modo avançado, roteiro inicial e seletor visual são acessíveis", () => {
  for(const name of files.slice(0,2)){
    const source=fs.readFileSync(new URL(name, import.meta.url),"utf8");
    assert.match(source,/data-pdv-first-use-guide/);
    assert.match(source,/Opções avançadas/);
    assert.match(source,/Escolher produto/);
    assert.match(source,/Marca \(opcional\)/);
    assert.match(source,/Custo de aquisição/);
    assert.match(source,/Margem bruta/);
  }
});
