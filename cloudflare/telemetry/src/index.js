import { validateRegistration, validateBatch } from './schema.js';
import { createCredential, hashCredential, authenticateRequest } from './auth.js';
import {
  ensureSchema,
  registerInstallation,
  recordEvent,
  purgeOldEvents
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
    throw httpError(422, String(error?.message || 'Payload invalido.'));
  }
}

function database(env) {
  const db = env?.pdvnexus;
  if (!db?.prepare) throw httpError(503, 'Binding D1 pdvnexus indisponivel.');
  return db;
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
  }

  try {
    await purgeOldEvents(db, now, 30);
  } catch {
    // Retencao nao pode derrubar a ingestao.
  }

  return json(202, { accepted: batch.events.length });
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
    return json(404, { error: 'Not found.' });
  } catch (error) {
    const status = Number(error?.statusCode) || 500;
    if (status >= 500) return json(500, { error: 'Internal server error.' });
    return json(status, { error: String(error?.message || 'Request failed.').slice(0, 180) });
  }
}

export { MAX_BODY_BYTES, handleRequest };
export default { fetch: handleRequest };
