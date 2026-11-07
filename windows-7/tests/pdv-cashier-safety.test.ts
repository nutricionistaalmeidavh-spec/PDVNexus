import test from "node:test";
import assert from "node:assert/strict";
import { buildPdvCashCount, shouldHandlePdvHotkey } from "../apps/pdv-demo/src/cashierSafety";

test("fechamento: dinheiro, PIX, crédito e débito são conferidos individualmente", () => {
  assert.deepEqual(buildPdvCashCount({cash:"100,50",pix:"20",credit:"135.75",debit:"60"}), {
    "A VISTA":100.50, PIX:20, CREDITO:135.75, DEBITO:60
  });
});
test("fechamento cego: campos vazios, valores negativos e texto inválido bloqueiam a conferência", () => {
  const valid={cash:"0",pix:"0",credit:"0",debit:"0"};
  assert.throws(()=>buildPdvCashCount({...valid,credit:""}),/crédito|valor|preencha/i);
  assert.throws(()=>buildPdvCashCount({...valid,debit:"-1"}),/débito|valor/i);
  assert.throws(()=>buildPdvCashCount({...valid,pix:"abc"}),/PIX|valor/i);
});
test("atalhos: Delete nunca exclui item com cursor em campo editável", () => {
  assert.equal(shouldHandlePdvHotkey("Delete",{route:"/caixa",editing:true}),false);
  assert.equal(shouldHandlePdvHotkey("Delete",{route:"/caixa",editing:false}),true);
  assert.equal(shouldHandlePdvHotkey("Delete",{route:"/produtos",editing:false}),false);
});
test("atalhos: F3 continua focando pesquisa, F8 não finaliza enquanto o usuário digita", () => {
  assert.equal(shouldHandlePdvHotkey("F3",{route:"/caixa",editing:true}),true);
  assert.equal(shouldHandlePdvHotkey("F8",{route:"/caixa",editing:true}),false);
  assert.equal(shouldHandlePdvHotkey("F8",{route:"/caixa",editing:false,dialogOpen:true}),false);
  assert.equal(shouldHandlePdvHotkey("F6",{route:"/caixa",editing:false,modifiers:true}),false);
  assert.equal(shouldHandlePdvHotkey("a",{route:"/caixa",editing:false}),false);
});

test("atalhos da operação funcionam com o leitor focado, sem confundir Delete com edição de texto", () => {
  const context={route:"/caixa",editing:true,scannerInput:true};
  assert.equal(shouldHandlePdvHotkey("F2",context),true);
  assert.equal(shouldHandlePdvHotkey("F6",context),true);
  assert.equal(shouldHandlePdvHotkey("F8",context),true);
  assert.equal(shouldHandlePdvHotkey("Delete",context),false);
});
