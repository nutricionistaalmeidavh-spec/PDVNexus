import assert from 'node:assert/strict';
import test from 'node:test';
import { executeStep } from '../src/steps.js';

function createPageHarness() {
  const storage = new Map();
  const desktopStore = new Map();
  const page = {
    evaluate: async (fn, arg) => {
      const previousWindow = globalThis.window;
      globalThis.window = {
        localStorage: {
          getItem: (key) => storage.get(key) ?? null,
          setItem: (key, value) => storage.set(key, String(value))
        },
        nexusDesktop: {
          store: {
            save: async (key, snapshotJson) => { desktopStore.set(key, { snapshotJson }); },
            load: async (key) => desktopStore.get(key) ?? null
          }
        }
      };
      try { return await fn(arg); }
      finally { globalThis.window = previousWindow; }
    },
    waitForTimeout: async () => {}
  };
  return { page, storage, desktopStore };
}

const base = { index: 0, screenshotsDir: '.', baseURL: '', env: {}, adapter: null, runtimeContext: null };

test('desktopStoreSet grava bridge e localStorage substituindo NOW_ISO', async () => {
  const harness = createPageHarness();
  await executeStep({
    ...base,
    page: harness.page,
    step: { action: 'desktopStoreSet', key: 'qa:test', value: { version: 1, updatedAt: '{{NOW_ISO}}', nested: { ok: true } } }
  });
  const row = harness.desktopStore.get('qa:test');
  assert.ok(row?.snapshotJson);
  const parsed = JSON.parse(row.snapshotJson);
  assert.equal(parsed.version, 1);
  assert.equal(parsed.nested.ok, true);
  assert.match(parsed.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(harness.storage.get('qa:test'), row.snapshotJson);
});

test('expectDesktopStoreJson valida caminhos com indices de array', async () => {
  const harness = createPageHarness();
  harness.desktopStore.set('qa:test', { snapshotJson: JSON.stringify({ batches: [{ remainingQuantity: 5 }, { remainingQuantity: 4 }], mode: 'confirmed' }) });
  await executeStep({
    ...base,
    page: harness.page,
    step: { action: 'expectDesktopStoreJson', key: 'qa:test', path: 'batches.1.remainingQuantity', expected: 4 }
  });
  await executeStep({
    ...base,
    page: harness.page,
    step: { action: 'expectDesktopStoreJson', key: 'qa:test', path: 'mode', expected: 'confirmed' }
  });
});

test('expectDesktopStoreJson falha quando o estado real diverge', async () => {
  const harness = createPageHarness();
  harness.desktopStore.set('qa:test', { snapshotJson: JSON.stringify({ batches: [{ remainingQuantity: 3 }] }) });
  await assert.rejects(() => executeStep({
    ...base,
    page: harness.page,
    step: { action: 'expectDesktopStoreJson', key: 'qa:test', path: 'batches.0.remainingQuantity', expected: 4 }
  }), /expected batches\.0\.remainingQuantity=4, got 3/);
});
