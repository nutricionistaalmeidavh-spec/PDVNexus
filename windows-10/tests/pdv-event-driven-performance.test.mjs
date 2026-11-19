import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const editions = ["windows-10", "windows-7"];

test("P0: background decorators reconcile on actual commits, not sub-second polling", () => {
  for (const edition of editions) {
    const base = "../" + edition + "/apps/pdv-demo/src/";
    const batch = edition === "windows-10" ? source("apps/pdv-demo/src/ProductBatchFefoSync.tsx") :
      fs.readFileSync(new URL("../../windows-7/apps/pdv-demo/src/ProductBatchFefoSync.tsx", import.meta.url), "utf8");
    const sale = edition === "windows-10" ? source("apps/pdv-demo/src/SaleObservationDecor.tsx") :
      fs.readFileSync(new URL("../../windows-7/apps/pdv-demo/src/SaleObservationDecor.tsx", import.meta.url), "utf8");
    const ops = edition === "windows-10" ? source("apps/pdv-demo/src/PdvOpsDecor.tsx") :
      fs.readFileSync(new URL("../../windows-7/apps/pdv-demo/src/PdvOpsDecor.tsx", import.meta.url), "utf8");
    for (const [name, body] of [["FEFO", batch], ["sale observations", sale], ["operations", ops]]) {
      assert.doesNotMatch(body, /(?:window\.)?setInterval\s*\(/, edition + " " + name + " must not poll the full snapshot");
      assert.match(body, /nexus-pdv:canonical-commit/, edition + " " + name + " must subscribe to canonical commits");
      assert.match(body, /nexus-pdv:canonical-external-write/, edition + " " + name + " must process external commits");
    }
    const app = edition === "windows-10" ? source("apps/pdv-demo/src/PdvDemoApp.tsx") :
      fs.readFileSync(new URL("../../windows-7/apps/pdv-demo/src/PdvDemoApp.tsx", import.meta.url), "utf8");
    assert.match(app, /dispatchEvent\(new CustomEvent\("nexus-pdv:canonical-commit"/, edition + " must announce persisted writes");
  }
});

test("P0: SQLite diagnostics avoid synchronously appending logs on the Electron main thread", () => {
  const main = source("apps/nexus-desktop/main.cjs");
  assert.doesNotMatch(main, /fs\.appendFileSync\(logPath/, "critical path must not synchronously append diagnostics");
  assert.match(main, /fs\.promises\.appendFile/, "diagnostics stay available asynchronously");
});

test("P1: synthetic SQLite regressions keep full revision, backup and history checks", () => {
  const sqlite = source("tests/pdv-sqlite-integration.test.mjs");
  assert.match(sqlite, /PRAGMA quick_check/);
  assert.match(sqlite, /REVISION_CONFLICT/);
  assert.match(sqlite, /50000/);
  assert.match(sqlite, /process\.cpuUsage\(/);
  assert.match(sqlite, /process\.memoryUsage\(/);
  assert.match(sqlite, /readPdvStateFromTables/);
});
