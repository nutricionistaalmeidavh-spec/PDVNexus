import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("../apps/nexus-desktop/main.cjs",import.meta.url),"utf8");
test("network sync rejects unauthenticated and stale snapshots",()=>{
  assert.match(source,/Token obrigat[oó]rio|token obrigat[oó]rio|Token de sincroniza[cç][aã]o obrigat[oó]rio/i);
  assert.match(source,/expectedRevision/);
  assert.match(source,/REVISION_CONFLICT/);
  assert.match(source,/sendJson\(response, 409/);
  assert.match(source,/sendJson\(response, 428/);
});
test("SQLite revision and canonical tables must commit in the same transaction",()=>{
  assert.match(source,/ALTER TABLE pdv_store ADD COLUMN revision/);
  assert.match(source,/revision\s*=\s*pdv_store\.revision\s*\+\s*1/);
  const write=source.split("function writePdvStateToTables(")[1]?.split("\nfunction readPdvStateFromTables(")[0];
  assert.ok(write);
  assert.match(write,/BEGIN IMMEDIATE/);
  assert.match(write,/INSERT INTO pdv_store/);
  assert.match(write,/COMMIT/);
});

const legacy = fs.readFileSync(new URL("../../windows-7/apps/nexus-desktop/main.cjs", import.meta.url),"utf8");
test("Windows 7 canonical JSON store must also require revision and token, never pretend it is SQLite", () => {
  assert.match(legacy,/pdv-nexus-data\.json/);
  assert.match(legacy,/path: getDesktopStorePath\(\)/);
  assert.match(legacy,/REVISION_CONFLICT/);
  assert.match(legacy,/expectedRevision/);
  assert.match(legacy,/Token de sincroniza[cç][aã]o obrigat[oó]rio/i);
  assert.doesNotMatch(legacy,/if \(!token\) return true/);
});

test("desktop IPC also requires optimistic concurrency, not only HTTP sync", () => {
 const preload = fs.readFileSync(new URL("../apps/nexus-desktop/preload.cjs",import.meta.url),"utf8");
 const runtime = fs.readFileSync(new URL("../packages/desktop-runtime/src/index.ts",import.meta.url),"utf8");
 const app = fs.readFileSync(new URL("../apps/pdv-demo/src/PdvDemoApp.tsx",import.meta.url),"utf8");
 assert.match(source, /"nexus-pdv-store:save", \(_event, storeKey, snapshotJson, expectedRevision\)/);
 assert.match(source, /savePdvStoreSnapshot\(storeKey, snapshotJson, expectedRevision\)/);
 assert.match(preload, /save: \(storeKey, snapshotJson, expectedRevision\)/);
 assert.match(runtime, /save\(storeKey: string, snapshotJson: string, expectedRevision: number\)/);
 assert.match(app, /lastPersistedRevisionRef/);
 assert.match(app, /desktopStoreBridge\.save\(PDV_STORE_KEY, nextSnapshot, lastPersistedRevisionRef\.current\)/);
 assert.match(app, /REVISION_CONFLICT/);
});
