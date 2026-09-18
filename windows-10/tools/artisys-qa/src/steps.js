import path from 'node:path';
import { resolveSecret, stepLabel } from './helpers.js';

const MAIN_PDV_STORE_KEY = 'nexus-core:pdv-store:v1';

function locator(page, step) {
  if (step.testId) return page.getByTestId(step.testId);
  if (step.role) return page.getByRole(step.role, step.roleName ? { name: step.roleName, exact: step.exact ?? false } : step.name ? { name: step.name } : undefined);
  if (step.text) return page.getByText(step.text, { exact: step.exact ?? false });
  if (step.label) return page.getByLabel(step.label, { exact: step.exact ?? false });
  if (step.selector) return page.locator(step.selector);
  throw new Error(`Step ${step.action} requires selector, testId, role, text or label`);
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
    case 'click': await locator(page, step).click(); break;
    case 'clickIfVisible': {
      const target = locator(page, step);
      if (await target.isVisible()) await target.click();
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
      if (!(await locator(page, step).isVisible())) throw new Error(`${label}: expected locator to be visible`);
      break;
    }
    case 'expectText': {
      const actual = (await locator(page, step).textContent()) ?? '';
      if (!actual.includes(step.expected ?? '')) throw new Error(`${label}: expected text ${JSON.stringify(step.expected)}, got ${JSON.stringify(actual)}`);
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
      const raw = await page.evaluate(async ({ key, mainPdvStoreKey }) => {
        const desktop = window.nexusDesktop;
        const bridge = key === mainPdvStoreKey ? desktop?.pdvStore : desktop?.store;
        if (bridge?.load) {
          const row = await bridge.load(key);
          if (row?.snapshotJson) return row.snapshotJson;
        }
        return window.localStorage.getItem(key);
      }, { key: step.key, mainPdvStoreKey: MAIN_PDV_STORE_KEY });
      if (!raw) throw new Error(`${label}: store ${step.key} is empty`);
      const parsed = JSON.parse(raw);
      const actual = readJsonPath(parsed, step.path);
      const expected = resolveRuntimeTokens(step.expected);
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${label}: expected ${step.path}=${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
      break;
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
