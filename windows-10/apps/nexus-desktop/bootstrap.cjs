const path = require("node:path");
const electron = require("electron");
const { app, dialog } = electron;
const safeStorage = electron.safeStorage || null;
const pkg = require("./package.json");
const { preparePdvVersionMigration, startPdvAutoUpdater } = require("./pdv-lifecycle.cjs");
const { createPdvTelemetry } = require("./pdv-telemetry.cjs");

let DatabaseSync = null;
try {
  ({ DatabaseSync } = require("node:sqlite"));
} catch {
  DatabaseSync = null;
}

const isPdv = process.env.NEXUS_APP === "pdv-demo" || Boolean(pkg.pdvUpdateChannel);
let migrationError = null;
let telemetry = null;

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

  if (isPdv) {
    app.whenReady().then(async () => {
      try {
        telemetry = createPdvTelemetry({
          app,
          dialog,
          safeStorage,
          packageMetadata: pkg,
          endpoint: pkg.pdvTelemetryEndpoint || process.env.PDV_TELEMETRY_ENDPOINT || ""
        });
        await telemetry.start();
      } catch {
        telemetry = null;
      }
    });

    process.on("uncaughtExceptionMonitor", (error, origin) => {
      try {
        telemetry?.recordFailure(error, {
          subsystem: "node",
          operation: String(origin || "uncaught_exception").slice(0, 80)
        });
      } catch {
        // Telemetria nunca pode alterar o tratamento normal da exceção.
      }
    });

    app.on("render-process-gone", (_event, _webContents, details) => {
      try {
        const reason = String(details?.reason || "render_process_gone").slice(0, 80);
        const error = new Error(reason);
        error.name = "RenderProcessGone";
        telemetry?.recordFailure(error, { subsystem: "renderer", operation: reason });
      } catch {
        // Observabilidade fail-open.
      }
    });

    app.on("before-quit", () => {
      try { void telemetry?.stop(); } catch {}
    });
  }

  if (isPdv && pkg.pdvUpdateChannel && pkg.pdvUpdateManifestUrl) {
    app.whenReady().then(() => {
      setTimeout(() => {
        void (async () => {
          const result = await startPdvAutoUpdater({
            app,
            dialog,
            channel: pkg.pdvUpdateChannel,
            manifestUrl: pkg.pdvUpdateManifestUrl
          });
          try { telemetry?.recordUpdaterStatus(result); } catch {}
        })();
      }, 8000);
    });
  }
}
