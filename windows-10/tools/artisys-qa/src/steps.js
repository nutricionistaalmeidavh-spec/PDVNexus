import path from 'node:path';
import { resolveSecret, stepLabel } from './helpers.js';

const MAIN_PDV_STORE_KEY = 'nexus-core:pdv-store:v1';
const DEFAULT_ASSERT_TIMEOUT_MS = 5000;
const DEFAULT_POLL_MS = 100;

function locator(page, step) {
  if (step.testId) return page.getByTestId(step.testId);
  if (step.role) return page.getByRole(step.role, step.roleName ? { name: step.roleName, exact: step.exact ?? false } : step.name ? { name: step.name } : undefined);
  if (step.text) return page.getByText(step.text, { exact: step.exact ?? false });
  if (step.label) return page.getByLabel(step.label, { exact: step.exact ?? false });
  if (step.selector) return page.locator(step.selector);
  throw new Error(`Step ${step.action} requires selector, testId, role, text or label`);
}

async function resolveClickable(page, step) {
  if (step.text && !step.selector && !step.testId && !step.role && !step.label) {
    const button = page.getByRole('button', { name: step.text, exact: step.exact ?? false });
    if (await button.count() === 1) return button;
  }
  return locator(page, step);
}

async function clickTarget(page, step) {
  const target = await resolveClickable(page, step);
  await target.click(step.force ? { force: true } : undefined);
}

async function loadDesktopStoreRaw(page, key) {
  return page.evaluate(async ({ key, mainPdvStoreKey }) => {
    const desktop = window.nexusDesktop;
    const bridge = key === mainPdvStoreKey ? desktop?.pdvStore : desktop?.store;
    if (bridge?.load) {
      const row = await bridge.load(key);
      if (row?.snapshotJson != null) return row.snapshotJson;
    }
    return window.localStorage.getItem(key);
  }, { key, mainPdvStoreKey: MAIN_PDV_STORE_KEY });
}

export async function executeStep({ page, step, index, screenshotsDir, baseURL, env = process.env, adapter = null, runtimeContext = null }) {
  const label = stepLabel(step, index);
  switch (step.action) {
    case 'goto': {
      const target = step.url || (step.path && baseURL ? new URL(step.path, baseURL).toString() : step.path);
      if (!target) throw new Error('goto requires url or path');
      await page.goto(target, { waitUntil: step.waitUntil || 'domcontentloaded' });
      break;
    }
    case 'click': await clickTarget(page, step); break;
    case 'clickIfVisible': {
      const target = await resolveClickable(page, step);
      if (await target.isVisible()) await target.click(step.force ? { force: true } : undefined);
      break;
    }
    case 'fill': await locator(page, step).fill(resolveSecret(step, env)); break;
    case 'press': await locator(page, step).press(step.key || 'Enter'); break;
    case 'check': await locator(page, step).check(); break;
    case 'uncheck': await locator(page, step).uncheck(); break;
    case 'hover': await locator(page, step).hover(); break;
    case 'selectOption': await locator(page, step).selectOption(resolveSecret(step, env)); break;
    case 'reload': await page.reload({ waitUntil: step.waitUntil || 'domcontentloaded' }); break;
    case 'waitFor': await locator(page, step).waitFor({ state: step.state || 'visible', timeout: step.timeoutMs }); break;
    case 'waitForTimeout': await page.waitForTimeout(step.timeoutMs ?? 250); break;
    case 'expectVisible': {
      try {
        await locator(page, step).waitFor({ state: 'visible', timeout: step.timeoutMs ?? DEFAULT_ASSERT_TIMEOUT_MS });
      } catch {
        throw new Error(`${label}: expected locator to be visible`);
      }
      break;
    }
    case 'expectText': {
      const target = locator(page, step);
      const timeoutMs = step.timeoutMs ?? DEFAULT_ASSERT_TIMEOUT_MS;
      const expected = step.expected ?? '';
      try {
        await target.waitFor({ state: 'visible', timeout: timeoutMs });
      } catch {
        throw new Error(`${label}: expected locator to be visible before checking text`);
      }
      const startedAt = Date.now();
      let actual = '';
      while (Date.now() - startedAt <= timeoutMs) {
        actual = (await target.textContent()) ?? '';
        if (actual.includes(expected)) break;
        await page.waitForTimeout(DEFAULT_POLL_MS);
      }
      if (!actual.includes(expected)) throw new Error(`${label}: expected text ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      break;
    }
    case 'expectURL': {
      const actual = page.url();
      if (step.equals && actual !== step.equals) throw new Error(`${label}: URL mismatch: ${actual}`);
      if (step.includes && !actual.includes(step.includes)) throw new Error(`${label}: URL does not include ${step.includes}: ${actual}`);
      break;
    }
    case 'desktopStoreSet': {
      if (!step.key || typeof step.key !== 'string') throw new Error(`${label}: desktopStoreSet requires key`);
      const value = resolveRuntimeTokens(step.value);
      await page.evaluate(async ({ key, value, mainPdvStoreKey }) => {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        window.localStorage.setItem(key, serialized);
        const desktop = window.nexusDesktop;
        const bridge = key === mainPdvStoreKey ? desktop?.pdvStore : desktop?.store;
        if (bridge?.save) await bridge.save(key, serialized);
      }, { key: step.key, value, mainPdvStoreKey: MAIN_PDV_STORE_KEY });
      break;
    }
    case 'storageSet': {
      if (!step.key || typeof step.key !== 'string') throw new Error(`${label}: storageSet requires key`);
      const value = resolveRuntimeTokens(step.value);
      await page.evaluate(({ key, value }) => {
        window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      }, { key: step.key, value });
      break;
    }
    case 'expectDesktopStoreJson': {
      if (!step.key || typeof step.key !== 'string') throw new Error(`${label}: expectDesktopStoreJson requires key`);
      if (!step.path || typeof step.path !== 'string') throw new Error(`${label}: expectDesktopStoreJson requires path`);
      const timeoutMs = step.timeoutMs ?? DEFAULT_ASSERT_TIMEOUT_MS;
      const expected = resolveRuntimeTokens(step.expected);
      const startedAt = Date.now();
      let lastActual;
      let lastRaw = null;
      while (Date.now() - startedAt <= timeoutMs) {
        lastRaw = await loadDesktopStoreRaw(page, step.key);
        if (lastRaw) {
          try {
            const parsed = JSON.parse(lastRaw);
            lastActual = readJsonPath(parsed, step.path);
            if (JSON.stringify(lastActual) === JSON.stringify(expected)) return label;
          } catch {
            // O snapshot pode estar entre duas gravacoes; tente novamente ate o timeout.
          }
        }
        await page.waitForTimeout(DEFAULT_POLL_MS);
      }
      if (!lastRaw) throw new Error(`${label}: store ${step.key} is empty`);
      throw new Error(`${label}: expected ${step.path}=${JSON.stringify(expected)}, got ${JSON.stringify(lastActual)}`);
    }
    case 'screenshot': {
      await page.screenshot({ path: path.join(screenshotsDir, `${label}.png`), fullPage: step.fullPage ?? false });
      break;
    }
    case 'capability': {
      if (!step.name || typeof step.name !== 'string') throw new Error('capability requires name');
      const capability = adapter?.capabilities?.[step.name];
      if (typeof capability !== 'function') throw new Error(`Missing demo adapter capability: ${step.name}`);
      await capability({ page, step, runtimeContext });
      break;
    }
    default: throw new Error(`Unsupported QA action: ${step.action}`);
  }
  if (step.holdMs != null) {
    if (!Number.isFinite(step.holdMs) || step.holdMs < 0) throw new TypeError(`${label}: holdMs must be a non-negative number`);
    if (step.holdMs > 0) await page.waitForTimeout(step.holdMs);
  }
  return label;
}

function resolveRuntimeTokens(value) {
  if (typeof value === 'string') return value.replaceAll('{{NOW_ISO}}', new Date().toISOString());
  if (Array.isArray(value)) return value.map(resolveRuntimeTokens);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveRuntimeTokens(item)]));
  return value;
}

function readJsonPath(value, pathExpression) {
  const parts = String(pathExpression).split('.').filter(Boolean);
  let current = value;
  for (const part of parts) {
    if (current == null) return undefined;
    const key = /^\d+$/.test(part) ? Number(part) : part;
    current = current[key];
  }
  return current;
}
