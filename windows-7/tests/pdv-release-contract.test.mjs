import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("../apps/pdv-demo/src/PdvDemoApp.tsx", import.meta.url), "utf8");
const releaseConfig = JSON.parse(fs.readFileSync(new URL("../../pdv-release.json", import.meta.url), "utf8"));
const publishWorkflow = fs.readFileSync(new URL("../../.github/workflows/publish-pdv-release.yml", import.meta.url), "utf8");
const desktopBuilder = fs.readFileSync(new URL("../apps/nexus-desktop/electron-builder.cjs", import.meta.url), "utf8");

test("release atual do PDV é 2.0.1", () => {
  assert.equal(releaseConfig.version, "2.0.1");
  assert.match(releaseConfig.version, /^\d+\.\d+\.\d+$/);
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

test("pacote desktop inclui todos os módulos locais exigidos pelo bootstrap", () => {
  assert.match(desktopBuilder, /"bootstrap\.cjs"/);
  assert.match(desktopBuilder, /"main\.cjs"/);
  assert.match(desktopBuilder, /"pdv-lifecycle\.cjs"/);
  assert.match(desktopBuilder, /"pdv-telemetry\.cjs"/);
  assert.match(desktopBuilder, /"preload\.cjs"/);
});


test("hotfix 2.0.1 grava o armazenamento legado de forma atômica", () => {
  const mainSource = fs.readFileSync(new URL("../apps/nexus-desktop/main.cjs", import.meta.url), "utf8");
  assert.match(mainSource, /\.tmp/);
  assert.match(mainSource, /\.bak/);
  assert.match(mainSource, /renameSync/);
  assert.match(appSource, /PDV_STORE_LOAD_TIMEOUT_MS/);
  assert.match(appSource, /sqlite-save-failed/);
});
