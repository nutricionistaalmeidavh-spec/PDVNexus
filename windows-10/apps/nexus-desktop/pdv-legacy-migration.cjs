const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const LEGACY_APP_NAME = 'PDV Nexus';
const SQLITE_FILE = 'pdv-nexus.sqlite';
const JSON_FILE = 'pdv-nexus-data.json';
const TABLES = ['pdv_store', 'pdv_meta', 'pdv_products', 'pdv_customers', 'pdv_sales', 'pdv_sale_items', 'pdv_cancelled_sales', 'pdv_inventory_movements', 'pdv_settings'];

function sameDirectory(a, b) {
  const normalize = value => path.resolve(value).replace(/[\\/]+$/, '').toLocaleLowerCase();
  return normalize(a) === normalize(b);
}

function checkSqlite(db) {
  const integrity = db.prepare('PRAGMA quick_check').get();
  if (String(integrity?.quick_check || Object.values(integrity || {})[0] || '') !== 'ok') {
    throw new Error('Banco SQLite de origem ou destino não passou na verificação de integridade.');
  }
  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name));
  if (!tables.has('pdv_store')) throw new Error('Banco de origem sem tabela pdv_store; migração interrompida.');
  const counts = {};
  for (const name of TABLES) {
    if (tables.has(name)) counts[name] = Number(db.prepare('SELECT COUNT(*) AS count FROM ' + name).get().count);
  }
  const snapshots = db.prepare('SELECT store_key, snapshot_json FROM pdv_store ORDER BY store_key').all();
  const snapshotHash = crypto.createHash('sha256').update(JSON.stringify(snapshots)).digest('hex');
  for (const row of snapshots) {
    if (row.snapshot_json) JSON.parse(row.snapshot_json);
  }
  return { counts, snapshotHash };
}

function copySqliteSnapshot(source, destination, DatabaseSync) {
  const sourceDb = new DatabaseSync(source, { readOnly: true });
  let sourceState;
  try {
    sourceState = checkSqlite(sourceDb);
    sourceDb.exec("VACUUM INTO '" + destination.replace(/'/g, "''") + "'");
  } finally {
    sourceDb.close();
  }
  const destinationDb = new DatabaseSync(destination, { readOnly: true });
  try {
    const targetState = checkSqlite(destinationDb);
    if (JSON.stringify(sourceState) !== JSON.stringify(targetState)) {
      throw new Error('Os registros SQLite copiados não conferem com a origem.');
    }
  } finally {
    destinationDb.close();
  }
  return sourceState;
}

function readValidJson(filePath) {
  const raw = fs.readFileSync(filePath);
  const parsed = JSON.parse(raw.toString('utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !parsed.pdvSnapshots || typeof parsed.pdvSnapshots !== 'object') {
    throw new Error('Arquivo de dados legado sem pdvSnapshots válido.');
  }
  for (const snapshot of Object.values(parsed.pdvSnapshots)) {
    if (snapshot?.snapshotJson) JSON.parse(snapshot.snapshotJson);
  }
  return raw;
}

function migrateLegacyPdvData({ app, DatabaseSync = null } = {}) {
  if (!app?.isPackaged) return { status: 'development' };
  const destinationDir = app.getPath('userData');
  const sourceDir = path.join(app.getPath('appData'), LEGACY_APP_NAME);
  if (sameDirectory(sourceDir, destinationDir)) return { status: 'same-installation' };

  const sqliteTarget = path.join(destinationDir, SQLITE_FILE);
  const jsonTarget = path.join(destinationDir, JSON_FILE);
  // Uma instalação com dados próprios nunca deve ser sobrescrita por outra edição.
  if (fs.existsSync(sqliteTarget) || fs.existsSync(jsonTarget)) return { status: 'already-initialized' };

  const sqliteSource = path.join(sourceDir, SQLITE_FILE);
  const jsonSource = path.join(sourceDir, JSON_FILE);
  const jsonBackup = jsonSource + '.bak';
  if (![sqliteSource, jsonSource, jsonBackup].some(file => fs.existsSync(file))) return { status: 'no-legacy-data' };

  const usesSqlite = Boolean(DatabaseSync);
  const sourceFile = usesSqlite ? sqliteSource : jsonSource;
  if (usesSqlite && !fs.existsSync(sourceFile)) {
    throw new Error('Foi encontrada uma base legada, mas não um SQLite compatível com esta edição. Os dados originais não foram alterados.');
  }
  if (!usesSqlite && fs.existsSync(sqliteSource) && !fs.existsSync(jsonSource) && !fs.existsSync(jsonBackup)) {
    throw new Error('O armazenamento legado é SQLite, incompatível com o Windows 7/8. A importação foi interrompida sem alterar os dados.');
  }

  fs.mkdirSync(destinationDir, { recursive: true });
  const backupDir = path.join(destinationDir, 'pdv-upgrade-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const filename = usesSqlite ? SQLITE_FILE : JSON_FILE;
  const target = path.join(destinationDir, filename);
  const tmp = target + '.migration.tmp';
  if (fs.existsSync(tmp)) throw new Error('Migração anterior incompleta: confira o backup antes de continuar.');

  try {
    if (usesSqlite) {
      copySqliteSnapshot(sourceFile, tmp, DatabaseSync);
    } else {
      let validSource = sourceFile;
      let original;
      try {
        original = readValidJson(validSource);
      } catch (primaryError) {
        if (!fs.existsSync(jsonBackup)) throw primaryError;
        validSource = jsonBackup;
        original = readValidJson(validSource);
      }
      fs.copyFileSync(validSource, tmp, fs.constants.COPYFILE_EXCL);
      if (!crypto.timingSafeEqual(crypto.createHash('sha256').update(original).digest(), crypto.createHash('sha256').update(readValidJson(tmp)).digest())) {
        throw new Error('Cópia JSON não confere com a origem.');
      }
    }
    const backup = path.join(backupDir, 'legacy-before-import-' + Date.now() + '-' + filename);
    fs.copyFileSync(tmp, backup, fs.constants.COPYFILE_EXCL);
    fs.renameSync(tmp, target);
    return { status: 'imported', sourceDir, backup, target };
  } catch (error) {
    try { fs.unlinkSync(tmp); } catch {}
    throw error;
  }
}

module.exports = { migrateLegacyPdvData, checkSqlite };
