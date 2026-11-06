import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../apps/pdv-demo/src/PdvDemoApp.tsx", import.meta.url), "utf8");

test("caixa exibe acao clara para iniciar venda sem depender apenas de tecla F2", () => {
  assert.match(source, />Nova venda \(F2\)<\/button>/);
  assert.match(source, /Para começar, clique em Nova venda/);
});

test("catalogo indica quando os cinco produtos sao exemplos e nao um limite", () => {
  assert.match(source, /hasOnlyDemoProducts/);
  assert.match(source, /5 produtos iniciais são exemplos/);
  assert.match(source, /sem limite de cinco/);
});

test("navegacao deixa os relatorios visiveis no nome do menu financeiro", () => {
  assert.match(source, /label: "Financeiro e relatórios"/);
});
