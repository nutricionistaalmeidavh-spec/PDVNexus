import { test as base, expect } from 'playwright/test';
import { withTerminals } from './index.js';

export const test = base.extend({
  terminalCount: [2, { option: true }],
  terminals: async ({ browser, baseURL, terminalCount }, use) => {
    await withTerminals(browser, { count: terminalCount, contextOptions: { baseURL } }, use);
  },
  login: [undefined, { option: true }],
  authenticatedPage: async ({ page, login }, use) => {
    if (typeof login !== 'function') throw new Error('Provide test.use({ login: async page => ... }) for authenticatedPage');
    await login(page);
    await use(page);
  },
});
export { expect };
