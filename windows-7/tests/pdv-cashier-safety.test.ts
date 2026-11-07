import test from "node:test";
import assert from "node:assert/strict";
import { parsePdvOpeningAmount, buildPdvCashCount, shouldHandlePdvHotkey, authorizePdvCashManager } from "../apps/pdv-demo/src/cashierSafety";

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

test("fechamento cego exige PIN de gerente real, mesmo se o operador selecionado for gerente", () => {
  const users = [
    { id: "OP-1", name: "Caixa", role: "cashier" as const, active: true, password: "caixa123" },
    { id: "GER-1", name: "Gerente", role: "manager" as const, active: true, managerPassword: "gerente123" }
  ];
  assert.throws(() => authorizePdvCashManager(users, ""), /PIN/);
  assert.throws(() => authorizePdvCashManager(users, "caixa123"), /gerente|PIN/i);
  assert.throws(() => authorizePdvCashManager(users, "senhaerrada"), /gerente|PIN/i);
  assert.equal(authorizePdvCashManager(users, "gerente123").id, "GER-1");
});

test("conferência de modalidades adicionais não confunde cheque com dinheiro", () => {
  const counted=buildPdvCashCount({ cash:"100",pix:"0",credit:"0",debit:"0",
    extras:{CHEQUE:"50,25",OUTROS:"0"} });
  assert.equal(counted.CHEQUE,50.25);
  assert.equal(counted.OUTROS,0);
  assert.throws(() => buildPdvCashCount({cash:"0",pix:"0",credit:"0",debit:"0",extras:{CHEQUE:""}}),/CHEQUE/);
});

test("abertura do caixa usa troco informado em pt-BR, sem aceitar valor negativo ou inválido", () => {
  assert.equal(parsePdvOpeningAmount("150,00"), 150);
  assert.equal(parsePdvOpeningAmount("1.250,50"), 1250.5);
  assert.equal(parsePdvOpeningAmount("0"), 0);
  assert.throws(() => parsePdvOpeningAmount("-1"), /troco|inicial|inválid/i);
  assert.throws(() => parsePdvOpeningAmount("texto"), /troco|inicial|inválid/i);
  assert.throws(() => parsePdvOpeningAmount(""), /troco|inicial|informe/i);
});
