import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  CONSENT_VERSION,
  createPdvTelemetryCore,
  fingerprintError,
  validateTelemetryEvent
} = require("../apps/nexus-desktop/pdv-telemetry.cjs");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pdv-nexus-telemetry-"));
}

test("telemetria fica desativada sem consentimento explicito", () => {
  const rootDir = tempDir();
  const telemetry = createPdvTelemetryCore({ rootDir, appVersion: "0.1.19" });
  assert.equal(telemetry.status().enabled, false);
  assert.equal(telemetry.record("app_started", { dimensions: { platform: "win32", architecture: "x64" } }), false);
  assert.equal(telemetry.status().pending, 0);
});

test("consentimento persiste identidade pseudonima e fila local", () => {
  const rootDir = tempDir();
  const telemetry = createPdvTelemetryCore({
    rootDir,
    appVersion: "0.1.19",
    randomUUID: (() => {
      const values = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"];
      return () => values.shift();
    })()
  });

  telemetry.setConsent(true);
  assert.equal(telemetry.status().consentVersion, CONSENT_VERSION);
  assert.equal(telemetry.record("heartbeat", { measurements: { uptime_seconds: 120 } }), true);
  const firstId = telemetry.status().installationId;
  assert.equal(telemetry.status().pending, 1);

  const reopened = createPdvTelemetryCore({ rootDir, appVersion: "0.1.19" });
  assert.equal(reopened.status().installationId, firstId);
  assert.equal(reopened.status().pending, 1);
});

test("schema rejeita campos e valores sensiveis", () => {
  assert.throws(
    () => validateTelemetryEvent("operation_failed", { dimensions: { email: "cliente@empresa.com" } }),
    /desconhecido|sensivel|proibido/i
  );
  assert.throws(
    () => validateTelemetryEvent("operation_failed", { dimensions: { error_class: "cliente@empresa.com" } }),
    /sensivel|proibido/i
  );
});

test("fingerprint normaliza ids e caminhos dinamicos", () => {
  const left = fingerprintError({
    errorClass: "TypeError",
    subsystem: "desktop",
    operation: "startup",
    stack: "TypeError at C:\\Users\\alice\\app.js:123:45 id 550e8400-e29b-41d4-a716-446655440000"
  });
  const right = fingerprintError({
    errorClass: "TypeError",
    subsystem: "desktop",
    operation: "startup",
    stack: "TypeError at C:\\Users\\bob\\app.js:999:77 id 123e4567-e89b-42d3-a456-426614174000"
  });
  assert.equal(left, right);
  assert.match(left, /^ERR-[a-f0-9]{16}$/);
});

test("flush bem sucedido remove eventos; endpoint vazio nunca envia", async () => {
  const rootDir = tempDir();
  let calls = 0;
  const telemetry = createPdvTelemetryCore({
    rootDir,
    appVersion: "0.1.19",
    endpoint: "https://telemetry.example.test",
    sender: async batch => {
      calls += 1;
      assert.equal(batch.schema_version, 1);
      return { status: 202 };
    }
  });
  telemetry.setConsent(true);
  telemetry.record("heartbeat", { measurements: { uptime_seconds: 5 } });
  const summary = await telemetry.flush();
  assert.equal(summary.sent, 1);
  assert.equal(telemetry.status().pending, 0);
  assert.equal(calls, 1);

  const offline = createPdvTelemetryCore({ rootDir: tempDir(), appVersion: "0.1.19", sender: async () => { throw new Error("nao deveria enviar"); } });
  offline.setConsent(true);
  offline.record("heartbeat", { measurements: { uptime_seconds: 1 } });
  const paused = await offline.flush();
  assert.equal(paused.paused, true);
  assert.equal(offline.status().pending, 1);
});

test("fila limitada preserva diagnosticos antes de heartbeats antigos", () => {
  const rootDir = tempDir();
  let seq = 0;
  const telemetry = createPdvTelemetryCore({
    rootDir,
    appVersion: "0.1.19",
    maxPending: 3,
    idFactory: prefix => `${prefix}-${++seq}`
  });
  telemetry.setConsent(true);
  telemetry.record("heartbeat", { measurements: { uptime_seconds: 1 } });
  telemetry.record("heartbeat", { measurements: { uptime_seconds: 2 } });
  telemetry.recordFailure(new Error("boom"), { subsystem: "desktop", operation: "startup" });
  telemetry.record("heartbeat", { measurements: { uptime_seconds: 3 } });

  const events = telemetry.inspectQueue();
  assert.equal(events.length, 3);
  assert.equal(events.some(event => event.event_name === "operation_failed"), true);
});
