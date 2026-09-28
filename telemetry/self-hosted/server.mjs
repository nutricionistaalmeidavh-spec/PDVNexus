import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { validateRegistration, validateBatch } from '../../cloudflare/telemetry/src/schema.js';

const MAX_BODY_BYTES = 128 * 1024;
const DEFAULT_RETENTION_DAYS = 30;

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body)
  });
  res.end(body);
}

function hashCredential(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

function secureEquals(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function bearer(req) {
  const value = String(req.headers.authorization || '');
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

function ensureSchema(db) {
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS installations (
      installation_id TEXT PRIMARY KEY,
      credential_hash TEXT NOT NULL UNIQUE,
      app_version TEXT NOT NULL,
      release_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      last_event_name TEXT,
      last_session_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_installations_last_seen ON installations(last_seen_at);
    CREATE TABLE IF NOT EXISTS telemetry_events (
      event_id TEXT PRIMARY KEY,
      installation_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      session_id TEXT NOT NULL,
      app_version TEXT NOT NULL,
      release_id TEXT NOT NULL,
      dimensions_json TEXT NOT NULL,
      measurements_json TEXT NOT NULL,
      FOREIGN KEY (installation_id) REFERENCES installations(installation_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_telemetry_events_installation_time
      ON telemetry_events(installation_id, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS idx_telemetry_events_name_time
      ON telemetry_events(event_name, occurred_at DESC);
  `);
}

async function readJson(req) {
  const type = String(req.headers['content-type'] || '').toLowerCase();
  if (!type.startsWith('application/json')) throw Object.assign(new Error('Content-Type application/json obrigatorio.'), { statusCode: 415 });
  const declared = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw Object.assign(new Error('Corpo excede o limite permitido.'), { statusCode: 413 });
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw Object.assign(new Error('Corpo excede o limite permitido.'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try {
    const text = Buffer.concat(chunks).toString('utf8');
    return text ? JSON.parse(text) : {};
  } catch {
    throw Object.assign(new Error('JSON invalido.'), { statusCode: 400 });
  }
}

function validateAsClient(fn, input) {
  try {
    return fn(input);
  } catch (error) {
    if (error?.statusCode) throw error;
    throw Object.assign(new Error(String(error?.message || 'Payload invalido.').slice(0, 180)), { statusCode: 422 });
  }
}

function registerInstallation(db, input, now) {
  const credential = randomBytes(32).toString('base64url');
  const credentialHash = hashCredential(credential);
  db.prepare(`INSERT INTO installations (
      installation_id, credential_hash, app_version, release_id, created_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(installation_id) DO UPDATE SET
      credential_hash=excluded.credential_hash,
      app_version=excluded.app_version,
      release_id=excluded.release_id,
      last_seen_at=excluded.last_seen_at`)
    .run(input.installation_id, credentialHash, input.app_version, input.release_id, now, now);
  return credential;
}

function authenticateInstallation(db, req) {
  const credential = bearer(req);
  if (!credential) return null;
  return db.prepare('SELECT installation_id FROM installations WHERE credential_hash = ?')
    .get(hashCredential(credential)) || null;
}

function recordEvent(db, event, receivedAt) {
  db.prepare(`INSERT OR IGNORE INTO telemetry_events (
      event_id, installation_id, event_name, occurred_at, received_at,
      session_id, app_version, release_id, dimensions_json, measurements_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      event.event_id,
      event.installation_id,
      event.event_name,
      event.occurred_at,
      receivedAt,
      event.session_id,
      event.app_version,
      event.release_id,
      JSON.stringify(event.dimensions || {}),
      JSON.stringify(event.measurements || {})
    );
  db.prepare(`UPDATE installations SET
      app_version=?, release_id=?, last_seen_at=?, last_event_name=?, last_session_id=?
    WHERE installation_id=?`)
    .run(event.app_version, event.release_id, receivedAt, event.event_name, event.session_id, event.installation_id);
}

function purgeOldEvents(db, now, retentionDays) {
  const cutoff = new Date(Date.parse(now) - retentionDays * 86400000).toISOString();
  db.prepare('DELETE FROM telemetry_events WHERE received_at < ?').run(cutoff);
}

function summary(db, now) {
  const onlineCutoff = new Date(Date.parse(now) - 10 * 60 * 1000).toISOString();
  const dayCutoff = new Date(Date.parse(now) - 24 * 60 * 60 * 1000).toISOString();
  return {
    installations: Number(db.prepare('SELECT COUNT(*) AS count FROM installations').get()?.count || 0),
    online_now: Number(db.prepare('SELECT COUNT(*) AS count FROM installations WHERE last_seen_at >= ?').get(onlineCutoff)?.count || 0),
    active_24h: Number(db.prepare('SELECT COUNT(*) AS count FROM installations WHERE last_seen_at >= ?').get(dayCutoff)?.count || 0),
    errors_24h: Number(db.prepare("SELECT COUNT(*) AS count FROM telemetry_events WHERE event_name='operation_failed' AND received_at >= ?").get(dayCutoff)?.count || 0)
  };
}

function createTelemetryServer({
  dbPath = process.env.PDV_TELEMETRY_DB || path.resolve('data/pdv-nexus-telemetry.sqlite'),
  adminToken = process.env.PDV_TELEMETRY_ADMIN_TOKEN || '',
  retentionDays = Number(process.env.PDV_TELEMETRY_RETENTION_DAYS || DEFAULT_RETENTION_DAYS)
} = {}) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  ensureSchema(db);
  const safeRetentionDays = Number.isFinite(retentionDays) && retentionDays >= 1 ? Math.floor(retentionDays) : DEFAULT_RETENTION_DAYS;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/health') {
        return json(res, 200, { ok: true, service: 'pdv-nexus-telemetry-self-hosted', schemaVersion: 1 });
      }

      if (req.method === 'POST' && url.pathname === '/v1/installations/register') {
        const input = validateAsClient(validateRegistration, await readJson(req));
        const credential = registerInstallation(db, input, new Date().toISOString());
        return json(res, 201, { installation_id: input.installation_id, credential });
      }

      if (req.method === 'POST' && url.pathname === '/v1/events') {
        const auth = authenticateInstallation(db, req);
        if (!auth) return json(res, 401, { error: 'Credencial de telemetria invalida.' });
        const batch = validateAsClient(validateBatch, await readJson(req));
        const receivedAt = new Date().toISOString();
        for (const event of batch.events) {
          if (event.installation_id !== auth.installation_id) return json(res, 403, { error: 'installation_id divergente da credencial.' });
          recordEvent(db, event, receivedAt);
        }
        purgeOldEvents(db, receivedAt, safeRetentionDays);
        return json(res, 202, { accepted: batch.events.length });
      }

      if (req.method === 'GET' && url.pathname === '/v1/admin/summary') {
        if (!adminToken || !secureEquals(bearer(req), adminToken)) return json(res, 401, { error: 'Nao autorizado.' });
        return json(res, 200, summary(db, new Date().toISOString()));
      }

      return json(res, 404, { error: 'Not found.' });
    } catch (error) {
      const status = Number(error?.statusCode) || 500;
      if (status >= 500) return json(res, 500, { error: 'Internal server error.' });
      return json(res, status, { error: String(error?.message || 'Request failed.').slice(0, 180) });
    }
  });

  return {
    db,
    server,
    listen(port = Number(process.env.PDV_TELEMETRY_PORT || 8788), host = process.env.PDV_TELEMETRY_HOST || '127.0.0.1') {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => resolve(server.address()));
      });
    },
    close() {
      return new Promise(resolve => server.close(() => {
        try { db.close(); } catch {}
        resolve();
      }));
    }
  };
}

const executedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (executedDirectly) {
  const telemetry = createTelemetryServer();
  const address = await telemetry.listen();
  const shown = typeof address === 'object' && address ? `${address.address}:${address.port}` : String(address);
  console.log(`PDV Nexus telemetry self-hosted ouvindo em ${shown}`);
}

export { MAX_BODY_BYTES, createTelemetryServer, hashCredential, summary };
