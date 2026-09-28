'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const CONSENT_VERSION = 1;
const TELEMETRY_SCHEMA_VERSION = 1;
const DEFAULT_MAX_PENDING = 500;
const DEFAULT_BATCH_SIZE = 50;
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
const FLUSH_INTERVAL_MS = 60 * 1000;
const DIAGNOSTIC_EVENTS = new Set(['operation_failed']);

const EVENT_SCHEMAS = Object.freeze({
  app_started: { dimensions: ['platform', 'architecture'], measurements: [] },
  app_closed: { dimensions: ['result'], measurements: ['duration_ms'] },
  heartbeat: { dimensions: [], measurements: ['uptime_seconds'] },
  updater_status: { dimensions: ['result', 'channel', 'target_version'], measurements: [] },
  operation_failed: { dimensions: ['module', 'subsystem', 'operation', 'error_class', 'fingerprint'], measurements: [] }
});

const FORBIDDEN_FIELD = /(?:password|senha|passwd|token|authorization|credential|secret|segredo|api.?key|private.?key|certificate|certificado|\bcsc\b|\bcpf\b|\bcnpj\b|documento?|\bemail\b|telefone|\bphone\b|address|endere[cç]o|\bxml\b|danfe|\bcard\b|cart[aã]o|\bpan\b|\bcvv\b|observation|observa[cç][aã]o|notes?|message.?content)/i;
const SENSITIVE_VALUE = [
  /Bearer\s+[A-Za-z0-9._~+/=-]{12,}/i,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\b\d{11}\b/,
  /\b\d{14}\b/,
  /\b(?:\d[ -]*?){13,19}\b/
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertSafeString(value, field, maxLength = 128) {
  if (FORBIDDEN_FIELD.test(String(field))) throw new Error(`Campo sensivel/proibido em telemetria: ${field}.`);
  if (typeof value !== 'string') throw new TypeError(`Campo ${field} deve ser texto.`);
  const text = value.trim();
  if (!text) throw new TypeError(`Campo ${field} deve ser texto.`);
  if (text.length > maxLength) throw new RangeError(`Campo ${field} excede o limite.`);
  if (SENSITIVE_VALUE.some(pattern => pattern.test(text))) throw new Error(`Valor sensivel/proibido em telemetria: ${field}.`);
  return text;
}

function validateTelemetryEvent(eventName, payload = {}) {
  const name = String(eventName || '').trim();
  const schema = EVENT_SCHEMAS[name];
  if (!schema) throw new Error(`Evento de telemetria desconhecido: ${name || '<vazio>'}.`);
  if (!isPlainObject(payload)) throw new TypeError('Payload de telemetria deve ser objeto.');

  const dimensions = {};
  const inputDimensions = payload.dimensions || {};
  if (!isPlainObject(inputDimensions)) throw new TypeError('dimensions deve ser objeto.');
  for (const [key, value] of Object.entries(inputDimensions)) {
    if (!schema.dimensions.includes(key)) throw new Error(`Campo de telemetria desconhecido: ${key}.`);
    dimensions[key] = assertSafeString(value, key);
  }

  const measurements = {};
  const inputMeasurements = payload.measurements || {};
  if (!isPlainObject(inputMeasurements)) throw new TypeError('measurements deve ser objeto.');
  for (const [key, value] of Object.entries(inputMeasurements)) {
    if (!schema.measurements.includes(key)) throw new Error(`Campo de telemetria desconhecido: ${key}.`);
    const number = Number(value);
    if (!Number.isFinite(number)) throw new TypeError(`Campo ${key} deve ser numerico.`);
    measurements[key] = number;
  }

  return { dimensions, measurements };
}

function normalizeStack(stack = '') {
  return String(stack || '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/([A-Za-z]:\\Users\\)[^\\]+/gi, '$1<user>')
    .replace(/(\/home\/)[^/]+/g, '$1<user>')
    .replace(/:\d+:\d+/g, ':<line>:<col>')
    .replace(/\b\d{3,}\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1024);
}

function fingerprintError({ errorClass = 'Error', subsystem = 'desktop', operation = 'unknown', stack = '' } = {}) {
  const signature = [
    String(errorClass).trim().toLowerCase(),
    String(subsystem).trim().toLowerCase(),
    String(operation).trim().toLowerCase(),
    normalizeStack(stack)
  ].join('|');
  return `ERR-${crypto.createHash('sha256').update(signature).digest('hex').slice(0, 16)}`;
}

function atomicWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

function createInitialState(randomUUID) {
  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    consentVersion: 0,
    consentAcceptedAt: null,
    enabled: false,
    diagnostics: false,
    installationId: String(randomUUID()),
    queue: []
  };
}

function loadState(filePath, randomUUID) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!isPlainObject(parsed) || typeof parsed.installationId !== 'string' || !Array.isArray(parsed.queue)) throw new Error('estado invalido');
    return {
      schemaVersion: TELEMETRY_SCHEMA_VERSION,
      consentVersion: Number(parsed.consentVersion || 0),
      consentAcceptedAt: parsed.consentAcceptedAt || null,
      enabled: Boolean(parsed.enabled),
      diagnostics: Boolean(parsed.diagnostics),
      installationId: parsed.installationId,
      queue: parsed.queue.filter(item => isPlainObject(item) && isPlainObject(item.envelope))
    };
  } catch {
    return createInitialState(randomUUID);
  }
}

function createPdvTelemetryCore({
  rootDir,
  appVersion = '0.0.0',
  releaseId = appVersion,
  endpoint = '',
  sender = null,
  now = () => new Date().toISOString(),
  randomUUID = crypto.randomUUID,
  idFactory = prefix => `${prefix}-${randomUUID()}`,
  maxPending = DEFAULT_MAX_PENDING,
  batchSize = DEFAULT_BATCH_SIZE,
  random = Math.random
} = {}) {
  if (!rootDir) throw new TypeError('rootDir obrigatorio.');
  const statePath = path.join(rootDir, 'pdv-telemetry.json');
  let state = loadState(statePath, randomUUID);
  const sessionId = String(idFactory('session'));
  const configuredEndpoint = String(endpoint || '').trim().replace(/\/+$/, '');

  function persist() {
    atomicWriteJson(statePath, state);
  }

  function isEnabled() {
    return state.consentVersion >= CONSENT_VERSION && Boolean(state.consentAcceptedAt) && state.enabled;
  }

  function status() {
    return {
      enabled: isEnabled(),
      diagnostics: state.diagnostics,
      consentVersion: state.consentVersion,
      consentAcceptedAt: state.consentAcceptedAt,
      endpointConfigured: Boolean(configuredEndpoint),
      installationId: state.installationId,
      pending: state.queue.length
    };
  }

  function setConsent(accepted, { diagnostics = accepted } = {}) {
    state.consentVersion = CONSENT_VERSION;
    state.consentAcceptedAt = accepted ? now() : null;
    state.enabled = Boolean(accepted);
    state.diagnostics = Boolean(accepted && diagnostics);
    if (!accepted) state.queue = [];
    persist();
    return status();
  }

  function trimQueue() {
    while (state.queue.length > maxPending) {
      let victimIndex = 0;
      for (let index = 1; index < state.queue.length; index += 1) {
        const current = state.queue[index];
        const victim = state.queue[victimIndex];
        if (Number(current.priority || 0) < Number(victim.priority || 0)) victimIndex = index;
      }
      state.queue.splice(victimIndex, 1);
    }
  }

  function record(eventName, payload = {}) {
    try {
      if (!isEnabled()) return false;
      if (DIAGNOSTIC_EVENTS.has(String(eventName)) && !state.diagnostics) return false;
      const validated = validateTelemetryEvent(eventName, payload);
      const envelope = {
        schema_version: TELEMETRY_SCHEMA_VERSION,
        event_id: String(idFactory('event')),
        event_name: String(eventName),
        occurred_at: now(),
        installation_id: state.installationId,
        session_id: sessionId,
        app_version: String(appVersion),
        release_id: String(releaseId || appVersion),
        dimensions: validated.dimensions,
        measurements: validated.measurements
      };
      state.queue.push({
        envelope,
        attempts: 0,
        nextAttemptAt: null,
        priority: DIAGNOSTIC_EVENTS.has(String(eventName)) ? 10 : 0
      });
      trimQueue();
      persist();
      return true;
    } catch {
      return false;
    }
  }

  function recordFailure(error, { module = 'pdv', subsystem = 'desktop', operation = 'unknown' } = {}) {
    const safeErrorClass = String(error?.name || 'Error').slice(0, 80) || 'Error';
    return record('operation_failed', {
      dimensions: {
        module: String(module || 'pdv').slice(0, 80),
        subsystem: String(subsystem || 'desktop').slice(0, 80),
        operation: String(operation || 'unknown').slice(0, 80),
        error_class: safeErrorClass,
        fingerprint: fingerprintError({
          errorClass: safeErrorClass,
          subsystem,
          operation,
          stack: error?.stack || ''
        })
      }
    });
  }

  function retryAt(attempt) {
    const seconds = Math.min(3600, Math.max(5, 5 * (2 ** Math.min(attempt, 8))));
    const jitter = 1 + (Number(random()) - 0.5) * 0.2;
    return new Date(Date.parse(now()) + seconds * 1000 * jitter).toISOString();
  }

  async function flush() {
    const summary = { attempted: 0, sent: 0, retryable: 0, discarded: 0, paused: false };
    try {
      if (!isEnabled() || !configuredEndpoint || typeof sender !== 'function') {
        summary.paused = true;
        return summary;
      }
      const currentTime = now();
      const ready = state.queue
        .filter(item => !item.nextAttemptAt || item.nextAttemptAt <= currentTime)
        .sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0))
        .slice(0, Math.min(Number(batchSize) || DEFAULT_BATCH_SIZE, DEFAULT_BATCH_SIZE));
      if (!ready.length) return summary;
      summary.attempted = ready.length;

      let response;
      try {
        response = await sender({ schema_version: TELEMETRY_SCHEMA_VERSION, events: ready.map(item => item.envelope) });
      } catch {
        const nextAttemptAt = retryAt(Math.max(...ready.map(item => Number(item.attempts || 0)), 0));
        for (const item of ready) {
          item.attempts = Number(item.attempts || 0) + 1;
          item.nextAttemptAt = nextAttemptAt;
        }
        summary.retryable = ready.length;
        persist();
        return summary;
      }

      const code = Number(response?.status || 0);
      const ids = new Set(ready.map(item => item.envelope.event_id));
      if (code >= 200 && code < 300) {
        state.queue = state.queue.filter(item => !ids.has(item.envelope.event_id));
        summary.sent = ready.length;
      } else if ([400, 413, 422].includes(code)) {
        state.queue = state.queue.filter(item => !ids.has(item.envelope.event_id));
        summary.discarded = ready.length;
      } else if ([401, 403].includes(code)) {
        summary.paused = true;
      } else {
        const nextAttemptAt = retryAt(Math.max(...ready.map(item => Number(item.attempts || 0)), 0));
        for (const item of ready) {
          item.attempts = Number(item.attempts || 0) + 1;
          item.nextAttemptAt = nextAttemptAt;
        }
        summary.retryable = ready.length;
      }
      persist();
      return summary;
    } catch {
      summary.paused = true;
      return summary;
    }
  }

  function inspectQueue() {
    return state.queue.map(item => ({ ...item.envelope }));
  }

  return { status, setConsent, record, recordFailure, flush, inspectQueue };
}

function createTelemetryCredentialStore({ app, safeStorage } = {}) {
  const filePath = path.join(app.getPath('userData'), 'pdv-telemetry-credential.bin');
  function encryptionAvailable() {
    try { return Boolean(safeStorage?.isEncryptionAvailable?.()); } catch { return false; }
  }
  function save(secret) {
    const value = String(secret || '').trim();
    if (!value || !encryptionAvailable()) throw new Error('Armazenamento seguro de telemetria indisponivel.');
    const encrypted = safeStorage.encryptString(value);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, encrypted, { mode: 0o600 });
    fs.renameSync(tempPath, filePath);
  }
  function load() {
    if (!fs.existsSync(filePath) || !encryptionAvailable()) return null;
    try { return String(safeStorage.decryptString(fs.readFileSync(filePath)) || '').trim() || null; } catch { return null; }
  }
  function remove() {
    try { fs.rmSync(filePath, { force: true }); } catch {}
  }
  return { save, load, remove, encryptionAvailable };
}

function requestJson(url, { method = 'GET', headers = {}, body = null, timeoutMs = 3500 } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = https.request(target, { method, headers, timeout: timeoutMs }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let payload = null;
        try { payload = raw ? JSON.parse(raw) : null; } catch {}
        resolve({ status: Number(response.statusCode || 0), payload });
      });
    });
    request.on('timeout', () => request.destroy(new Error('telemetry timeout')));
    request.on('error', reject);
    if (body != null) request.write(body);
    request.end();
  });
}

function createTelemetryHttpSender({ endpoint, credentialStore, timeoutMs = 3500 } = {}) {
  const base = String(endpoint || '').trim().replace(/\/+$/, '');
  return async batch => {
    if (!base) return { status: 0 };
    let credential = credentialStore.load();
    if (!credential) {
      const first = batch?.events?.[0];
      if (!first) return { status: 400 };
      const registration = await requestJson(`${base}/v1/installations/register`, {
        method: 'POST',
        timeoutMs,
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          protocol_version: 1,
          telemetry_schema_version: TELEMETRY_SCHEMA_VERSION,
          installation_id: first.installation_id,
          app_version: first.app_version,
          release_id: first.release_id
        })
      });
      credential = String(registration.payload?.credential || '').trim();
      if (registration.status < 200 || registration.status >= 300 || !credential) return { status: registration.status || 401 };
      try { credentialStore.save(credential); } catch { return { status: 401 }; }
    }

    const response = await requestJson(`${base}/v1/events`, {
      method: 'POST',
      timeoutMs,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `Bearer ${credential}`
      },
      body: JSON.stringify(batch)
    });
    if ([401, 403].includes(response.status)) credentialStore.remove();
    return { status: response.status };
  };
}

function createPdvTelemetry({ app, dialog, safeStorage, packageMetadata = {}, endpoint = '' } = {}) {
  const rootDir = app.getPath('userData');
  const startedAt = Date.now();
  const configuredEndpoint = String(endpoint || '').trim();
  const credentialStore = createTelemetryCredentialStore({ app, safeStorage });
  const sender = createTelemetryHttpSender({ endpoint: configuredEndpoint, credentialStore });
  const core = createPdvTelemetryCore({
    rootDir,
    appVersion: String(packageMetadata.version || app.getVersion?.() || '0.0.0'),
    releaseId: String(packageMetadata.version || app.getVersion?.() || '0.0.0'),
    endpoint: configuredEndpoint,
    sender
  });
  let heartbeatTimer = null;
  let flushTimer = null;
  let started = false;

  async function ensureConsent() {
    const current = core.status();
    if (!configuredEndpoint || current.consentVersion >= CONSENT_VERSION) return current.enabled;
    const response = await dialog.showMessageBox({
      type: 'question',
      title: 'Privacidade e diagnostico',
      message: 'Permitir envio de telemetria tecnica anonima?',
      detail: 'O PDV Nexus pode enviar versao instalada, abertura/fechamento, tempo online, status de atualizacao e falhas tecnicas anonimizadas. Nao envia vendas, valores, produtos, nomes, CPF/CNPJ, telefone, e-mail, senhas ou dados fiscais.',
      buttons: ['Permitir', 'Nao enviar'],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    });
    core.setConsent(response.response === 0, { diagnostics: response.response === 0 });
    return response.response === 0;
  }

  async function start() {
    if (started) return false;
    started = true;
    const allowed = await ensureConsent();
    if (!allowed) return true;
    core.record('app_started', { dimensions: { platform: process.platform, architecture: process.arch } });
    core.record('heartbeat', { measurements: { uptime_seconds: 0 } });
    void core.flush();
    heartbeatTimer = setInterval(() => {
      core.record('heartbeat', { measurements: { uptime_seconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)) } });
    }, HEARTBEAT_INTERVAL_MS);
    flushTimer = setInterval(() => { void core.flush(); }, FLUSH_INTERVAL_MS);
    heartbeatTimer.unref?.();
    flushTimer.unref?.();
    return true;
  }

  async function stop() {
    if (!started) return false;
    started = false;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (flushTimer) clearInterval(flushTimer);
    heartbeatTimer = null;
    flushTimer = null;
    core.record('app_closed', {
      dimensions: { result: 'normal' },
      measurements: { duration_ms: Math.max(0, Date.now() - startedAt) }
    });
    await Promise.race([
      Promise.resolve(core.flush()).catch(() => {}),
      new Promise(resolve => setTimeout(resolve, 500))
    ]);
    return true;
  }

  function recordUpdaterStatus(result = {}) {
    return core.record('updater_status', {
      dimensions: {
        result: String(result.status || 'unknown').slice(0, 64),
        channel: String(packageMetadata.pdvUpdateChannel || 'unknown').slice(0, 64),
        target_version: String(result.version || packageMetadata.version || 'unknown').slice(0, 64)
      }
    });
  }

  return {
    start,
    stop,
    status: core.status,
    record: core.record,
    recordFailure: core.recordFailure,
    recordUpdaterStatus,
    flush: core.flush
  };
}

module.exports = {
  CONSENT_VERSION,
  TELEMETRY_SCHEMA_VERSION,
  EVENT_SCHEMAS,
  createPdvTelemetryCore,
  createPdvTelemetry,
  createTelemetryCredentialStore,
  createTelemetryHttpSender,
  fingerprintError,
  normalizeStack,
  validateTelemetryEvent
};
