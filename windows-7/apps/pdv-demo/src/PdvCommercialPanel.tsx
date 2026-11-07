import { useMemo, useState, type CSSProperties } from "react";
import {
  purchaseTotal, receivePurchase, registerPurchase, registerSupplier, saleGrossProfit, summarizeCommercial,
  type CommercialCatalogProduct, type CommercialLedger, type CommercialPurchase,
  type CommercialSale, type CommercialSupplier, type PurchaseLine
} from "./commercialLedger";
import { PdvFinancePanel } from "./PdvFinancePanel";
import type { PdvStockMovement } from "../../../packages/database/src/pdv";

type Props<P extends CommercialCatalogProduct> = {
  ledger: CommercialLedger;
  catalog: P[];
  movements: PdvStockMovement[];
  sales: CommercialSale[];
  creditMethods: string[];
  allowed: boolean;
  customers?: ReadonlyArray<{id:string;name:string}>;
  mode?: "gestao" | "financeiro";
  onLedgerChange: (next: CommercialLedger) => void;
  onPurchaseReceived: (change: { ledger: CommercialLedger; catalog: P[]; movements: PdvStockMovement[] }) => void;
};
const timestamp = () => new Date().toISOString();
const id = (prefix: string) => prefix + "-" + crypto.randomUUID();
const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const numberInput = (value: string) => {
  const text = value.trim();
  const n = Number(text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text);
  return n;
};
const box: CSSProperties = { background: "#fff", border: "1px solid #dae3ed", borderRadius: 9, padding: 14, display: "grid", gap: 10 };
const field: CSSProperties = { padding: "9px 10px", minHeight: 38, borderRadius: 6, border: "1px solid #cbd5e1", minWidth: 0, flex: "1 1 145px" };
const action: CSSProperties = { padding: "9px 13px", minHeight: 38, borderRadius: 6, background: "#1d4ed8", color: "#fff", border: 0, cursor: "pointer" };
const split: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" };
const table: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 520 };
const cell: CSSProperties = { padding: "9px", borderBottom: "1px solid #e2e8f0", textAlign: "left" };

function downloadCsv(rows: string[][], filename: string) {
  const csv = "\uFEFF" + rows.map((cells) => cells.map((v) => '"' + v.replace(/"/g, '""') + '"').join(";")).join("\r\n");
  const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

export function PdvCommercialPanel<P extends CommercialCatalogProduct>(props: Props<P>) {
  const { ledger, catalog, movements, sales, creditMethods, customers, allowed, mode = "gestao", onLedgerChange, onPurchaseReceived } = props;
  const [view, setView] = useState<"compras" | "financeiro" | "relatorios">("compras");
  const activeView = mode === "financeiro" ? "financeiro" : view;
  const [message, setMessage] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierDocument, setSupplierDocument] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [productCode, setProductCode] = useState(catalog[0]?.productCode ?? "");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLine[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [purchaseReference, setPurchaseReference] = useState("");
  const summary = useMemo(() => summarizeCommercial({ ledger, sales, creditMethods }), [ledger, sales, creditMethods]);
  const protect = (fn: () => void) => {
    if (!allowed) { setMessage("Seu perfil não tem permissão para alterar o financeiro."); return; }
    try { fn(); setMessage("Operação registrada para gravação no armazenamento local."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível concluir a operação."); }
  };
  const createSupplier = () => protect(() => {
    const next: CommercialSupplier = { id: id("FOR"), name: supplierName.trim(), document: supplierDocument.trim(), phone: supplierPhone.trim(), createdAt: timestamp() };
    onLedgerChange(registerSupplier(ledger, next));
    setSupplierName(""); setSupplierDocument(""); setSupplierPhone(""); setSupplierId(next.id);
  });
  const addPurchaseLine = () => protect(() => {
    const n = numberInput(quantity), cost = numberInput(unitCost);
    if (!catalog.some((p) => p.productCode === productCode && p.active !== false)) throw new Error("Selecione um produto cadastrado e ativo.");
    if (!Number.isFinite(n) || n <= 0 || !Number.isFinite(cost) || cost < 0) throw new Error("Quantidade deve ser positiva e custo não negativo.");
    if (purchaseLines.some((line) => line.productCode === productCode)) throw new Error("Produto já está na compra.");
    setPurchaseLines((previous) => [...previous, { productCode, quantity: n, unitCost: cost }]);
    setQuantity("1");setUnitCost("");
  });
  const savePurchase = () => protect(() => {
    const purchase: CommercialPurchase = {
      id: id("COM"), supplierId, orderedAt: timestamp(), dueDate: dueDate || undefined,
      status: "draft", items: purchaseLines,
      invoiceRef: purchaseReference.trim() || undefined
    };
    onLedgerChange(registerPurchase(ledger, purchase, catalog));
    setPurchaseLines([]);setPurchaseReference("");setDueDate("");
  });
  const receipt = (purchaseId: string) => protect(() => {
    onPurchaseReceived(receivePurchase({ ledger, catalog, movements, purchaseId, receivedAt: timestamp() }));
  });
  const tabs: Array<typeof view> = mode === "financeiro" ? [] : ["compras", "relatorios"];
  const tabLabel: Record<typeof view,string> = { compras:"Compras e fornecedores", financeiro:"Contas e despesas",
    relatorios:"Lucratividade" };

  return <section data-pdv-commercial-panel="true" style={{ display: "grid", gap: 14 }}>
    <div style={{ ...split, justifyContent: "space-between" }}>
      <div><h2 style={{ margin: 0 }}>{mode === "financeiro" ? "Financeiro" : "Gestão comercial"}</h2><p style={{ margin: "3px 0", fontSize: 12, color: "#64748b" }}>Dados comerciais associados ao mesmo cadastro e estoque do PDV. Sem saldos paralelos.</p></div>
      <div style={{ fontSize: 12, color: "#475569" }}>Armazenamento local canônico</div>
    </div>
    {mode === "gestao" ? <div style={split}>{tabs.map((t) => <button key={t} type="button" onClick={() => { setView(t);setMessage(""); }} aria-pressed={view === t}
      style={{ ...action, background: view === t ? "#1d4ed8" : "#e2e8f0", color: view === t ? "#fff" : "#0f172a" }}>{tabLabel[t]}</button>)}</div> : null}
    {message ? <div role="status" style={{ background: "#eef2ff", color: "#1e3a8a", padding: 10, borderRadius: 6 }}>{message}</div> : null}

    {activeView === "compras" ? <>
      <div style={box}><strong>Cadastrar fornecedor</strong><div style={split}>
        <input aria-label="Nome do fornecedor" style={field} placeholder="Razão social ou nome *" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
        <input style={field} placeholder="CNPJ/CPF (opcional)" value={supplierDocument} onChange={(e) => setSupplierDocument(e.target.value)} />
        <input style={field} placeholder="Telefone (opcional)" value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} />
        <button disabled={!allowed} onClick={createSupplier} style={action}>Salvar fornecedor</button>
      </div></div>
      <div style={box}><strong>Nova compra · adicionar itens</strong><div style={split}>
        <select aria-label="Fornecedor da compra" style={field} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">Selecione o fornecedor</option>
          {ledger.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <input style={field} type="date" aria-label="Vencimento da compra" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <input style={field} placeholder="Número da NF ou referência (opcional)" value={purchaseReference} onChange={(e) => setPurchaseReference(e.target.value)} />
      </div><div style={split}>
        <select aria-label="Produto da compra" style={field} value={productCode} onChange={(e) => setProductCode(e.target.value)}>
          {catalog.filter((p) => p.active !== false).map((p) => <option value={p.productCode} key={p.productCode}>{p.productCode} · {p.productName}</option>)}</select>
        <input aria-label="Quantidade da compra" style={field} placeholder="Quantidade" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <input aria-label="Custo unitário da compra" style={field} placeholder="Custo unitário (R$)" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
        <button disabled={!allowed} onClick={addPurchaseLine} style={action}>Adicionar item</button>
      </div>
        {purchaseLines.map((line) => <div key={line.productCode} style={split}><span style={{ flex: 1 }}>{catalog.find((p) => p.productCode === line.productCode)?.productName ?? line.productCode} · {line.quantity} × {currency(line.unitCost)}</span>
          <button type="button" disabled={!allowed} onClick={() => setPurchaseLines((p) => p.filter((x) => x.productCode !== line.productCode))}>Remover</button></div>)}
        <div style={{ ...split, justifyContent: "space-between" }}><strong>Total {currency(purchaseLines.reduce((n,p) => n+p.quantity*p.unitCost,0))}</strong>
          <button disabled={!allowed || !supplierId || !purchaseLines.length} onClick={savePurchase} style={action}>Registrar compra</button></div>
        <small style={{ color: "#64748b" }}>Registrar não altera estoque. Somente o recebimento confirmado gera movimentações e custo médio no catálogo canônico.</small>
      </div>
      <div style={box}><strong>Compras registradas</strong><div style={{ overflowX: "auto" }}><table style={table}>
        <thead><tr>{["Compra","Fornecedor","Situação","Total","Vencimento","Ação"].map((h) => <th key={h} style={cell}>{h}</th>)}</tr></thead>
        <tbody>{[...ledger.purchases].reverse().map((p) => <tr key={p.id}>
          <td style={cell}>{p.id}</td><td style={cell}>{ledger.suppliers.find((s) => s.id === p.supplierId)?.name ?? p.supplierId}</td>
          <td style={cell}>{p.status === "received" ? "Recebida" : "Aguardando recebimento"}</td>
          <td style={cell}>{currency(purchaseTotal(p))}</td><td style={cell}>{p.dueDate ?? "—"}</td>
          <td style={cell}>{p.status === "draft" ? <button disabled={!allowed} onClick={() => receipt(p.id)} style={action}>Confirmar recebimento</button> : "Movimento registrado"}</td>
        </tr>)}</tbody></table></div></div>
    </> : null}

    {activeView === "financeiro" ? <PdvFinancePanel ledger={ledger} sales={sales}
      creditMethods={creditMethods} customers={customers} allowed={allowed} onLedgerChange={onLedgerChange} /> : null}

    {activeView === "relatorios" ? <>
      <div style={split}>
        <div style={{ ...box, flex: "1 1 200px" }}>Vendas registradas<strong style={{ fontSize: 21 }}>{currency(summary.revenueTotal)}</strong></div>
        <div style={{ ...box, flex: "1 1 200px" }}>Custos conhecidos das vendas<strong style={{ fontSize: 21 }}>{currency(summary.knownCostTotal)}</strong></div>
        <div style={{ ...box, flex: "1 1 200px" }}>Lucro bruto apurado<strong style={{ fontSize: 21 }}>{summary.grossProfit === null ? "Incompleto" : currency(summary.grossProfit)}</strong></div>
      </div>
      {summary.uncostedSales ? <p role="status" style={{ ...box, background: "#fffbeb" }}>{summary.uncostedSales} venda(s) têm itens sem custo histórico. Não é possível afirmar o lucro total sem custo comprovado.</p> : null}
      <div style={box}><div style={{ ...split, justifyContent: "space-between" }}><strong>Lucratividade por venda</strong>
        <button type="button" style={action} onClick={() => downloadCsv([
          ["Venda","Data","Receita","Custo conhecido","Lucro bruto","Qualidade"],
          ...sales.map((sale) => { const p = saleGrossProfit(sale);return [sale.number,sale.finalizedAt,String(p.revenue),
            p.cost === null ? "" : String(p.cost),p.grossProfit === null ? "" : String(p.grossProfit),
            p.grossProfit === null ? "Custo histórico ausente" : "Completo"]; })
        ],"pdv-nexus-lucratividade.csv")}>Exportar CSV</button></div>
        <div style={{ overflowX: "auto" }}><table style={table}><thead><tr>{["Venda","Receita","Custo histórico","Lucro bruto"].map(h=><th key={h} style={cell}>{h}</th>)}</tr></thead>
          <tbody>{sales.slice(0,80).map((sale) => {const p = saleGrossProfit(sale);return <tr key={sale.number}><td style={cell}>{sale.number}</td><td style={cell}>{currency(p.revenue)}</td><td style={cell}>{p.cost === null ? "Sem custo" : currency(p.cost)}</td><td style={cell}>{p.grossProfit === null ? "Não apurável" : currency(p.grossProfit)}</td></tr>;})}</tbody></table></div>
        <small>Visualização: 80 vendas recentes. Exportação: todas as vendas do histórico canônico. Lucro bruto não é lucro líquido nem DRE; faltam impostos, despesas e taxas.</small></div>
    </> : null}

  </section>;
}
