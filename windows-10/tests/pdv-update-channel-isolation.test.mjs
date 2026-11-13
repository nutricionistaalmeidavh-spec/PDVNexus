import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const read = rel => fs.readFileSync(new URL("../../" + rel, import.meta.url),"utf8");
const release = JSON.parse(read("pdv-release.json"));
const nova = JSON.parse(read("pdv-nova-release.json"));
const w10 = require("../apps/nexus-desktop/electron-builder-pdv.cjs");
const w7 = require("../../windows-7/apps/nexus-desktop/electron-builder-pdv-win7.cjs");
const w8 = require("../../windows-7/apps/nexus-desktop/electron-builder-pdv-win8-x86.cjs");

test("upgrade 2.0.6 preserva appId, diretório e canal dos clientes 2.0.2", () => {
  assert.equal(release.version, "2.0.6");
  assert.match(release.manifestUrl, /\/releases\/latest\/download\/latest\.json$/);
  for (const config of [w10,w7,w8]) {
    assert.equal(config.appId, "com.nexuscore.pdv");
    assert.equal(config.productName, "PDV Nexus");
    assert.equal(config.nsis.shortcutName, "PDV Nexus");
    assert.equal(config.extraMetadata.version, release.version);
    assert.equal(config.extraMetadata.pdvUpdateManifestUrl, release.manifestUrl);
    assert.doesNotMatch(config.artifactName, /Nova-Edicao/);
  }
});

test("feed antigo da edição paralela permanece inerte para não apagar nada", () => {
  assert.equal(nova.version, "2.0.3");
  assert.deepEqual(nova.artifacts, {});
  assert.notEqual(nova.manifestUrl, release.manifestUrl);
});

test("pipeline publica apenas na main após os três builds e QA", () => {
  const publish = read(".github/workflows/publish-pdv-release.yml");
  assert.match(publish,/head_branch == 'main'/);
  assert.match(publish,/github.event.workflow_run.event == 'push'/);
  assert.doesNotMatch(publish,/if:\s*\$\{\{\s*false\s*\}\}/);
  for(const workflow of ["build-windows10-pdv.yml","build-windows7-pdv.yml","build-windows8-x86-pdv.yml"]){
    const source = read(".github/workflows/" + workflow);
    assert.match(source,/pdv-release\.json/);
    assert.doesNotMatch(source,/pdv-nova-release\.json/);
    assert.doesNotMatch(source,/PDV-Nexus-Nova-/);
  }
});
