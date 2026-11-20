import http from "node:http";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { appendEvents, authenticate, pullEvents, adminOverview, migrate, VersionConflict } from "./storage.mjs";
import { tokenEquals } from "./protocol.mjs";
function json(res,status,payload){
 res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});
 res.end(JSON.stringify(payload));
}
const bearer=req=>{const val=String(req.headers.authorization||"");return val.startsWith("Bearer ")?val.slice(7).trim():"";};
async function readBody(req){
 let size=0;const chunks=[];
 for await(const chunk of req){size+=chunk.length;if(size>1024*1024){const e=new Error("Corpo excede 1 MB.");e.status=413;throw e;}chunks.push(chunk);}
 try{return JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{const e=new Error("JSON inválido.");e.status=400;throw e;}
}
export function createSyncServer({pool,adminToken=""}){
 return http.createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin==="null"||/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin??"")){
   res.setHeader("access-control-allow-origin",origin);res.setHeader("vary","Origin");
   res.setHeader("access-control-allow-methods","GET, POST, OPTIONS");
   res.setHeader("access-control-allow-headers","Authorization, Content-Type");
  }
  if(req.method==="OPTIONS"){res.writeHead(204);res.end();return;}
  try{
   const url=new URL(req.url||"/","http://127.0.0.1");
   if(req.method==="GET"&&url.pathname==="/health"){json(res,200,{ok:true,service:"pdv-sync"});return;}
   const token=bearer(req);
   if(req.method==="GET"&&url.pathname==="/v1/admin/overview"){
    if(!adminToken||adminToken.length<32||!tokenEquals(token,adminToken)){json(res,403,{error:"Administrador não autorizado."});return;}
    json(res,200,{branches:await adminOverview(pool)});return;
   }
   const claim=await authenticate(pool,token);
   if(!claim){json(res,401,{error:"Credencial inválida ou filial/terminal inativo."});return;}
   if(req.method==="GET"&&url.pathname==="/v1/meta"){json(res,200,{companyId:claim.company_id,branchId:claim.branch_id,terminalId:claim.terminal_id});return;}
   if(req.method==="GET"&&url.pathname==="/v1/sync/pull"){json(res,200,await pullEvents(pool,claim,url.searchParams.get("after")??"0",Number(url.searchParams.get("limit")??100)));return;}
   if(req.method==="POST"&&url.pathname==="/v1/sync/push"){
    const data=await readBody(req);json(res,200,await appendEvents(pool,claim,data?.events));return;
   }
   json(res,404,{error:"Rota não encontrada."});
  }catch(error){
   const status=error instanceof VersionConflict?409:error.status??(/inválido|identificador|filial|terminal|lote|payload|evento|Cursor|Limite|excede|autorizado/i.test(error.message)?400:500);
   if(status>=500)console.error("Erro do PDV sync:",error);
   json(res,status,{error:status>=500?"Erro interno de sincronização.":error.message});
  }
 });
}
async function start(){
 if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL obrigatório. Serviço PostgreSQL é opcional.");
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:8000});
 await migrate(pool);
 const server=createSyncServer({pool,adminToken:process.env.PDV_ADMIN_TOKEN||""});
 const host=process.env.PDV_SYNC_HOST||"127.0.0.1",port=Number(process.env.PDV_SYNC_PORT||4317);
 await new Promise((resolve,reject)=>server.listen(port,host,resolve).once("error",reject));
 console.log("PDV Nexus Central: http://"+host+":"+port);
 for(const signal of ["SIGTERM","SIGINT"])process.on(signal,()=>server.close(()=>pool.end().then(()=>process.exit(0))));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)start().catch(e=>{console.error(e);process.exitCode=1;});
