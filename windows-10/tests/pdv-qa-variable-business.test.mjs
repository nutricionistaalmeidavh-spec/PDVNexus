import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {planVariableJourneys} from "../qa/variable-business-journeys.mjs";
const plans=planVariableJourneys();
const find=(p,name)=>p.steps.find(s=>s.name===name);
test("quatro seeds geram duas ordens e dois produtos sem aleatoriedade irreproduzivel",()=>{
  assert.equal(plans.length,4);
  assert.deepEqual(planVariableJourneys(),plans);
  assert.equal(new Set(plans.map(p=>p.operations.slice(0,2).join("->"))).size,2);
  assert.equal(new Set(plans.map(p=>p.product)).size,2);
  assert.equal(new Set(plans.map(p=>p.id)).size,4);
});
test("um unico ambiente por jornada: sem resets apos setup",()=>{
  for(const plan of plans){
    assert.equal(plan.steps.filter(s=>s.action==="desktopStoreSet").length,1);
    assert.ok(plan.steps.findIndex(s=>s.action==="desktopStoreSet")<5);
    assert.ok(plan.steps.length>60);
  }
});
test("oraculos conferem estoque, caixa, vendas, cancelamento e relatorio em cada etapa",()=>{
  for(const plan of plans){
    for(const stage of ["abertura","entrada","venda","cancelamento"]){
      for(const suffix of ["estoque","caixa","vendas","cancelamentos"]){
        assert.ok(find(plan,stage+"-"+suffix),plan.id+": "+stage+"-"+suffix);
        assert.ok(find(plan,stage+"-apos-reload-"+suffix),plan.id+": "+stage+"-apos-reload-"+suffix);
      }
      assert.ok(find(plan,stage+"-relatorio-vendas"));
      assert.ok(find(plan,stage+"-relatorio-total"));
    }
    assert.ok(find(plan,"cancelada-no-historico"));
    assert.ok(find(plan,"fechamento-equilibrado"));
    assert.ok(find(plan,"fechamento-reabre"));
    assert.equal(plan.expectedSales,0);
    assert.equal(plan.expectedCancelled,1);
  }
});
test("oraculo preserva aritmetica entrada - venda + estorno independente da ordem",()=>{
  for(const plan of plans){
    const check=name=>find(plan,name)?.expected;
    const original=plan.expectedFinalStock-plan.quantity;
    assert.equal(check("abertura-estoque"),original);
    assert.equal(check("cancelamento-estoque"),original+plan.quantity);
    assert.equal(check("cancelamento-vendas"),0);
    assert.equal(check("venda-vendas"),1);
    if(plan.operations[0]==="entry"){
      assert.equal(check("entrada-estoque"),original+plan.quantity);
      assert.equal(check("venda-estoque"),original+plan.quantity-1);
    }else{
      assert.equal(check("venda-estoque"),original-1);
      assert.equal(check("entrada-estoque"),original-1+plan.quantity);
    }
  }
});
test("workflow executa Electron real com Windows e guarda evidencia, sem API paga",()=>{
  const wf=readFileSync(new URL("../../.github/workflows/qa-variable-business-journeys.yml",import.meta.url),"utf8");
  assert.match(wf,/windows-latest/);
  assert.match(wf,/run-variable-business-journeys\.mjs/);
  assert.match(wf,/upload-artifact/);
  assert.doesNotMatch(wf,/ANTHROPIC_API_KEY|OPENAI_API_KEY/);
});
test("seeds duplicadas e invalidas falham",()=>{
  assert.throws(()=>planVariableJourneys([11,11]),/Seeds/);
  assert.throws(()=>planVariableJourneys([1,-1]),/Seeds/);
});
