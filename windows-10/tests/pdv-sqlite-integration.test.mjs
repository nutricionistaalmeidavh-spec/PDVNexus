import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { DatabaseSync } from "node:sqlite";

const main = fs.readFileSync(new URL("../apps/nexus-desktop/main.cjs", import.meta.url), "utf8");
const start = main.indexOf("function writePdvStateToTables(");
const end = main.indexOf("\nfunction readPdvStateFromTables(", start);
assert.ok(start >= 0 && end > start, "canonical write function must be present");
const source = main.slice(start, end);
const write = vm.runInNewContext(source + "\nwritePdvStateToTables;", { Error, JSON, Number, String, Array });

function createDb() {
 const db = new DatabaseSync(":memory:");
 db.exec(`
  CREATE TABLE pdv_store (store_key TEXT PRIMARY KEY, snapshot_json TEXT NOT NULL, updated_at TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE pdv_meta (name TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE pdv_products (store_key TEXT NOT NULL, product_code TEXT NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY(store_key, product_code));
  CREATE TABLE pdv_customers (store_key TEXT NOT NULL, customer_id TEXT NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY(store_key, customer_id));
  CREATE TABLE pdv_sales (store_key TEXT NOT NULL, sale_number TEXT NOT NULL, finalized_at TEXT NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY(store_key, sale_number));
  CREATE TABLE pdv_sale_items (store_key TEXT NOT NULL, sale_number TEXT NOT NULL, item_index INTEGER NOT NULL, product_code TEXT, product_name TEXT, quantity REAL, total_price REAL, PRIMARY KEY(store_key,sale_number,item_index));
  CREATE TABLE pdv_cancelled_sales (store_key TEXT NOT NULL, sale_number TEXT NOT NULL, finalized_at TEXT NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY(store_key,sale_number));
  CREATE TABLE pdv_inventory_movements (store_key TEXT NOT NULL, movement_id TEXT NOT NULL, created_at TEXT NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY(store_key,movement_id));
  CREATE TABLE pdv_settings (store_key TEXT NOT NULL, setting_name TEXT NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY(store_key,setting_name));
 `);
 return db;
}
function state(size = 251, stock = 100) {
 return {
  catalogProducts: [{ productCode:"00101",productName:"Café",stock,unitPrice:10 }],
  registeredCustomers: [{ id:"CLI-1",name:"Cliente" }],
  completedSales: Array.from({length:size},(_,i)=>({number:String(i+1),finalizedAt:"2026-11-06",netTotal:10,
    items:[{productCode:"00101",productName:"Café",quantity:1,totalPrice:10}]})),
  cashSession:null,paymentOptions:[],deviceConfig:{},extensions:{
   cancelledSales:[],inventoryMovements:Array.from({length:301},(_,i)=>({
     id:"MOV-"+i,productCode:"00101",createdAt:"2026-11-06",quantityDelta:1,stockBefore:i,stockAfter:i+1
   })),commercialLedger:{suppliers:[],purchases:[],settlements:[],expenses:[]}
  }
 };
}
function row(db) {
 return db.prepare("SELECT revision, snapshot_json AS snapshotJson FROM pdv_store WHERE store_key = ?").get("loja");
}
function count(db,table) {
 return db.prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE store_key = ?`).get("loja").total;
}
test("SQLite real: 251 sales, 301 movements and the snapshot persist atomically",()=>{
 const db=createDb();
 try {
  write(db,"loja",state(),new Date().toISOString(),0);
  assert.equal(row(db).revision,1);
  assert.equal(count(db,"pdv_sales"),251);
  assert.equal(count(db,"pdv_inventory_movements"),301);
  assert.equal(JSON.parse(row(db).snapshotJson).completedSales.length,251);
  assert.equal(JSON.parse(row(db).snapshotJson).extensions.commercialLedger.purchases.length,0);
 } finally { db.close(); }
});
test("SQLite real: stale cashier revision must roll back the entire write",()=>{
 const db=createDb();
 try {
  write(db,"loja",state(),new Date().toISOString(),0);
  const before=row(db).snapshotJson;
  assert.throws(()=>write(db,"loja",state(1,0),new Date().toISOString(),0),/REVISION_CONFLICT/);
  assert.equal(row(db).snapshotJson,before);
  assert.equal(row(db).revision,1);
  assert.equal(count(db,"pdv_sales"),251);
  assert.equal(count(db,"pdv_inventory_movements"),301);
  write(db,"loja",state(252,80),new Date().toISOString(),1);
  assert.equal(row(db).revision,2);
  assert.equal(count(db,"pdv_sales"),252);
 } finally { db.close(); }
});
test("SQLite real: malformed duplicated product rolls back deletes, preserving previous state",()=>{
 const db=createDb();
 try {
  write(db,"loja",state(),new Date().toISOString(),0);
  const before=row(db).snapshotJson;
  const broken=state(1,0);
  broken.catalogProducts.push({ ...broken.catalogProducts[0] });
  assert.throws(()=>write(db,"loja",broken,new Date().toISOString(),1));
  assert.equal(row(db).revision,1);
  assert.equal(row(db).snapshotJson,before);
  assert.equal(count(db,"pdv_products"),1);
  assert.equal(count(db,"pdv_sales"),251);
 } finally { db.close(); }
});


test("Benchmark canônico: 2000 vendas e 2500 movimentos sobrevivem a revisões, sem truncar histórico", () => {
 const db = createDb();
 const synthetic = state(2000, 900);
 synthetic.extensions.inventoryMovements = Array.from({ length: 2500 }, (_, index) => ({
  id: `MOV-PERF-${index}`, productCode: "00101",
  createdAt: "2026-11-07", quantityDelta: 1, stockBefore: index, stockAfter: index + 1
 }));
 const writeDurationsMs = [];
 const readDurationsMs = [];
 try {
  for (let revision = 0; revision < 3; revision += 1) {
   const started = performance.now();
   write(db, "loja", synthetic, new Date().toISOString(), revision);
   writeDurationsMs.push(Math.round((performance.now() - started) * 100) / 100);
   const readStart = performance.now();
   const saved = row(db);
   const parsed = JSON.parse(saved.snapshotJson);
   readDurationsMs.push(Math.round((performance.now() - readStart) * 100) / 100);
   assert.equal(saved.revision, revision + 1);
   assert.equal(parsed.completedSales.length, 2000);
   assert.equal(parsed.extensions.inventoryMovements.length, 2500);
  }
  assert.equal(count(db, "pdv_sales"), 2000);
  assert.equal(count(db, "pdv_sale_items"), 2000);
  assert.equal(count(db, "pdv_inventory_movements"), 2500);
  assert.equal(count(db, "pdv_products"), 1);
  const orderedWrites = [...writeDurationsMs].sort((a, b) => a - b);
  const orderedReads = [...readDurationsMs].sort((a, b) => a - b);
  const metrics = {
   dataset: { sales: 2000, movements: 2500, products: 1, revisions: 3 },
   writeMs: writeDurationsMs,
   writeP50Ms: orderedWrites[1],
   writeMaxMs: orderedWrites[2],
   readParseMs: readDurationsMs,
   readParseP50Ms: orderedReads[1],
   readParseMaxMs: orderedReads[2],
   environment: "SQLite node:sqlite em GitHub Actions runner"
  };
  console.log("PDV_SQLITE_VOLUME_BENCHMARK " + JSON.stringify(metrics));
  // Gate amplo e estável, apenas para detectar regressões catastróficas em runners compartilhados.
  assert.ok(metrics.writeMaxMs < 15000, "Gravação canônica excedeu 15s no runner de QA");
  assert.ok(metrics.readParseMaxMs < 5000, "Leitura da base canônica excedeu 5s no runner de QA");
 } finally {
  db.close();
 }
});


test("P0 regressao: abrir caixa nao regrava catalogo, vendas nem movimentacoes", () => {
 const db=createDb();
 try {
  const original=state(1200,300);
  original.catalogProducts=Array.from({length:1000},(_,i)=>({
    productCode:"SKU-"+i, productName:"Produto "+i, stock:100, unitPrice:10
  }));
  write(db,"loja",original,new Date().toISOString(),0);
  const changed=structuredClone(original);
  changed.cashSession={openedAt:"12/11/2026 09:00:00",initialAmount:150,withdrawals:[]};
  const before=db.prepare("SELECT total_changes() AS changes").get().changes;
  write(db,"loja",changed,new Date().toISOString(),1);
  const delta=db.prepare("SELECT total_changes() AS changes").get().changes-before;
  assert.ok(delta<20, "Abertura de caixa regravou "+delta+" linhas; esperado somente caixa/snapshot/revisao");
  assert.equal(count(db,"pdv_products"),1000);
  assert.equal(count(db,"pdv_sales"),1200);
  assert.equal(count(db,"pdv_inventory_movements"),301);
  assert.equal(JSON.parse(row(db).snapshotJson).cashSession.initialAmount,150);
 } finally {db.close();}
});
