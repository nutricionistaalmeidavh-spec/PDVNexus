import test from "node:test";
import assert from "node:assert/strict";
import { normalizePdvCustomerPhone, updatePdvCustomerContact } from "../apps/pdv-demo/src/customerPhone";

test("telefone de cliente aceita DDD brasileiro e prefixo +55, sem mascarar dado canônico", () => {
  assert.equal(normalizePdvCustomerPhone("(16) 99999-1234"), "16999991234");
  assert.equal(normalizePdvCustomerPhone("+55 (16) 99999-1234"), "16999991234");
  assert.equal(normalizePdvCustomerPhone("(16) 3333-4444"), "1633334444");
  assert.equal(normalizePdvCustomerPhone(""), "");
});
test("telefone inválido nunca é persistido parcialmente", () => {
  assert.throws(() => normalizePdvCustomerPhone("1699999"), /DDD|telefone|WhatsApp/i);
  assert.throws(() => normalizePdvCustomerPhone("169999912340"), /DDD|telefone|WhatsApp/i);
});
test("edição de contato preserva campos canônicos e extensões desconhecidas", () => {
  const previous = {id:"CLI-7",name:"Claudia",document:"123",city:"SP",creditLimit:100,creditUsed:25,legacyMetadata:"preservar",phone:"1633334444"};
  const next = updatePdvCustomerContact(previous,"+55 16 99999-1234");
  assert.deepEqual(next,{...previous,phone:"16999991234"});
  assert.equal(previous.phone,"1633334444");
});
