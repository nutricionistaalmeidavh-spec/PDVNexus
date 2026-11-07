import { buildWorkbookXlsx, type WorkbookTable } from "./reportDocuments";
import type { PdvFinanceRow } from "./financeMatrix";
import type { PdvFinanceReport } from "./financeReporting";

const fixed=(n:number)=>Number.isFinite(n)?Number(n.toFixed(2)):0;
const money=(n:number)=>"R$ "+n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const nameFor=(row:PdvFinanceRow)=>row.kind==="payable"?"Conta a pagar":row.kind==="receivable"?"Conta a receber":"Despesa";

export function buildPdvFinanceXlsx(rows:readonly PdvFinanceRow[],report:PdvFinanceReport):Uint8Array {
 const tables:WorkbookTable[]=[
  {name:"Resumo",headers:["Indicador","Valor"],widths:[42,24],moneyColumns:[2],rows:[
   ["Entradas realizadas",fixed(report.realizedIn)],["Saídas realizadas",fixed(report.realizedOut)],
   ["Diferença operacional",fixed(report.netRealized)],["Previsão a receber",fixed(report.forecastIn)],
   ["Previsão a pagar",fixed(report.forecastOut)],["Obrigações sem vencimento",report.missingDueDates],
   ["Despesas sem controle histórico",report.untrackedExpenses]
  ]},
  {name:"Lançamentos",headers:["Natureza","Documento","Cliente / fornecedor","Data","Vencimento",
     "Valor original","Liquidado","Em aberto","Situação"],widths:[20,20,38,22,18,19,19,19,18],
     moneyColumns:[6,7,8],rows:rows.map(r=>[nameFor(r),r.reference,r.party,r.date,r.dueDate??"Não informado",
       fixed(r.original),r.settled===null?"Não controlado":fixed(r.settled),r.open===null?"Não controlado":fixed(r.open),r.status])},
  {name:"Baixas",headers:["Documento","Baixa","Data","Forma","Valor"],widths:[20,26,25,23,18],moneyColumns:[5],
     rows:rows.flatMap(row=>row.sources.map(s=>[row.reference,s.id,s.paidAt,s.method,fixed(s.amount)]))},
  {name:"Fluxo realizado",headers:["Data","Entradas","Saídas","Diferença"],widths:[20,23,23,23],moneyColumns:[2,3,4],
     rows:report.daily.map(day=>[day.day,fixed(day.in),fixed(day.out),fixed(day.net)])},
  {name:"Despesas por categoria",headers:["Categoria","Valor registrado","Saldo pendente identificado"],widths:[34,23,34],moneyColumns:[2,3],
     rows:report.categories.map(cat=>[cat.category,fixed(cat.registered),cat.pending===null?"Incompleto":fixed(cat.pending)])}
 ];
 return buildWorkbookXlsx(tables);
}

const enc=new TextEncoder();
const utf8=(s:string)=>enc.encode(s);
const specials:Record<string,number>={"€":128,"“":147,"”":148,"•":149,"–":150,"—":151,"’":146};
const winAnsiHex=(raw:string)=>{
 let hex="";
 for(const char of raw){
  const n=char.codePointAt(0)??63;
  const code=n<=127||(n>=160&&n<=255)?n:(specials[char]??63);
  hex+=code.toString(16).padStart(2,"0");
 }
 return hex.toUpperCase();
};
function pdfLine(text:string,x:number,y:number,size=9,bold=false):string {
 return `BT /${bold?"F2":"F1"} ${size} Tf 1 0 0 1 ${x} ${y} Tm <${winAnsiHex(text)}> Tj ET`;
}
const short=(value:string,n:number)=>value.length>n?value.slice(0,n-3)+"...":value;
type PdfPage={commands:string[]};
/** Offline, paginated A4 PDF with explicit financial-report scope (not fiscal or bank reconciliation). */
export function buildPdvFinancePdf(rows:readonly PdvFinanceRow[],report:PdvFinanceReport,storeName:string):Uint8Array {
 const pages:PdfPage[]=[];
 const addPage=()=>{
  const page:PdfPage={commands:[]};
  pages.push(page);
  page.commands.push(pdfLine(short(storeName||"PDV Nexus",57),40,795,16,true));
  page.commands.push(pdfLine("RELATÓRIO FINANCEIRO GERENCIAL",40,770,12,true));
  page.commands.push(pdfLine("Entradas: "+money(report.realizedIn)+"   Saídas: "+money(report.realizedOut)+"   Diferença: "+money(report.netRealized),40,750,10));
  page.commands.push(pdfLine("A receber: "+money(report.forecastIn)+"   A pagar: "+money(report.forecastOut),40,734,10));
  page.commands.push(pdfLine("Documento | Origem | Saldo em aberto | Vencimento",40,712,9,true));
  page.commands.push("0.8 G 0.6 w 40 704 m 555 704 l S");
  return page;
 };
 let page=addPage(),y=684;
 for(const r of rows){
  if(y<74){page=addPage();y=684;}
  page.commands.push(pdfLine(short(r.reference+" | "+r.party,66),40,y,9,true));
  const right=r.open===null?"não controlado":money(r.open);
  page.commands.push(pdfLine(short(nameFor(r)+" | "+right+" | "+(r.dueDate??"sem vencimento"),85),40,y-13,8));
  page.commands.push("0.87 G 0.5 w 40 "+(y-21)+" m 555 "+(y-21)+" l S");
  y-=36;
 }
 if(!rows.length)page.commands.push(pdfLine("Nenhum lançamento para os filtros selecionados.",40,y,10));
 for(let i=0;i<pages.length;i++){
  pages[i].commands.push(pdfLine("Página "+(i+1)+" de "+pages.length+" · Fluxo operacional, não saldo bancário nem documento fiscal.",40,35,7));
  pages[i].commands.push(pdfLine(report.untrackedExpenses+" despesa(s) históricas sem baixa rastreada · "+report.missingDueDates+" obrigação(ões) sem vencimento.",40,24,7));
 }
 const objects:string[]=[
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids ["+pages.map((_,i)=>(5+2*i)+" 0 R").join(" ")+"] /Count "+pages.length+" >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
 ];
 for(let i=0;i<pages.length;i++){
  const pageNo=5+2*i,contentNo=pageNo+1;
  objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents "+contentNo+" 0 R >>");
  const stream=pages[i].commands.join("\n")+"\n";
  objects.push("<< /Length "+utf8(stream).length+" >>\nstream\n"+stream+"endstream");
 }
 const pieces:Uint8Array[]=[utf8("%PDF-1.4\n")],offsets:number[]=[0];
 let offset=pieces[0].length;
 for(let i=0;i<objects.length;i++){
  offsets.push(offset);
  const b=utf8((i+1)+" 0 obj\n"+objects[i]+"\nendobj\n");pieces.push(b);offset+=b.length;
 }
 const xrefOffset=offset;
 const trailer="xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n"
  +offsets.slice(1).map(n=>String(n).padStart(10,"0")+" 00000 n \n").join("")
  +"trailer\n<< /Size "+(objects.length+1)+" /Root 1 0 R >>\nstartxref\n"+xrefOffset+"\n%%EOF\n";
 pieces.push(utf8(trailer));
 const output=new Uint8Array(pieces.reduce((n,p)=>n+p.length,0));
 let cursor=0;for(const p of pieces){output.set(p,cursor);cursor+=p.length;}
 return output;
}
