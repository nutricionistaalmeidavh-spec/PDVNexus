import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const release = JSON.parse(read("../../pdv-release.json"));
const builder10 = read("../apps/nexus-desktop/electron-builder.cjs");
const builder7 = read("../../windows-7/apps/nexus-desktop/electron-builder.cjs");
const publisher = read("../../.github/workflows/publish-pdv-release.yml");

test("nova distribuição não consulta manifesto de atualização dos clientes antigos", () => {
  assert.equal(release.version, "2.1.0");
  assert.equal(release.manifestUrl, "");
  assert.match(release.legacyManifestUrl, /releases\/latest\/download\/latest\.json/);
  for (const os of ["windows-10", "windows-7"]) {
    const config = read(`../../${os}/apps/nexus-desktop/electron-builder-pdv.cjs`);
    assert.match(config, /pdvUpdateManifestUrl: release\.manifestUrl/);
  }
});

test("instaladores têm identificação Windows distinta do PDV instalado antigo", () => {
  for (const config of [builder10, builder7]) {
    assert.match(config, /appId: "com\.artisys\.pdvnexus\.nova"/);
    assert.match(config, /productName: "PDV Nexus Nova"/);
    assert.match(config, /artifactName: "PDV-Nexus-Nova-Setup/);
    assert.match(config, /shortcutName: selectedKey === "pdv-demo"/);
    assert.doesNotMatch(config, /appId: "com\.nexuscore\.pdv"/);
  }
  assert.match(read("../../windows-7/apps/nexus-desktop/electron-builder-pdv-win7.cjs"), /PDV-Nexus-Nova-Windows-7-Setup/);
  assert.match(read("../../windows-7/apps/nexus-desktop/electron-builder-pdv-win8-x86.cjs"), /PDV-Nexus-Nova-Windows-8-32bit-Setup/);
});

test("pipeline gera somente artefatos novos e não publica nada no canal legado", () => {
  assert.match(publisher, /jobs:\s*\n\s*publish:\s*\n\s*if: \$\{\{ false \}\}/);
  for (const [os, filename] of [
    ["windows10", "PDV-Nexus-Nova-Setup-"],
    ["windows7", "PDV-Nexus-Nova-Windows-7-Setup-"],
    ["windows8-x86", "PDV-Nexus-Nova-Windows-8-32bit-Setup-"],
  ]) {
    const workflow = read(`../../.github/workflows/build-${os}-pdv.yml`);
    assert.ok(workflow.includes(filename));
  }
});

test("fluxos reais não apagam registros antigos para limitar tamanho de arrays", () => {
  for (const os of ["windows-10", "windows-7"]) {
    const app = read(`../../${os}/apps/pdv-demo/src/PdvDemoApp.tsx`);
    const db = read(`../../${os}/packages/database/src/pdv.ts`);
    assert.doesNotMatch(app, /maxCompletedSales: 100/);
    assert.doesNotMatch(app, /\.slice\(0, (?:50|100|200)\)/);
    assert.doesNotMatch(db, /maxCompletedSales \?\? 100/);
  }
});

test("o caixa orienta a primeira venda e o catálogo diferencia resultados visíveis do total", () => {
  for (const os of ["windows-10", "windows-7"]) {
    const app = read(`../../${os}/apps/pdv-demo/src/PdvDemoApp.tsx`);
    assert.match(app, /Primeira venda: abra o caixa/);
    assert.match(app, /Mostrando \{productList\.length\} de \{catalogProducts\.length\} produtos cadastrados/);
  }
});
