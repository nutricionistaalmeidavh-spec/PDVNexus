const TEXT_LIMIT = 160;
const REGISTRATION_KEYS = new Set([
  'protocol_version',
  'telemetry_schema_version',
  'installation_id',
  'app_version',
  'release_id'
]);
const EVENT_KEYS = new Set([
  'schema_version',
  'event_id',
  'event_name',
  'occurred_at',
  'installation_id',
  'session_id',
  'app_version',
  'release_id',
  'dimensions',
  'measurements'
]);

const EVENT_SCHEMAS = Object.freeze({
  app_started: { dimensions: ['platform', 'architecture'], measurements: [] },
  app_closed: { dimensions: ['result'], measurements: ['duration_ms'] },
  heartbeat: { dimensions: [], measurements: ['uptime_seconds'] },
  updater_status: { dimensions: ['result', 'channel', 'target_version'], measurements: [] },
  operation_failed: { dimensions: ['module', 'subsystem', 'operation', 'error_class', 'fingerprint'], measurements: [] }
});

const FORBIDDEN = /(?:password|senha|passwd|token|authorization|credential|secret|segredo|api.?key|private.?key|certificate|certificado|\bcsc\b|\bcpf\b|\bcnpj\b|documento?|\bemail\b|telefone|\bphone\b|address|endere[cç]o|\bxml\b|danfe|\bcard\b|cart[aã]o|\bpan\b|\bcvv\b|observation|observa[cç][aã]o|notes?|message.?content)/i;
const SENSITIVE_VALUES = [
  /Bearer\s+[A-Za-z0-9._~+/=-]{12,}/i,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\b\d{11}\b/,
  /\b\d{14}\b/,
  /\b(?:\d[ -]*?){13,19}\b/
];
const TECHNICAL_IDS = new Set(['event_id', 'installation_id', 'session_id', 'release_id']);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`Campo ${label} desconhecido: ${key}.`);
  }
}

function safeInteger(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new TypeError(`${field} invalido.`);
  return number;
}

function safeText(value, field, { scan = true, max = TEXT_LIMIT } = {}) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} deve ser texto.`);
  if (value.length > max) throw new RangeError(`${field} excede o limite.`);
  if (FORBIDDEN.test(field)) throw new Error(`Campo sensivel/proibido: ${field}.`);
  if (scan && SENSITIVE_VALUES.some(pattern => pattern.test(value))) throw new Error(`Valor sensivel/proibido: ${field}.`);
  return value.trim();
}

function validateMap(input, allowed, type) {
  if (input == null) return {};
  if (!isObject(input)) throw new TypeError(`${type} invalido.`);
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.has(key)) throw new Error(`Campo ${type} desconhecido: ${key}.`);
    if (FORBIDDEN.test(key)) throw new Error(`Campo sensivel/proibido: ${key}.`);
    if (type === 'dimensions') output[key] = safeText(value, key);
    else {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0) throw new TypeError(`${key} deve ser numerico nao-negativo.`);
      output[key] = number;
    }
  }
  return output;
}

function validateRegistration(input) {
  if (!isObject(input)) throw new TypeError('Registro invalido.');
  exactKeys(input, REGISTRATION_KEYS, 'de registro');
  const output = {
    protocol_version: safeInteger(input.protocol_version, 'protocol_version'),
    telemetry_schema_version: safeInteger(input.telemetry_schema_version, 'telemetry_schema_version'),
    installation_id: safeText(input.installation_id, 'installation_id', { scan: false }),
    app_version: safeText(input.app_version, 'app_version'),
    release_id: safeText(input.release_id, 'release_id', { scan: false })
  };
  if (output.protocol_version !== 1 || output.telemetry_schema_version !== 1) throw new Error('Versao de protocolo/schema nao suportada.');
  return output;
}

function validateEvent(input) {
  if (!isObject(input)) throw new TypeError('Evento invalido.');
  exactKeys(input, EVENT_KEYS, 'de evento');
  const schema = EVENT_SCHEMAS[input.event_name];
  if (!schema) throw new Error(`Evento desconhecido: ${String(input.event_name || '')}.`);
  const output = {
    schema_version: safeInteger(input.schema_version, 'schema_version'),
    event_id: safeText(input.event_id, 'event_id', { scan: false }),
    event_name: safeText(input.event_name, 'event_name'),
    occurred_at: safeText(input.occurred_at, 'occurred_at'),
    installation_id: safeText(input.installation_id, 'installation_id', { scan: false }),
    session_id: safeText(input.session_id, 'session_id', { scan: false }),
    app_version: safeText(input.app_version, 'app_version'),
    release_id: safeText(input.release_id, 'release_id', { scan: false }),
    dimensions: validateMap(input.dimensions, new Set(schema.dimensions), 'dimensions'),
    measurements: validateMap(input.measurements, new Set(schema.measurements), 'measurements')
  };
  if (output.schema_version !== 1) throw new Error('schema_version nao suportado.');
  if (output.event_name === 'operation_failed' && !/^ERR-[0-9a-f]{16}$/i.test(output.dimensions.fingerprint || '')) throw new Error('Fingerprint invalido.');
  return output;
}

function validateBatch(input) {
  if (!isObject(input)) throw new TypeError('Batch invalido.');
  exactKeys(input, new Set(['schema_version', 'events']), 'de batch');
  if (safeInteger(input.schema_version, 'schema_version') !== 1) throw new Error('schema_version nao suportado.');
  if (!Array.isArray(input.events)) throw new TypeError('events deve ser array.');
  if (input.events.length < 1 || input.events.length > 50) throw new RangeError('Batch deve conter de 1 a 50 eventos.');
  return { schema_version: 1, events: input.events.map(validateEvent) };
}

export { EVENT_SCHEMAS, validateRegistration, validateEvent, validateBatch };
