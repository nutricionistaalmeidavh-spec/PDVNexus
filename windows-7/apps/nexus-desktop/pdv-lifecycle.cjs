const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

function normalizeVersion(value) {
  return String(value || "0.0.0").trim().replace(/^v/i, "").split("-")[0].split("+")[0];
}

function compareVersions(a, b) {
  const left = normalizeVersion(a).split(".").map((part) => Number(part) || 0);
  const right = normalizeVersion(b).split(".").map((part) => Number(part) || 0);
  const length = Math.max(left.length, right.length, 3);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function safeFilePart(value) {
  return String(value || "unknown").replace(/[^a-z0-9._-]+/gi, "-");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function preparePdvVersionMigration({ DatabaseSync, dbPath, backupDir, currentVersion }) {
  if (!DatabaseSync) return { status: "sqlite-unavailable" };
  if (!fs.existsSync(dbPath)) return { status: "new-installation" };

  const db = new DatabaseSync(dbPath);
  let previousVersion = null;
  let backupPath = null;

  try {
    db.exec(`CREATE TABLE IF NOT EXISTS pdv_meta (
      name TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`);
    previousVersion = db.prepare("SELECT value FROM pdv_meta WHERE name = ?").get("installed-pdv-version")?.value || null;
    if (previousVersion === currentVersion) {
      return { status: "already-current", previousVersion, currentVersion };
    }

    try { db.exec("PRAGMA wal_checkpoint(FULL)"); } catch { /* database may not use WAL */ }

    ensureDir(backupDir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupPath = path.join(
      backupDir,
      `pdv-nexus-${safeFilePart(previousVersion || "unknown")}-to-${safeFilePart(currentVersion)}-${timestamp}.sqlite`
    );
    fs.copyFileSync(dbPath, backupPath);

    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(`INSERT INTO pdv_meta (name, value) VALUES (?, ?)
        ON CONFLICT(name) DO UPDATE SET value = excluded.value`)
        .run("installed-pdv-version", currentVersion);
      db.prepare(`INSERT INTO pdv_meta (name, value) VALUES (?, ?)
        ON CONFLICT(name) DO UPDATE SET value = excluded.value`)
        .run(`upgrade-from:${currentVersion}`, previousVersion || "unknown");
      db.prepare(`INSERT INTO pdv_meta (name, value) VALUES (?, ?)
        ON CONFLICT(name) DO UPDATE SET value = excluded.value`)
        .run(`upgrade-backup:${currentVersion}`, backupPath);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    return { status: "migrated", previousVersion, currentVersion, backupPath };
  } finally {
    try { db.close(); } catch { /* ignore close failures during shutdown */ }
  }
}

function requestBuffer(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error("Muitos redirecionamentos ao buscar atualização."));
    const request = https.get(url, {
      headers: {
        "User-Agent": "PDV-Nexus-Updater",
        Accept: "application/json, application/octet-stream;q=0.9, */*;q=0.8"
      }
    }, (response) => {
      const status = response.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
        response.resume();
        const nextUrl = new URL(response.headers.location, url).toString();
        requestBuffer(nextUrl, redirectCount + 1).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`Falha HTTP ${status} ao buscar atualização.`));
        return;
      }
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks)));
    });
    request.on("error", reject);
    request.setTimeout(30000, () => request.destroy(new Error("Tempo esgotado ao buscar atualização.")));
  });
}

async function downloadToFile(url, targetPath) {
  const payload = await requestBuffer(url);
  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, payload);
  return targetPath;
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function selectArtifact(manifest, channel, runtimeArch = process.arch) {
  const artifact = manifest?.artifacts?.[channel];
  if (!artifact) throw new Error(`Canal de atualização não encontrado: ${channel}`);
  if (artifact.arch && artifact.arch !== runtimeArch) {
    throw new Error(`Arquitetura incompatível: pacote ${artifact.arch}, sistema ${runtimeArch}.`);
  }
  if (!artifact.url || !artifact.sha256 || !artifact.file) {
    throw new Error("Manifesto de atualização incompleto.");
  }
  return artifact;
}

function appendUpdaterLog(logPath, message) {
  try {
    ensureDir(path.dirname(logPath));
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`, "utf8");
  } catch {
    // updater logging must never block the PDV
  }
}

async function startPdvAutoUpdater({ app, dialog, channel, manifestUrl }) {
  if (!app?.isPackaged || !channel || !manifestUrl) return { status: "disabled" };

  const logPath = path.join(app.getPath("userData"), "pdv-updater.log");
  try {
    appendUpdaterLog(logPath, `Verificando canal ${channel} a partir da versão ${app.getVersion()}.`);
    const manifest = JSON.parse((await requestBuffer(manifestUrl)).toString("utf8"));
    if (!manifest?.version || compareVersions(manifest.version, app.getVersion()) <= 0) {
      appendUpdaterLog(logPath, "Nenhuma atualização disponível.");
      return { status: "current", version: app.getVersion() };
    }

    const artifact = selectArtifact(manifest, channel);
    const updateDir = ensureDir(path.join(app.getPath("temp"), "pdv-nexus-updates", safeFilePart(manifest.version)));
    const installerPath = path.join(updateDir, path.basename(artifact.file));
    await downloadToFile(artifact.url, installerPath);

    const actualHash = sha256File(installerPath).toLowerCase();
    const expectedHash = String(artifact.sha256).toLowerCase();
    if (actualHash !== expectedHash) {
      try { fs.unlinkSync(installerPath); } catch { /* ignore */ }
      throw new Error("O SHA-256 do instalador baixado não confere com o manifesto.");
    }

    appendUpdaterLog(logPath, `Atualização ${manifest.version} validada em ${installerPath}.`);
    const response = await dialog.showMessageBox({
      type: "info",
      title: "Atualização do PDV Nexus",
      message: `A versão ${manifest.version} está pronta para instalar.`,
      detail: "O instalador foi baixado e validado por SHA-256. Seus dados locais serão preservados e um backup será criado antes da troca de versão.",
      buttons: ["Instalar agora", "Depois"],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });

    if (response.response !== 0) {
      appendUpdaterLog(logPath, "Instalação adiada pelo usuário.");
      return { status: "deferred", version: manifest.version };
    }

    const child = spawn(installerPath, [], { detached: true, stdio: "ignore" });
    child.unref();
    appendUpdaterLog(logPath, `Instalador ${manifest.version} iniciado.`);
    app.quit();
    return { status: "installing", version: manifest.version };
  } catch (error) {
    appendUpdaterLog(logPath, `Falha: ${error?.stack || error?.message || String(error)}`);
    return { status: "error", error: error?.message || String(error) };
  }
}

module.exports = {
  compareVersions,
  preparePdvVersionMigration,
  selectArtifact,
  sha256File,
  startPdvAutoUpdater
};
