CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,email TEXT NOT NULL,code_hash TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'active',
  max_devices INTEGER NOT NULL DEFAULT 1,expires_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email);
CREATE TABLE IF NOT EXISTS license_activations (
  id TEXT PRIMARY KEY,license_id TEXT NOT NULL,installation_id TEXT NOT NULL,app_version TEXT NOT NULL,
  channel TEXT NOT NULL,activated_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,UNIQUE(license_id,installation_id)
);
CREATE INDEX IF NOT EXISTS idx_license_activations_license ON license_activations(license_id);
