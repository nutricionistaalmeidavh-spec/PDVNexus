import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const require = createRequire(import.meta.url);
const {preparePdvVersionMigration} = require("../apps/nexus-desktop/pdv-lifecycle.cjs");

function digest(file){
 const db = new DatabaseSync(file, {readOnly:true});
 try{
  const tables=["pdv_store","pdv_products","pdv_customers","pdv_sales","pdv_inventory_movements","pdv_settings"];
  const contents={};
  for(const table of tables) contents[table]=db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all();
  return crypto.createHash("sha256").update(JSON.stringify(contents)).digest("hex");
 } finally { db.close(); }
}

test("atualização real da base SQLite 2.0.2 para 2.0.4 preserva integralmente registros e backup",t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"pdv-nexus-202-upgrade-"));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const dbPath=path.join(dir,"pdv-nexus.sqlite"),backupDir=path.join(dir,"pdv-upgrade-backups");
 const db=new DatabaseSync(dbPath);
 db.exec(`
   CREATE TABLE pdv_meta(name TEXT PRIMARY KEY,value TEXT NOT NULL);
   CREATE TABLE pdv_store(store_key TEXT PRIMARY KEY,snapshot_json TEXT NOT NULL,updated_at TEXT NOT NULL);
   CREATE TABLE pdv_products(store_key TEXT,product_code TEXT,payload_json TEXT,PRIMARY KEY(store_key,product_code));
   CREATE TABLE pdv_customers(store_key TEXT,customer_id TEXT,payload_json TEXT,PRIMARY KEY(store_key,customer_id));
   CREATE TABLE pdv_sales(store_key TEXT,sale_number TEXT,finalized_at TEXT,payload_json TEXT,PRIMARY KEY(store_key,sale_number));
   CREATE TABLE pdv_inventory_movements(store_key TEXT,movement_id TEXT,created_at TEXT,payload_json TEXT,PRIMARY KEY(store_key,movement_id));
   CREATE TABLE pdv_settings(store_key TEXT,setting_name TEXT,payload_json TEXT,PRIMARY KEY(store_key,setting_name));
 `);
 const store={catalogProducts:[],registeredCustomers:[],completedSales:[],extensions:{commercialLedger:{suppliers:[],purchases:[],settlements:[],expenses:[]}}};
 for(let i=0;i<251;i++){
  const product={productCode:"SKU-"+i,stock:i+9,unitPrice:12.5};
  const customer={id:"CLIENT-"+i,name:"Cliente Fictício "+i};
  const sale={number:"SALE-"+i,finalizedAt:"2026-10-21",netTotal:12.5,items:[{productCode:product.productCode,quantity:1,totalPrice:12.5}]};
  store.catalogProducts.push(product);store.registeredCustomers.push(customer);store.completedSales.push(sale);
  db.prepare("INSERT INTO pdv_products VALUES(?,?,?)").run("default",product.productCode,JSON.stringify(product));
  db.prepare("INSERT INTO pdv_customers VALUES(?,?,?)").run("default",customer.id,JSON.stringify(customer));
  db.prepare("INSERT INTO pdv_sales VALUES(?,?,?,?)").run("default",sale.number,sale.finalizedAt,JSON.stringify(sale));
  db.prepare("INSERT INTO pdv_inventory_movements VALUES(?,?,?,?)").run("default","MOV-"+i,"2026-10-21",JSON.stringify({productCode:product.productCode,stockAfter:i+9}));
 }
 store.extensions.commercialLedger.suppliers.push({id:"SUP-1",name:"Fornecedor Fictício"});
 store.extensions.commercialLedger.purchases.push({id:"BUY-1",supplierId:"SUP-1",total:200});
 db.prepare("INSERT INTO pdv_store VALUES(?,?,?)").run("default",JSON.stringify(store),"2026-10-21T12:00:00Z");
 db.prepare("INSERT INTO pdv_settings VALUES(?,?,?)").run("default","storeProfile",JSON.stringify({name:"Loja Fictícia"}));
 db.prepare("INSERT INTO pdv_meta VALUES(?,?)").run("installed-pdv-version","2.0.2");
 db.close();
 const before=digest(dbPath);
 const changed=preparePdvVersionMigration({DatabaseSync,dbPath,backupDir,currentVersion:"2.0.4"});
 assert.equal(changed.status,"migrated");
 assert.equal(changed.previousVersion,"2.0.2");
 assert.equal(digest(dbPath),before);
 assert.ok(changed.backupPath && fs.existsSync(changed.backupPath));
 assert.equal(digest(changed.backupPath),before);
 const migrated=new DatabaseSync(dbPath,{readOnly:true});
 try{
  const meta=migrated.prepare("SELECT value FROM pdv_meta WHERE name='installed-pdv-version'").get();
  assert.equal(meta.value,"2.0.4");
  const snapshot=JSON.parse(migrated.prepare("SELECT snapshot_json FROM pdv_store WHERE store_key='default'").get().snapshot_json);
  assert.equal(snapshot.completedSales.length,251);
  assert.equal(snapshot.registeredCustomers.length,251);
  assert.equal(snapshot.catalogProducts.length,251);
  assert.equal(snapshot.extensions.commercialLedger.purchases.length,1);
  assert.equal(snapshot.extensions.commercialLedger.suppliers.length,1);
 } finally {migrated.close();}
 assert.equal(preparePdvVersionMigration({DatabaseSync,dbPath,backupDir,currentVersion:"2.0.4"}).status,"already-current");
 assert.equal(digest(dbPath),before);
});
