// Privacy-minimized geographic observations: no IP, coordinates, session or installation IDs in this table.
const UNKNOWN = 'Desconhecida';
const MAX_DAYS = 30;

function geographicArea(request) {
  const cf = request?.cf;
  if (!cf || typeof cf !== 'object') return null;
  const country = typeof cf.country === 'string' ? cf.country.trim().toUpperCase() : '';
  if (!/^[A-Z]{2}$/.test(country)) return null;
  const candidateRegion = typeof cf.regionCode === 'string' ? cf.regionCode.trim().toUpperCase() : '';
  const region_code = /^[A-Z0-9-]{1,8}$/.test(candidateRegion) ? candidateRegion : '??';
  const rawCity = typeof cf.city === 'string' ? cf.city.normalize('NFKC').trim().replace(/\s+/gu, ' ') : '';
  const city = rawCity.length >= 2 && rawCity.length <= 80 && /^[\p{L}\p{N}\s.'’(),-]+$/u.test(rawCity)
    ? rawCity : UNKNOWN;
  return { country, region_code, city };
}

async function ensureGeographySchema(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS telemetry_geo_daily (
    day TEXT NOT NULL,
    country TEXT NOT NULL,
    region_code TEXT NOT NULL,
    city TEXT NOT NULL,
    app_version TEXT NOT NULL,
    observations INTEGER NOT NULL DEFAULT 0,
    last_seen_at TEXT NOT NULL,
    PRIMARY KEY(day, country, region_code, city, app_version)
  )`).run();
}

async function recordGeographicObservation(db, geo, appVersion, nowIso) {
  if (!geo) return;
  const version = typeof appVersion === 'string' && /^[0-9A-Za-z.+_-]{1,32}$/.test(appVersion) ? appVersion : 'unknown';
  const today = nowIso.slice(0, 10);
  await ensureGeographySchema(db);
  await db.prepare(`INSERT INTO telemetry_geo_daily
    (day, country, region_code, city, app_version, observations, last_seen_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(day, country, region_code, city, app_version) DO UPDATE SET
      observations = observations + 1,
      last_seen_at = excluded.last_seen_at`)
    .bind(today, geo.country, geo.region_code, geo.city, version, nowIso).run();
  // Lazy 30-day retention: old rows are removed during the next ingested batch.
  const cutoff = new Date(Date.parse(nowIso) - MAX_DAYS * 86400000).toISOString().slice(0, 10);
  await db.prepare('DELETE FROM telemetry_geo_daily WHERE day < ?').bind(cutoff).run();
}

async function geographicSummary(db, nowIso, requestedDays = 7) {
  const numericDays = Number(requestedDays);
  const days = Number.isFinite(numericDays) ? Math.max(1, Math.min(MAX_DAYS, Math.trunc(numericDays))) : 7;
  const fromDay = new Date(Date.parse(nowIso) - (days - 1) * 86400000).toISOString().slice(0, 10);
  await ensureGeographySchema(db);
  const [totals, states, cities, versions] = await Promise.all([
    db.prepare(`SELECT COALESCE(SUM(observations), 0) AS observations, MAX(last_seen_at) AS last_seen_at
      FROM telemetry_geo_daily WHERE day >= ?`).bind(fromDay).first(),
    db.prepare(`SELECT country, region_code, SUM(observations) AS observations, MAX(last_seen_at) AS last_seen_at
      FROM telemetry_geo_daily WHERE day >= ? GROUP BY country, region_code
      ORDER BY observations DESC LIMIT 100`).bind(fromDay).all(),
    db.prepare(`SELECT country, region_code, city, SUM(observations) AS observations, MAX(last_seen_at) AS last_seen_at
      FROM telemetry_geo_daily WHERE day >= ? GROUP BY country, region_code, city
      ORDER BY observations DESC LIMIT 250`).bind(fromDay).all(),
    db.prepare(`SELECT app_version, SUM(observations) AS observations, MAX(last_seen_at) AS last_seen_at
      FROM telemetry_geo_daily WHERE day >= ? GROUP BY app_version
      ORDER BY observations DESC LIMIT 50`).bind(fromDay).all()
  ]);
  return {
    days, from_day: fromDay, through_day: nowIso.slice(0, 10),
    source: 'cloudflare_request_cf', metric: 'authenticated_telemetry_batches',
    unique_installations_available: false,
    observations: Number(totals?.observations || 0),
    last_seen_at: totals?.last_seen_at || null,
    states: states?.results || [], cities: cities?.results || [], versions: versions?.results || []
  };
}

export { geographicArea, ensureGeographySchema, recordGeographicObservation, geographicSummary };
