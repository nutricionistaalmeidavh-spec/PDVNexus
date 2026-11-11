import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);
const { migrateLegacyPdvData } = require('../apps/nexus-desktop/pdv-legacy-migration.cjs');

function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-migration-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const old = path.join(root, 'PDV Nexus');
  const modern = path.join(root, 'PDV Nexus Nova Edição');
  fs.mkdirSync(old);
  return { old, modern, app: { isPackaged: true, getPath(key) { return key === 'appData' ? root : modern; } } };
}

function seedSqlite(file) {
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE pdv_store(store_key TEXT PRIMARY KEY, snapshot_json TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE pdv_sales(store_key TEXT, sale_number TEXT, finalized_at TEXT, payload_json TEXT);
    CREATE TABLE pdv_products(store_key TEXT, product_code TEXT, payload_json TEXT);
    CREATE TABLE pdv_customers(store_key TEXT, customer_id TEXT, payload_json TEXT);`);
  db.prepare('INSERT INTO pdv_store VALUES(?, ?, ?)').run('default', JSON.stringify({completedSales: [1,2], catalogProducts: [1], registeredCustomers: [1]}), new Date().toISOString());
  db.prepare('INSERT INTO pdv_sales VALUES(?,?,?,?)').run('default', '1', '2026-11-01', '{"number":1}');
  db.prepare('INSERT INTO pdv_products VALUES(?,?,?)').run('default','001','{"stock":10}');
  db.prepare('INSERT INTO pdv_customers VALUES(?,?,?)').run('default','c1','{"name":"Fictício"}');
  db.close();
}

test('migra SQLite 2.0.2 por snapshot íntegro, preservando origem e backup', t => {
  const {old,modern,app} = setup(t);
  const source = path.join(old,'pdv-nexus.sqlite'); seedSqlite(source);
  const result = migrateLegacyPdvData({app, DatabaseSync});
  assert.equal(result.status,'imported');
  assert.ok(fs.existsSync(source));
  assert.ok(fs.existsSync(result.backup));
  const migrated = new DatabaseSync(path.join(modern,'pdv-nexus.sqlite'),{readOnly:true});
  assert.equal(migrated.prepare('SELECT COUNT(*) n FROM pdv_sales').get().n,1);
  assert.equal(migrated.prepare('SELECT COUNT(*) n FROM pdv_customers').get().n,1);
  migrated.close();
  assert.equal(migrateLegacyPdvData({app,DatabaseSync}).status,'already-initialized');
});

test('não sobrescreve dados 2.0.3 quando existe banco na Nova Edição', t => {
  const {old,modern,app}=setup(t);fs.mkdirSync(modern);
  seedSqlite(path.join(old,'pdv-nexus.sqlite'));
  const target = path.join(modern,'pdv-nexus.sqlite');
  fs.writeFileSync(target,'dados atuais');
  assert.equal(migrateLegacyPdvData({app,DatabaseSync}).status,'parallel-installations');
  assert.equal(fs.readFileSync(target,'utf8'),'dados atuais');
});

test('migra arquivo JSON do Windows 7/8 e mantém os dados de origem',t=>{
  const {old,modern,app}=setup(t);
  const source=path.join(old,'pdv-nexus-data.json');
  const state={pdvSnapshots:{default:{snapshotJson:JSON.stringify({completedSales:[1,2,3],catalogProducts:[4]})}}};
  fs.writeFileSync(source,JSON.stringify(state));
  const result=migrateLegacyPdvData({app});
  assert.equal(result.status,'imported');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(modern,'pdv-nexus-data.json'),'utf8')),state);
  assert.ok(fs.existsSync(result.backup));
  assert.ok(fs.existsSync(source));
});

test('usa backup JSON válido quando arquivo primário está danificado',t=>{
  const {old,modern,app}=setup(t);
  fs.writeFileSync(path.join(old,'pdv-nexus-data.json'),'{broken');
  fs.writeFileSync(path.join(old,'pdv-nexus-data.json.bak'),JSON.stringify({pdvSnapshots:{default:{snapshotJson:'{}'}}}));
  assert.equal(migrateLegacyPdvData({app}).status,'imported');
  assert.ok(fs.existsSync(path.join(modern,'pdv-nexus-data.json')));
});

test('não abre como loja vazia quando única base legada é ilegível',t=>{
  const {old,modern,app}=setup(t);
  fs.writeFileSync(path.join(old,'pdv-nexus-data.json'),'{broken');
  assert.throws(()=>migrateLegacyPdvData({app}),/JSON|Unexpected|position|parse/i);
  assert.equal(fs.existsSync(path.join(modern,'pdv-nexus-data.json')),false);
});

test('evita migração silenciosa entre arquiteturas incompatíveis',t=>{
  const {old,app}=setup(t);
  fs.writeFileSync(path.join(old,'pdv-nexus-data.json'),'{}');
  assert.throws(()=>migrateLegacyPdvData({app,DatabaseSync}),/SQLite compatível/);
});

test('recusa migrar SQLite danificado e não cria uma loja vazia', t => {
  const {old,modern,app}=setup(t);
  fs.writeFileSync(path.join(old,'pdv-nexus.sqlite'),'dados de teste danificados');
  assert.throws(()=>migrateLegacyPdvData({app,DatabaseSync}));
  assert.equal(fs.existsSync(path.join(modern,'pdv-nexus.sqlite')),false);
  assert.ok(fs.existsSync(path.join(old,'pdv-nexus.sqlite')));
});
