async function ensureSchema(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS installations (
      installation_id TEXT PRIMARY KEY,
      credential_hash TEXT NOT NULL UNIQUE,
      app_version TEXT NOT NULL,
      release_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      last_event_name TEXT,
      last_session_id TEXT
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_installations_last_seen
      ON installations(last_seen_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS telemetry_events (
      event_id TEXT PRIMARY KEY,
      installation_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      session_id TEXT NOT NULL,
      app_version TEXT NOT NULL,
      release_id TEXT NOT NULL,
      dimensions_json TEXT NOT NULL,
      measurements_json TEXT NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_telemetry_events_installation_time
      ON telemetry_events(installation_id, occurred_at DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_telemetry_events_name_time
      ON telemetry_events(event_name, occurred_at DESC)`)
  ]);
}

async function registerInstallation(db, input, credentialHash, now) {
  await ensureSchema(db);
  await db.prepare(`INSERT INTO installations (
      installation_id, credential_hash, app_version, release_id, created_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(installation_id) DO UPDATE SET
      credential_hash = excluded.credential_hash,
      app_version = excluded.app_version,
      release_id = excluded.release_id,
      last_seen_at = excluded.last_seen_at`)
    .bind(
      input.installation_id,
      credentialHash,
      input.app_version,
      input.release_id,
      now,
      now
    )
    .run();
}

async function recordEvent(db, event, receivedAt) {
  await db.prepare(`INSERT OR IGNORE INTO telemetry_events (
      event_id, installation_id, event_name, occurred_at, received_at,
      session_id, app_version, release_id, dimensions_json, measurements_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
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
    )
    .run();

  await db.prepare(`UPDATE installations SET
      app_version = ?,
      release_id = ?,
      last_seen_at = ?,
      last_event_name = ?,
      last_session_id = ?
    WHERE installation_id = ?`)
    .bind(
      event.app_version,
      event.release_id,
      receivedAt,
      event.event_name,
      event.session_id,
      event.installation_id
    )
    .run();
}

async function purgeOldEvents(db, nowIso, retentionDays = 30) {
  const cutoff = new Date(Date.parse(nowIso) - retentionDays * 86400000).toISOString();
  await db.prepare('DELETE FROM telemetry_events WHERE received_at < ?').bind(cutoff).run();
}

async function telemetrySummary(db, nowIso) {
  await ensureSchema(db);
  const onlineCutoff = new Date(Date.parse(nowIso) - 10 * 60 * 1000).toISOString();
  const dayCutoff = new Date(Date.parse(nowIso) - 24 * 60 * 60 * 1000).toISOString();
  const [installations, online, activeDay, errorsDay] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS count FROM installations').first(),
    db.prepare('SELECT COUNT(*) AS count FROM installations WHERE last_seen_at >= ?').bind(onlineCutoff).first(),
    db.prepare('SELECT COUNT(*) AS count FROM installations WHERE last_seen_at >= ?').bind(dayCutoff).first(),
    db.prepare("SELECT COUNT(*) AS count FROM telemetry_events WHERE event_name = 'operation_failed' AND received_at >= ?").bind(dayCutoff).first()
  ]);
  return {
    installations: Number(installations?.count || 0),
    online_now: Number(online?.count || 0),
    active_24h: Number(activeDay?.count || 0),
    errors_24h: Number(errorsDay?.count || 0)
  };
}

export {
  ensureSchema,
  registerInstallation,
  recordEvent,
  purgeOldEvents,
  telemetrySummary
};
