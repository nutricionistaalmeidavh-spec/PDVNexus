-- Aggregated request observations only; no IP, installation, session, email or location coordinates.
CREATE TABLE IF NOT EXISTS telemetry_geo_daily (
  day TEXT NOT NULL,
  country TEXT NOT NULL,
  region_code TEXT NOT NULL,
  city TEXT NOT NULL,
  app_version TEXT NOT NULL,
  observations INTEGER NOT NULL DEFAULT 0,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY(day, country, region_code, city, app_version)
);
