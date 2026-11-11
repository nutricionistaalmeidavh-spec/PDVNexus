import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";

const require = createRequire(import.meta.url);
const { probeRamuzaAtena2Lan } = require("../apps/nexus-desktop/ramuzaNetwork.cjs");

test("rejeita IP publico, DNS e portas diferentes da porta Ramuza", async () => {
  await assert.rejects(probeRamuzaAtena2Lan("8.8.8.8"), /IPv4 privado/);
  await assert.rejects(probeRamuzaAtena2Lan("example.com"), /IPv4 privado/);
  await assert.rejects(probeRamuzaAtena2Lan("192.168.1.50", 80), /33581/);
});

test("sondagem local apenas abre e fecha a conexao, sem enviar comandos", async () => {
  let created;
  const probe = probeRamuzaAtena2Lan("192.168.0.150", 33581, (options) => {
    const socket = new EventEmitter();
    socket.setTimeout = () => {};
    socket.destroy = () => { socket.destroyed = true; };
    socket.write = () => { throw new Error("Nao pode escrever para a balanca"); };
    created = { options, socket };
    queueMicrotask(() => socket.emit("connect"));
    return socket;
  });
  assert.deepEqual(await probe, { host: "192.168.0.150", port: 33581, reachable: true });
  assert.deepEqual(created.options, { host: "192.168.0.150", port: 33581 });
  assert.equal(created.socket.destroyed, true);
});

test("porta inacessivel retorna indisponivel, sem inventar sucesso", async () => {
  const result = await probeRamuzaAtena2Lan("10.0.0.4", 33581, () => {
    const socket = new EventEmitter();
    socket.setTimeout = () => {};
    socket.destroy = () => {};
    queueMicrotask(() => socket.emit("error", new Error("ECONNREFUSED")));
    return socket;
  });
  assert.equal(result.reachable, false);
});
