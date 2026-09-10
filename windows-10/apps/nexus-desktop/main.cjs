const { app, BrowserWindow, ipcMain, safeStorage, session } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { SerialPort } = require("serialport");
let DatabaseSync = null;

try {
  ({ DatabaseSync } = require("node:sqlite"));
} catch {
  DatabaseSync = null;
}

const WINDOW_WIDTH = 1440;
const WINDOW_HEIGHT = 960;
const SECRETS_FILE = "nexus-secrets.json";
const SECRET_ENCODING = "base64";
const SERIAL_READ_EVENT = "nexus-serial:data";
const SERIAL_ERROR_EVENT = "nexus-serial:error";
const PDV_DB_FILE = "pdv-nexus.sqlite";
const APP_DB_FILE = "software-local.sqlite";
const PDV_SYNC_DEFAULT_PORT = 4174;
const TEF_BRIDGE_DEFAULT_PORT = 9090;
const PDV_BACKUP_DIR = "pdv-backups";
const APP_BACKUP_DIR = "app-backups";
const openSerialPorts = new Map();
let mainWindowRef = null;
let pdvDbRef = null;
let appDbRef = null;
let pdvSyncServerRef = null;
let pdvSyncServerMeta = null;
let tefBridgeServerRef = null;

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

function startTefBridgeServer() {
  if (tefBridgeServerRef) return;
  const port = Number(process.env.NEXUS_TEF_BRIDGE_PORT || TEF_BRIDGE_DEFAULT_PORT);
  const server = http.createServer(async (request, response) => {
    const payload = { ok: true, status: "bridge-online", provider: "Nexus Desktop Bridge", endpoint: "/pay", timestamp: new Date().toISOString() };
    if (request.url?.split("?")[0] === "/health" || request.url?.split("?")[0] === "/pay") {
      if (request.method === "POST") {
        let body = "";
        for await (const chunk of request) body += chunk;
        try { Object.assign(payload, { status: "approved", transaction: JSON.parse(body || "{}") }); } catch { /* keep a valid demo response */ }
      }
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" });
      response.end(JSON.stringify(payload));
      return;
    }
    response.writeHead(404); response.end();
  });
  server.on("error", (error) => { if (error.code !== "EADDRINUSE") console.error("TEF bridge error", error); });
  server.listen(port, "127.0.0.1");
  tefBridgeServerRef = server;
}

const APP_META = {
  "meu-engenheiro": {
    title: "Sr. Engenheiro"
  },
  "pdv-demo": {
    title: "PDV Nexus"
  },
  "oficina-demo": {
    title: "Sistema Oficina"
  },
  "aluguel-veiculo-demo": {
    title: "Sistema Locadora"
  }
};

function getSecretsPath() {
  return path.join(app.getPath("userData"), SECRETS_FILE);
}

function getPdvDbPath() {
  return path.join(app.getPath("userData"), PDV_DB_FILE);
}

function getAppDbPath() {
  return path.join(app.getPath("userData"), APP_DB_FILE);
}

function getPdvBackupDir() {
  return path.join(app.getPath("userData"), PDV_BACKUP_DIR);
}

function getAppBackupDir(scope) {
  const safeScope = String(scope ?? "app").replace(/[^a-z0-9-]/gi, "-").replace(/^-+|-+$/g, "") || "app";
  return path.join(app.getPath("userData"), APP_BACKUP_DIR, safeScope);
}

function listAppBackupFiles(scope) {
  const backupDir = getAppBackupDir(scope);
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const filePath = path.join(backupDir, name);
      const stat = fs.statSync(filePath);
      return { name, path: filePath, createdAt: stat.mtime.toISOString(), size: stat.size };
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function writeAppBackup(options) {
  const scope = options?.scope;
  const backupDir = getAppBackupDir(scope);
  fs.mkdirSync(backupDir, { recursive: true });
  const createdAt = new Date().toISOString();
  const timestamp = createdAt.replace(/\W+/g, "-").replace(/-$/, "");
  const reason = String(options?.reason ?? "auto").replace(/[^a-z0-9-]/gi, "-") || "auto";
  const filePath = path.join(backupDir, `${timestamp}-${reason}.json`);
  fs.writeFileSync(filePath, String(options?.snapshotJson ?? "{}"), "utf8");
  const retention = Math.max(Number(options?.retention ?? 14) || 14, 1);
  for (const file of listAppBackupFiles(scope).slice(retention)) fs.unlinkSync(file.path);
  return { path: filePath, createdAt, files: listAppBackupFiles(scope) };
}

function getPdvDatabase() {
  if (!DatabaseSync) {
    throw new Error("SQLite nativo indisponivel nesta versao do Electron.");
  }

  if (pdvDbRef) {
    return pdvDbRef;
  }

  const dbPath = getPdvDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS pdv_store (
      store_key TEXT PRIMARY KEY,
      snapshot_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pdv_meta (
      name TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pdv_migration_backups (
      store_key TEXT PRIMARY KEY,
      snapshot_json TEXT NOT NULL,
      backed_up_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pdv_products (
      store_key TEXT NOT NULL,
      product_code TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (store_key, product_code)
    );
    CREATE TABLE IF NOT EXISTS pdv_customers (
      store_key TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (store_key, customer_id)
    );
    CREATE TABLE IF NOT EXISTS pdv_sales (
      store_key TEXT NOT NULL,
      sale_number TEXT NOT NULL,
      finalized_at TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (store_key, sale_number)
    );
    CREATE TABLE IF NOT EXISTS pdv_sale_items (
      store_key TEXT NOT NULL,
      sale_number TEXT NOT NULL,
      item_index INTEGER NOT NULL,
      product_code TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      total_price REAL NOT NULL,
      PRIMARY KEY (store_key, sale_number, item_index)
    );
    CREATE TABLE IF NOT EXISTS pdv_cancelled_sales (
      store_key TEXT NOT NULL,
      sale_number TEXT NOT NULL,
      finalized_at TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (store_key, sale_number)
    );
    CREATE TABLE IF NOT EXISTS pdv_inventory_movements (
      store_key TEXT NOT NULL,
      movement_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (store_key, movement_id)
    );
    CREATE TABLE IF NOT EXISTS pdv_settings (
      store_key TEXT NOT NULL,
      setting_name TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (store_key, setting_name)
    );
    CREATE INDEX IF NOT EXISTS idx_pdv_sales_finalized_at ON pdv_sales (store_key, finalized_at);
    CREATE INDEX IF NOT EXISTS idx_pdv_sale_items_product ON pdv_sale_items (store_key, product_code);
  `);
  resetPdvDataForNewInstalledVersion(db);
  pdvDbRef = db;
  return db;
}

function resetPdvDataForNewInstalledVersion(db) {
  const version = app.getVersion();
  const previousVersion = db.prepare("SELECT value FROM pdv_meta WHERE name = ?").get("installed-pdv-version")?.value;
  if (previousVersion === version) return;
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const table of ["pdv_store", "pdv_migration_backups", "pdv_products", "pdv_customers", "pdv_sales", "pdv_sale_items", "pdv_cancelled_sales", "pdv_inventory_movements", "pdv_settings"]) db.exec(`DELETE FROM ${table}`);
    db.exec("DELETE FROM pdv_meta");
    db.prepare("INSERT INTO pdv_meta (name, value) VALUES (?, ?)").run("installed-pdv-version", version);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function getAppDatabase() {
  if (!DatabaseSync) {
    throw new Error("SQLite nativo indisponivel nesta versao do Electron.");
  }

  if (appDbRef) {
    return appDbRef;
  }

  const dbPath = getAppDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_store (
      store_key TEXT PRIMARY KEY,
      snapshot_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  appDbRef = db;
  return db;
}

function loadAppStoreSnapshot(storeKey) {
  const db = getAppDatabase();
  const row = db.prepare("SELECT snapshot_json AS snapshotJson, updated_at AS updatedAt FROM app_store WHERE store_key = ?").get(String(storeKey ?? "default"));
  return row ?? null;
}

function saveAppStoreSnapshot(storeKey, snapshotJson) {
  const db = getAppDatabase();
  const updatedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO app_store (store_key, snapshot_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(store_key) DO UPDATE SET
      snapshot_json = excluded.snapshot_json,
      updated_at = excluded.updated_at
  `).run(String(storeKey ?? "default"), String(snapshotJson ?? "{}"), updatedAt);
  return { updatedAt };
}

function loadPdvStoreSnapshot(storeKey) {
  const db = getPdvDatabase();
  const key = String(storeKey ?? "default");
  migrateLegacyPdvSnapshotIfNeeded(db, key);
  const state = readPdvStateFromTables(db, key);
  if (!state) return null;
  return { snapshotJson: JSON.stringify(state), updatedAt: getPdvUpdatedAt(db, key) };
}

function savePdvStoreSnapshot(storeKey, snapshotJson) {
  const db = getPdvDatabase();
  const key = String(storeKey ?? "default");
  const updatedAt = new Date().toISOString();
  let state;
  try {
    state = JSON.parse(String(snapshotJson ?? "{}"));
  } catch {
    throw new Error("Snapshot do PDV inválido; os dados não foram gravados.");
  }
  writePdvStateToTables(db, key, state, updatedAt);
  db.prepare(`
    INSERT INTO pdv_store (store_key, snapshot_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(store_key) DO UPDATE SET snapshot_json = excluded.snapshot_json, updated_at = excluded.updated_at
  `).run(key, JSON.stringify(state), updatedAt);
  return { updatedAt };
}

function parsePdvJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function getPdvUpdatedAt(db, storeKey) {
  return db.prepare("SELECT updated_at AS updatedAt FROM pdv_store WHERE store_key = ?").get(storeKey)?.updatedAt ?? new Date().toISOString();
}

function migrateLegacyPdvSnapshotIfNeeded(db, storeKey) {
  const migrated = db.prepare("SELECT value FROM pdv_meta WHERE name = ?").get(`direct-schema:${storeKey}`);
  if (migrated) return;
  const legacy = db.prepare("SELECT snapshot_json AS snapshotJson, updated_at AS updatedAt FROM pdv_store WHERE store_key = ?").get(storeKey);
  if (legacy?.snapshotJson) {
    db.prepare("INSERT OR IGNORE INTO pdv_migration_backups (store_key, snapshot_json, backed_up_at) VALUES (?, ?, ?)").run(storeKey, legacy.snapshotJson, new Date().toISOString());
    writePdvStateToTables(db, storeKey, parsePdvJson(legacy.snapshotJson, {}), legacy.updatedAt || new Date().toISOString());
  }
  db.prepare("INSERT OR REPLACE INTO pdv_meta (name, value) VALUES (?, ?)").run(`direct-schema:${storeKey}`, "1");
}

function writePdvStateToTables(db, storeKey, state, updatedAt) {
  const products = Array.isArray(state.catalogProducts) ? state.catalogProducts : [];
  const customers = Array.isArray(state.registeredCustomers) ? state.registeredCustomers : [];
  const sales = Array.isArray(state.completedSales) ? state.completedSales : [];
  const extensions = state.extensions && typeof state.extensions === "object" ? state.extensions : {};
  const cancelledSales = Array.isArray(extensions.cancelledSales) ? extensions.cancelledSales : [];
  const inventoryMovements = Array.isArray(extensions.inventoryMovements) ? extensions.inventoryMovements : [];
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const table of ["pdv_products", "pdv_customers", "pdv_sales", "pdv_sale_items", "pdv_cancelled_sales", "pdv_inventory_movements", "pdv_settings"]) db.prepare(`DELETE FROM ${table} WHERE store_key = ?`).run(storeKey);
    const insertProduct = db.prepare("INSERT INTO pdv_products (store_key, product_code, payload_json) VALUES (?, ?, ?)");
    const insertCustomer = db.prepare("INSERT INTO pdv_customers (store_key, customer_id, payload_json) VALUES (?, ?, ?)");
    const insertSale = db.prepare("INSERT INTO pdv_sales (store_key, sale_number, finalized_at, payload_json) VALUES (?, ?, ?, ?)");
    const insertSaleItem = db.prepare("INSERT INTO pdv_sale_items (store_key, sale_number, item_index, product_code, product_name, quantity, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)");
    const insertCancelled = db.prepare("INSERT INTO pdv_cancelled_sales (store_key, sale_number, finalized_at, payload_json) VALUES (?, ?, ?, ?)");
    const insertMovement = db.prepare("INSERT INTO pdv_inventory_movements (store_key, movement_id, created_at, payload_json) VALUES (?, ?, ?, ?)");
    const insertSetting = db.prepare("INSERT INTO pdv_settings (store_key, setting_name, payload_json) VALUES (?, ?, ?)");
    for (const product of products) if (product?.productCode) insertProduct.run(storeKey, String(product.productCode), JSON.stringify(product));
    for (const customer of customers) if (customer?.id) insertCustomer.run(storeKey, String(customer.id), JSON.stringify(customer));
    for (const sale of sales) {
      if (!sale?.number) continue;
      insertSale.run(storeKey, String(sale.number), String(sale.finalizedAt ?? ""), JSON.stringify(sale));
      for (const [index, item] of (Array.isArray(sale.items) ? sale.items : []).entries()) insertSaleItem.run(storeKey, String(sale.number), index, String(item.productCode ?? ""), String(item.productName ?? ""), Number(item.quantity) || 0, Number(item.totalPrice) || 0);
    }
    for (const sale of cancelledSales) if (sale?.number) insertCancelled.run(storeKey, String(sale.number), String(sale.finalizedAt ?? ""), JSON.stringify(sale));
    for (const movement of inventoryMovements) if (movement?.id) insertMovement.run(storeKey, String(movement.id), String(movement.createdAt ?? ""), JSON.stringify(movement));
    insertSetting.run(storeKey, "cashSession", JSON.stringify(state.cashSession ?? null));
    insertSetting.run(storeKey, "paymentOptions", JSON.stringify(state.paymentOptions ?? []));
    insertSetting.run(storeKey, "deviceConfig", JSON.stringify(state.deviceConfig ?? {}));
    insertSetting.run(storeKey, "extensions", JSON.stringify({ ...extensions, cancelledSales: [], inventoryMovements: [] }));
    db.prepare("INSERT OR REPLACE INTO pdv_meta (name, value) VALUES (?, ?)").run(`direct-schema:${storeKey}`, "1");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function readPdvStateFromTables(db, storeKey) {
  const hasData = db.prepare("SELECT 1 AS found FROM pdv_products WHERE store_key = ? LIMIT 1").get(storeKey)
    || db.prepare("SELECT 1 AS found FROM pdv_settings WHERE store_key = ? LIMIT 1").get(storeKey);
  if (!hasData) return null;
  const readRows = (table, orderBy) => db.prepare(`SELECT payload_json AS payloadJson FROM ${table} WHERE store_key = ? ORDER BY ${orderBy}`).all(storeKey).map((row) => parsePdvJson(row.payloadJson, null)).filter(Boolean);
  const settings = new Map(db.prepare("SELECT setting_name AS name, payload_json AS payloadJson FROM pdv_settings WHERE store_key = ?").all(storeKey).map((row) => [row.name, parsePdvJson(row.payloadJson, null)]));
  const extensions = settings.get("extensions") && typeof settings.get("extensions") === "object" ? settings.get("extensions") : {};
  return {
    catalogProducts: readRows("pdv_products", "product_code"),
    registeredCustomers: readRows("pdv_customers", "customer_id"),
    completedSales: readRows("pdv_sales", "finalized_at, sale_number"),
    cashSession: settings.get("cashSession") ?? null,
    paymentOptions: settings.get("paymentOptions") ?? [],
    deviceConfig: settings.get("deviceConfig") ?? {},
    extensions: {
      ...extensions,
      cancelledSales: readRows("pdv_cancelled_sales", "finalized_at, sale_number"),
      inventoryMovements: readRows("pdv_inventory_movements", "created_at, movement_id")
    }
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, x-nexus-token",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function isPdvSyncAuthorized(request, token) {
  if (!token) return true;
  return request.headers["x-nexus-token"] === token || request.headers.authorization === `Bearer ${token}`;
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("error", reject);
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

async function handlePdvSyncRequest(request, response, options) {
  if (request.method === "OPTIONS") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (!isPdvSyncAuthorized(request, options.token)) {
    sendJson(response, 401, { error: "Token de sincronizacao invalido." });
    return;
  }

  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const storeKey = url.searchParams.get("storeKey") || options.storeKey || "default";

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { ok: true, storeKey, updatedAt: new Date().toISOString() });
    return;
  }

  if (request.method === "GET" && url.pathname === "/pdv-store") {
    sendJson(response, 200, loadPdvStoreSnapshot(storeKey));
    return;
  }

  if (request.method === "PUT" && url.pathname === "/pdv-store") {
    const body = await readRequestBody(request);
    const parsed = JSON.parse(body || "{}");
    const snapshotJson = typeof parsed.snapshotJson === "string" ? parsed.snapshotJson : JSON.stringify(parsed.snapshot ?? {});
    sendJson(response, 200, savePdvStoreSnapshot(storeKey, snapshotJson));
    return;
  }

  sendJson(response, 404, { error: "Rota de sincronizacao nao encontrada." });
}

function stopPdvSyncServer() {
  return new Promise((resolve) => {
    if (!pdvSyncServerRef) {
      pdvSyncServerMeta = null;
      resolve({ running: false });
      return;
    }
    const server = pdvSyncServerRef;
    pdvSyncServerRef = null;
    pdvSyncServerMeta = null;
    server.close(() => resolve({ running: false }));
  });
}

function listPdvBackupFiles() {
  const backupDir = getPdvBackupDir();
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const filePath = path.join(backupDir, name);
      const stat = fs.statSync(filePath);
      return { name, path: filePath, createdAt: stat.mtime.toISOString(), size: stat.size };
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function writePdvBackup(snapshotJson, reason, retention) {
  const backupDir = getPdvBackupDir();
  fs.mkdirSync(backupDir, { recursive: true });
  const createdAt = new Date().toISOString();
  const safeCreatedAt = createdAt.replace(/\W+/g, "-").replace(/-$/, "");
  const safeReason = String(reason ?? "auto").replace(/\W+/g, "-").replace(/-$/, "") || "auto";
  const filePath = path.join(backupDir, `pdv-${safeCreatedAt}-${safeReason}.json`);
  fs.writeFileSync(filePath, String(snapshotJson ?? "{}"), "utf8");
  const keep = Math.max(Number(retention ?? 7) || 7, 1);
  for (const file of listPdvBackupFiles().slice(keep)) {
    try {
      fs.unlinkSync(file.path);
    } catch {
      // best effort retention cleanup
    }
  }
  return { path: filePath, createdAt, files: listPdvBackupFiles() };
}

function readSecrets() {
  try {
    const filePath = getSecretsPath();
    if (!fs.existsSync(filePath)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function writeSecrets(nextValue) {
  const filePath = getSecretsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(nextValue, null, 2), "utf8");
}

function encryptSecret(value) {
  if (!value) {
    return "";
  }

  if (!safeStorage.isEncryptionAvailable()) {
    return value;
  }

  return safeStorage.encryptString(value).toString(SECRET_ENCODING);
}

function decryptSecret(value) {
  if (!value) {
    return "";
  }

  if (!safeStorage.isEncryptionAvailable()) {
    return value;
  }

  try {
    return safeStorage.decryptString(Buffer.from(value, SECRET_ENCODING));
  } catch {
    return "";
  }
}

function getRendererAppName() {
  if (process.env.NEXUS_APP === "pdv-demo") return "pdv-demo";
  if (process.env.NEXUS_APP === "oficina-demo") return "oficina-demo";
  if (process.env.NEXUS_APP === "aluguel-veiculo-demo") return "aluguel-veiculo-demo";
  // The packaged PDV installer does not inherit the build-time environment.
  // Detect the renderer included in the installed app so it cannot fall back
  // to the other product when launched by the customer.
  if (app.isPackaged && fs.existsSync(path.join(__dirname, "pdv-demo", "dist", "index.html"))) return "pdv-demo";
  if (app.isPackaged && fs.existsSync(path.join(__dirname, "oficina-demo", "dist", "index.html"))) return "oficina-demo";
  if (app.isPackaged && fs.existsSync(path.join(__dirname, "aluguel-veiculo-demo", "dist", "index.html"))) return "aluguel-veiculo-demo";
  return "meu-engenheiro";
}

function getRendererMeta() {
  return APP_META[getRendererAppName()] ?? APP_META["meu-engenheiro"];
}

function resolveRendererIndexPath() {
  const appName = getRendererAppName();
  const packagedPath = path.join(__dirname, appName, "dist", "index.html");
  const devPath = path.join(__dirname, "..", appName, "dist", "index.html");
  return fs.existsSync(packagedPath) ? packagedPath : devPath;
}

function setupDevicePermissions() {
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return ["serial", "hid", "usb"].includes(permission);
  });

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(["serial", "hid", "usb"].includes(permission));
  });

  session.defaultSession.on("select-serial-port", (_event, portList, _webContents, callback) => {
    callback(portList[0]?.portId ?? "");
  });

  session.defaultSession.on("select-hid-device", (_event, details, callback) => {
    callback(details.deviceList[0]?.deviceId ?? "");
  });
}

function emitSerialData(portPath, data) {
  mainWindowRef?.webContents.send(SERIAL_READ_EVENT, {
    path: portPath,
    data: data.toString("utf8")
  });
}

function emitSerialError(portPath, error) {
  mainWindowRef?.webContents.send(SERIAL_ERROR_EVENT, {
    path: portPath,
    message: error instanceof Error ? error.message : String(error)
  });
}

function renderLoadFailure(mainWindow, error) {
  const message = error instanceof Error ? error.message : String(error);
  const safeMessage = message.replace(/[&<>\"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char];
  });

  const html = `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>Falha ao abrir app</title>
      <style>
        body { margin: 0; font-family: Segoe UI, sans-serif; background: #0f172a; color: #e2e8f0; display: grid; place-items: center; min-height: 100vh; }
        main { max-width: 720px; padding: 32px; }
        h1 { margin-top: 0; font-size: 32px; }
        pre { padding: 16px; background: #111827; border-radius: 12px; overflow: auto; white-space: pre-wrap; }
      </style>
    </head>
    <body>
      <main>
        <h1>Falha ao abrir o aplicativo</h1>
        <p>O Electron nao conseguiu carregar a interface renderizada.</p>
        <pre>${safeMessage}</pre>
      </main>
    </body>
  </html>`;

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function createMainWindow() {
  const rendererMeta = getRendererMeta();
  const mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#0f172a",
    show: false,
    title: rendererMeta.title,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  mainWindowRef = mainWindow;
  mainWindow.removeMenu();
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.loadFile(resolveRendererIndexPath()).catch((error) => renderLoadFailure(mainWindow, error));

  return mainWindow;
}

ipcMain.handle("nexus-secret:get", (_event, key) => {
  const secrets = readSecrets();
  return typeof secrets[key] === "string" ? decryptSecret(secrets[key]) : "";
});

ipcMain.handle("nexus-secret:set", (_event, key, value) => {
  const secrets = readSecrets();
  secrets[key] = encryptSecret(String(value ?? ""));
  writeSecrets(secrets);
  return true;
});

ipcMain.handle("nexus-secret:remove", (_event, key) => {
  const secrets = readSecrets();
  delete secrets[key];
  writeSecrets(secrets);
  return true;
});

ipcMain.handle("nexus-secret:encryption-available", () => safeStorage.isEncryptionAvailable());

ipcMain.handle("nexus-pdv-store:status", () => ({
  available: Boolean(DatabaseSync),
  path: getPdvDbPath(),
  machineName: os.hostname()
}));

ipcMain.handle("nexus-pdv-store:load", (_event, storeKey) => {
  return loadPdvStoreSnapshot(storeKey);
});

ipcMain.handle("nexus-pdv-store:save", (_event, storeKey, snapshotJson) => {
  return savePdvStoreSnapshot(storeKey, snapshotJson);
});

ipcMain.handle("app-store:status", () => ({
  available: Boolean(DatabaseSync),
  path: getAppDbPath()
}));

ipcMain.handle("app-store:load", (_event, storeKey) => {
  return loadAppStoreSnapshot(storeKey);
});

ipcMain.handle("app-store:save", (_event, storeKey, snapshotJson) => {
  return saveAppStoreSnapshot(storeKey, snapshotJson);
});

ipcMain.handle("app-backup:list", (_event, scope) => ({ directory: getAppBackupDir(scope), files: listAppBackupFiles(scope) }));
ipcMain.handle("app-backup:write", (_event, options) => writeAppBackup(options));

ipcMain.handle("nexus-pdv-sync:status", () => pdvSyncServerMeta ?? { running: false });

ipcMain.handle("nexus-pdv-sync:start", async (_event, options) => {
  if (!DatabaseSync) {
    throw new Error("SQLite nativo indisponivel; servidor multi-caixa precisa do banco desktop.");
  }

  if (pdvSyncServerRef) {
    return pdvSyncServerMeta;
  }

  const port = Number(options?.port ?? PDV_SYNC_DEFAULT_PORT) || PDV_SYNC_DEFAULT_PORT;
  const token = String(options?.token ?? "");
  const storeKey = String(options?.storeKey ?? "default");
  const server = http.createServer((request, response) => {
    handlePdvSyncRequest(request, response, { token, storeKey }).catch((error) => {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => resolve(true));
  });

  pdvSyncServerRef = server;
  pdvSyncServerMeta = {
    running: true,
    host: "0.0.0.0",
    port,
    url: `http://127.0.0.1:${port}`,
    storeKey,
    tokenRequired: Boolean(token)
  };
  return pdvSyncServerMeta;
});

ipcMain.handle("nexus-pdv-sync:stop", () => stopPdvSyncServer());

ipcMain.handle("nexus-pdv-backup:list", () => ({
  directory: getPdvBackupDir(),
  files: listPdvBackupFiles()
}));

ipcMain.handle("nexus-pdv-backup:write", (_event, options) => writePdvBackup(options?.snapshotJson, options?.reason, options?.retention));

ipcMain.handle("nexus-print:receipt", async (_event, options) => {
  const receipt = String(options?.text ?? "");
  const width = Number(options?.width ?? 32);
  const requestedPaperFormat = String(options?.paperFormat ?? "");
  const paperFormat = ["58mm", "80mm", "a4-half"].includes(requestedPaperFormat)
    ? requestedPaperFormat
    : width >= 80 ? "a4-half" : width >= 42 ? "80mm" : "58mm";
  const isA4Half = paperFormat === "a4-half";
  const printWindow = new BrowserWindow({
    width: isA4Half ? 840 : width <= 32 ? 320 : 420,
    height: isA4Half ? 600 : 640,
    show: false,
    webPreferences: { sandbox: true }
  });
  const safeReceipt = receipt.replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const printHtml = isA4Half
    ? `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><style>@page { size: A4 portrait; margin: 0; } html, body { margin: 0; padding: 0; background: #fff; color: #000; } .receipt-half { width: 210mm; height: 148.5mm; box-sizing: border-box; padding: 8mm 10mm; overflow: visible; } pre { margin: 0; font-family: Consolas, "Courier New", monospace; font-size: 9pt; line-height: 1.15; white-space: pre-wrap; overflow-wrap: anywhere; }</style></head><body><section class="receipt-half"><pre>${safeReceipt}</pre></section></body></html>`
    : `<pre style="font-family: Consolas, monospace; font-size: 12px; white-space: pre-wrap;">${safeReceipt}</pre>`;
  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(printHtml)}`);
  const printOptions = isA4Half
    ? { silent: false, printBackground: false, pageSize: "A4", margins: { marginType: "none" } }
    : { silent: false, printBackground: false };
  const result = await new Promise((resolve) => {
    printWindow.webContents.print(printOptions, (success, failureReason) => {
      resolve({ success, failureReason: failureReason || "" });
    });
  });
  printWindow.close();
  return result;
});

ipcMain.handle("nexus-serial:list", async () => {
  return SerialPort.list();
});

ipcMain.handle("nexus-serial:open", async (_event, options) => {
  const portPath = String(options?.path ?? "");
  const baudRate = Number(options?.baudRate ?? 9600);

  if (!portPath) {
    throw new Error("Porta serial nao informada.");
  }

  if (openSerialPorts.has(portPath)) {
    return true;
  }

  const port = new SerialPort({ path: portPath, baudRate, autoOpen: false });

  await new Promise((resolve, reject) => {
    port.open((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(true);
    });
  });

  port.on("data", (data) => emitSerialData(portPath, data));
  port.on("error", (error) => emitSerialError(portPath, error));
  port.on("close", () => openSerialPorts.delete(portPath));
  openSerialPorts.set(portPath, port);
  return true;
});

ipcMain.handle("nexus-serial:write", async (_event, pathName, value) => {
  const port = openSerialPorts.get(pathName);

  if (!port) {
    throw new Error("Porta serial nao esta aberta.");
  }

  await new Promise((resolve, reject) => {
    port.write(String(value), (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(true);
    });
  });

  return true;
});

ipcMain.handle("nexus-serial:close", async (_event, pathName) => {
  const port = openSerialPorts.get(pathName);

  if (!port) {
    return true;
  }

  await new Promise((resolve) => {
    port.close(() => resolve(true));
  });

  openSerialPorts.delete(pathName);
  return true;
});

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) return;
  startTefBridgeServer();
  setupDevicePermissions();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("second-instance", () => {
  if (!mainWindowRef) return;
  if (mainWindowRef.isMinimized()) mainWindowRef.restore();
  mainWindowRef.focus();
});

app.on("window-all-closed", () => {
  for (const port of openSerialPorts.values()) {
    try {
      port.close();
    } catch {
      // best effort on shutdown
    }
  }
  if (pdvSyncServerRef) {
    pdvSyncServerRef.close();
    pdvSyncServerRef = null;
    pdvSyncServerMeta = null;
  }
  if (tefBridgeServerRef) {
    tefBridgeServerRef.close();
    tefBridgeServerRef = null;
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});
