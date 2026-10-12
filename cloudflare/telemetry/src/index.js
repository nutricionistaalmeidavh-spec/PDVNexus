import { validateRegistration, validateBatch } from './schema.js';
import { geographicArea, recordGeographicObservation, geographicSummary } from './geography.js';
import { geographyDashboard } from './geography-dashboard.js';
import { createCredential, hashCredential, authenticateRequest } from './auth.js';
import {
  ensureSchema,
  registerInstallation,
  recordEvent,
  purgeOldEvents,
  telemetrySummary
} from './storage.js';

const MAX_BODY_BYTES = 128 * 1024;

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

async function readJson(request) {
  const type = String(request.headers.get('content-type') || '').toLowerCase();
  if (!type.startsWith('application/json')) throw httpError(415, 'Content-Type application/json obrigatorio.');
  const declared = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw httpError(413, 'Corpo excede o limite permitido.');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw httpError(413, 'Corpo excede o limite permitido.');
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw httpError(400, 'JSON invalido.');
  }
}

function validateAsClient(fn, input) {
  try {
    return fn(input);
  } catch (error) {
    if (error?.statusCode) throw error;
    throw httpError(422, String(error?.message || 'Payload invalido.').slice(0, 180));
  }
}

function database(env) {
  const db = env?.DB;
  if (!db?.prepare) throw httpError(503, 'Binding D1 dedicado da telemetria indisponivel.');
  return db;
}

function adminAuthorized(request, env) {
  const expected = String(env?.TELEMETRY_ADMIN_TOKEN || '').trim();
  if (!expected) return false;
  return String(request.headers.get('authorization') || '') === `Bearer ${expected}`;
}

async function handleRegistration(request, env) {
  const db = database(env);
  const input = validateAsClient(validateRegistration, await readJson(request));
  const credential = createCredential(32);
  const credentialHash = await hashCredential(credential);
  const now = new Date().toISOString();
  await registerInstallation(db, input, credentialHash, now);
  return json(201, { installation_id: input.installation_id, credential });
}

async function handleEvents(request, env) {
  const db = database(env);
  await ensureSchema(db);
  const auth = await authenticateRequest(request, db);
  if (!auth) return json(401, { error: 'Credencial de telemetria invalida.' });

  const batch = validateAsClient(validateBatch, await readJson(request));
  const now = new Date().toISOString();
  for (const event of batch.events) {
    if (event.installation_id !== auth.installation_id) throw httpError(403, 'installation_id divergente da credencial.');
    await recordEvent(db, event, now);
    env.ANALYTICS?.writeDataPoint?.({
      indexes: [event.installation_id],
      blobs: [
        event.event_name,
        event.app_version,
        event.release_id,
        event.dimensions?.subsystem || '',
        event.dimensions?.operation || '',
        event.dimensions?.fingerprint || '',
        event.dimensions?.result || '',
        event.dimensions?.channel || ''
      ],
      doubles: [
        Number(event.measurements?.uptime_seconds || 0),
        Number(event.measurements?.duration_ms || 0)
      ]
    });
  }

  // Only accepted, authenticated telemetry is counted. Geography stays strictly aggregated.
  // Geo failures never interrupt the existing collector or clients.
  try {
    await recordGeographicObservation(db, geographicArea(request), batch.events[0].app_version, now);
  } catch {
    // Fail open: neither registration nor normal events depend on regional analytics.
  }

  try {
    await purgeOldEvents(db, now, 30);
  } catch {
    // Retencao nao pode derrubar a ingestao.
  }

  return json(202, { accepted: batch.events.length });
}

async function handleAdminSummary(request, env) {
  if (!adminAuthorized(request, env)) return json(401, { error: 'Nao autorizado.' });
  return json(200, await telemetrySummary(database(env), new Date().toISOString()));
}

async function handleRequest(request, env) {
  try {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return json(200, { ok: true, service: 'pdv-nexus-telemetry', schemaVersion: 1 });
    }
    if (request.method === 'POST' && url.pathname === '/v1/installations/register') {
      return await handleRegistration(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/v1/events') {
      return await handleEvents(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/v1/admin/summary') {
      return await handleAdminSummary(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/v1/admin/geography') {
      if (!adminAuthorized(request, env)) return json(401, { error: 'Nao autorizado.' });
      return json(200, await geographicSummary(database(env), new Date().toISOString(), url.searchParams.get('days') ?? 7));
    }
    if (request.method === 'GET' && url.pathname === '/admin/geography') {
      const nonce = crypto.randomUUID().replace(/-/g, '');
      return new Response(geographyDashboard(nonce), {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
          'x-frame-options': 'DENY',
          'referrer-policy': 'no-referrer',
          'content-security-policy': `default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; connect-src 'self'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'`
        }
      });
    }
    return json(404, { error: 'Not found.' });
  } catch (error) {
    const status = Number(error?.statusCode) || 500;
    if (status >= 500) return json(500, { error: 'Internal server error.' });
    return json(status, { error: String(error?.message || 'Request failed.').slice(0, 180) });
  }
}

export { MAX_BODY_BYTES, database, adminAuthorized, handleRequest };
export default { fetch: handleRequest };
