// Visual P0 smoke for the customer-reported clipped product search (Windows 10).
// Uses the existing open-source Electron/Playwright QA dependencies.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { _electron as electron } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const executablePath = resolve(root, "node_modules/electron/dist/electron.exe");
const entry = resolve(root, "apps/nexus-desktop/main.cjs");
const viewports = [
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 }
];

const app = await electron.launch({
  args: [entry],
  executablePath,
  cwd: root,
  env: { ...process.env, NEXUS_APP: "pdv-demo" },
  timeout: 45000
});
try {
  const page = await app.firstWindow();
  await page.waitForSelector('[data-cashier-toolbar="true"]', { timeout: 30000 });
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    const measurements = await page.evaluate(() => {
      const wrapper = document.querySelector('[data-cashier-search="true"]');
      const toolbar = document.querySelector('[data-cashier-toolbar="true"]');
      const input = toolbar?.querySelector("input");
      const buttons = [...(toolbar?.querySelectorAll("button") || [])];
      if (!wrapper || !toolbar || !input || buttons.length < 5) return null;
      const rect = (element) => {
        const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
        return { left, right, top, bottom, width, height };
      };
      const wrapperRect = rect(wrapper), toolbarRect = rect(toolbar);
      const items = [rect(input), ...buttons.map(rect)];
      return {
        viewportWidth: window.innerWidth,
        wrapper: wrapperRect,
        toolbar: toolbarRect,
        items,
        parentOverflow: getComputedStyle(wrapper).overflow,
        toolbarDisplay: getComputedStyle(toolbar).display,
        toolbarColumns: getComputedStyle(toolbar).gridTemplateColumns
      };
    });
    const label = `${viewport.width}x${viewport.height}`;
    assert.ok(measurements, `${label}: search toolbar and controls are present`);
    const { wrapper, toolbar, items } = measurements;
    assert.ok(wrapper.width > 260, `${label}: product lookup spans the cashier column`);
    assert.ok(toolbar.width > 260, `${label}: actions are not trapped inside a grid cell`);
    assert.ok(toolbar.left >= wrapper.left - 2 && toolbar.right <= wrapper.right + 2, `${label}: toolbar fits the parent`);
    assert.equal(measurements.parentOverflow, "visible", `${label}: suggestions should not be clipped`);
    assert.equal(measurements.toolbarDisplay, "grid", `${label}: toolbar should be grid`);
    for (const [index, item] of items.entries()) {
      assert.ok(item.width > 20 && item.height >= 30, `${label}: control ${index} has usable dimensions`);
      assert.ok(item.left >= wrapper.left - 2 && item.right <= wrapper.right + 2, `${label}: control ${index} not cut horizontally`);
      assert.ok(item.top >= wrapper.top - 2 && item.bottom <= wrapper.bottom + 2, `${label}: control ${index} not cut vertically`);
      assert.ok(item.right <= measurements.viewportWidth + 2, `${label}: control ${index} not outside viewport`);
    }
    await page.screenshot({ path: resolve(root, `qa-cashier-${label}.png`), fullPage: false });
    console.log(`PASS ${label}: search width ${wrapper.width.toFixed(0)}, toolbar width ${toolbar.width.toFixed(0)}`);
  }
} finally {
  await app.close();
}
