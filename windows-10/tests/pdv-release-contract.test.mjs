import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("../apps/pdv-demo/src/PdvDemoApp.tsx", import.meta.url), "utf8");
const releaseConfig = JSON.parse(fs.readFileSync(new URL("../../pdv-release.json", import.meta.url), "utf8"));
const publishWorkflow = fs.readFileSync(new URL("../../.github/workflows/publish-pdv-release.yml", import.meta.url), "utf8");

test("release atual do PDV é 0.1.19", () => {
  assert.equal(releaseConfig.version, "0.1.19");
});

test("carrinho expõe controles explícitos para diminuir e aumentar quantidade", () => {
  assert.match(appSource, /adjustSaleItemQuantity/);
  assert.match(appSource, /Diminuir quantidade/);
  assert.match(appSource, /Aumentar quantidade/);
});

test("release publicada bloqueia sobrescrita silenciosa da mesma versão", () => {
  assert.match(publishWorkflow, /Protect published version from overwrite/);
  assert.match(publishWorkflow, /steps\.existing\.outputs\.exists == 'true'/);
  assert.match(publishWorkflow, /steps\.existing\.outputs\.draft != 'true'/);
});
