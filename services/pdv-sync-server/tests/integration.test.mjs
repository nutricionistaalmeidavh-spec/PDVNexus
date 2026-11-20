import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { migrate, provisionTerminal, appendEvents, pullEvents, VersionConflict } from "../src/storage.mjs";
import { createSyncServer } from "../src/server.mjs";
test("PostgreSQL: isolamento por filial, token por terminal e idempotência transacional", async(t)=>{
 if(!process.env.DATABASE_URL){t.skip("Requer DATABASE_URL de banco PostgreSQL de teste");return;}
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
 const server=createSyncServer({pool,adminToken:"x".repeat(40)});
 try{
  await migrate(pool);
  const rand=Math.random().toString(36).slice(2);
  const companyId="company-"+rand, branchA="store-a-"+rand, branchB="store-b-"+rand;
  const a=await provisionTerminal(pool,{companyId,companyName:"Testes",branchId:branchA,branchName:"A",terminalId:"CAIXA-A"});
  const b=await provisionTerminal(pool,{companyId,companyName:"Testes",branchId:branchB,branchName:"B",terminalId:"CAIXA-B"});
  const claim={company_id:companyId,branch_id:branchA,terminal_id:"CAIXA-A"};
  const sale={eventId:"sale:CAIXA-A:1",branchId:branchA,terminalId:"CAIXA-A",kind:"sale.completed",entityId:"1",payload:{number:"1",netTotal:50}};
  const initial=await appendEvents(pool,claim,[sale]);
  assert.deepEqual(initial.ackedIds,[sale.eventId]);
  const replay=await appendEvents(pool,claim,[sale]);
  assert.equal(replay.duplicates,1);
  await assert.rejects(()=>appendEvents(pool,claim,[{...sale,payload:{number:"1",netTotal:999}}]),VersionConflict);
  const pulled=await pullEvents(pool,claim,"0",100);
  assert.equal(pulled.events.length,1);
  assert.equal(pulled.events[0].payload.netTotal,50);
  assert.equal((await pullEvents(pool,{...claim,branch_id:branchB},"0",100)).events.length,0);
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const root="http://127.0.0.1:"+server.address().port;
  const get=(path,token)=>fetch(root+path,{headers:{Authorization:"Bearer "+token}});
  const unauth=await fetch(root+"/v1/meta");
  assert.equal(unauth.status,401);
  const meta=await get("/v1/meta",a.token);
  assert.equal((await meta.json()).branchId,branchA);
  const cross=await get("/v1/sync/pull?after=0",b.token);
  assert.equal((await cross.json()).events.length,0);
  const post=await fetch(root+"/v1/sync/push",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+b.token},body:JSON.stringify({events:[sale]})});
  assert.equal(post.status,400);
  const summary=await get("/v1/admin/overview","x".repeat(40));
  assert.equal(summary.status,200);
  assert.ok((await summary.json()).branches.some(row=>row.branchId===branchA&&row.events===1));
 }finally{
  if(server.listening)await new Promise(resolve=>server.close(resolve));
  await pool.end();
 }
});
