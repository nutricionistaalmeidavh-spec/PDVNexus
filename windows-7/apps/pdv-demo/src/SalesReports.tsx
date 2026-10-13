import { useMemo, useState } from "react";
import {
  buildSalesReport, exportSalesReportCsv, reportDate,
  type ReportSale, type ReportView, type ReportFilters
} from "./salesReporting";
import "./sales-reports.css";

type Props = {
  completedSales: readonly ReportSale[];
  cancelledSales: readonly ReportSale[];
  customers: readonly { id: string; name: string }[];
  cashMethodNames?: readonly string[];
};

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const number = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const today = () => {
  const d = new Date();
  const pad = (v: number) => String(v).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
};
const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const pad = (v: number) => String(v).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
};
const tabs: { key: ReportView; label: string }[] = [
  { key: "lines", label: "Itens vendidos" },
  { key: "products", label: "Por produto" },
  { key: "payments", label: "Pagamentos" },
  { key: "operators", label: "Operadores" },
  { key: "sales", label: "Vendas" }
];

export function SalesReports({ completedSales, cancelledSales, customers, cashMethodNames = [] }: Props) {
  const [view, setView] = useState<ReportView>("lines");
  const [period, setPeriod] = useState("30");
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(today());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"completed" | "cancelled" | "all">("completed");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [operator, setOperator] = useState("");
  const [productCode, setProductCode] = useState("");
  const [message, setMessage] = useState("");

  const methods = useMemo(() => [...new Set([...completedSales, ...cancelledSales].flatMap(s =>
    s.payments.filter(p => p.amount > 0).map(p => p.method)))].sort(), [completedSales, cancelledSales]);
  const operators = useMemo(() => [...new Set([...completedSales, ...cancelledSales].map(s => s.seller ?? "")
    .filter(Boolean))].sort(), [completedSales, cancelledSales]);
  const products = useMemo(() => {
    const values = new Map<string, string>();
    for (const s of [...completedSales, ...cancelledSales]) {
      for (const item of s.items) values.set(item.productCode, item.productName);
    }
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [completedSales, cancelledSales]);

  const filters: ReportFilters = { from, to, query, status, paymentMethod, operator, productCode };
  const report = useMemo(() => buildSalesReport(completedSales, cancelledSales, customers, filters, cashMethodNames),
    [completedSales, cancelledSales, customers, from, to, query, status, paymentMethod, operator, productCode, cashMethodNames]);
  const paymentFilterWarning = Boolean(paymentMethod || productCode);
  const coverageNote = "Os resultados incluem apenas vendas ainda presentes no histórico desta instalação. Versões anteriores limitavam esse histórico às 100 vendas mais recentes.";

  const setQuickPeriod = (key: string) => {
    setPeriod(key);
    if (key === "all") { setFrom(""); setTo(""); return; }
    setFrom(daysAgo(Number(key) - 1));
    setTo(today());
  };

  const download = (target: ReportView) => {
    try {
      const blob = new Blob([exportSalesReportCsv(report, target)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "pdv-nexus-" + target + "-" + (from || "inicio") + "-a-" + (to || "atual") + ".csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage("Arquivo CSV gerado com " + (target === "lines" ? report.lines.length : target === "sales" ? report.sales.length : report[target].length) + " registro(s) e os filtros selecionados.");
    } catch {
      setMessage("Não foi possível gerar o CSV. Os filtros foram preservados; tente novamente.");
    }
  };
  const noData = report.sales.length === 0;

  return (
    <div className="nexus-reports">
      <div className="nexus-reports__header">
        <div>
          <h3>Vendas e recebimentos</h3>
          <p>Consulte os itens, os totais por produto e as formas de pagamento.</p>
        </div>
        <button type="button" className="nexus-reports__primary" onClick={() => download(view)}>
          Exportar CSV {view === "lines" ? "detalhado" : "da visão"}
        </button>
      </div>
      <div className="nexus-reports__filters" aria-label="Filtros do relatório">
        <label>Período
          <select value={period} onChange={e => setQuickPeriod(e.target.value)}>
            <option value="1">Hoje</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="all">Todo o histórico disponível</option>
            <option value="custom">Personalizado</option>
          </select>
        </label>
        <label>De
          <input type="date" value={from} max={to || undefined} onChange={e => { setFrom(e.target.value); setPeriod("custom"); }} />
        </label>
        <label>Até
          <input type="date" value={to} min={from || undefined} onChange={e => { setTo(e.target.value); setPeriod("custom"); }} />
        </label>
        <label>Situação
          <select value={status} onChange={e => setStatus(e.target.value as typeof status)}>
            <option value="completed">Concluídas</option>
            <option value="cancelled">Canceladas</option>
            <option value="all">Todas</option>
          </select>
        </label>
        <label>Forma de pagamento
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
            <option value="">Todas</option>
            {methods.map(method => <option key={method} value={method}>{method}</option>)}
          </select>
        </label>
        <label>Operador
          <select value={operator} onChange={e => setOperator(e.target.value)}>
            <option value="">Todos</option>
            {operators.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label>Produto
          <select value={productCode} onChange={e => setProductCode(e.target.value)}>
            <option value="">Todos</option>
            {products.map(([code, name]) => <option key={code} value={code}>{name} ({code})</option>)}
          </select>
        </label>
        <label className="nexus-reports__search">Buscar venda, cliente ou produto
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nome, código, cliente, venda..." />
        </label>
      </div>
      <div className="nexus-reports__metrics">
        <div><span>Vendas concluídas</span><strong>{report.salesCount}</strong></div>
        <div><span>Faturamento válido</span><strong>{currency(report.revenue)}</strong></div>
        <div><span>Ticket médio</span><strong>{currency(report.ticket)}</strong></div>
        <div><span>Quantidade vendida</span><strong>{number(report.quantity)}</strong></div>
      </div>
      <p className="nexus-reports__hint">{coverageNote}</p>
      {paymentFilterWarning && <p className="nexus-reports__notice">
        {paymentMethod ? "O filtro por pagamento seleciona vendas que utilizaram essa forma; não atribui produtos individualmente a ela. " : ""}
        {productCode ? "O filtro por produto seleciona vendas que contêm esse item; os recebimentos representam as vendas completas, não apenas o produto selecionado." : ""}
      </p>}
      {report.unmatched.length > 0 && <p className="nexus-reports__warning" role="alert">
        Atenção: {report.unmatched.length} venda(s) com diferença entre pagamentos registrados (descontado o troco identificado) e valor líquido.
        Diferença acumulada: {currency(report.tenderDifference)}. Confira vendas: {report.unmatched.slice(0, 8).join(", ")}.
      </p>}
      {report.missingItems.length > 0 && <p className="nexus-reports__warning" role="alert">
        {report.missingItems.length} venda(s) sem itens registrados: {report.missingItems.join(", ")}. O valor aparece no faturamento, mas não no agrupamento por produtos.
      </p>}
      {report.cancelledCount > 0 && <p className="nexus-reports__hint">
        {report.cancelledCount} venda(s) cancelada(s) no filtro; não entram no faturamento nem nos totais de produtos e pagamentos.
      </p>}
      <div className="nexus-reports__tabs" role="tablist" aria-label="Visões do relatório">
        {tabs.map(t => <button type="button" key={t.key} role="tab" aria-selected={view === t.key}
          className={view === t.key ? "nexus-reports__tab active" : "nexus-reports__tab"}
          onClick={() => setView(t.key)}>{t.label}</button>)}
      </div>
      <div className="nexus-reports__table-wrap">
        <table className="nexus-reports__table">
          {view === "lines" && <>
            <thead><tr><th>Data</th><th>Venda</th><th>Produto</th><th>Qtd.</th><th>Unitário</th><th>Desconto</th><th>Líquido</th><th>Pagamento(s) da venda</th><th>Operador</th><th>Situação</th></tr></thead>
            <tbody>{report.lines.map((r, i) => <tr key={r.number + "/" + r.productCode + "/" + i}>
              <td>{r.date}</td><td>#{r.number}</td><td><strong>{r.productName}</strong><small>{r.productCode} · {r.unit}</small></td>
              <td>{number(r.quantity)}</td><td>{currency(r.unitPrice)}</td><td>{currency(r.discount)}</td>
              <td>{currency(r.net)}</td><td>{r.payments}</td><td>{r.operator}</td>
              <td>{r.status === "cancelled" ? "Cancelada" : "Concluída"}</td>
            </tr>)}</tbody>
          </>}
          {view === "sales" && <>
            <thead><tr><th>Data</th><th>Venda</th><th>Operador</th><th>Cliente</th><th>Itens</th><th>Pagamento(s)</th><th>Situação</th><th>Válido</th></tr></thead>
            <tbody>{report.sales.map((r, i) => <tr key={r.number + "/" + i}><td>{r.date}</td>
              <td>#{r.number}</td><td>{r.operator}</td><td>{r.customer}</td><td>{number(r.quantity)}</td>
              <td>{r.payments}</td><td>{r.status === "cancelled" ? "Cancelada" : "Concluída"}</td>
              <td>{currency(r.total)}</td></tr>)}</tbody>
          </>}
          {view !== "lines" && view !== "sales" && <>
            <thead><tr><th>{view === "products" ? "Produto" : view === "payments" ? "Forma de pagamento" : "Operador"}</th>
              <th>Vendas</th>{view === "products" && <th>Quantidade</th>}<th>Total</th></tr></thead>
            <tbody>{report[view].map(r => <tr key={r.key}><td><strong>{r.label}</strong></td>
              <td>{r.count}</td>{view === "products" && <td>{number(r.quantity)}</td>}
              <td>{currency(r.total)}</td></tr>)}</tbody>
          </>}
        </table>
        {(noData || (view === "lines" && !report.lines.length)) &&
          <p className="nexus-reports__empty">Nenhum registro corresponde aos filtros selecionados. Experimente “Todo o histórico disponível” ou limpe os filtros.</p>}
      </div>
      <div className="nexus-reports__footer">
        <p>Pagamento misto é registrado por venda. O total do produto nunca é duplicado entre formas de pagamento.</p>
        {view !== "lines" && <button type="button" className="nexus-reports__secondary" onClick={() => download("lines")}>Baixar itens detalhados (CSV)</button>}
      </div>
      {message && <p className="nexus-reports__feedback" role="status">{message}</p>}
    </div>
  );
}
