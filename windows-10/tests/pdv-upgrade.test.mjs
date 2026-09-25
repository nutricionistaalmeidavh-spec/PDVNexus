import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import { DatabaseSync } from "node:sqlite";

const require = createRequire(import.meta.url);
const { compareVersions, formatUpdaterErrorDetail, launchWindowsInstaller, preparePdvVersionMigration, selectArtifact } = require("../apps/nexus-desktop/pdv-lifecycle.cjs");

function seed017Database(dbPath) {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE pdv_meta (name TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE pdv_store (store_key TEXT PRIMARY KEY, snapshot_json TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE pdv_products (store_key TEXT NOT NULL, product_code TEXT NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY (store_key, product_code));
    CREATE TABLE pdv_customers (store_key TEXT NOT NULL, customer_id TEXT NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY (store_key, customer_id));
    CREATE TABLE pdv_sales (store_key TEXT NOT NULL, sale_number TEXT NOT NULL, finalized_at TEXT NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY (store_key, sale_number));
    CREATE TABLE pdv_inventory_movements (store_key TEXT NOT NULL, movement_id TEXT NOT NULL, created_at TEXT NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY (store_key, movement_id));
    CREATE TABLE pdv_settings (store_key TEXT NOT NULL, setting_name TEXT NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY (store_key, setting_name));
  `);
  db.prepare("INSERT INTO pdv_meta (name, value) VALUES (?, ?)").run("installed-pdv-version", "0.1.17");
  db.prepare("INSERT INTO pdv_store VALUES (?, ?, ?)").run("default", JSON.stringify({ cashSession: { isOpen: true } }), "2026-09-18T12:00:00.000Z");
  db.prepare("INSERT INTO pdv_products VALUES (?, ?, ?)").run("default", "789000000001", JSON.stringify({ productCode: "789000000001", name: "Produto", stock: 17 }));
  db.prepare("INSERT INTO pdv_customers VALUES (?, ?, ?)").run("default", "cli-1", JSON.stringify({ id: "cli-1", name: "Cliente Teste" }));
  db.prepare("INSERT INTO pdv_sales VALUES (?, ?, ?, ?)").run("default", "000123", "18/09/2026, 12:00:00", JSON.stringify({ number: "000123", total: 42.5 }));
  db.prepare("INSERT INTO pdv_inventory_movements VALUES (?, ?, ?, ?)").run("default", "mov-1", "2026-09-18T12:00:00.000Z", JSON.stringify({ id: "mov-1", quantity: -1 }));
  db.prepare("INSERT INTO pdv_settings VALUES (?, ?, ?)").run("default", "storeProfile", JSON.stringify({ name: "Loja Teste", phone: "16999999999" }));
  db.close();
}

function snapshot(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const result = {
    version: db.prepare("SELECT value FROM pdv_meta WHERE name = ?").get("installed-pdv-version")?.value,
    store: db.prepare("SELECT snapshot_json FROM pdv_store WHERE store_key = ?").get("default")?.snapshot_json,
    product: db.prepare("SELECT payload_json FROM pdv_products WHERE product_code = ?").get("789000000001")?.payload_json,
    customer: db.prepare("SELECT payload_json FROM pdv_customers WHERE customer_id = ?").get("cli-1")?.payload_json,
    sale: db.prepare("SELECT payload_json FROM pdv_sales WHERE sale_number = ?").get("000123")?.payload_json,
    movement: db.prepare("SELECT payload_json FROM pdv_inventory_movements WHERE movement_id = ?").get("mov-1")?.payload_json,
    setting: db.prepare("SELECT payload_json FROM pdv_settings WHERE setting_name = ?").get("storeProfile")?.payload_json
  };
  db.close();
  return result;
}

test("upgrade 0.1.17 -> 0.1.18 preserva caixa, estoque, clientes, vendas, movimentos e configurações", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdv-upgrade-"));
  const dbPath = path.join(tempDir, "pdv-nexus.sqlite");
  const backupDir = path.join(tempDir, "backups");
  seed017Database(dbPath);
  const before = snapshot(dbPath);

  const result = preparePdvVersionMigration({ DatabaseSync, dbPath, backupDir, currentVersion: "0.1.18" });
  const after = snapshot(dbPath);

  assert.equal(result.status, "migrated");
  assert.equal(result.previousVersion, "0.1.17");
  assert.equal(after.version, "0.1.18");
  assert.deepEqual({ ...after, version: before.version }, before);
  assert.ok(result.backupPath && fs.existsSync(result.backupPath));
  assert.deepEqual(snapshot(result.backupPath), before);
});

test("comparação de versões só oferece versão realmente mais nova", () => {
  assert.equal(compareVersions("0.1.18", "0.1.17"), 1);
  assert.equal(compareVersions("0.1.18", "0.1.18"), 0);
  assert.equal(compareVersions("0.1.17", "0.1.18"), -1);
});

test("manifesto seleciona apenas o canal e arquitetura corretos", () => {
  const manifest = {
    version: "0.1.18",
    artifacts: {
      "windows10-x64": { file: "w10.exe", url: "https://example.test/w10.exe", sha256: "abc", arch: "x64" },
      "windows8-x86": { file: "w8.exe", url: "https://example.test/w8.exe", sha256: "def", arch: "ia32" }
    }
  };
  assert.equal(selectArtifact(manifest, "windows10-x64", "x64").file, "w10.exe");
  assert.throws(() => selectArtifact(manifest, "windows8-x86", "x64"), /Arquitetura incompatível/);
});

test("launcher do instalador trata EACCES como rejeição controlada, sem erro não tratado", async () => {
  const child = new EventEmitter();
  child.unref = () => assert.fail("não deve chamar unref quando o processo falha ao iniciar");
  const spawnImpl = () => {
    queueMicrotask(() => {
      const error = new Error("spawn installer EACCES");
      error.code = "EACCES";
      child.emit("error", error);
    });
    return child;
  };

  await assert.rejects(
    launchWindowsInstaller("C:\\Temp\\PDV-Nexus-Setup.exe", { spawnImpl }),
    (error) => error?.code === "EACCES"
  );
});

test("launcher usa ShellExecute via PowerShell com UAC e só conclui após o comando iniciar", async () => {
  const child = new EventEmitter();
  child.unref = () => {};
  let invocation = null;
  const spawnImpl = (command, args, options) => {
    invocation = { command, args, options };
    queueMicrotask(() => child.emit("exit", 0, null));
    return child;
  };

  await launchWindowsInstaller("C:\\Temp\\PDV Nexus 'Teste'.exe", { spawnImpl });

  assert.equal(invocation.command.toLowerCase(), "powershell.exe");
  assert.ok(invocation.args.includes("-Command"));
  const commandText = invocation.args[invocation.args.indexOf("-Command") + 1];
  assert.match(commandText, /Start-Process/);
  assert.match(commandText, /-Verb RunAs/);
  assert.match(commandText, /PDV Nexus ''Teste''\.exe/);
});

test("erro de execução bloqueada vira mensagem amigável e mantém o PDV aberto", () => {
  const error = new Error("spawn installer EACCES");
  error.code = "EACCES";

  const detail = formatUpdaterErrorDetail(error);

  assert.match(detail, /Windows impediu/i);
  assert.match(detail, /PDV continuará aberto/i);
  assert.doesNotMatch(detail, /spawn installer EACCES/i);
});
