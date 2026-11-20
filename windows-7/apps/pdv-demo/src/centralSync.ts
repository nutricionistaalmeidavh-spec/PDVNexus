// Protocolo incremental P3: eventos imutáveis da operação local, sem substituição de snapshots.
// O SQLite (ou JSON legado) segue sendo a base de trabalho offline.
export type CentralEventKind = "sale.completed" | "sale.cancelled" | "stock.movement";
export interface CentralSyncEvent {
  eventId: string;
  branchId: string;
  terminalId: string;
  kind: CentralEventKind;
  entityId: string;
  payload: Record<string, unknown>;
}
export interface RemoteCentralSyncEvent extends CentralSyncEvent { sequence: string }
export interface CentralSyncState {
  enabled: boolean;
  endpointUrl: string;
  ackedIds: string[];
  receivedIds: string[];
  cursor: string;
  lastSuccessAt?: string;
}
export type CentralSnapshot = Record<string, unknown> & {
  catalogProducts?: Array<Record<string, unknown>>;
  registeredCustomers?: Array<Record<string, unknown>>;
  completedSales?: Array<Record<string, unknown>>;
  extensions?: Record<string, unknown> & {
    cancelledSales?: Array<Record<string, unknown>>;
    inventoryMovements?: Array<Record<string, unknown>>;
    centralSync?: Partial<CentralSyncState>;
  };
};
const allowedId=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/;
const allowedCursor=/^(0|[1-9][0-9]{0,17})$/;
function requiredId(input:unknown,label:string):string {
  const id=String(input??"");
  if(!allowedId.test(id))throw new Error("Identificador inválido de "+label+"; sincronização bloqueada.");
  return id;
}
function safeRecord(value:unknown):Record<string,unknown> {
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Registro remoto inválido.");
  return value as Record<string,unknown>;
}
function readRecords(value:unknown):Array<Record<string,unknown>> {
  return Array.isArray(value)?value.map(safeRecord):[];
}
export function normalizeCentralSyncState(snapshot:CentralSnapshot):CentralSyncState {
  const input=snapshot.extensions?.centralSync ?? {};
  return {
    enabled:input.enabled===true,
    endpointUrl:typeof input.endpointUrl==="string"?input.endpointUrl:"",
    ackedIds:Array.isArray(input.ackedIds)?[...new Set(input.ackedIds.filter((value):value is string=>typeof value==="string"))]:[],
    receivedIds:Array.isArray(input.receivedIds)?[...new Set(input.receivedIds.filter((value):value is string=>typeof value==="string"))]:[],
    cursor:typeof input.cursor==="string"&&allowedCursor.test(input.cursor)?input.cursor:"0",
    lastSuccessAt:typeof input.lastSuccessAt==="string"?input.lastSuccessAt:undefined
  };
}
export function updateCentralSyncState<T extends CentralSnapshot>(snapshot:T,patch:Partial<CentralSyncState>):T {
  const old=normalizeCentralSyncState(snapshot);
  const next={...old,...patch};
  if(!allowedCursor.test(next.cursor))throw new Error("Cursor de sincronização inválido.");
  return {...snapshot,extensions:{...(snapshot.extensions??{}),centralSync:next}} as T;
}
export function collectPendingEvents(snapshot:CentralSnapshot,branchId:string,terminalId:string,ackedIds:readonly string[]):CentralSyncEvent[] {
  const branch=requiredId(branchId,"filial"),terminal=requiredId(terminalId,"terminal");
  const acked=new Set(ackedIds),result:CentralSyncEvent[]=[];
  const add=(kind:CentralEventKind,entityId:unknown,value:Record<string,unknown>)=>{
    const identity=requiredId(entityId,"registro");
    const eventId=(kind==="stock.movement"?"stock":kind==="sale.cancelled"?"cancel":"sale")+":"+terminal+":"+identity;
    if(acked.has(eventId))return;
    result.push({eventId,branchId:branch,terminalId:terminal,kind,entityId:identity,payload:{...value}});
  };
  for(const sale of readRecords(snapshot.completedSales)) {
    if(sale.terminalId&&sale.terminalId!==terminal)continue;
    add("sale.completed",sale.number,sale);
  }
  for(const sale of readRecords(snapshot.extensions?.cancelledSales)) {
    if(sale.terminalId&&sale.terminalId!==terminal)continue;
    add("sale.cancelled",sale.number,sale);
  }
  for(const movement of readRecords(snapshot.extensions?.inventoryMovements)) {
    if(movement.sourceTerminalId&&movement.sourceTerminalId!==terminal)continue;
    add("stock.movement",movement.id,movement);
  }
  return result;
}
function same(a:unknown,b:unknown):boolean{return JSON.stringify(a)===JSON.stringify(b);}
function normalizeAmount(value:unknown):number {
  const n=Number(value);
  if(!Number.isFinite(n)||!Number.isSafeInteger(Math.round(n*1000)))throw new Error("Quantidade inválida no movimento.");
  return n;
}
export function applyRemoteEvents<T extends CentralSnapshot>(
 snapshot:T,events:readonly RemoteCentralSyncEvent[],branchId:string,localTerminalId:string
):T {
  const branch=requiredId(branchId,"filial"),local=requiredId(localTerminalId,"terminal");
  const already=normalizeCentralSyncState(snapshot);
  const received=new Set(already.receivedIds);
  let products=readRecords(snapshot.catalogProducts);
  let sales=readRecords(snapshot.completedSales);
  let cancelled=readRecords(snapshot.extensions?.cancelledSales);
  let movements=readRecords(snapshot.extensions?.inventoryMovements);
  let cursor=BigInt(already.cursor);
  for(const event of events) {
    if(event.branchId!==branch)throw new Error("Evento de outra filial bloqueado.");
    requiredId(event.eventId,"evento");requiredId(event.terminalId,"terminal");requiredId(event.entityId,"registro");
    if(!allowedCursor.test(String(event.sequence)))throw new Error("Cursor remoto inválido.");
    const sequence=BigInt(event.sequence);
    if(sequence>cursor)cursor=sequence;
    if(received.has(event.eventId))continue;
    received.add(event.eventId);
    if(event.terminalId===local||already.ackedIds.includes(event.eventId))continue;
    const payload=safeRecord(event.payload);
    if(event.kind==="sale.completed"||event.kind==="sale.cancelled") {
      if(String(payload.number??"")!==event.entityId)throw new Error("Venda remota com identificação inconsistente.");
      if(payload.terminalId && payload.terminalId!==event.terminalId)throw new Error("Venda remota com terminal incompatível.");
      const tagged:Record<string,unknown>={...payload,terminalId:event.terminalId};
      const active=sales.find(row=>row.number===tagged.number);
      const previouslyCancelled=cancelled.find(row=>row.number===tagged.number);
      if(event.kind==="sale.completed") {
        if(previouslyCancelled)throw new Error("Conflito: venda já cancelada na filial.");
        if(active && !same(active,tagged))throw new Error("Conflito de número de venda entre caixas. Conciliação obrigatória.");
        if(!active)sales=[tagged,...sales];
      } else {
        if(previouslyCancelled && !same(previouslyCancelled,tagged))throw new Error("Conflito de cancelamento duplicado.");
        if(active && active.terminalId!==event.terminalId)throw new Error("Cancelamento de venda pertencente a outro terminal.");
        if(!previouslyCancelled)cancelled=[tagged,...cancelled];
        if(active)sales=sales.filter(row=>row.number!==tagged.number);
      }
    } else if(event.kind==="stock.movement") {
      if(String(payload.id??"")!==event.entityId)throw new Error("Movimento remoto com identificação inconsistente.");
      const existing=movements.find(row=>row.id===payload.id);
      if(existing&&!same(existing,payload))throw new Error("Conflito de movimento de estoque: IDs coincidentes.");
      if(existing)continue;
      const productCode=String(payload.productCode??"");
      const delta=normalizeAmount(payload.quantityDelta);
      const product=products.find(row=>row.productCode===productCode);
      if(!product)throw new Error("Produto não cadastrado nesta filial; conciliação de estoque necessária.");
      const stock=normalizeAmount(product.stock);
      if(stock+delta<0)throw new Error("Estoque insuficiente para aplicar movimento remoto; saldo preservado.");
      const nextStock=Math.round((stock+delta)*1000)/1000;
      products=products.map(row=>row.productCode===productCode?{...row,stock:nextStock}:row);
      // O histórico remoto deve registrar os saldos REAIS da unidade que aplica,
      // e não os saldos de origem da outra máquina.
      movements=[{...payload,sourceTerminalId:event.terminalId,stockBefore:stock,stockAfter:nextStock},...movements];
    } else throw new Error("Tipo de evento remoto desconhecido.");
  }
  const next=updateCentralSyncState(snapshot,{receivedIds:[...received],cursor:String(cursor)});
  return {...next,catalogProducts:products,completedSales:sales,extensions:{
    ...(next.extensions??{}),cancelledSales:cancelled,inventoryMovements:movements
  }} as T;
}
export function validateSyncEndpointUrl(raw:string):string {
  let url:URL;
  try { url=new URL(raw.trim()); } catch { throw new Error("URL de sincronização inválida."); }
  if(url.username||url.password||url.search||url.hash)throw new Error("URL não pode conter senha, parâmetros ou fragmentos.");
  if(url.protocol!=="https:"&&!(url.protocol==="http:"&&["127.0.0.1","localhost","[::1]"].includes(url.hostname))){
    throw new Error("Para conexão remota, configure HTTPS. HTTP só é permitido em localhost.");
  }
  return url.href.replace(/\/+$/,"");
}
