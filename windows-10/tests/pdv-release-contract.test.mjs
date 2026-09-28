import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("../apps/pdv-demo/src/PdvDemoApp.tsx", import.meta.url), "utf8");
const releaseConfig = JSON.parse(fs.readFileSync(new URL("../../pdv-release.json", import.meta.url), "utf8"));
const publishWorkflow = fs.readFileSync(new URL("../../.github/workflows/publish-pdv-release.yml", import.meta.url), "utf8");
const desktopBuilder = fs.readFileSync(new URL("../apps/nexus-desktop/electron-builder.cjs", import.meta.url), "utf8");

test("release atual do PDV é 2.0.0", () => {
  assert.equal(releaseConfig.version, "2.0.0");
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

test("manifesto de atualização usa bridge sem elevação para clientes legados e preserva o instalador real", () => {
  assert.match(publishWorkflow, /PDV-Nexus-Update-Bridge-/);
  assert.match(publishWorkflow, /RequestExecutionLevel user/);
  assert.match(publishWorkflow, /ExecShell "runas"/);
  assert.match(publishWorkflow, /legacyDirectSpawnCompatible:true/);
  assert.match(publishWorkflow, /installerFile:\$w10InstallerFile/);
});
