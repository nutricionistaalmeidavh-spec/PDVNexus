import { useEffect, useRef, useState } from "react";
import { getDesktopPdvStoreBridge } from "@nexus-core/desktop-runtime";
import { configureCentralSync, syncCentralNow } from "./centralSyncClient";
import { normalizeCentralSyncState, type CentralSnapshot } from "./centralSync";
import { getActivePdvStoreKey } from "./storeNetwork";

export const CENTRAL_SYNC_EVENT = "nexus-pdv:central-sync-status";
function announce(message:string){
  if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent(CENTRAL_SYNC_EVENT,{detail:message}));
}
export function CentralSyncController({terminalId,canRun}:{terminalId:string;canRun:()=>boolean}){
  const gate=useRef(canRun);
  gate.current=canRun;
  useEffect(()=>{
    let disposed=false;
    const tick=async()=>{
      if(disposed||!gate.current()||!navigator.onLine)return;
      try{
        const bridge=getDesktopPdvStoreBridge();
        if(!bridge)return;
        const row=await bridge.load(getActivePdvStoreKey());
        if(!row?.snapshotJson||!normalizeCentralSyncState(JSON.parse(row.snapshotJson) as CentralSnapshot).enabled)return;
        const result=await syncCentralNow({terminalId,canPersist:()=>gate.current()});
        if(!disposed&&result.state==="ok")announce("Última sincronização: "+result.sent+" enviados, "+result.received+" recebidos; cursor "+result.cursor+".");
      }catch(error){
        if(!disposed)announce("Sincronização pendente: "+(error instanceof Error?error.message:"falha de comunicação")+". As vendas locais foram preservadas.");
      }
    };
    const online=()=>{void tick();};
    const timer=window.setInterval(()=>void tick(),30000);
    window.addEventListener("online",online);
    void tick();
    return ()=>{disposed=true;window.clearInterval(timer);window.removeEventListener("online",online);};
  },[terminalId]);
  return null;
}
export function CentralSyncPanel({terminalId,canConfigure,canSynchronize}:{terminalId:string;canConfigure:boolean;canSynchronize:boolean}){
  const [endpoint,setEndpoint]=useState("");
  const [credential,setCredential]=useState("");
  const [enabled,setEnabled]=useState(false);
  const [status,setStatus]=useState("Servidor central opcional: nenhum serviço pago é necessário.");
  const [busy,setBusy]=useState(false);
  const manualGate=useRef(canSynchronize);
  manualGate.current=canSynchronize;
  useEffect(()=>{
    let alive=true;
    const refresh=async()=>{
      const row=await getDesktopPdvStoreBridge()?.load(getActivePdvStoreKey());
      if(!alive||!row?.snapshotJson)return;
      const state=normalizeCentralSyncState(JSON.parse(row.snapshotJson) as CentralSnapshot);
      setEndpoint(state.endpointUrl);
      setEnabled(state.enabled);
    };
    void refresh().catch(error=>{if(alive)setStatus(error instanceof Error?error.message:"Falha ao verificar sincronização.");});
    const onStatus=(event:Event)=>{
      const message=(event as CustomEvent<string>).detail;
      if(alive)setStatus(message);
    };
    window.addEventListener(CENTRAL_SYNC_EVENT,onStatus);
    return ()=>{alive=false;window.removeEventListener(CENTRAL_SYNC_EVENT,onStatus);};
  },[]);
  const configure=async(nextEnabled:boolean)=>{
    if(busy)return;
    setBusy(true);
    try{
      await configureCentralSync({endpointUrl:endpoint,token:credential,terminalId,enabled:nextEnabled});
      setCredential("");
      setEnabled(nextEnabled);
      setStatus(nextEnabled?"Servidor autenticado e sincronização habilitada.":"Sincronização automática desativada. Os dados locais permanecem intactos.");
    }catch(error){setStatus(error instanceof Error?error.message:"Falha ao configurar servidor.");}
    finally{setBusy(false);}
  };
  const syncNow=async()=>{
    if(busy||!canSynchronize)return;
    setBusy(true);
    try{
      const result=await syncCentralNow({terminalId,canPersist:()=>manualGate.current});
      setStatus("Sincronização confirmada: "+result.sent+" enviados e "+result.received+" recebidos. Pendentes: "+result.pending+".");
    }catch(error){setStatus(error instanceof Error?error.message:"Sincronização falhou. Operações locais preservadas.");}
    finally{setBusy(false);}
  };
  return <section data-pdv-central-sync style={{display:"grid",gap:10,border:"1px solid #dbe2ea",borderRadius:12,padding:16}}>
    <div><strong>Servidor central (PostgreSQL) — opcional</strong><p style={{fontSize:12,color:"#64748b"}}>O banco local continua funcionando offline. Configure o terminal em modo Caixa único antes de habilitar o servidor central; não execute simultaneamente o multi-caixa legado.</p></div>
    <label style={{display:"grid",gap:4}}>URL da API central
      <input aria-label="URL da API central" value={endpoint} onChange={e=>setEndpoint(e.target.value)} disabled={!canConfigure||busy} placeholder="https://pdv.intranet.exemplo" style={{padding:9,border:"1px solid #dbe2ea",borderRadius:8}}/>
    </label>
    <label style={{display:"grid",gap:4}}>Token do terminal — não será exibido novamente
      <input aria-label="Token de sincronização central" type="password" autoComplete="off" value={credential} onChange={e=>setCredential(e.target.value)} disabled={!canConfigure||busy} placeholder={enabled?"Informe somente para substituir o token":"Credencial gerada pelo servidor"} style={{padding:9,border:"1px solid #dbe2ea",borderRadius:8}}/>
    </label>
    <p style={{fontSize:12,color:"#64748b"}}>Estado: {enabled?"Conectado/configurado":"Desativado"} · Terminal {terminalId}. Sincronização incremental automática a cada 30 segundos, quando não houver operações pendentes.</p>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <button type="button" disabled={!canConfigure||busy} onClick={()=>void configure(true)}>Validar e habilitar</button>
      <button type="button" disabled={!canConfigure||busy||!enabled} onClick={()=>void configure(false)}>Desativar</button>
      <button type="button" disabled={!enabled||busy||!canSynchronize} onClick={()=>void syncNow()}>Sincronizar agora</button>
    </div>
    <p role="status" style={{fontSize:13,margin:0}}>{status}</p>
  </section>;
}
