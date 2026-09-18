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
  const end = workflow.indexOf('- name: Generate update manifest', start);
  const block = workflow.slice(start, end);
  assert.ok(start >= 0 && end > start, 'download step block missing');
  assert.doesNotMatch(block, /steps\.existing\.outputs\.exists == 'false'/);
});
