import assert from "node:assert/strict";
import test from "node:test";
import { normalizePdvContactPhone } from "../apps/pdv-demo/src/customerPhone";

test("cliente: WhatsApp e telefone brasileiro persistem com DDD em formato canônico", () => {
  assert.equal(normalizePdvContactPhone("(16) 99999-8888"), "16999998888");
  assert.equal(normalizePdvContactPhone("+55 (16) 3333-2222"), "1633332222");
  assert.equal(normalizePdvContactPhone(""), "");
});
test("cliente: telefone preenchido e inválido não entra no cadastro", () => {
  assert.throws(() => normalizePdvContactPhone("1234"), /DDD|telefone/i);
  assert.throws(() => normalizePdvContactPhone("abcdefgh"), /DDD|telefone/i);
});
