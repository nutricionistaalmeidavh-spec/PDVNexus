import { createHash, timingSafeEqual } from "node:crypto";
export const EVENT_KINDS=new Set(["sale.completed","sale.cancelled","stock.movement","product.upsert","customer.upsert"]);
export const digestToken=(token)=>createHash("sha256").update(String(token)).digest("hex");
export function tokenEquals(a,b){return timingSafeEqual(Buffer.from(digestToken(a),"hex"),Buffer.from(digestToken(b),"hex"));}
export function sanitizeCursor(value){const input=String(value??"0");if(!/^(0|[1-9][0-9]{0,17})$/.test(input))throw new Error("Cursor inválido.");return input;}
function sortKeys(value){if(Array.isArray(value))return value.map(sortKeys);if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).sort().map(key=>[key,sortKeys(value[key])]));return value;}
export function hashEvent(event){return createHash("sha256").update(JSON.stringify(sortKeys({kind:event.kind,entityId:event.entityId,terminalId:event.terminalId,payload:event.payload}))).digest("hex");}
const key=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/;
export function validateEvents(events,branchId){
 if(!Array.isArray(events)||events.length<1||events.length>250)throw new Error("Lote inválido: envie entre 1 e 250 eventos.");
 if(JSON.stringify(events).length>1024*1024)throw new Error("Lote excede 1 MB.");
 for(const event of events){
  if(!event||typeof event!=="object"||!key.test(String(event.eventId||"")))throw new Error("Identificador de evento inválido.");
  if(event.branchId!==branchId)throw new Error("Evento de outra filial bloqueado.");
  if(!key.test(String(event.terminalId||""))||!key.test(String(event.entityId||"")))throw new Error("Identificador do terminal ou da entidade inválido.");
  if(!EVENT_KINDS.has(event.kind))throw new Error("Tipo de evento não autorizado.");
  if(!event.payload||typeof event.payload!=="object"||Array.isArray(event.payload)||JSON.stringify(event.payload).length>131072)throw new Error("Payload do evento inválido.");
 }
 if(new Set(events.map(e=>e.eventId)).size!==events.length)throw new Error("Evento duplicado no mesmo lote.");
 return events;
}