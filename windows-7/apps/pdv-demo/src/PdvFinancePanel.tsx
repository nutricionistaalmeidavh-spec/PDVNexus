import { useMemo, useState, type CSSProperties } from "react";
import { summarizeCommercial, buildCommercialAuditTrail, type CommercialLedger, type CommercialSale } from "./commercialLedger";
import { PdvGuidedDialog, guidedPrimaryStyle, guidedSecondaryStyle } from "./PdvGuidedDialog";
import {
 buildPdvFinanceRows, filterPdvFinanceRows, buildPdvFinanceKanban,
 type PdvFinanceFilters, type PdvFinanceRow, type PdvFinanceKind
} from "./financeMatrix";
import { buildPdvFinanceReport, exportPdvFinanceCsv } from "./financeReporting";
import { buildPdvFinanceXlsx, buildPdvFinancePdf } from "./financeExportDocuments";

const money=(n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const styleBox:CSSProperties={border:"1px solid #dce4ee",borderRadius:12,padding:14,background:"#fff",display:"grid",gap:10};
const filterStyle:CSSProperties={border:"1px solid #ced7e5",borderRadius:8,minHeight:40,padding:"8px 10px",minWidth:0,background:"#fff",color:"#17253c",flex:"1 1 175px"};
const compactButton:CSSProperties={border:"1px solid #c9d7e9",borderRadius:8,minHeight:38,padding:"7px 12px",cursor:"pointer",background:"#f6f9fd",fontWeight:650,color:"#1b4d8d"};
const rowLayout:CSSProperties={display:"flex",gap:9,alignItems:"center",flexWrap:"wrap"};
const moneyTableCell:CSSProperties={padding:"10px 12px",borderBottom:"1px solid #e7edf5",whiteSpace:"nowrap",textAlign:"right",fontVariantNumeric:"tabular-nums"};
const labels:Record<PdvFinanceKind,string>={payable:"Conta a pagar",receivable:"Conta a receber",expense:"Despesa"};
const statuses={pendente:"Pendente",parcial:"Parcial",liquidada:"Liquidada",registrada:"Registrada"};
const formatDay=(s:string|undefined)=>s?/^\d{4}-\d{2}-\d{2}$/.test(s)?s.slice(8,10)+"/"+s.slice(5,7)+"/"+s.slice(0,4):s:"Não informado";
const todayLocal=()=>{const d=new Date(),p=(n:number)=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;};
const downloadFile=(content:string|Uint8Array,name:string,type:string)=>{
 const url=URL.createObjectURL(new Blob([content as BlobPart],{type}));
 const link=document.createElement("a");link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
type FinanceTab="matrix"|"kanban"|"cashflow"|"reports"|"audit";
type Props={
 ledger:CommercialLedger;
 sales:CommercialSale[];
 creditMethods:string[];
 customers?:ReadonlyArray<{id:string;name:string}>;
 allowed:boolean;
 onOpenSettlement:(kind:"purchase"|"sale"|"expense",reference?:string)=>void;
 onOpenExpense:()=>void;
 storeName?:string;
};
/** No duplicate finance store: every row and kanban lane is computed from canonical purchases, sales and settlements. */
export function PdvFinancePanel({ledger,sales,creditMethods,customers,allowed,onOpenSettlement,onOpenExpense,storeName="PDV Nexus"}:Props){
 const [tab,setTab]=useState<FinanceTab>("matrix");
 const [filters,setFilters]=useState<PdvFinanceFilters>({kind:"all",status:"all",search:"",from:"",to:""});
 const [detail,setDetail]=useState<string|null>(null);
 const [exportError,setExportError]=useState("");
 const summary=useMemo(()=>summarizeCommercial({ledger,sales,creditMethods}),[ledger,sales,creditMethods]);
 const rows=useMemo(()=>buildPdvFinanceRows({ledger,sales,creditMethods,customers}),[ledger,sales,creditMethods,customers]);
 const filtered=useMemo(()=>filterPdvFinanceRows(rows,filters),[rows,filters]);
 const board=useMemo(()=>buildPdvFinanceKanban(filtered,todayLocal()),[filtered]);
 const audit=useMemo(()=>buildCommercialAuditTrail(ledger),[ledger]);
 const report=useMemo(()=>buildPdvFinanceReport({ledger,sales,creditMethods,from:filters.from,to:filters.to}),[ledger,sales,creditMethods,filters.from,filters.to]);
 const selected=rows.find(row=>row.key===detail);
 const selectedTotal=filtered.reduce((sum,row)=>sum+(row.open??0),0);
 const updateFilter=<K extends keyof PdvFinanceFilters>(key:K,value:PdvFinanceFilters[K])=>setFilters(v=>({...v,[key]:value}));
 const launch=(row:PdvFinanceRow)=>{
   if(!allowed||row.open===null||row.open<=0)return;
   setDetail(null);
   onOpenSettlement(row.kind==="payable"?"purchase":row.kind==="receivable"?"sale":"expense",row.reference);
 };
 const exportReport=(format:"csv"|"xlsx"|"pdf")=>{
   if(!allowed)return;
   setExportError("");
   try{
     const filename="pdv-nexus-financeiro-"+todayLocal();
     if(format==="csv")downloadFile(exportPdvFinanceCsv(filtered),filename+".csv","text/csv;charset=utf-8");
     if(format==="xlsx")downloadFile(buildPdvFinanceXlsx(filtered,report,audit),filename+".xlsx","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
     if(format==="pdf")downloadFile(buildPdvFinancePdf(filtered,report,storeName),filename+".pdf","application/pdf");
   }catch(error){setExportError(error instanceof Error?error.message:"Não foi possível exportar o relatório.");}
 };
 const summaryCards=[
   {key:"payable",label:"A pagar",value:summary.payableOpen},
   {key:"receivable",label:"A receber",value:summary.receivableOpen},
   {key:"expenses",label:"Despesas registradas",value:summary.expensesTotal}
 ];
 const sources=(row:PdvFinanceRow)=>row.sources.length?row.sources.map(source=>
   <div key={source.id} style={{...styleBox,padding:10,background:"#f8fbff"}}>
     <strong>{money(source.amount)} · {source.method}</strong>
     <small>{source.id} · {source.paidAt}{source.operatorName?" · "+source.operatorName:""}</small>
   </div>):<p style={{margin:0,fontSize:12,color:"#64748b"}}>Nenhuma baixa vinculada. O valor original permanece registrado.</p>;
 if(!allowed)return <section data-pdv-finance-panel="true" style={styleBox} role="status">
   <h2 style={{margin:0}}>Acesso restrito ao Financeiro</h2>
   <p style={{margin:0}}>Somente gerente ou administrador ativo pode consultar valores e registrar operações financeiras.</p>
 </section>;
 return <section data-pdv-finance-panel="true" style={{display:"grid",gap:14}}>
   <div style={{...rowLayout,justifyContent:"space-between"}}>
     <div><h2 style={{margin:0,fontSize:20}}>Financeiro</h2>
       <p style={{margin:"4px 0 0",fontSize:12,color:"#64748b"}}>Compras recebidas, crediário e despesas — sem saldos paralelos e com funcionamento offline.</p></div>
     <div style={rowLayout}><button type="button" onClick={onOpenExpense} style={compactButton}>+ Nova despesa</button>
       <button type="button" onClick={()=>onOpenSettlement("purchase")} style={guidedPrimaryStyle}>Registrar pagamento ou recebimento parcial</button></div>
   </div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:10}}>
     {summaryCards.map(item=><div key={item.key} data-pdv-finance-kpi={item.key} style={styleBox}>
       <span style={{fontSize:11,color:"#607186"}}>{item.label}</span>
       <strong style={{fontSize:22,fontVariantNumeric:"tabular-nums"}}>{money(item.value)}</strong>
     </div>)}
   </div>
   <p style={{fontSize:11,color:"#64748b",margin:0}}>Indicadores acima: histórico completo. Filtros abaixo: matriz, Kanban, fluxo por período e relatórios.</p>
   <div style={{...styleBox,gap:12}}>
     <nav aria-label="Modo de visualização financeira" style={rowLayout}>
       {([["matrix","Matriz financeira"],["kanban","Kanban"],["cashflow","Fluxo de caixa"],["reports","Relatórios"],["audit","Auditoria"]] as Array<[FinanceTab,string]>)
         .map(([id,label])=><button key={id} type="button" aria-pressed={tab===id} onClick={()=>setTab(id)}
           style={{...compactButton,background:tab===id?"#1d4ed8":"#f6f9fd",color:tab===id?"#fff":"#1b4d8d"}}>
           {label}</button>)}
     </nav>
     <div aria-label="Filtros do Financeiro" style={rowLayout}>
       <input aria-label="Buscar lançamento" value={filters.search} onChange={event=>updateFilter("search",event.target.value)}
         placeholder="Buscar cliente, fornecedor, despesa ou documento" style={{...filterStyle,flex:"2 1 240px"}}/>
       <select aria-label="Tipo do lançamento" value={filters.kind} onChange={event=>updateFilter("kind",event.target.value as PdvFinanceFilters["kind"])} style={filterStyle}>
         <option value="all">Todos os tipos</option><option value="payable">A pagar</option><option value="receivable">A receber</option><option value="expense">Despesas</option>
       </select>
       <select aria-label="Situação financeira" value={filters.status} onChange={event=>updateFilter("status",event.target.value as PdvFinanceFilters["status"])} style={filterStyle}>
         <option value="all">Todas as situações</option><option value="pendente">Pendente</option><option value="parcial">Parcial</option>
         <option value="liquidada">Liquidada</option><option value="registrada">Registrada</option>
       </select>
       <label style={{display:"grid",gap:2,fontSize:11,color:"#64748b"}}>De<input type="date" aria-label="Data inicial" style={filterStyle} value={filters.from} onChange={event=>updateFilter("from",event.target.value)}/></label>
       <label style={{display:"grid",gap:2,fontSize:11,color:"#64748b"}}>Até<input type="date" aria-label="Data final" style={filterStyle} value={filters.to} onChange={event=>updateFilter("to",event.target.value)}/></label>
       <button type="button" style={compactButton} onClick={()=>setFilters({kind:"all",status:"all",search:"",from:"",to:""})}>Limpar filtros</button>
     </div>
     {tab==="matrix"?<div style={{display:"grid",gap:9}}>
       <div style={{...rowLayout,justifyContent:"space-between"}}>
         <strong>Matriz financeira</strong><small>{filtered.length} lançamento(s) · Saldo consultado: {money(selectedTotal)}</small>
       </div>
       <p style={{margin:0,fontSize:11,color:"#64748b"}}>Clique no nome ou em uma célula com valor para abrir a origem do lançamento.</p>
       <div style={{maxHeight:480,overflow:"auto",border:"1px solid #e5ebf2",borderRadius:9}}>
         <table style={{width:"100%",minWidth:850,borderCollapse:"separate",borderSpacing:0,fontSize:12}}>
           <thead><tr>{["Lançamento","Natureza","Valor original","Liquidado","Em aberto","Vencimento","Situação"].map((label,i)=>
             <th key={label} style={{...moneyTableCell,textAlign:i<2?"left":"right",position:"sticky",top:0,left:i===0?0:undefined,
               zIndex:i===0?5:3,background:"#eaf1fc",color:"#243a59"}}>{label}</th>)}</tr></thead>
           <tbody>{filtered.map(row=><tr key={row.key}>
             <td style={{...moneyTableCell,textAlign:"left",position:"sticky",left:0,zIndex:2,background:"#fff"}}>
               <button type="button" title="Abrir origem do lançamento" style={{border:0,background:"transparent",color:"#1653a2",cursor:"pointer",textAlign:"left"}}
                 onClick={()=>setDetail(row.key)}><strong style={{display:"block"}}>{row.party}</strong><small>{row.reference}{row.installmentLabel?" · Parcela "+row.installmentLabel:""}</small></button></td>
             <td style={{...moneyTableCell,textAlign:"left"}}>{labels[row.kind]}</td>
             {(["original","settled","open"] as const).map(key=><td key={key} style={moneyTableCell}>
               {row[key]===null?"—":<button type="button" title={"Ver origem de "+row.reference} onClick={()=>setDetail(row.key)}
                 style={{border:0,background:"transparent",color:key==="open"?"#1d4ed8":"#253b57",fontWeight:700,cursor:"pointer"}}>{money(row[key]!)}</button>}
             </td>)}
             <td style={moneyTableCell}>{formatDay(row.dueDate)}</td>
             <td style={moneyTableCell}>{statuses[row.status]}</td>
           </tr>)}
           {!filtered.length?<tr><td colSpan={7} style={{padding:23,textAlign:"center",color:"#64748b"}}>Nenhum lançamento para este filtro.</td></tr>:null}
           </tbody>
           <tfoot><tr><td colSpan={4} style={{...moneyTableCell,textAlign:"left",background:"#f0f5fb",fontWeight:800}}>TOTAL EM ABERTO (registros selecionados)</td>
             <td style={{...moneyTableCell,background:"#f0f5fb",fontWeight:800}}>{money(selectedTotal)}</td><td colSpan={2} style={{background:"#f0f5fb"}}/></tr></tfoot>
         </table>
       </div>
     </div>:null}
     {tab==="kanban"?<div style={{display:"grid",gap:10}}>
       <div><strong>Kanban financeiro</strong><p style={{fontSize:11,color:"#64748b",margin:"4px 0 0"}}>Colunas com lançamentos reais; clique em cada conta para abrir seu histórico. O estado não muda por arrastar cartões.</p></div>
       <div data-pdv-kanban="true" style={{display:"flex",gap:12,overflowX:"auto",paddingBottom:8}}>
         {board.map(column=><section key={column.id} data-pdv-kanban-column={column.id} style={{flex:"0 0 246px",background:"#f1f5fb",border:"1px solid #dbe5f1",borderRadius:12,padding:10,display:"grid",gap:10,alignContent:"start",minHeight:245}}>
           <div style={{...rowLayout,justifyContent:"space-between"}}><strong style={{fontSize:12}}>{column.title}</strong>
             <small style={{fontSize:11,color:"#4c5f79"}}>{column.rows.length}</small></div>
           {column.rows.map(row=><button type="button" key={row.key} data-pdv-kanban-item={row.key}
             onClick={()=>setDetail(row.key)} style={{textAlign:"left",border:"1px solid #dce5ee",borderRadius:9,background:"#fff",padding:11,
             display:"grid",gap:6,cursor:"pointer"}}>
             <strong style={{fontSize:12,color:"#182d4c"}}>{row.party}</strong>
             <span style={{fontSize:11,color:"#63758a"}}>{row.reference}{row.installmentLabel?" · Parcela "+row.installmentLabel:""} · {labels[row.kind]}</span>
             <strong style={{fontSize:16,color:"#164883"}}>{row.open===null?"Sem controle de baixa":money(row.open)}</strong>
             <span style={{fontSize:11,color:"#67788e"}}>{row.dueDate?"Vence "+formatDay(row.dueDate):"Vencimento não informado"} · {statuses[row.status]}</span>
           </button>)}
           {!column.rows.length?<p style={{fontSize:11,color:"#7a8797"}}>Nenhuma conta nesta situação.</p>:null}
         </section>)}
       </div>
     </div>:null}
     {tab==="cashflow"?<div style={{display:"grid",gap:12}}>
       <strong>Fluxo de caixa operacional</strong>
       <p style={{margin:0,fontSize:11,color:"#64748b"}}>Entradas e saídas registradas, sem conciliação bancária. Vendas a prazo entram somente quando recebidas; despesas antigas sem baixa comprovada não são tratadas como pagas.</p>
       <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:9}}>
         {[{label:"Entradas realizadas",v:report.realizedIn},{label:"Saídas realizadas",v:report.realizedOut},
           {label:"Diferença operacional",v:report.netRealized},{label:"A receber previsto",v:report.forecastIn},{label:"A pagar previsto",v:report.forecastOut}]
           .map(x=><div key={x.label} style={styleBox}><small>{x.label}</small><strong>{money(x.v)}</strong></div>)}
       </div>
       {report.daily.length?<div style={{display:"grid",gap:9}}>{report.daily.slice(-40).map(day=><div key={day.day} style={{display:"grid",gap:4}}>
         <span style={{fontSize:11}}>{formatDay(day.day)} · {money(day.in)} entradas / {money(day.out)} saídas</span>
         <div style={{display:"flex",gap:2,height:9}}>
           <div style={{width:Math.max(0,Math.min(100,day.in/Math.max(1,day.in+day.out)*100))+"%",background:"#278269",borderRadius:3}}/>
           <div style={{width:Math.max(0,Math.min(100,day.out/Math.max(1,day.in+day.out)*100))+"%",background:"#b45e57",borderRadius:3}}/>
         </div>
       </div>)}</div>:<p style={{fontSize:12,color:"#64748b"}}>Não há movimentações confirmadas no período informado.</p>}
       <small>{report.missingDueDates} obrigação(ões) sem vencimento · {report.untrackedExpenses} despesa(s) históricas sem baixa rastreada.</small>
     </div>:null}
     {tab==="audit"?<div style={{display:"grid",gap:10}}>
       <strong>Auditoria financeira — eventos de origem</strong>
       <p style={{margin:0,fontSize:11,color:"#64748b"}}>Eventos derivados do histórico canônico. Para dados legados sem identificação, o operador aparece como não registrado; não há edição de eventos nesta tela.</p>
       <div style={{overflow:"auto",maxHeight:520,border:"1px solid #e3eaf2",borderRadius:8}}>
         <table data-pdv-finance-audit="true" style={{width:"100%",minWidth:740,borderCollapse:"collapse",fontSize:12}}>
           <thead><tr>{["Data","Evento","Documento","Operador","Valor","Forma"].map(t=>
             <th key={t} style={{...moneyTableCell,textAlign:"left",background:"#eef3f9",position:"sticky",top:0}}>{t}</th>)}</tr></thead>
           <tbody>{audit.filter(e=>{
              const day=e.performedAt.slice(0,10);
              return (!filters.from||day>=filters.from)&&(!filters.to||day<=filters.to);
            }).map(event=><tr key={event.id}>
             <td style={{...moneyTableCell,textAlign:"left"}}>{event.performedAt}</td>
             <td style={{...moneyTableCell,textAlign:"left"}}>{event.action}</td>
             <td style={{...moneyTableCell,textAlign:"left"}}>{event.referenceId}</td>
             <td style={{...moneyTableCell,textAlign:"left"}}>{event.operatorName??"Não registrado (legado)"}</td>
             <td style={{...moneyTableCell,textAlign:"left"}}>{event.amount===undefined?"—":money(event.amount)}</td>
             <td style={{...moneyTableCell,textAlign:"left"}}>{event.method??"—"}</td>
            </tr>)}</tbody>
         </table>
       </div>
     </div>:null}
     {tab==="reports"?<div style={{display:"grid",gap:13}}>
       <div style={{...rowLayout,justifyContent:"space-between"}}>
         <strong>Relatórios financeiros e exportação local</strong>
         <div style={rowLayout}>
           <button type="button" onClick={()=>exportReport("csv")} style={compactButton}>CSV</button>
           <button type="button" onClick={()=>exportReport("xlsx")} style={compactButton}>Excel XLSX</button>
           <button type="button" onClick={()=>exportReport("pdf")} style={compactButton}>PDF</button>
         </div>
       </div>
       {exportError?<p role="alert" style={{color:"#9b2525"}}>{exportError}</p>:null}
       <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:10}}>
         {[{name:"Entradas confirmadas",v:report.realizedIn},{name:"Saídas confirmadas",v:report.realizedOut},
           {name:"Previsão a receber",v:report.forecastIn},{name:"Previsão a pagar",v:report.forecastOut}]
           .map(item=><div key={item.name} style={styleBox}><small>{item.name}</small><strong>{money(item.v)}</strong></div>)}
       </div>
       <div style={{overflowX:"auto"}}><table style={{width:"100%",minWidth:460,borderCollapse:"collapse",fontSize:12}}>
         <thead><tr><th style={{...moneyTableCell,textAlign:"left"}}>Categoria de despesa</th><th style={moneyTableCell}>Registrado</th><th style={moneyTableCell}>Pendente comprovado</th></tr></thead>
         <tbody>{report.categories.map(c=><tr key={c.category}>
           <td style={{...moneyTableCell,textAlign:"left"}}>{c.category}</td><td style={moneyTableCell}>{money(c.registered)}</td>
           <td style={moneyTableCell}>{c.pending===null?"Incompleto":money(c.pending)}</td></tr>)}
         {!report.categories.length?<tr><td colSpan={3} style={{padding:15}}>Nenhuma despesa registrada.</td></tr>:null}</tbody>
       </table></div>
       <p style={{fontSize:11,color:"#64748b",margin:0}}>Relatório gerencial, não fiscal. Diferença operacional não representa saldo bancário nem lucro líquido. Valores sem custo histórico não entram em margem afirmada.</p>
     </div>:null}
   </div>
   {selected?<PdvGuidedDialog title="Origem do valor financeiro" description="Dados diretamente associados ao documento canônico, sem alterar o histórico."
     step={labels[selected.kind]+" · "+selected.reference} onClose={()=>setDetail(null)}
     actions={<><button type="button" style={guidedSecondaryStyle} onClick={()=>setDetail(null)}>Fechar</button>
       {selected.open!==null&&selected.open>0?<button type="button" style={guidedPrimaryStyle} onClick={()=>launch(selected)}>Registrar baixa deste documento</button>:null}</>}>
     <div style={{...styleBox,background:"#f7fbff"}}>
       <strong>{selected.party}</strong>
       <span style={{fontSize:12}}>Documento: {selected.reference}{selected.installmentLabel?" · Parcela "+selected.installmentLabel:""}</span>
       <span style={{fontSize:12}}>Vencimento: {formatDay(selected.dueDate)}</span>
       <span style={{fontSize:12}}>Valor original: <strong>{money(selected.original)}</strong></span>
       <span style={{fontSize:12}}>Liquidado: <strong>{selected.settled===null?"Não controlado":money(selected.settled)}</strong></span>
       <span style={{fontSize:12}}>Em aberto: <strong>{selected.open===null?"Não controlado":money(selected.open)}</strong></span>
     </div>
     <strong style={{fontSize:13}}>Histórico das baixas ({selected.sources.length})</strong>
     {sources(selected)}
   </PdvGuidedDialog>:null}
 </section>;
}
