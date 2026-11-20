import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

async function loadModule(path) {
  const source = fs.readFileSync(new URL(path, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

for (const edition of ["windows-10", "windows-7"]) {
  test(edition + ": matriz antiga mantém a chave, migração não destrutiva", async () => {
    const net = await loadModule((edition === "windows-10" ? "../apps/pdv-demo/src/storeNetwork.ts" : "../../windows-7/apps/pdv-demo/src/storeNetwork.ts"));
    const storage = memoryStorage();
    const registry = net.readStoreNetwork(storage);
    assert.equal(registry.branches.length, 1);
    assert.equal(net.getActivePdvStoreKey(storage), "nexus-core:pdv-store:v1");
    assert.equal(storage.getItem(net.STORE_NETWORK_KEY), null);
    assert.equal(net.getScopedBranchStorageKey("nexus-core:pdv-sale-observations:v1", storage), "nexus-core:pdv-sale-observations:v1");
  });

  test(edition + ": filiais com snapshots e auxiliares separados", async () => {
    const net = await loadModule((edition === "windows-10" ? "../apps/pdv-demo/src/storeNetwork.ts" : "../../windows-7/apps/pdv-demo/src/storeNetwork.ts"));
    const storage = memoryStorage();
    const main = net.readStoreNetwork(storage);
    const next = net.registerStoreBranch(main, { name: "Filial Centro", operatorId: "GER-001" });
    const branch = next.branches[1];
    assert.notEqual(branch.storeKey, main.branches[0].storeKey);
    assert.equal(next.branches[0].storeKey, main.branches[0].storeKey);
    net.saveStoreNetwork(storage, next);
    net.selectActiveStoreBranch(storage, next, branch.id, { id: "GER-001", role: "manager" });
    assert.equal(net.getActivePdvStoreKey(storage), branch.storeKey);
    assert.notEqual(net.getScopedBranchStorageKey("nexus-core:pdv-sale-observations:v1", storage), "nexus-core:pdv-sale-observations:v1");
    assert.throws(() => net.selectActiveStoreBranch(storage, next, branch.id, { id: "OP-002", role: "cashier" }), /permiss/i);
    assert.throws(() => net.registerStoreBranch(next, { name: "Filial Centro", operatorId: "GER-001" }), /existe/i);
    assert.throws(() => net.deactivateStoreBranch(next, "matriz"), /matriz/i);
  });

  test(edition + ": registro inválido não é apagado e filial inativa não abre", async () => {
    const net = await loadModule((edition === "windows-10" ? "../apps/pdv-demo/src/storeNetwork.ts" : "../../windows-7/apps/pdv-demo/src/storeNetwork.ts"));
    const storage = memoryStorage();
    storage.setItem(net.STORE_NETWORK_KEY, "{");
    assert.throws(() => net.readStoreNetwork(storage), /inválido|corrompido/i);
    assert.equal(storage.getItem(net.STORE_NETWORK_KEY), "{");
    storage.removeItem(net.STORE_NETWORK_KEY);
    const next = net.registerStoreBranch(net.readStoreNetwork(storage), { name: "Loja Dois", operatorId: "GER-001" });
    const disabled = net.deactivateStoreBranch(next, next.branches[1].id);
    net.saveStoreNetwork(storage, disabled);
    assert.throws(() => net.selectActiveStoreBranch(storage, disabled, next.branches[1].id, { id: "GER-001", role: "manager" }), /inativa/i);
    assert.equal(net.getActivePdvStoreKey(storage), net.LEGACY_PDV_STORE_KEY);
  });
}

test("P0: cliente sempre envia expectedRevision e conflitos impedem substituição silenciosa", () => {
  for (const edition of ["windows-10", "windows-7"]) {
    const src = fs.readFileSync(new URL("../../" + edition + "/apps/pdv-demo/src/PdvDemoApp.tsx", import.meta.url), "utf8");
    assert.match(src, /expectedRevision:\s*lastPulledServerRevisionRef\.current/);
    assert.match(src, /lastPulledServerRevisionRef\.current\s*===\s*null/);
    assert.match(src, /Servidor recusou envio|Conflito/);
  }
});

test("P1: leitores auxiliares usam a chave ativa em ambas as edições", () => {
  for (const edition of ["windows-10", "windows-7"]) for (const name of ["PdvDemoApp.tsx", "PdvOpsDecor.tsx", "productLabelBatchStore.ts", "saleObservation.ts", "saleObservationDesktop.ts"]) {
    const s = fs.readFileSync(new URL("../../" + edition + "/apps/pdv-demo/src/" + name, import.meta.url), "utf8");
    assert.match(s, /getActivePdvStoreKey/);
  }
});
