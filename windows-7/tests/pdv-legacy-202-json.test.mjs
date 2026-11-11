import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

test("Windows 7/8: os mesmos dados JSON da 2.0.2 são lidos e gravados sem esvaziamento",t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"nexus-202-json-"));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,"pdv-nexus-data.json");
 const snapshot={catalogProducts:[],registeredCustomers:[],completedSales:[],extensions:{commercialLedger:{suppliers:[{id:"SUP-1",name:"Exemplo"}],purchases:[]}}};
 for(let i=0;i<140;i++){
   snapshot.catalogProducts.push({productCode:"F-"+i,stock:i+20});
   snapshot.registeredCustomers.push({id:"C-"+i,name:"Cliente Fictício"});
   snapshot.completedSales.push({number:"V-"+i,netTotal:50});
 }
 const seed={pdvSnapshots:{default:{snapshotJson:JSON.stringify(snapshot),revision:3,updatedAt:"2026-10-18"}},appSnapshots:{settings:{snapshotJson:'{"mode":"retail"}',updatedAt:"2026-10-18"}}};
 fs.writeFileSync(file,JSON.stringify(seed));
 const source=fs.readFileSync(new URL("../apps/nexus-desktop/main.cjs",import.meta.url),"utf8");
 const start=source.indexOf('const DESKTOP_STORE_FILE = "pdv-nexus-data.json";');
 const end=source.indexOf('\nfunction loadAppStoreSnapshot(',start);
 assert.ok(start>0&&end>start,"Funções de persistência JSON devem existir");
 const code=source.slice(start,end)+ "\n({load:getDesktopStore,save:saveDesktopStore});";
 const store=vm.runInNewContext(code,{fs,path,app:{getPath:()=>dir},JSON,Date,Math,String,Object,Number,Array});
 assert.equal(store.load().pdvSnapshots.default.revision,3);
 assert.equal(JSON.parse(store.load().pdvSnapshots.default.snapshotJson).completedSales.length,140);
 store.save();
 const result=JSON.parse(fs.readFileSync(file,"utf8"));
 assert.deepEqual(result,seed);
 assert.deepEqual(JSON.parse(fs.readFileSync(file+".bak","utf8")),seed);
});
