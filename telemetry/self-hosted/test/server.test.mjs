import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createTelemetryServer } from '../server.mjs';

function tempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdv-nexus-telemetry-server-'));
  return path.join(dir, 'telemetry.sqlite');
}

function event(overrides = {}) {
  return {
    schema_version: 1,
    event_id: overrides.event_id || 'event-1',
    event_name: overrides.event_name || 'heartbeat',
    occurred_at: new Date().toISOString(),
    installation_id: overrides.installation_id,
    session_id: overrides.session_id || 'session-1',
    app_version: '0.1.19',
    release_id: '0.1.19',
    dimensions: overrides.dimensions || {},
    measurements: overrides.measurements || { uptime_seconds: 60 }
  };
}

test('coletor self-hosted registra, ingere e resume sem servico externo', async t => {
  const telemetry = createTelemetryServer({ dbPath: tempDb(), adminToken: 'admin-test-token' });
  const address = await telemetry.listen(0, '127.0.0.1');
  t.after(async () => telemetry.close());
  const base = `http://127.0.0.1:${address.port}`;

  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);

  const registration = await fetch(`${base}/v1/installations/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      protocol_version: 1,
      telemetry_schema_version: 1,
      installation_id: '00000000-0000-4000-8000-000000000001',
      app_version: '0.1.19',
      release_id: '0.1.19'
    })
  });
  assert.equal(registration.status, 201);
  const registered = await registration.json();
  assert.ok(registered.credential);

  const ingestion = await fetch(`${base}/v1/events`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${registered.credential}`
    },
    body: JSON.stringify({
      schema_version: 1,
      events: [event({ installation_id: registered.installation_id })]
    })
  });
  assert.equal(ingestion.status, 202);

  const unauthorized = await fetch(`${base}/v1/admin/summary`);
  assert.equal(unauthorized.status, 401);

  const summaryResponse = await fetch(`${base}/v1/admin/summary`, {
    headers: { authorization: 'Bearer admin-test-token' }
  });
  assert.equal(summaryResponse.status, 200);
  const summary = await summaryResponse.json();
  assert.deepEqual(summary, {
    installations: 1,
    online_now: 1,
    active_24h: 1,
    errors_24h: 0
  });
});

test('coletor rejeita payload sensivel e credencial invalida', async t => {
  const telemetry = createTelemetryServer({ dbPath: tempDb(), adminToken: 'admin-test-token' });
  const address = await telemetry.listen(0, '127.0.0.1');
  t.after(async () => telemetry.close());
  const base = `http://127.0.0.1:${address.port}`;

  const invalidRegistration = await fetch(`${base}/v1/installations/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      protocol_version: 1,
      telemetry_schema_version: 1,
      installation_id: '00000000-0000-4000-8000-000000000001',
      app_version: '0.1.19',
      release_id: '0.1.19',
      email: 'cliente@example.com'
    })
  });
  assert.equal(invalidRegistration.status, 422);

  const invalidCredential = await fetch(`${base}/v1/events`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer invalida'
    },
    body: JSON.stringify({ schema_version: 1, events: [] })
  });
  assert.equal(invalidCredential.status, 401);
});
