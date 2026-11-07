import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../apps/pdv-demo/src/PdvDemoApp.tsx", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../packages/ui/src/index.tsx", import.meta.url), "utf8");

test("caixa exibe acao clara para iniciar venda sem depender apenas de tecla F2", () => {
  assert.match(source, />Nova venda \(F2\)<\/button>/);
  assert.match(source, /aria-label="Iniciar nova venda"/);
  assert.match(source, /Pressione F2 ou clique em Nova venda/);
  assert.match(source, /role="status" aria-live="polite"/);
  assert.doesNotMatch(source, /cashierSubtitle:\s*\{\s*display:\s*"none"/);
});

test("catalogo indica quando os cinco produtos sao exemplos e nao um limite", () => {
  assert.match(source, /hasOnlyDemoProducts/);
  assert.match(source, /5 produtos iniciais são exemplos/);
  assert.match(source, /sem limite de cinco/);
});

test("navegacao separa relatorios em Vendas e operacional em Financeiro", () => {
  assert.match(source, /key: "vendas", label: "Vendas e relatórios", path: "\/vendas"/);
  assert.match(source, /key: "financeiro", label: "Financeiro", path: "\/financeiro"/);
  assert.match(shell, /vendas: "Vendas e relatórios"/);
  assert.match(shell, /financeiro: "Financeiro"/);
});


test("guia de primeiro acesso permite informar troco antes de abrir o caixa", () => {
  for (const edition of ["../", "../../windows-7/"]) {
    const file = fs.readFileSync(new URL(edition + "apps/pdv-demo/src/PdvFirstUseGuide.tsx", import.meta.url), "utf8");
    const app = fs.readFileSync(new URL(edition + "apps/pdv-demo/src/PdvDemoApp.tsx", import.meta.url), "utf8");
    assert.match(file, /Troco inicial \(R\$\)/);
    assert.match(file, /onOpenCash\(initialAmount\)/);
    assert.match(app, /onOpenCash=\{\(amount\) => openCash\(amount\)\}/);
  }
});

test("se não encontrar produto, oferece cadastro separado do lançamento de venda", () => {
  for (const edition of ["../", "../../windows-7/"]) {
    const file = fs.readFileSync(new URL(edition + "apps/pdv-demo/src/PdvProductPicker.tsx", import.meta.url), "utf8");
    const app = fs.readFileSync(new URL(edition + "apps/pdv-demo/src/PdvDemoApp.tsx", import.meta.url), "utf8");
    assert.match(file, /Cadastrar novo produto/);
    assert.match(file, /onCreateProduct/);
    assert.match(app, /onCreateProduct=\{\(\) =>/);
  }
});
