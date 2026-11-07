import {useState, type CSSProperties} from "react";
import {PdvGuidedDialog,guidedFieldStyle,guidedPrimaryStyle,guidedSecondaryStyle} from "./PdvGuidedDialog";
import type {PdvFinanceRow,PdvKanbanColumnId} from "./financeMatrix";
const brl=(n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export interface KanbanMoveFields {
 amount?:number; method?:string; dueDate?:string; reason?:string; assumeUnpaid?:boolean;
}
type Props={
 row:PdvFinanceRow;
 target:PdvKanbanColumnId;
 targetTitle:string;
 error:string;
 onClose:()=>void;
 onConfirm:(fields:KanbanMoveFields)=>void;
};
const label:CSSProperties={display:"grid",gap:5,fontSize:13,fontWeight:650};
const dateTargets=new Set<PdvKanbanColumnId>(["vencidas","a_vencer"]);
export function PdvKanbanMoveDialog({row,target,targetTitle,error,onClose,onConfirm}:Props){
 const payment=target==="liquidadas"||target==="parciais";
 const legacy=row.status==="registrada";
 const [rawAmount,setRawAmount]=useState(target==="liquidadas"?String(row.open??row.original):"");
 const [method,setMethod]=useState("PIX");
 const [dueDate,setDueDate]=useState(row.dueDate??"");
 const [reason,setReason]=useState("");
 const [assumeUnpaid,setAssumeUnpaid]=useState(false);
 const parsed=Number(rawAmount.includes(",")?rawAmount.replace(/\./g,"").replace(",","."):rawAmount);
 const title="Mover para "+targetTitle;
 const disabled=legacy&&!assumeUnpaid||payment&&(!Number.isFinite(parsed)||parsed<=0);
 return <PdvGuidedDialog title={title} step="Financeiro · alteração canônica" tone={row.open===0?"danger":"default"}
  description="A troca de coluna será confirmada somente após atualizar o lançamento financeiro original. Nenhum pagamento é criado sem confirmação."
  onClose={onClose}
  actions={<><button type="button" onClick={onClose} style={guidedSecondaryStyle}>Cancelar</button>
    <button type="button" disabled={disabled} onClick={()=>onConfirm({amount:payment?parsed:undefined,method:payment?method:undefined,
      dueDate:dateTargets.has(target)||legacy?dueDate:undefined,reason,assumeUnpaid})} style={guidedPrimaryStyle}>
      Confirmar alteração</button></>}>
  <div style={{display:"grid",gap:5,padding:12,border:"1px solid #dce5ef",borderRadius:10,background:"#f7fbff"}}>
    <strong>{row.party}</strong>
    <span style={{fontSize:12}}>Documento: {row.reference}{row.installmentLabel?" · Parcela "+row.installmentLabel:""}</span>
    <span style={{fontSize:12}}>Valor original: {brl(row.original)} · Já baixado: {row.settled===null?"Não apurado":brl(row.settled)}</span>
    <strong style={{fontSize:14}}>Saldo em aberto: {row.open===null?"Histórico sem baixa rastreada":brl(row.open)}</strong>
  </div>
  {payment?<><label style={label}>Valor da baixa (R$)
      <input aria-label="Valor confirmado para mover no Kanban" style={guidedFieldStyle} inputMode="decimal"
        value={rawAmount} onChange={e=>setRawAmount(e.target.value)} placeholder="0,00"/>
    </label><label style={label}>Forma do pagamento ou recebimento
      <select aria-label="Forma da baixa do Kanban" style={guidedFieldStyle} value={method} onChange={e=>setMethod(e.target.value)}>
        <option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option>
        <option value="TRANSFERENCIA">Transferência</option><option value="CARTAO">Cartão</option>
      </select></label>
    <small style={{color:"#52647a"}}>{target==="liquidadas"?"A baixa deve ser integral.":"A baixa deve ser menor que o saldo restante."} O valor será registrado no documento canônico, inclusive na parcela específica.</small>
  </>:null}
  {dateTargets.has(target)||legacy?<label style={label}>Novo vencimento real
    <input aria-label="Novo vencimento no Kanban" type="date" style={guidedFieldStyle} value={dueDate} onChange={e=>setDueDate(e.target.value)}/>
  </label>:null}
  {target==="sem_vencimento"?<small>Somente lançamentos sem obrigação de vencimento obrigatório podem ficar nesta coluna. Nenhuma baixa será apagada.</small>:null}
  {legacy?<label style={{display:"flex",alignItems:"start",gap:8,fontSize:13}}>
    <input type="checkbox" checked={assumeUnpaid} onChange={e=>setAssumeUnpaid(e.target.checked)}/>
    <span>Conferi os comprovantes e confirmo que esta despesa antiga está em aberto. Autorizar seu controle financeiro a partir de agora.</span>
  </label>:null}
  <label style={label}>Motivo ou observação
    <textarea aria-label="Motivo da movimentação do Kanban" style={{...guidedFieldStyle,minHeight:65,resize:"vertical"}}
      value={reason} onChange={e=>setReason(e.target.value)} placeholder={payment?"Opcional: referência do comprovante":"Obrigatório: motivo da alteração do vencimento"}/>
  </label>
  {error?<p role="alert" style={{color:"#991b1b",margin:0}}>{error}</p>:null}
 </PdvGuidedDialog>;
}
