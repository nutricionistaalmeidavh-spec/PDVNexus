import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const builtIndexUrl = new URL("../apps/pdv-demo/dist/index.html", import.meta.url);

test("o build do PDV usa recursos relativos compativeis com Electron file://", async () => {
  const html = await readFile(builtIndexUrl, "utf8");
  const resourceUrls = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(
    ([, resourceUrl]) => resourceUrl,
  );

  assert.ok(resourceUrls.length > 0, "o HTML precisa carregar ao menos um recurso");
  assert.equal(
    resourceUrls.some((resourceUrl) => resourceUrl.startsWith("/")),
    false,
    `recursos absolutos quebram no Electron: ${resourceUrls.join(", ")}`,
  );
});
