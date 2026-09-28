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

CREATE INDEX IF NOT EXISTS idx_installations_last_seen
  ON installations(last_seen_at);

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
