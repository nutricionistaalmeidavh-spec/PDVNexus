const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

const PDV_STORE_KEY = "nexus-core:pdv-store:v1";
const PDV_DB_FILE = "pdv-nexus.sqlite";

const requestedUserDataDir = String(process.env.NEXUS_USER_DATA_DIR || "").trim();
if (!requestedUserDataDir) {
  throw new Error("NEXUS_USER_DATA_DIR is required for the isolated ArtiSys QA Electron entrypoint.");
}

const isolatedUserDataDir = path.resolve(process.cwd(), requestedUserDataDir);
fs.mkdirSync(isolatedUserDataDir, { recursive: true });
app.setPath("userData", isolatedUserDataDir);

function seedPdvStoreForQa() {
  const seedFile = String(process.env.NEXUS_QA_PDV_SEED_FILE || "").trim();
  if (!seedFile) return;

  let DatabaseSync;
  try {
    ({ DatabaseSync } = require("node:sqlite"));
  } catch {
    throw new Error("node:sqlite is required to seed the isolated PDV QA database.");
  }

  const seedPath = path.resolve(process.cwd(), seedFile);
  const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  const dbPath = path.join(app.getPath("userData"), PDV_DB_FILE);
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
  `);

  const updatedAt = new Date().toISOString();
  db.prepare("INSERT OR REPLACE INTO pdv_meta (name, value) VALUES (?, ?)").run("installed-pdv-version", app.getVersion());
  db.prepare("DELETE FROM pdv_meta WHERE name = ?").run(`direct-schema:${PDV_STORE_KEY}`);
  db.prepare(`
    INSERT INTO pdv_store (store_key, snapshot_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(store_key) DO UPDATE SET
      snapshot_json = excluded.snapshot_json,
      updated_at = excluded.updated_at
  `).run(PDV_STORE_KEY, JSON.stringify(seed), updatedAt);
  db.close();
}

seedPdvStoreForQa();
require("./main.cjs");
