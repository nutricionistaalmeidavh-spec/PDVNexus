import {
  settlePayable, settleReceivable, settleExpense, type CommercialLedger, type CommercialSale,
  type CommercialFinanceAction, type CommercialSettlement
} from "./commercialLedger";
import {buildPdvFinanceRows,buildPdvFinanceKanban,type PdvKanbanColumnId} from "./financeMatrix";

export type PdvFinanceMoveInput={
  ledger:CommercialLedger;
  sales:CommercialSale[];
  creditMethods:string[];
  rowKey:string;
  target:PdvKanbanColumnId;
  today:string;
  now:string;
  eventId:string;
  allowed:boolean;
  operator:{id:string;name:string};
  amount?:number;
  method?:string;
  dueDate?:string;
  reason?:string;
  /** An old expense has no reliable paid status. Operator must verify and explicitly acknowledge it is unpaid. */
  assumeUnpaid?:boolean;
};
export type PdvFinanceMoveResult={
  ledger:CommercialLedger;
  sales:CommercialSale[];
  creditMethods:string[];
};
const money=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
function validDate(day:string|undefined):day is string {
  if(!day||!/^(\d{4})-(\d{2})-(\d{2})$/.test(day))return false;
  const [year,month,date]=day.split("-").map(Number);
  return year>=2000&&month>=1&&month<=12&&date>=1&&date<=new Date(Date.UTC(year,month,0)).getUTCDate();
}
function appendAction(ledger:CommercialLedger,action:CommercialFinanceAction):CommercialLedger {
  return {...ledger,financeActions:[...(ledger.financeActions??[]),action]};
}
/**
 * Treat drag/drop as a request to edit canonical financial data, not a local board status.
 * Throws for impossible or unsafe transitions. No writes are returned unless the recomputed
 * board actually contains the title in the requested destination.
 */
export function applyPdvFinanceKanbanMove(input:PdvFinanceMoveInput):PdvFinanceMoveResult {
  const {rowKey,target,today,now,eventId,operator}=input;
  if(!input.allowed||!operator?.id?.trim()||!operator?.name?.trim())
    throw new Error("Operação sem permissão: autentique um gerente antes de alterar o Financeiro.");
  if(!eventId?.trim()||!now?.trim()||!validDate(today))throw new Error("Identificação ou data da operação inválida.");
  if(input.ledger.settlements.some(x=>x.id===eventId)||
     (input.ledger.financeActions??[]).some(x=>x.id===eventId||x.id===eventId+":TRACK"))
    throw new Error("Evento duplicado; nenhuma alteração foi aplicada.");
  const previous=buildPdvFinanceRows(input).find(x=>x.key===rowKey);
  if(!previous)throw new Error("Lançamento canônico não encontrado ou atualizado. Reabra o Kanban.");
  const from=buildPdvFinanceKanban([previous],today).find(c=>c.rows.length)?.id;
  if(from===target)throw new Error("O lançamento já está nessa coluna.");
  if(previous.open===0)throw new Error("Conta liquidada: para reabrir é necessário estorno formal de uma baixa. O Kanban não apaga pagamentos.");
  if(target==="registradas")throw new Error("Não é permitido remover rastreamento de pagamento ou transformar uma conta em histórica.");
  let ledger=input.ledger, sales=input.sales;
  const installmentNumber=previous.installmentLabel?Number(previous.installmentLabel.split("/")[0]):undefined;
  const baseAction:Pick<CommercialFinanceAction,"id"|"kind"|"referenceId"|"performedAt"|"operatorId"|"operatorName">={id:eventId,kind:previous.kind==="payable"?"purchase":previous.kind==="receivable"?"sale":"expense",
    referenceId:previous.reference,performedAt:now,operatorId:operator.id,operatorName:operator.name};
  const textReason=input.reason?.trim();
  if(previous.status==="registrada"){
    if(previous.kind!=="expense")throw new Error("Lançamento histórico incompatível.");
    if(!input.assumeUnpaid)throw new Error("Despesa histórica: confirme que não foi paga após verificar os comprovantes.");
    if(!validDate(input.dueDate))throw new Error("Informe vencimento real para habilitar controle da despesa histórica.");
    if(!textReason)throw new Error("Informe motivo da regularização histórica.");
    ledger={...ledger,expenses:ledger.expenses.map(e=>e.id===previous.reference?
      {...e,trackPayment:true,dueDate:input.dueDate}:e)};
    ledger=appendAction(ledger,{...baseAction,id:eventId+":TRACK",action:"tracking-enabled",
      reason:textReason,previousDueDate:previous.dueDate,dueDate:input.dueDate});
  }
  if(target==="liquidadas"||target==="parciais"){
    const current=buildPdvFinanceRows({ledger,sales,creditMethods:input.creditMethods}).find(x=>x.key===rowKey);
    const open=current?.open;
    if(open===null||open===undefined||open<=0)throw new Error("Não há saldo devedor comprovado para baixar.");
    const value=money(input.amount??NaN);
    if(!Number.isFinite(value)||value<=0||value>open)
      throw new Error("Valor da baixa inválido ou superior ao saldo em aberto.");
    if(target==="liquidadas"&&value!==money(open))
      throw new Error("Para a coluna Liquidada, confirme a baixa integral do saldo.");
    if(target==="parciais"&&value>=money(open))
      throw new Error("Para a coluna Parciais, o pagamento deve ser menor que o saldo.");
    if(!input.method?.trim())throw new Error("Informe a forma de pagamento efetivamente utilizada.");
    const payment:Omit<CommercialSettlement,"kind">={
      id:eventId,referenceId:previous.reference,amount:value,paidAt:now,method:input.method,
      operatorId:operator.id,operatorName:operator.name,
      ...(installmentNumber===undefined?{}:{installmentNumber})
    };
    ledger=previous.kind==="payable"?settlePayable(ledger,payment):
      previous.kind==="expense"?settleExpense(ledger,payment):
      settleReceivable(ledger,payment,sales,input.creditMethods);
  } else {
    if(previous.status==="parcial")
      throw new Error("Conta com baixa parcial: o Kanban não remove pagamentos para alterar de coluna. Regularize o vencimento no documento, ou liquide o saldo.");
    let day:string|undefined;
    if(target==="vencidas"||target==="a_vencer"){
      day=input.dueDate;
      if(!validDate(day))throw new Error("Informe um vencimento real e válido.");
      if(target==="vencidas"&&day>=today)throw new Error("Data de vencimento deve ser anterior a hoje para Vencidas.");
      if(target==="a_vencer"&&day<today)throw new Error("Data de vencimento deve ser hoje ou posterior para A vencer.");
    }else if(target==="sem_vencimento"){
      if(previous.kind==="expense")throw new Error("Despesa controlada exige vencimento. Não remova o rastreamento.");
      if(installmentNumber!==undefined)throw new Error("Parcela do crediário exige vencimento. Não remova a data desta parcela.");
      day=undefined;
    }else throw new Error("Coluna não aceita para alteração financeira.");
    if(day===previous.dueDate && previous.status!=="registrada")throw new Error("Informe um vencimento diferente do atual.");
    if(!textReason)throw new Error("Informe o motivo da mudança de vencimento.");
    if(previous.kind==="payable"){
      ledger={...ledger,purchases:ledger.purchases.map(p=>p.id===previous.reference?{...p,dueDate:day}:p)};
    } else if(previous.kind==="expense"){
      ledger={...ledger,expenses:ledger.expenses.map(e=>e.id===previous.reference?{...e,dueDate:day}:e)};
    } else {
      sales=sales.map(s=>{
        if(s.number!==previous.reference)return s;
        if(installmentNumber!==undefined && s.installments?.length)
          return {...s,installments:s.installments.map(i=>i.number===installmentNumber?{...i,dueDate:day!}:i),
            ...(installmentNumber===1?{dueDate:day}: {})};
        return {...s,dueDate:day};
      });
    }
    ledger=appendAction(ledger,{...baseAction,action:"due-date-updated",reason:textReason,
      installmentNumber,previousDueDate:previous.dueDate,dueDate:day});
  }
  const next:PdvFinanceMoveResult={ledger,sales,creditMethods:input.creditMethods};
  const moved=buildPdvFinanceRows(next).find(r=>r.key===rowKey);
  if(!moved||buildPdvFinanceKanban([moved],today).find(c=>c.rows.length)?.id!==target)
    throw new Error("A alteração não produz a coluna solicitada; nenhuma gravação foi confirmada.");
  return next;
}
