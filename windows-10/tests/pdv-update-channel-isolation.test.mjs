import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = new URL("../../", import.meta.url);
const read = (relativePath) => fs.readFileSync(new URL(relativePath, root), "utf8");
const nova = JSON.parse(read("pdv-nova-release.json"));
const build = JSON.parse(read("pdv-build-release.json"));
const old = JSON.parse(read("pdv-release.json"));
const w10 = require("../apps/nexus-desktop/electron-builder-pdv.cjs");
const w7 = require("../../windows-7/apps/nexus-desktop/electron-builder-pdv-win7.cjs");
const w8 = require("../../windows-7/apps/nexus-desktop/electron-builder-pdv-win8-x86.cjs");

test("nova edição preserva o manifesto legado, com canal independente", () => {
  assert.equal(old.version, "2.0.4");
  assert.match(old.manifestUrl, /\/releases\/latest\/download\/latest\.json$/);
  assert.equal(build.version, old.version);
  assert.ok(Number(nova.version.split(".")[2]) <= Number(build.version.split(".")[2]));
  assert.notEqual(nova.manifestUrl, old.manifestUrl);
  assert.doesNotMatch(nova.manifestUrl, /\/releases\/latest\//);
  assert.equal(w10.extraMetadata.version, build.version);
  assert.equal(w10.extraMetadata.pdvUpdateManifestUrl, nova.manifestUrl);
  assert.equal(w7.extraMetadata.version, build.version);
  assert.equal(w8.extraMetadata.version, build.version);
  assert.equal(w7.extraMetadata.pdvUpdateManifestUrl, nova.manifestUrl);
  assert.equal(w8.extraMetadata.pdvUpdateManifestUrl, nova.manifestUrl);
});

test("nova edição instala em identidade e pasta separadas, sem substituir o legado", () => {
  for (const config of [w10, w7, w8]) {
    assert.equal(config.appId, "br.com.artisys.pdvnexus.nova");
    assert.equal(config.productName, "PDV Nexus Nova Edição");
    assert.equal(config.nsis.shortcutName, "PDV Nexus Nova Edição");
    assert.notEqual(config.appId, "com.nexuscore.pdv");
    assert.match(config.artifactName, /^PDV-Nexus-Nova-Edicao-/);
  }
});

test("pipeline publica apenas após gates na main e preserva atualização dos dois canais", () => {
  const publish = read(".github/workflows/publish-pdv-release.yml");
  assert.match(publish, /Protect published version from overwrite/);
  assert.match(publish, /head_branch/);
  for (const workflow of ["build-windows10-pdv.yml", "build-windows7-pdv.yml", "build-windows8-x86-pdv.yml"]) {
    const ci = read(".github/workflows/" + workflow);
    assert.match(ci, /pdv-nova-release\.json/);
    assert.match(ci, /PDV-Nexus-Nova-Edicao-/);
  }
  assert.equal(build.version, "2.0.4");
  assert.ok(nova.artifacts && typeof nova.artifacts === "object");
});
