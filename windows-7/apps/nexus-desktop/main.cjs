const { app, BrowserWindow, ipcMain, safeStorage, session } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { SerialPort } = require("serialport");
// Electron 22 (the last version compatible with Windows 7) uses Node 16,
// which does not provide node:sqlite. Keep the same local, synchronous
// persistence contract using a JSON file, with no native module to compile.
const DatabaseSync = true;

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

const DESKTOP_STORE_FILE = "pdv-nexus-data.json";
let desktopStoreRef = null;

function getDesktopStorePath() {
  return path.join(app.getPath("userData"), DESKTOP_STORE_FILE);
}

function getDesktopStore() {
  if (desktopStoreRef) return desktopStoreRef;
  try {
    desktopStoreRef = JSON.parse(fs.readFileSync(getDesktopStorePath(), "utf8"));
  } catch {
    desktopStoreRef = {};
  }
  desktopStoreRef.pdvSnapshots ??= {};
  desktopStoreRef.appSnapshots ??= {};
  return desktopStoreRef;
}

function saveDesktopStore() {
  const filePath = getDesktopStorePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(getDesktopStore()), "utf8");
}

function loadAppStoreSnapshot(storeKey) {
  return getDesktopStore().appSnapshots[String(storeKey ?? "default")] ?? null;
}

function saveAppStoreSnapshot(storeKey, snapshotJson) {
  const updatedAt = new Date().toISOString();
  getDesktopStore().appSnapshots[String(storeKey ?? "default")] = { snapshotJson: String(snapshotJson ?? "{}"), updatedAt };
  saveDesktopStore();
  return { updatedAt };
}

function loadPdvStoreSnapshot(storeKey) {
  return getDesktopStore().pdvSnapshots[String(storeKey ?? "default")] ?? null;
}

function savePdvStoreSnapshot(storeKey, snapshotJson) {
  let state;
  try {
    state = JSON.parse(String(snapshotJson ?? "{}"));
  } catch {
    throw new Error("Snapshot do PDV inválido; os dados não foram gravados.");
  }
  const updatedAt = new Date().toISOString();
  getDesktopStore().pdvSnapshots[String(storeKey ?? "default")] = { snapshotJson: JSON.stringify(state), updatedAt };
  saveDesktopStore();
  return { updatedAt };
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
  const printWindow = new BrowserWindow({
    width: width <= 32 ? 320 : 420,
    height: 640,
    show: false,
    webPreferences: { sandbox: true }
  });
  const safeReceipt = receipt.replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<pre style="font-family: Consolas, monospace; font-size: 12px; white-space: pre-wrap;">${safeReceipt}</pre>`)}`);
  const result = await new Promise((resolve) => {
    printWindow.webContents.print({ silent: false, printBackground: false }, (success, failureReason) => {
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
