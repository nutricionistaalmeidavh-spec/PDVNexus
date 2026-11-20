import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { digestToken, hashEvent, validateEvents, sanitizeCursor } from "./protocol.mjs";
export async function migrate(pool){await pool.query(await readFile(new URL("../schema.sql",import.meta.url),"utf8"));}
export async function provisionTerminal(pool,{companyId,companyName,branchId,branchName,terminalId}){
 const fields=[companyId,companyName,branchId,branchName,terminalId];
 if(fields.some(v=>typeof v!=="string"||!/^[A-Za-z0-9À-ÿ _.:=-]{1,100}$/.test(v)))throw new Error("Dados da empresa, filial ou terminal inválidos.");
 const token=randomBytes(32).toString("base64url");
 const client=await pool.connect();
 try{
  await client.query("BEGIN");
  await client.query("INSERT INTO pdv_companies(id,name) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name",[companyId,companyName]);
  await client.query("INSERT INTO pdv_branches(company_id,id,name) VALUES($1,$2,$3) ON CONFLICT(company_id,id) DO UPDATE SET name=EXCLUDED.name",[companyId,branchId,branchName]);
  await client.query("INSERT INTO pdv_terminal_tokens(token_hash,company_id,branch_id,terminal_id) VALUES($1,$2,$3,$4)",[digestToken(token),companyId,branchId,terminalId]);
  await client.query("COMMIT");
  return {companyId,branchId,terminalId,token};
 }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
}
export async function authenticate(pool,token){
 if(typeof token!=="string"||token.length<32||token.length>512)return null;
 const r=await pool.query("SELECT k.company_id,k.branch_id,k.terminal_id FROM pdv_terminal_tokens k JOIN pdv_branches b ON b.company_id=k.company_id AND b.id=k.branch_id WHERE k.token_hash=$1 AND k.active=TRUE AND b.active=TRUE",[digestToken(token)]);
 return r.rows[0]??null;
}
export class VersionConflict extends Error{constructor(message){super(message);this.name="VersionConflict";}}
export async function appendEvents(pool,claim,events){
 validateEvents(events,claim.branch_id);
 if(events.some(e=>e.terminalId!==claim.terminal_id))throw new Error("Token não autorizado para este terminal.");
 const client=await pool.connect();const ackedIds=[];let inserted=0;
 try{
  await client.query("BEGIN");
  for(const event of events){
   const hash=hashEvent(event);
   const row=await client.query("INSERT INTO pdv_sync_events(company_id,branch_id,event_id,terminal_id,kind,entity_id,payload,payload_hash) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8) ON CONFLICT(company_id,branch_id,event_id) DO NOTHING RETURNING event_id",[claim.company_id,claim.branch_id,event.eventId,event.terminalId,event.kind,event.entityId,JSON.stringify(event.payload),hash]);
   if(!row.rowCount){
    const prev=await client.query("SELECT payload_hash FROM pdv_sync_events WHERE company_id=$1 AND branch_id=$2 AND event_id=$3",[claim.company_id,claim.branch_id,event.eventId]);
    if(prev.rows[0]?.payload_hash!==hash)throw new VersionConflict("EVENT_ID_CONFLICT: evento existente com conteúdo diferente.");
   }else inserted++;
   ackedIds.push(event.eventId);
  }
  await client.query("COMMIT");return {ackedIds,inserted,duplicates:ackedIds.length-inserted};
 }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
}
export async function pullEvents(pool,claim,after="0",limit=100){
 const cursor=sanitizeCursor(after);
 if(!Number.isInteger(limit)||limit<1||limit>250)throw new Error("Limite inválido.");
 const rows=await pool.query('SELECT sequence::text AS sequence,event_id AS "eventId",branch_id AS "branchId",terminal_id AS "terminalId",kind,entity_id AS "entityId",payload FROM pdv_sync_events WHERE company_id=$1 AND branch_id=$2 AND sequence>$3::bigint ORDER BY sequence LIMIT $4',[claim.company_id,claim.branch_id,cursor,limit]);
 const events=rows.rows;return {events,nextCursor:events.length?events[events.length-1].sequence:cursor,hasMore:events.length===limit};
}
export async function adminOverview(pool){
 const r=await pool.query('SELECT b.company_id AS "companyId",c.name AS "companyName",b.id AS "branchId",b.name AS "branchName",b.active,COUNT(e.sequence)::int AS events FROM pdv_branches b JOIN pdv_companies c ON c.id=b.company_id LEFT JOIN pdv_sync_events e ON e.company_id=b.company_id AND e.branch_id=b.id GROUP BY b.company_id,c.name,b.id,b.name,b.active ORDER BY c.name,b.name');return r.rows;
}
