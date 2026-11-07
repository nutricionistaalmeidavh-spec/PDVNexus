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
    assert.match(finance, /A pagar/);
    assert.match(finance, /A receber/);
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

test("E2E da forma de pagamento autentica gerente existente; não oferece bootstrap quando o seed já tem PIN", () => {
 const flow = JSON.parse(readFileSync(new URL("../qa/business-flows.json",import.meta.url),"utf8"));
 const actions = flow.flows.find(x=>x.id==="payment-method-create")?.steps ?? [];
 assert.ok(actions.some(x=>x.name==="select-existing-manager" && x.value==="GER-001"));
 assert.ok(actions.some(x=>x.name==="authenticate-existing-manager"));
 assert.ok(!actions.some(x=>x.name==="bootstrap-finance-manager"));
});

test("QA cobre parcelamento real em 3x e trilha financeira de auditoria",()=>{
 const business=JSON.parse(readFileSync(new URL("../qa/business-flows.json",import.meta.url),"utf8"));
 const flow=business.flows.find(x=>x.id==="sale-store-credit");
 assert.ok(flow.steps.some(x=>x.name==="selecionar-3-parcelas" && x.value==="3"));
 assert.ok(flow.steps.some(x=>x.name==="segunda-parcela-vencimento" && x.expected==="2026-12-20"));
 const ui=JSON.parse(readFileSync(new URL("../qa/flows/ui-review.json",import.meta.url),"utf8"));
 assert.ok(ui.steps.some(x=>x.name==="open-finance-audit"));
 assert.ok(ui.steps.some(x=>x.name==="finance-audit-source-table"));
});

test("Kanban QA arrasta entre colunas, grava vencimento e baixas na base canônica",()=>{
 const suite=JSON.parse(readFileSync(new URL("../qa/business-flows.json",import.meta.url),"utf8"));
 const flow=suite.flows.find(x=>x.id==="finance-kanban-canonical-move");
 assert.ok(flow?.critical);
 assert.ok(flow.steps.some(x=>x.action==="dragTo"&&x.name==="drag-overdue-to-upcoming"));
 assert.ok(flow.steps.some(x=>x.name==="canonical-due-date-saved"));
 assert.ok(flow.steps.some(x=>x.name==="canonical-full-settlement"&&x.expected===70));
 const qa=readFileSync(new URL("../tools/artisys-qa/src/steps.js",import.meta.url),"utf8");
 assert.match(qa,/case 'dragTo'/);
});
