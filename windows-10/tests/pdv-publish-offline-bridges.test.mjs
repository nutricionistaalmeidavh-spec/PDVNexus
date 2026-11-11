import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), "utf8");

test("o build Windows produz a ponte de atualização no mesmo artifact sem instalar NSIS na publicação", () => {
  const publish = read(".github/workflows/publish-pdv-release.yml");
  assert.doesNotMatch(publish, /apt-get\s+(install|update)[^\n]*nsis/i);
  assert.doesNotMatch(publish, /makensis\s+-V2/);
  for (const [file, channel] of [
    ["build-windows10-pdv.yml", "Windows-10"],
    ["build-windows7-pdv.yml", "Windows-7"],
    ["build-windows8-x86-pdv.yml", "Windows-8-32bit"]
  ]) {
    const yaml = read(".github/workflows/" + file);
    assert.match(yaml, /build-pdv-update-bridge\.ps1/);
    assert.ok(yaml.includes("PDV-Nexus-Update-Bridge-" + channel), file + ": ponte ausente no artefato");
    assert.ok(yaml.includes("scripts/**"), file + ": alteração no gerador deve disparar CI");
  }
  const builder = read("scripts/build-pdv-update-bridge.ps1");
  assert.match(builder, /RequestExecutionLevel user/);
  assert.match(builder, /ExecShell "runas"/);
  assert.match(builder, /makensis\.exe/);
  assert.match(publish, /Copy bridges produced by Windows installer builds/);
  assert.match(publish, /PDV-Nexus-Update-Bridge-Windows-10-/);
  assert.match(publish, /PDV-Nexus-Update-Bridge-Windows-7-/);
  assert.match(publish, /PDV-Nexus-Update-Bridge-Windows-8-32bit-/);
});

test("a publicação pode recuperar release draft sem criar nova instalação ou apagar arquivos", () => {
  const publish = read(".github/workflows/publish-pdv-release.yml");
  assert.match(publish, /steps\.existing\.outputs\.draft == 'true'/);
  assert.match(publish, /gh release upload/);
  assert.match(publish, /--draft/);
  assert.match(publish, /steps\.existing\.outputs\.exists == 'true' && steps\.existing\.outputs\.draft != 'true'/);
  assert.match(publish, /sha256sum/);
});
