import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const edition of ["windows-10", "windows-7"]) {
  const app = readFileSync(new URL(`../../${edition}/apps/pdv-demo/src/PdvDemoApp.tsx`, import.meta.url), "utf8");
  const panel = readFileSync(new URL(`../../${edition}/apps/pdv-demo/src/PdvCommercialPanel.tsx`, import.meta.url), "utf8");
  const finance = readFileSync(new URL(`../../${edition}/apps/pdv-demo/src/PdvFinancePanel.tsx`, import.meta.url), "utf8");
  const model = readFileSync(new URL(`../../${edition}/apps/pdv-demo/src/commercialLedger.ts`, import.meta.url), "utf8");

  test(`${edition}: menu Financeiro renderiza contas a pagar/receber, não uma página vazia`, () => {
    assert.match(app, /route === "\/gestao" \|\| route === "\/financeiro"/);
    assert.match(app, /mode=\{route === "\/financeiro" \? "financeiro" : "gestao"\}/);
    assert.match(panel, /const activeView = mode === "financeiro" \? "financeiro" : view/);
    assert.match(panel, /activeView === "financeiro"/);
    assert.match(panel, /A pagar/);
    assert.match(panel, /A receber/);
    assert.match(panel, /PdvFinancePanel/);
    assert.match(finance, /Matriz financeira/);
    assert.match(finance, /data-pdv-kanban/);
    assert.match(finance, /buildPdvFinanceKanban/);
    assert.match(finance, /Acesso restrito ao Financeiro/);
    assert.match(model, /settleExpense/);
  });

  test(`${edition}: relatórios de lucratividade e compras seguem em Gestão Comercial`, () => {
    assert.match(panel, /mode === "financeiro" \? \[\] : \["compras", "relatorios"\]/);
    assert.match(panel, /activeView === "compras"/);
    assert.match(panel, /activeView === "relatorios"/);
  });
}

test("QA visual executa contas a pagar na rota Financeiro, não em aba antiga de Gestão", () => {
  const flow = JSON.parse(readFileSync(new URL("../qa/flows/ui-review.json", import.meta.url), "utf8"));
  const openAccounts = flow.steps.find(step => step.name === "open-payables");
  assert.equal(openAccounts.selector, 'a[href="#/financeiro"]');
  assert.ok(flow.steps.some(step => step.name === "ledger-settlements" && step.action === "expectVisible"));
  assert.ok(flow.steps.some(step => step.name === "return-to-commercial-for-profit" && step.selector === 'a[href="#/gestao"]'));
});

test("QA cobre Matriz, Kanban e exportações offline do Financeiro sem alterar saldos",()=>{
 const flow=JSON.parse(readFileSync(new URL("../qa/flows/ui-review.json",import.meta.url),"utf8"));
 assert.equal(flow.steps.find(x=>x.name==="financeiro-saldos-a-pagar").selector,'[data-pdv-finance-kpi="payable"]');
 for(const step of ["open-finance-kanban","finance-kanban-columns","finance-xlsx-export","finance-pdf-export","return-to-finance-matrix"])
  assert.ok(flow.steps.some(x=>x.name===step),"Etapa ausente: "+step);
});
