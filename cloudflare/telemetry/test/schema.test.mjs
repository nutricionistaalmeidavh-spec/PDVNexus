import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRegistration, validateBatch } from '../src/schema.js';

test('registro aceita apenas identidade tecnica pseudonima', () => {
  const input = validateRegistration({
    protocol_version: 1,
    telemetry_schema_version: 1,
    installation_id: '00000000-0000-4000-8000-000000000001',
    app_version: '0.1.19',
    release_id: '0.1.19'
  });
  assert.equal(input.installation_id, '00000000-0000-4000-8000-000000000001');
  assert.throws(() => validateRegistration({ ...input, email: 'cliente@example.com' }), /desconhecido|proibido/i);
});

test('batch aceita heartbeat e rejeita campos sensiveis', () => {
  const base = {
    schema_version: 1,
    event_id: 'event-1',
    event_name: 'heartbeat',
    occurred_at: '2026-09-28T14:30:00.000Z',
    installation_id: '00000000-0000-4000-8000-000000000001',
    session_id: 'session-1',
    app_version: '0.1.19',
    release_id: '0.1.19',
    dimensions: {},
    measurements: { uptime_seconds: 300 }
  };
  const parsed = validateBatch({ schema_version: 1, events: [base] });
  assert.equal(parsed.events[0].event_name, 'heartbeat');
  assert.throws(() => validateBatch({
    schema_version: 1,
    events: [{ ...base, dimensions: { email: 'cliente@example.com' } }]
  }), /desconhecido|sensivel|proibido/i);
});

test('batch suporta eventos de ciclo, updater e falha anonima', () => {
  for (const eventName of ['app_started', 'app_closed', 'updater_status', 'operation_failed']) {
    const dimensions = eventName === 'app_started'
      ? { platform: 'win32', architecture: 'x64' }
      : eventName === 'updater_status'
        ? { result: 'current', channel: 'windows10-x64', target_version: '0.1.19' }
        : eventName === 'operation_failed'
          ? { module: 'pdv', subsystem: 'desktop', operation: 'startup', error_class: 'TypeError', fingerprint: 'ERR-0123456789abcdef' }
          : { result: 'closed' };
    const measurements = eventName === 'app_closed' ? { duration_ms: 1000 } : {};
    assert.doesNotThrow(() => validateBatch({
      schema_version: 1,
      events: [{
        schema_version: 1,
        event_id: `event-${eventName}`,
        event_name: eventName,
        occurred_at: '2026-09-28T14:30:00.000Z',
        installation_id: '00000000-0000-4000-8000-000000000001',
        session_id: 'session-1',
        app_version: '0.1.19',
        release_id: '0.1.19',
        dimensions,
        measurements
      }]
    }));
  }
});
