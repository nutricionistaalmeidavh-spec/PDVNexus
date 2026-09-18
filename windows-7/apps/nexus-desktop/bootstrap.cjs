const path = require("node:path");
const { app, dialog } = require("electron");
const pkg = require("./package.json");
const { preparePdvVersionMigration, startPdvAutoUpdater } = require("./pdv-lifecycle.cjs");

let DatabaseSync = null;
try {
  ({ DatabaseSync } = require("node:sqlite"));
} catch {
  DatabaseSync = null;
}

const isPdv = process.env.NEXUS_APP === "pdv-demo" || Boolean(pkg.pdvUpdateChannel);
let migrationError = null;

if (isPdv) {
  try {
    preparePdvVersionMigration({
      DatabaseSync,
      dbPath: path.join(app.getPath("userData"), "pdv-nexus.sqlite"),
      backupDir: path.join(app.getPath("userData"), "pdv-upgrade-backups"),
      currentVersion: pkg.version
    });
  } catch (error) {
    migrationError = error;
  }
}

if (migrationError) {
  app.whenReady().then(async () => {
    await dialog.showMessageBox({
      type: "error",
      title: "Atualização interrompida",
      message: "O PDV Nexus não foi aberto porque a proteção de dados da atualização falhou.",
      detail: migrationError?.message || String(migrationError),
      buttons: ["Fechar"]
    });
    app.quit();
  });
} else {
  require("./main.cjs");

  if (isPdv && pkg.pdvUpdateChannel && pkg.pdvUpdateManifestUrl) {
    app.whenReady().then(() => {
      setTimeout(() => {
        void startPdvAutoUpdater({
          app,
          dialog,
          channel: pkg.pdvUpdateChannel,
          manifestUrl: pkg.pdvUpdateManifestUrl
        });
      }, 8000);
    });
  }
}
