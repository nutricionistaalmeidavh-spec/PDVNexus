import assert from 'node:assert/strict';
import test from 'node:test';
import { executeStep } from '../src/steps.js';

function createPageHarness() {
  const storage = new Map();
  const desktopStore = new Map();
  const pdvStore = new Map();
  let pdvLoadOverride = null;
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
          },
          pdvStore: {
            save: async (key, snapshotJson) => { pdvStore.set(key, { snapshotJson }); },
            load: async (key) => pdvLoadOverride ? pdvLoadOverride(key) : (pdvStore.get(key) ?? null)
          }
        }
      };
      try { return await fn(arg); }
      finally { globalThis.window = previousWindow; }
    },
    waitForTimeout: async () => {}
  };
  return { page, storage, desktopStore, pdvStore, setPdvLoadOverride: (fn) => { pdvLoadOverride = fn; } };
}

const base = { index: 0, screenshotsDir: '.', baseURL: '', env: {}, adapter: null, runtimeContext: null };

test('desktopStoreSet grava bridge generica e localStorage substituindo NOW_ISO', async () => {
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
  assert.equal(harness.pdvStore.has('qa:test'), false);
});

test('snapshot principal do PDV usa bridge SQLite pdvStore', async () => {
  const harness = createPageHarness();
  const key = 'nexus-core:pdv-store:v1';
  await executeStep({
    ...base,
    page: harness.page,
    step: { action: 'desktopStoreSet', key, value: { completedSales: [{ number: '000001' }] } }
  });
  assert.equal(harness.desktopStore.has(key), false);
  assert.deepEqual(JSON.parse(harness.pdvStore.get(key).snapshotJson), { completedSales: [{ number: '000001' }] });
  await executeStep({
    ...base,
    page: harness.page,
    step: { action: 'expectDesktopStoreJson', key, path: 'completedSales.0.number', expected: '000001' }
  });
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

test('expectDesktopStoreJson aguarda gravacao assincrona antes de falhar', async () => {
  const harness = createPageHarness();
  const key = 'nexus-core:pdv-store:v1';
  let reads = 0;
  harness.setPdvLoadOverride(async () => {
    reads += 1;
    return { snapshotJson: JSON.stringify(reads < 3 ? { completedSales: [] } : { completedSales: [{ number: '000777' }] }) };
  });
  await executeStep({
    ...base,
    page: harness.page,
    step: { action: 'expectDesktopStoreJson', key, path: 'completedSales.0.number', expected: '000777', timeoutMs: 1000 }
  });
  assert.ok(reads >= 3);
});

test('expectDesktopStoreJson falha quando o estado real diverge', async () => {
  const harness = createPageHarness();
  harness.desktopStore.set('qa:test', { snapshotJson: JSON.stringify({ batches: [{ remainingQuantity: 3 }] }) });
  await assert.rejects(() => executeStep({
    ...base,
    page: harness.page,
    step: { action: 'expectDesktopStoreJson', key: 'qa:test', path: 'batches.0.remainingQuantity', expected: 4, timeoutMs: 1 }
  }), /expected batches\.0\.remainingQuantity=4, got 3/);
});
