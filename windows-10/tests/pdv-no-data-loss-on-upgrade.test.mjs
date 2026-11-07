import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
for (const path of ["../apps/nexus-desktop/main.cjs","../../windows-7/apps/nexus-desktop/main.cjs"]) {
  test(path + " must never erase customer data when application version changes", () => {
    const source = fs.readFileSync(new URL(path, import.meta.url), "utf8");
    const reset = source.split("function resetPdvDataForNewInstalledVersion(db) {")[1]?.split("\nfunction getAppDatabase()")[0];
    assert.ok(reset, "existing upgrade hook must be audited");
    assert.doesNotMatch(reset, /DELETE FROM|DROP TABLE|VACUUM|TRUNCATE/i);
    assert.match(reset, /installed-pdv-version/);
  });
}
