#!/usr/bin/env node
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadQaManifest, resolveEnvironment, resolveViewport } from "../tools/artisys-qa/src/manifest.js";
import { runQaFlow } from "../tools/artisys-qa/src/runner.js";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : true;
    args[key] = value;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.config) throw new Error("Missing --config");
if (!args.suite) throw new Error("Missing --suite");

const { manifest, rootDir } = await loadQaManifest(args.config);
const { name: environmentName, environment } = resolveEnvironment(manifest, args.environment);
const viewport = resolveViewport(manifest, args.viewport);
const suitePath = path.resolve(args.suite);
const suite = JSON.parse(await readFile(suitePath, "utf8"));
if (!Array.isArray(suite.flows) || suite.flows.length === 0) throw new Error("Business flow suite is empty");

const outputRoot = path.resolve(args.output || "qa-business-artifacts");
await mkdir(outputRoot, { recursive: true });
const tempDir = await mkdtemp(path.join(os.tmpdir(), "pdv-business-flows-"));
const results = [];
const failures = [];

try {
  for (const flow of suite.flows) {
    const flowFile = path.join(tempDir, `${flow.id}.json`);
    await writeFile(flowFile, `${JSON.stringify({ id: `pdv-${flow.id}`, steps: flow.steps }, null, 2)}\n`, "utf8");
    const startedAt = Date.now();
    try {
      const result = await runQaFlow({
        manifest,
        rootDir,
        environmentName,
        environment,
        flowName: flow.id,
        flowFile,
        viewport,
        outputRoot: path.join(outputRoot, flow.id),
      });
      const record = {
        id: flow.id,
        category: flow.category,
        critical: flow.critical === true,
        status: "passed",
        durationMs: Date.now() - startedAt,
        outputDir: path.relative(outputRoot, result.outputDir),
      };
      results.push(record);
      console.log(`PASS ${flow.category}/${flow.id} (${record.durationMs}ms)`);
    } catch (error) {
      const record = {
        id: flow.id,
        category: flow.category,
        critical: flow.critical === true,
        status: "failed",
        durationMs: Date.now() - startedAt,
        message: error?.summary?.failure?.message || error?.message || String(error),
      };
      results.push(record);
      failures.push(record);
      console.error(`FAIL ${flow.category}/${flow.id}: ${record.message}`);
    }
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

const categorySummary = Object.fromEntries(
  [...new Set(results.map((item) => item.category))].map((category) => {
    const items = results.filter((item) => item.category === category);
    return [category, {
      total: items.length,
      passed: items.filter((item) => item.status === "passed").length,
      failed: items.filter((item) => item.status === "failed").length,
    }];
  }),
);
const summary = {
  schemaVersion: 1,
  suite: path.basename(suitePath),
  total: results.length,
  passed: results.filter((item) => item.status === "passed").length,
  failed: failures.length,
  categories: categorySummary,
  results,
};
await writeFile(path.join(outputRoot, "business-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
if (failures.length > 0) process.exitCode = 1;
