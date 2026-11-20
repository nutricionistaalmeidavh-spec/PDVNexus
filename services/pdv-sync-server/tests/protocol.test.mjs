import test from "node:test";
import assert from "node:assert/strict";
import { validateEvents, sanitizeCursor, digestToken } from "../src/protocol.mjs";
test("P2: validate event types, stable identifiers and branch isolation", () => {
  const event = { eventId:"sale:CAIXA-01:V-1", branchId:"loja-a", terminalId:"CAIXA-01", kind:"sale.completed", entityId:"V-1", payload:{number:"V-1", netTotal:100}};
  assert.deepEqual(validateEvents([event], "loja-a"), [event]);
  assert.throws(() => validateEvents([event], "loja-b"), /filial/i);
  assert.throws(() => validateEvents([{...event, eventId:""}], "loja-a"), /identificador/i);
  assert.throws(() => validateEvents([{...event, kind:"unsafe.action"}], "loja-a"), /evento/i);
  assert.throws(() => validateEvents(Array.from({length:251}, () => event), "loja-a"), /lote/i);
});
test("P2: token digest and pagination", () => {
  assert.equal(digestToken("secret"), digestToken("secret"));
  assert.notEqual(digestToken("secret"), digestToken("other"));
  assert.equal(sanitizeCursor("0"), "0");
  assert.equal(sanitizeCursor("25"), "25");
  assert.throws(() => sanitizeCursor("-1"));
  assert.throws(() => sanitizeCursor("nan"));
});
