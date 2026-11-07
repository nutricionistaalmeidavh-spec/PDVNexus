import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
for (const root of ["../","../../windows-7/"]) {
  test(root + " batch receipt writes lot, stock and movements in one canonical snapshot", () => {
    const batch = fs.readFileSync(new URL(root + "apps/pdv-demo/src/productLabelBatchStore.ts", import.meta.url), "utf8");
    const app = fs.readFileSync(new URL(root + "apps/pdv-demo/src/PdvDemoApp.tsx", import.meta.url), "utf8");
    const commit = batch.split("export async function commitBatchStockEntry(")[1]?.split("export async function saveMainPdvSnapshot(")[0];
    assert.ok(commit);
    assert.match(commit, /extensions: \{ \.\.\.originalExtensions, productLabelBatchStore: result\.store \}/);
    assert.match(commit, /await saveMainPdvSnapshot\(unifiedSnapshot, expectedRevision\)/);
    assert.doesNotMatch(commit, /await saveProductLabelBatchStore\(/);
    assert.match(batch, /desktop\.save\(PDV_STORE_KEY, JSON\.stringify\(/);
    assert.match(batch, /row\.revision\)/);
    assert.match(app, /preservedPdvExtensionsRef\.current/);
    assert.match(app, /extensions: \{ \.\.\.preservedPdvExtensionsRef\.current,/);
  });
}

test("canonical batch updates notify active checkout to reconcile its SQLite revision", () => {
  for (const root of ["../","../../windows-7/"]) {
    const batch = fs.readFileSync(new URL(root + "apps/pdv-demo/src/productLabelBatchStore.ts", import.meta.url), "utf8");
    const app = fs.readFileSync(new URL(root + "apps/pdv-demo/src/PdvDemoApp.tsx", import.meta.url), "utf8");
    assert.match(batch, /nexus-pdv:canonical-external-write/);
    assert.match(app, /nexus-pdv:canonical-external-write/);
    assert.match(app, /lastPersistedRevisionRef\.current = row\.revision/);
    assert.match(app, /preservedPdvExtensionsRef\.current =/);
  }
});
