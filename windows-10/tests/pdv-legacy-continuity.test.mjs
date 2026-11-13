import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = new URL('../../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), 'utf8');
const release = JSON.parse(read('pdv-release.json'));
const configs = [
  require('../apps/nexus-desktop/electron-builder-pdv.cjs'),
  require('../../windows-7/apps/nexus-desktop/electron-builder-pdv-win7.cjs'),
  require('../../windows-7/apps/nexus-desktop/electron-builder-pdv-win8-x86.cjs')
];

test('nova compilação 2.0.6 atualiza a instalação original, sem criar uma edição paralela',()=>{
  assert.equal(release.version,'2.0.6');
  for(const conf of configs){
    assert.equal(conf.appId,'com.nexuscore.pdv');
    assert.equal(conf.productName,'PDV Nexus');
    assert.equal(conf.nsis.shortcutName,'PDV Nexus');
    assert.equal(conf.extraMetadata.version,'2.0.6');
    assert.equal(conf.extraMetadata.pdvUpdateManifestUrl,release.manifestUrl);
    assert.doesNotMatch(conf.artifactName,/Nova-Edicao/);
  }
});

test('builds para Windows 10/7/8 e pipeline preservam o mesmo canal de atualização',()=>{
  for(const workflow of ['build-windows10-pdv.yml','build-windows7-pdv.yml','build-windows8-x86-pdv.yml']){
    const yaml=read('.github/workflows/'+workflow);
    assert.match(yaml,/pdv-release\.json/);
    assert.doesNotMatch(yaml,/pdv-nova-release\.json/);
    assert.doesNotMatch(yaml,/PDV-Nexus-Nova-/);
  }
  const pub=read('.github/workflows/publish-pdv-release.yml');
  assert.doesNotMatch(pub,/if:\s*\$\{\{\s*false\s*\}\}/);
  assert.match(pub,/head_branch\s*==\s*'main'/);
  assert.match(pub,/head_sha/);
  assert.match(pub,/PDV-Nexus-Update-Bridge-/);
});

test('o banco de clientes legados nunca é apagado durante a mudança de versão',()=>{
  const main=read('windows-10/apps/nexus-desktop/main.cjs');
  const reset=main.split('function resetPdvDataForNewInstalledVersion(db) {')[1]?.split('\nfunction getAppDatabase()')[0];
  assert.ok(reset);
  assert.doesNotMatch(reset,/DELETE FROM|DROP TABLE|TRUNCATE/i);
  const bootstrap=read('windows-10/apps/nexus-desktop/bootstrap.cjs');
  assert.match(bootstrap,/preparePdvVersionMigration/);
});
