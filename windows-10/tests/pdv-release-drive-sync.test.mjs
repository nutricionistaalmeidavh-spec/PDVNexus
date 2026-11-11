import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const release = JSON.parse(readFileSync(resolve(repoRoot, 'pdv-release.json'), 'utf8'));
const workflow = readFileSync(resolve(repoRoot, '.github/workflows/publish-pdv-release.yml'), 'utf8');

test('release config declares buyer Drive distribution target', () => {
  assert.equal(release.distribution?.googleDrive?.rootFolderId, '1M0_SfF1h_zUqEM-Ns1HJ8ZtCMMcbHnFr');
  assert.equal(release.distribution?.googleDrive?.previousFolderName, 'anterior');
});

test('release workflow syncs stable installers to Drive after GitHub Release', () => {
  const releaseIndex = workflow.indexOf('- name: Create GitHub Release');
  const driveIndex = workflow.indexOf('- name: Sync stable installers to Google Drive');
  assert.ok(releaseIndex >= 0, 'GitHub Release step missing');
  assert.ok(driveIndex > releaseIndex, 'Drive sync must run after GitHub Release');
  assert.match(workflow, /PDV_GDRIVE_RCLONE_CONFIG/);
  assert.match(workflow, /rclone check/);
  assert.match(workflow, /previousFolderName/);
});

test('release artifacts are downloaded even when a Release already exists so Drive sync can be retried', () => {
  const marker = '- name: Download installers from successful gate runs';
  const start = workflow.indexOf(marker);
  const nextStep = workflow.indexOf('\n      - name:', start + marker.length);
  const block = workflow.slice(start, nextStep >= 0 ? nextStep : workflow.length);
  assert.ok(start >= 0, 'download step block missing');
  assert.doesNotMatch(block, /steps\.existing\.outputs\.exists == 'false'/);
});

test('instaladores anteriores saem da pasta dos clientes somente após cópia verificada para arquivo externo', () => {
  assert.equal(release.distribution?.googleDrive?.archiveFolderId, '1kn7s1ZaBiWq2nSG5w7zhVCjSoVyathc-');
  const archivePosition = workflow.indexOf('rclone copyto "archive-stage/');
  const verifyPosition = workflow.indexOf('rclone check "archive-stage"');
  const deletePosition = workflow.indexOf('rclone deletefile');
  assert.ok(archivePosition >= 0 && verifyPosition > archivePosition && deletePosition > verifyPosition);
  assert.match(workflow, /--drive-root-folder-id "\\$ARCHIVE_ID"/);
  assert.doesNotMatch(workflow, /rclone mkdir "\\$\{REMOTE\}:\$\{PREVIOUS_FOLDER\}"/);
});
