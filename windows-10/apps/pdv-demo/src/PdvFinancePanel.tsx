import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  purchaseOpenBalance, saleOpenBalance, registerExpense, settlePayable, settleReceivable, summarizeCommercial,
  type CommercialLedger, type CommercialSale, type CommercialExpense
} from "./commercialLedger";
import {
  buildPdvFinanceRows, filterPdvFinanceRows, type PdvFinanceFilters, type PdvFinanceRow, type PdvFinanceKind
} from "./financeMatrix";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const numberInput = (raw: string) => {
  const value = raw.trim();
  return Number(value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value);
};
const box: CSSProperties = { display: "grid", gap: 11, padding: 16, background: "#fff", border: "1px solid #dce4ee", borderRadius: 10 };
const field: CSSProperties = { padding: "10px 11px", minHeight: 40, minWidth: 0, flex: "1 1 160px", border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff", color: "#17253c" };
const button: CSSProperties = { padding: "10px 14px", background: "#1d4ed8", color: "#fff", border: 0, borderRadius: 7, fontWeight: 700, minHeight: 40, cursor: "pointer" };
const flex: CSSProperties = { display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" };
const column: CSSProperties = { padding: "11px 10px", borderBottom: "1px solid #e9eef4", textAlign: "right", whiteSpace: "nowrap" };
const labels: Record<PdvFinanceKind, string> = {payable:"Conta a pagar", receivable:"Conta a receber", expense:"Despesa registrada"};
const statusLabels = {pendente:"Pendente",parcial:"Parcial",liquidada:"Liquidada",registrada:"Registrada"};
type Detail = { key: string; column: string };
type Props = {
  ledger: CommercialLedger;
  sales: CommercialSale[];
  creditMethods: string[];
  customers?: ReadonlyArray<{id:string; name:string}>;
  allowed: boolean;
  onLedgerChange: (next: CommercialLedger) => void;
};

/** Financeiro de leitura canônica: matricial, com fonte de cada valor clicável. */
export function PdvFinancePanel({ledger,sales,creditMethods,customers,allowed,onLedgerChange}: Props) {
  const [filters,setFilters] = useState<PdvFinanceFilters>({kind:"all",status:"all",search:"",from:"",to:""});
  const [detail,setDetail] = useState<Detail | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [message,setMessage] = useState("");
  const [settlementKind,setSettlementKind] = useState<"purchase" | "sale">("purchase");
  const [settlementReference,setSettlementReference] = useState("");
  const [settlementAmount,setSettlementAmount] = useState("");
  const [settlementMethod,setSettlementMethod] = useState("PIX");
  const [expenseDescription,setExpenseDescription] = useState("");
  const [expenseAmount,setExpenseAmount] = useState("");
  const [expenseCategory,setExpenseCategory] = useState("Operacional");

  const summary = useMemo(() => summarizeCommercial({ledger,sales,creditMethods}),[ledger,sales,creditMethods]);
  const rows = useMemo(() => buildPdvFinanceRows({ledger,sales,creditMethods,customers}),[ledger,sales,creditMethods,customers]);
  const filtered = useMemo(() => filterPdvFinanceRows(rows,filters),[rows,filters]);
  const selected = detail ? rows.find(row => row.key === detail.key) : undefined;
  const payables = useMemo(() => ledger.purchases.filter(p => purchaseOpenBalance(ledger,p)>0),[ledger]);
  const receivables = useMemo(() => sales.filter(s => saleOpenBalance(ledger,s,creditMethods)>0),[ledger,sales,creditMethods]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (detail && !dialog.open) dialog.showModal();
    if (!detail && dialog.open) dialog.close();
  },[detail]);

  const protect = (operation: () => void) => {
    if (!allowed) {setMessage("Seu perfil não tem permissão para alterar o financeiro.");return;}
    try {operation();setMessage("Lançamento registrado na sessão e enviado para persistência local.");}
    catch (error) {setMessage(error instanceof Error ? error.message : "Não foi possível registrar a operação.");}
  };

  const settle = () => protect(() => {
    const payment = {id:`PAG-${crypto.randomUUID()}`,referenceId:settlementReference,amount:numberInput(settlementAmount),
      method:settlementMethod,paidAt:new Date().toISOString()};
    const next = settlementKind === "purchase" ? settlePayable(ledger,payment)
      : settleReceivable(ledger,payment,sales,creditMethods);
    onLedgerChange(next);
    setSettlementAmount("");
  });
  const expense = () => protect(() => {
    const row: CommercialExpense = {id:`DES-${crypto.randomUUID()}`,description:expenseDescription,
      category:expenseCategory,amount:numberInput(expenseAmount),occurredAt:new Date().toISOString()};
    onLedgerChange(registerExpense(ledger,row));
    setExpenseDescription("");
    setExpenseAmount("");
  });

  const goToSettlement = (row: PdvFinanceRow) => {
    if (!allowed || !row.open || row.kind === "expense") return;
    setSettlementKind(row.kind === "payable" ? "purchase" : "sale");
    setSettlementReference(row.reference);
    setDetail(null);
    document.getElementById("pdv-finance-settlement")?.scrollIntoView({block:"center",behavior:"smooth"});
  };

  const fields: Array<{key:string;name:string;value:(row:PdvFinanceRow)=>string}> = [
    {key:"original",name:"Valor original",value:row=>money(row.original)},
    {key:"settled",name:"Liquidado",value:row=>row.settled===null?"—":money(row.settled)},
    {key:"open",name:"Em aberto",value:row=>row.open===null?"—":money(row.open)}
  ];
  const updateFilter = <K extends keyof PdvFinanceFilters>(key: K, value: PdvFinanceFilters[K]) =>
    setFilters(current => ({...current,[key]:value}));

  return <section data-pdv-finance-panel="true" style={{display:"grid",gap:14}}>
    <div style={{...flex,justifyContent:"space-between"}}>
      <div><strong style={{fontSize:15}}>Visão financeira</strong>
        <p style={{margin:"4px 0 0",fontSize:12,color:"#64748b"}}>Saldos derivados das compras e vendas originais. Nenhuma conta paralela.</p></div>
      <span style={{fontSize:11,color:"#536781"}}>Funcionamento offline · SQLite canônico</span>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:10}}>
      {[
        {label:"A pagar",value:summary.payableOpen},
        {label:"A receber",value:summary.receivableOpen},
        {label:"Despesas registradas",value:summary.expensesTotal}
      ].map(item=><div key={item.label} style={box}><span style={{fontSize:11,color:"#617187"}}>{item.label}</span>
        <strong style={{fontSize:22,color:"#17253c",fontVariantNumeric:"tabular-nums"}}>{money(item.value)}</strong></div>)}
    </div>
    <p style={{fontSize:11,color:"#64748b",margin:0}}>Os indicadores acima representam todo o histórico disponível. Os filtros abaixo atuam apenas sobre a matriz.</p>

    <div style={box}>
      <div style={{...flex,justifyContent:"space-between"}}>
        <div><h3 style={{margin:0,fontSize:16}}>Matriz financeira</h3>
          <p style={{margin:"4px 0 0",fontSize:11,color:"#64748b"}}>Clique no nome ou em um valor para consultar a origem e as baixas.</p></div>
        <span style={{fontSize:12,color:"#64748b"}}>{filtered.length} lançamento(s)</span>
      </div>
      <div style={flex} aria-label="Filtros da matriz financeira">
        <input aria-label="Buscar lançamento" placeholder="Buscar cliente, fornecedor ou documento" style={{...field,flex:"2 1 240px"}}
          value={filters.search} onChange={event=>updateFilter("search",event.target.value)}/>
        <select aria-label="Tipo do lançamento" style={field} value={filters.kind} onChange={event=>updateFilter("kind",event.target.value as PdvFinanceFilters["kind"])}>
          <option value="all">Todos os tipos</option><option value="payable">A pagar</option><option value="receivable">A receber</option><option value="expense">Despesas</option>
        </select>
        <select aria-label="Situação financeira" style={field} value={filters.status} onChange={event=>updateFilter("status",event.target.value as PdvFinanceFilters["status"])}>
          <option value="all">Todas as situações</option><option value="pendente">Pendente</option><option value="parcial">Parcial</option>
          <option value="liquidada">Liquidada</option><option value="registrada">Registrada</option>
        </select>
        <label style={{display:"grid",gap:3,fontSize:11,color:"#64748b"}}>De <input aria-label="Data inicial" type="date" value={filters.from} onChange={event=>updateFilter("from",event.target.value)} style={field}/></label>
        <label style={{display:"grid",gap:3,fontSize:11,color:"#64748b"}}>Até <input aria-label="Data final" type="date" value={filters.to} onChange={event=>updateFilter("to",event.target.value)} style={field}/></label>
        <button type="button" style={{...button,background:"#e7eef9",color:"#184e9e"}} onClick={()=>setFilters({kind:"all",status:"all",search:"",from:"",to:""})}>Limpar filtros</button>
      </div>
      <div style={{overflowX:"auto",border:"1px solid #e5ebf2",borderRadius:8,maxHeight:470,overflowY:"auto"}}>
        <table style={{width:"100%",minWidth:870,borderCollapse:"separate",borderSpacing:0,fontSize:12,fontVariantNumeric:"tabular-nums"}}>
          <thead><tr>{["Lançamento","Natureza",...fields.map(f=>f.name),"Vencimento","Situação"].map((heading,i)=><th key={heading}
            style={{...column,textAlign:i<2?"left":"right",position:"sticky",top:0,left:i===0?0:undefined,zIndex:i===0?4:2,
              background:"#f0f5fb",color:"#344864",fontWeight:800}}>{heading}</th>)}</tr></thead>
          <tbody>{filtered.map(row=><tr key={row.key}>
            <td style={{...column,textAlign:"left",position:"sticky",left:0,zIndex:1,background:"#fff",minWidth:195}}>
              <button type="button" style={{border:0,background:"none",cursor:"pointer",padding:2,textAlign:"left",color:"#174a91"}}
                title="Abrir origem do lançamento" onClick={()=>setDetail({key:row.key,column:"document"})}>
                <strong style={{display:"block",fontSize:12}}>{row.party}</strong>
                <small style={{display:"block",marginTop:3,color:"#6a7a90"}}>{row.reference}</small>
              </button>
            </td>
            <td style={{...column,textAlign:"left"}}>{labels[row.kind]}</td>
            {fields.map(field=><td key={field.key} style={column}>{row[field.key as "original" | "settled" | "open"]===null?"—":
              <button type="button" title={`Ver origem: ${field.name} de ${row.reference}`} onClick={()=>setDetail({key:row.key,column:field.key})}
                style={{padding:"7px 4px",border:0,cursor:"pointer",background:"transparent",fontWeight:700,
                  color:field.key==="open"?"#1c5095":"#2b3b50"}}>{field.value(row)}</button>}</td>)}
            <td style={column}>{row.dueDate || "Não informado"}</td>
            <td style={column}><span style={{display:"inline-block",padding:"5px 8px",borderRadius:6,
              background:row.status==="liquidada"?"#e8f6ed":row.status==="parcial"?"#fff3d9":"#edf2f8",
              color:row.status==="liquidada"?"#21764a":"#3e5270",fontWeight:700}}>{statusLabels[row.status]}</span></td>
          </tr>)}
          {filtered.length===0?<tr><td colSpan={7} style={{padding:24,color:"#64748b",textAlign:"center"}}>
            Nenhum lançamento encontrado. Ajuste os filtros ou registre uma operação em Compras, Vendas ou Despesas.</td></tr>:null}
          </tbody>
        </table>
      </div>
      <p style={{margin:0,fontSize:11,color:"#64748b"}}>Despesas registradas ainda não possuem controle próprio de quitação: não são contadas como contas pendentes ou liquidadas. Vendas sem vencimento permanecem como “Não informado”.</p>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(290px,1fr))",gap:12}}>
      <div id="pdv-finance-settlement" style={box}>
        <strong>Registrar pagamento ou recebimento parcial</strong>
        <label style={{display:"grid",gap:4,fontSize:11}}>Operação
          <select aria-label="Natureza do lançamento" style={field} value={settlementKind} onChange={event=>{setSettlementKind(event.target.value as "purchase" | "sale");setSettlementReference("");}}>
            <option value="purchase">Pagar fornecedor</option><option value="sale">Receber venda a prazo</option>
          </select>
        </label>
        <label style={{display:"grid",gap:4,fontSize:11}}>Documento
          <select aria-label="Documento a liquidar" style={field} value={settlementReference} onChange={event=>setSettlementReference(event.target.value)}>
            <option value="">Escolha um documento com saldo aberto</option>
            {settlementKind==="purchase"?payables.map(p=><option key={p.id} value={p.id}>{p.id} · {money(purchaseOpenBalance(ledger,p))}</option>):
              receivables.map(s=><option key={s.number} value={s.number}>{s.number} · {money(saleOpenBalance(ledger,s,creditMethods))}</option>)}
          </select>
        </label>
        <div style={flex}>
          <input aria-label="Valor da baixa" style={field} value={settlementAmount} onChange={event=>setSettlementAmount(event.target.value)} placeholder="Valor (R$)" inputMode="decimal"/>
          <select style={field} aria-label="Forma de liquidação" value={settlementMethod} onChange={event=>setSettlementMethod(event.target.value)}>
            <option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option><option value="TRANSFERENCIA">Transferência</option><option value="CARTAO">Cartão</option>
          </select>
        </div>
        <button type="button" disabled={!allowed||!settlementReference} onClick={settle} style={{...button,opacity:allowed&&settlementReference?1:0.55}}>Registrar baixa</button>
        <small style={{color:"#64748b"}}>Baixas são adicionadas ao histórico e não alteram o valor original do documento.</small>
      </div>
      <div style={box}>
        <strong>Registrar despesa operacional</strong>
        <input style={field} aria-label="Descrição da despesa" placeholder="Descrição *" value={expenseDescription} onChange={event=>setExpenseDescription(event.target.value)}/>
        <input style={field} aria-label="Categoria da despesa" placeholder="Categoria" value={expenseCategory} onChange={event=>setExpenseCategory(event.target.value)}/>
        <input style={field} aria-label="Valor da despesa" inputMode="decimal" placeholder="Valor (R$)" value={expenseAmount} onChange={event=>setExpenseAmount(event.target.value)}/>
        <button type="button" disabled={!allowed} style={{...button,opacity:allowed?1:0.55}} onClick={expense}>Registrar despesa</button>
      </div>
    </div>
    {message?<p role="status" style={{padding:11,borderRadius:7,background:"#eff6ff",color:"#1e40af",margin:0}}>{message}</p>:null}
    <div style={box}><strong>Últimas baixas</strong>
      {ledger.settlements.slice(-20).reverse().length?ledger.settlements.slice(-20).reverse().map(item=><div key={item.id}
        style={{...flex,justifyContent:"space-between",borderTop:"1px solid #e5ebf2",paddingTop:9}}>
        <span style={{fontSize:12}}>{item.kind==="purchase"?"Pagamento":"Recebimento"} · {item.referenceId}
          <small style={{display:"block",color:"#64748b",marginTop:3}}>{item.method} · {item.paidAt}</small></span>
        <strong>{money(item.amount)}</strong>
      </div>):<p style={{margin:0,color:"#64748b",fontSize:12}}>Nenhuma baixa registrada.</p>}
    </div>
    <dialog ref={dialogRef} onClose={()=>setDetail(null)} aria-label="Origem do valor financeiro"
      style={{width:"min(94vw,530px)",maxHeight:"85vh",padding:22,border:"1px solid #cbd5e1",borderRadius:12,boxShadow:"0 16px 60px rgba(15,23,42,.22)",color:"#17253c"}}>
      {selected?<div style={{display:"grid",gap:14}}>
        <div style={{...flex,justifyContent:"space-between"}}>
          <div><h3 style={{margin:0,fontSize:18}}>Origem do valor</h3>
            <p style={{margin:"4px 0 0",fontSize:12,color:"#64748b"}}>{labels[selected.kind]} · {selected.reference}</p></div>
          <button type="button" aria-label="Fechar detalhe" onClick={()=>setDetail(null)} style={{...button,background:"#edf2f8",color:"#23334b"}}>Fechar</button>
        </div>
        <div style={{...box,background:"#f8fbff"}}>
          <strong>{selected.party}</strong>
          <span style={{fontSize:12}}>Origem: {selected.kind==="payable"?"Compra recebida":selected.kind==="receivable"?"Venda a prazo":"Despesa registrada"}</span>
          <span style={{fontSize:12}}>Data do registro: {selected.date}</span>
          <span style={{fontSize:12}}>Vencimento: {selected.dueDate||"Não informado"}</span>
          <span style={{fontSize:12}}>Valor original: <strong>{money(selected.original)}</strong></span>
          {selected.open!==null?<span style={{fontSize:12}}>Saldo em aberto: <strong>{money(selected.open)}</strong></span>:<small>Despesa sem informação de quitação.</small>}
        </div>
        <strong style={{fontSize:13}}>Histórico de baixas ({selected.sources.length})</strong>
        {selected.sources.length?selected.sources.map(source=><div key={source.id} style={{...box,padding:10}}>
          <strong>{money(source.amount)} · {source.method}</strong>
          <span style={{fontSize:11,color:"#64748b"}}>{source.id} · {source.paidAt}</span>
        </div>):<p style={{margin:0,color:"#64748b",fontSize:12}}>Nenhuma baixa vinculada a este documento.</p>}
        {selected.kind!=="expense"&&selected.open!==null&&selected.open>0?
          <button type="button" disabled={!allowed} style={{...button,opacity:allowed?1:0.55}} onClick={()=>goToSettlement(selected)}>
            Abrir registro de baixa
          </button>:null}
      </div>:null}
    </dialog>
  </section>;
}
