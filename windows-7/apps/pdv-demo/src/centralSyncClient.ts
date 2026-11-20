import { createUserSecretStore, getDesktopPdvBackupBridge, getDesktopPdvStoreBridge } from "@nexus-core/desktop-runtime";
import { applyRemoteEvents, collectPendingEvents, normalizeCentralSyncState, updateCentralSyncState, validateSyncEndpointUrl, type CentralSnapshot, type RemoteCentralSyncEvent, type CentralSyncEvent } from "./centralSync";
import { getActivePdvStoreKey, readStoreNetwork, currentStoreBranch } from "./storeNetwork";

type Meta = { companyId:string; branchId:string; terminalId:string };
type PushResult = { ackedIds:string[]; inserted:number; duplicates:number };
type PullResult = { events:RemoteCentralSyncEvent[]; nextCursor:string; hasMore:boolean };
export type CentralSyncResult = { sent:number; received:number; pending:number; cursor:string; state:"ok"|"disabled" };
let running:Promise<CentralSyncResult>|null=null;
function credentialKey(branchId:string,terminalId:string) {return "pdv-central-sync:"+branchId+":"+terminalId;}
async function reply<T>(response:Response):Promise<T>{
  const value=await response.json() as T & {error?:string};
  if(!response.ok)throw new Error(value?.error||"Servidor central indisponível: HTTP "+response.status);
  return value;
}
function request(url:string,token:string,options:RequestInit={}) {
  return fetch(url,{...options,headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json",...(options.headers??{})},cache:"no-store"});
}
async function checkMeta(endpoint:string,token:string,companyId:string,branchId:string,terminalId:string) {
  const remote=await reply<Meta>(await request(endpoint+"/v1/meta",token));
  if(remote.companyId!==companyId||remote.branchId!==branchId||remote.terminalId!==terminalId)
    throw new Error("Token do servidor vinculado a empresa, filial ou terminal diferente. Operação bloqueada.");
}
export async function configureCentralSync(input:{endpointUrl:string;token:string;terminalId:string;enabled:boolean}):Promise<void>{
  const bridge=getDesktopPdvStoreBridge();
  if(!bridge)throw new Error("Sincronização central requer aplicativo desktop.");
  const endpoint=validateSyncEndpointUrl(input.endpointUrl);
  const branch=currentStoreBranch(readStoreNetwork());
  const network=readStoreNetwork();
  const key=getActivePdvStoreKey();
  const current=await bridge.load(key);
  if(!current?.snapshotJson)throw new Error("Base canônica local indisponível.");
  const token=input.token.trim()||await createUserSecretStore().get(credentialKey(branch.id,input.terminalId));
  if(input.enabled){
    if(token.length<32)throw new Error("Informe a credencial do terminal com pelo menos 32 caracteres.");
    await checkMeta(endpoint,token,network.company.id,branch.id,input.terminalId);
  }
  const snapshot=JSON.parse(current.snapshotJson) as CentralSnapshot;
  const next=updateCentralSyncState(snapshot,{enabled:input.enabled,endpointUrl:endpoint});
  await bridge.save(key,JSON.stringify(next),current.revision);
  if(input.token.trim())await createUserSecretStore().set(credentialKey(branch.id,input.terminalId),token);
  if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("nexus-pdv:canonical-external-write"));
}
async function runSync(input:{terminalId:string;canPersist?:()=>boolean}):Promise<CentralSyncResult>{
  const bridge=getDesktopPdvStoreBridge();
  if(!bridge)throw new Error("Banco canônico desktop indisponível.");
  const network=readStoreNetwork();
  const branch=currentStoreBranch(network);
  const storeKey=getActivePdvStoreKey();
  let row=await bridge.load(storeKey);
  if(!row?.snapshotJson)throw new Error("Snapshot local indisponível.");
  let snapshot=JSON.parse(row.snapshotJson) as CentralSnapshot;
  const state=normalizeCentralSyncState(snapshot);
  if(!state.enabled)return {sent:0,received:0,pending:0,cursor:state.cursor,state:"disabled"};
  const endpoint=validateSyncEndpointUrl(state.endpointUrl);
  const token=await createUserSecretStore().get(credentialKey(branch.id,input.terminalId));
  if(!token)throw new Error("Token central ausente: configure a conexão antes de sincronizar.");
  const expectedBranch=snapshot.extensions?.branchId??"matriz";
  if(expectedBranch!==branch.id)throw new Error("Snapshot canônico pertence a outra filial.");
  await checkMeta(endpoint,token,network.company.id,branch.id,input.terminalId);
  const backupBridge=getDesktopPdvBackupBridge();
  let sent=0,received=0;
  const persist=async(next:CentralSnapshot)=>{
    if(input.canPersist && !input.canPersist())throw new Error("Operação de caixa iniciada durante sincronização; gravação remota adiada.");
    const written=await bridge.save(storeKey,JSON.stringify(next),row!.revision);
    row={...row!,revision:written.revision,snapshotJson:JSON.stringify(next)};
    snapshot=next;
    if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("nexus-pdv:canonical-external-write",{detail:{revision:written.revision}}));
  };
  // Operações locais persistidas compõem a outbox. Uma falha não retira eventos da fila.
  const pending=collectPendingEvents(snapshot,branch.id,input.terminalId,state.ackedIds);
  for(let start=0;start<pending.length;start+=100){
    const batch=pending.slice(start,start+100);
    const result=await reply<PushResult>(await request(endpoint+"/v1/sync/push",token,{method:"POST",body:JSON.stringify({events:batch})}));
    const expectedIds=new Set(batch.map(event=>event.eventId));
    if(result.ackedIds.length!==expectedIds.size||result.ackedIds.some(id=>!expectedIds.has(id)))throw new Error("Servidor não confirmou todos os eventos; reenvio seguro pendente.");
    const current=normalizeCentralSyncState(snapshot);
    const next=updateCentralSyncState(snapshot,{ackedIds:[...new Set([...current.ackedIds,...result.ackedIds])]});
    await persist(next);
    sent+=batch.length;
  }
  for(let page=0;page<20;page++){
    const cursor=normalizeCentralSyncState(snapshot).cursor;
    const data=await reply<PullResult>(await request(endpoint+"/v1/sync/pull?after="+encodeURIComponent(cursor)+"&limit=100",token));
    if(!Array.isArray(data.events)||typeof data.nextCursor!=="string")throw new Error("Resposta de sincronização inválida.");
    if(!data.events.length)break;
    // Backup físico ANTES de integrar operações remotas pela primeira vez.
    if(!backupBridge)throw new Error("Backup desktop indisponível: aplicação de eventos remotos bloqueada.");
    await backupBridge.write({snapshotJson:row!.snapshotJson,reason:"pre-central-sync",retention:7});
    const next=applyRemoteEvents(snapshot,data.events,branch.id,input.terminalId);
    const enriched=updateCentralSyncState(next,{lastSuccessAt:new Date().toISOString()});
    await persist(enriched);
    received+=data.events.filter(event=>event.terminalId!==input.terminalId).length;
    if(!data.hasMore)break;
  }
  const end=normalizeCentralSyncState(snapshot);
  return {state:"ok",sent,received,pending:collectPendingEvents(snapshot,branch.id,input.terminalId,end.ackedIds).length,cursor:end.cursor};
}
export function syncCentralNow(input:{terminalId:string;canPersist?:()=>boolean}):Promise<CentralSyncResult>{
  if(running)return running;
  const op=runSync(input);
  running=op;
  void op.finally(()=>{if(running===op)running=null;}).catch(()=>undefined);
  return op;
}
