import { useEffect, useMemo, useRef, useState } from "react";
import type { ReportSaleIdentity } from "./reportTraining";
import { buildSalesPdf, buildSalesXlsx, type ExportContext } from "./reportDocuments";
import {
  SALES_REPORT_FAVORITES_KEY, parseReportFavorites, saveReportFavorite, removeReportFavorite,
  previousComparablePeriod, comparisonDelta, type SalesReportFavorite
} from "./reportPreferences";

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
  storeName?: string;
  allowed?: boolean;
  canManageTraining?: boolean;
  onReportInclusionChange?: (identity: ReportSaleIdentity, action: "exclude" | "restore", reason: string) => void;
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

export function SalesReports({ completedSales, cancelledSales, customers, cashMethodNames = [], storeName = "PDV Nexus", allowed = true, canManageTraining = false, onReportInclusionChange }: Props) {
  const [view, setView] = useState<ReportView>("lines");
  const [period, setPeriod] = useState("30");
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(today());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"completed" | "cancelled" | "all">("completed");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [operator, setOperator] = useState("");
  const [productCode, setProductCode] = useState("");
  const [brand, setBrand] = useState("");
  const [producer, setProducer] = useState("");
  const [pendingTraining, setPendingTraining] = useState<{ identity: ReportSaleIdentity; action: "exclude" | "restore" } | null>(null);
  const [trainingReason, setTrainingReason] = useState("");
  const [message, setMessage] = useState("");

  const [favorites, setFavorites] = useState<SalesReportFavorite[]>(() => {
    try { return parseReportFavorites(window.localStorage.getItem(SALES_REPORT_FAVORITES_KEY)); }
    catch { return []; }
  });
  const [favoriteName, setFavoriteName] = useState("");
  const [favoriteId, setFavoriteId] = useState("");
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<{ number: string; date: string; terminalId: string } | null>(null);
  const [busy, setBusy] = useState<"csv" | "pdf" | "xlsx" | null>(null);
  const workerRef = useRef<Worker | null>(null);
  useEffect(() => () => { workerRef.current?.terminate(); }, []);


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

  const brands = useMemo(() => [...new Set([...completedSales,...cancelledSales].flatMap(s => s.items.map(i => i.brand ?? "").filter(Boolean)))].sort(), [completedSales, cancelledSales]);
  const producers = useMemo(() => [...new Set([...completedSales,...cancelledSales].flatMap(s => s.items.map(i => i.producer ?? "").filter(Boolean)))].sort(), [completedSales, cancelledSales]);
  const excludedSales = useMemo(() => completedSales.filter(s => !!s.reportExclusion), [completedSales]);
  const filters: ReportFilters = { from, to, query, status, paymentMethod, operator, productCode, brand, producer };
  const report = useMemo(() => buildSalesReport(completedSales, cancelledSales, customers, filters, cashMethodNames),
    [completedSales, cancelledSales, customers, from, to, query, status, paymentMethod, operator, productCode, brand, producer, cashMethodNames]);

  const comparable = previousComparablePeriod(from, to);
  const previousReport = useMemo(() => compareEnabled && comparable
    ? buildSalesReport(completedSales, cancelledSales, customers,
      { from: comparable.from, to: comparable.to, query, status, paymentMethod, operator, productCode, brand, producer }, cashMethodNames)
    : null, [compareEnabled, comparable?.from, comparable?.to, completedSales, cancelledSales, customers,
      query, status, paymentMethod, operator, productCode, brand, producer, cashMethodNames]);
  useEffect(() => { setPage(1); setDetail(null); },
    [from, to, query, status, paymentMethod, operator, productCode, brand, producer, view]);
  const dataLength = view === "lines" ? report.lines.length : view === "sales" ? report.sales.length : report[view].length;
  const pageCount = Math.max(1, Math.ceil(dataLength / 100));
  const activePage = Math.min(page, pageCount);
  const offset = (activePage - 1) * 100;
  const detailSale = detail ? report.sales.find(s => s.number === detail.number &&
    s.date === detail.date && s.terminalId === detail.terminalId) : null;
  const detailLines = detail ? report.lines.filter(r => r.number === detail.number &&
    r.date === detail.date && r.terminalId === detail.terminalId) : [];
  const percentChange = (current: number, previous: number) => {
    const delta = comparisonDelta(current, previous);
    return delta.percentage === null ? "Sem base anterior" :
      (delta.percentage >= 0 ? "+" : "") + delta.percentage.toFixed(1).replace(".", ",") + "%";
  };

  const paymentFilterWarning = Boolean(paymentMethod || productCode);
  const coverageNote = "Os resultados incluem apenas vendas ainda presentes no histórico desta instalação. Versões anteriores limitavam esse histórico às 100 vendas mais recentes.";

  const setQuickPeriod = (key: string) => {
    setPeriod(key);
    if (key === "custom") return;
    if (key === "all") { setFrom(""); setTo(""); return; }
    setFrom(daysAgo(Number(key) - 1));
    setTo(today());
  };

  const persistFavorites = (next: SalesReportFavorite[]) => {
    try {
      window.localStorage.setItem(SALES_REPORT_FAVORITES_KEY, JSON.stringify(next));
      setFavorites(next);
      return true;
    } catch {
      setMessage("Não foi possível salvar favoritos no armazenamento deste computador. Os filtros foram mantidos.");
      return false;
    }
  };
  const addFavorite = () => {
    try {
      const id = "report-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
      const next = saveReportFavorite(favorites, { name: favoriteName, view, filters }, new Date().toISOString(), id);
      if (persistFavorites(next)) {
        setFavoriteId(next[0].id);
        setFavoriteName("");
        setMessage("Visão salva neste computador. Ela não altera os dados das vendas.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível salvar o favorito."); }
  };
  const applyFavorite = (id: string) => {
    setFavoriteId(id);
    const chosen = favorites.find(f => f.id === id);
    if (!chosen) return;
    setView(chosen.view);
    setFrom(chosen.filters.from || "");
    setTo(chosen.filters.to || "");
    setQuery(chosen.filters.query || "");
    setStatus(chosen.filters.status || "completed");
    setPaymentMethod(chosen.filters.paymentMethod || "");
    setOperator(chosen.filters.operator || "");
    setProductCode(chosen.filters.productCode || "");
    setBrand(chosen.filters.brand || "");
    setProducer(chosen.filters.producer || "");
    setPeriod("custom");
    setMessage("Filtros do favorito “" + chosen.name + "” aplicados.");
  };
  const deleteFavorite = () => {
    if (!favoriteId) return;
    const removed = favorites.find(f => f.id === favoriteId);
    if (persistFavorites(removeReportFavorite(favorites, favoriteId))) {
      setFavoriteId("");
      setMessage(removed ? "Favorito “" + removed.name + "” excluído. Os filtros atuais foram preservados." : "Favorito excluído.");
    }
  };
  const saveBlob = (bytes: Uint8Array, kind: "pdf" | "xlsx" | "csv", prefix: string) => {
    const content = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const types = { csv: "text/csv;charset=utf-8", pdf: "application/pdf",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    const url = URL.createObjectURL(new Blob([content], { type: types[kind] }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "pdv-nexus-" + prefix + "-" + (from || "inicio") + "-a-" + (to || "atual") + "." + kind;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 45000);
  };
  const exportDocument = (kind: "csv" | "pdf" | "xlsx", target: ReportView = view) => {
    if (!allowed || busy) return;
    setBusy(kind);
    setMessage("Preparando o relatório " + kind.toUpperCase() + " em segundo plano...");
    const context: ExportContext = { storeName, generatedAt: new Date().toLocaleString("pt-BR"), filters, view: target };
    const finish = () => { workerRef.current?.terminate(); workerRef.current = null; setBusy(null); };
    try {
      const worker = new Worker(new URL("./reportExport.worker.ts", import.meta.url), { type: "module" });
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<{ type: string; bytes?: ArrayBuffer; message?: string }>) => {
        const result = event.data;
        if (result.type === "progress") return;
        if (result.type === "done" && result.bytes) {
          try {
            saveBlob(new Uint8Array(result.bytes), kind, kind === "xlsx" ? "completo" : target);
            setMessage("Arquivo " + kind.toUpperCase() + " preparado para download. Selecione-o na pasta de downloads.");
          } catch { setMessage("Falha ao disponibilizar o arquivo. Seus filtros permanecem intactos; tente novamente."); }
        } else setMessage(result.message || "Falha na exportação. Seus filtros foram preservados.");
        finish();
      };
      worker.onerror = () => {
        setMessage("Falha na exportação em segundo plano. Seus filtros foram preservados; tente novamente.");
        finish();
      };
      worker.postMessage({ kind, report, context });
    } catch {
      // Small reports remain usable even if Electron disables web workers.
      if (report.lines.length <= 500) {
        window.setTimeout(() => {
          try {
            const bytes = kind === "pdf" ? buildSalesPdf(report, context) :
              kind === "xlsx" ? buildSalesXlsx(report, context) :
                new TextEncoder().encode(exportSalesReportCsv(report, target));
            saveBlob(bytes, kind, kind === "xlsx" ? "completo" : target);
            setMessage("Arquivo preparado para download.");
          } catch { setMessage("Falha ao gerar o arquivo. Seus filtros foram mantidos."); }
          setBusy(null);
        }, 0);
      } else {
        setBusy(null);
        setMessage("Exportação em segundo plano indisponível. Reduza o período e tente novamente.");
      }
    }
  };
  const cancelExport = () => {
    workerRef.current?.terminate(); workerRef.current = null;
    setBusy(null);
    setMessage("Exportação cancelada; filtros e dados foram preservados.");
  };
  const beginTrainingChange = (identity: ReportSaleIdentity, action: "exclude" | "restore") => {
    if (!canManageTraining || !onReportInclusionChange) return;
    setPendingTraining({ identity, action });
    setTrainingReason(action === "exclude" ? "Venda simulada durante treinamento" : "Reinclusão após revisão gerencial");
    setMessage("");
  };
  const confirmTrainingChange = () => {
    if (!pendingTraining || !canManageTraining || !onReportInclusionChange) return;
    try {
      onReportInclusionChange(pendingTraining.identity, pendingTraining.action, trainingReason);
      setMessage(pendingTraining.action === "exclude"
        ? "Venda removida dos relatórios gerenciais. Histórico, estoque e caixa não foram alterados."
        : "Venda reincluída nos relatórios gerenciais.");
      setPendingTraining(null);
      setTrainingReason("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível alterar o relatório.");
    }
  };
  const download = (target: ReportView) => exportDocument("csv", target);
  const noData = report.sales.length === 0;

  if (!allowed) return <p role="alert">Seu operador não tem permissão para consultar os relatórios.</p>;

  return (
    <div className="nexus-reports">
      <div className="nexus-reports__header">
        <div>
          <h3>Vendas e recebimentos</h3>
          <p>Consulte os itens, os totais por produto e as formas de pagamento.</p>
        </div>
        <div className="nexus-reports__export-tools">
          <button type="button" className="nexus-reports__primary" disabled={!!busy} onClick={() => download(view)}>
            Exportar CSV {view === "lines" ? "detalhado" : "da visão"}
          </button>
          <button type="button" className="nexus-reports__secondary" disabled={!!busy}
            onClick={() => exportDocument("xlsx")}>Exportar Excel (.xlsx)</button>
          <button type="button" className="nexus-reports__secondary" disabled={!!busy}
            onClick={() => exportDocument("pdf")}>Exportar PDF</button>
          {busy && <button type="button" className="nexus-reports__secondary" onClick={cancelExport}>
            Cancelar exportação
          </button>}
        </div>
      </div>

      <div className="nexus-reports__extras">
        <label>Relatórios favoritos
          <select value={favoriteId} onChange={e => applyFavorite(e.target.value)}>
            <option value="">Escolha uma visão salva</option>
            {favorites.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <label>Salvar filtros e visão atuais
          <input value={favoriteName} maxLength={60} onChange={e => setFavoriteName(e.target.value)}
            placeholder="Ex.: Fechamento semanal" />
        </label>
        <button type="button" className="nexus-reports__secondary" disabled={!favoriteName.trim()} onClick={addFavorite}>
          Salvar favorito
        </button>
        {favoriteId && <button type="button" className="nexus-reports__secondary" onClick={deleteFavorite}>
          Excluir favorito
        </button>}
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
        <label>Marca
          <select value={brand} onChange={e => setBrand(e.target.value)}><option value="">Todas</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label>Empreendimento / produtor
          <select value={producer} onChange={e => setProducer(e.target.value)}><option value="">Todos</option>
            {producers.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="nexus-reports__search">Buscar venda, cliente ou produto
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nome, código, cliente, venda..." />
        </label>
      </div>

      <div className="nexus-reports__compare-control">
        <label><input type="checkbox" checked={compareEnabled} onChange={e => setCompareEnabled(e.target.checked)}
          disabled={!comparable} /> Comparar com período anterior de mesma duração</label>
        {!comparable && <small>Para comparar, selecione uma data inicial e final válidas.</small>}
      </div>
      <div className="nexus-reports__metrics">
        <div><span>Vendas concluídas</span><strong>{report.salesCount}</strong></div>
        <div><span>Faturamento válido</span><strong>{currency(report.revenue)}</strong></div>
        <div><span>Ticket médio filtrado</span><strong>{currency(report.ticket)}</strong></div>
        <div><span>Quantidade vendida</span><strong>{number(report.quantity)}</strong></div>
      </div>

      {previousReport && comparable && <div className="nexus-reports__compare" role="region" aria-label="Comparação de períodos">
        <strong>Comparação: {from} a {to} versus {comparable.from} a {comparable.to}</strong>
        <div className="nexus-reports__compare-grid">
          <span>Vendas: {report.salesCount} / {previousReport.salesCount} <b>{percentChange(report.salesCount, previousReport.salesCount)}</b></span>
          <span>Faturamento: {currency(report.revenue)} / {currency(previousReport.revenue)} <b>{percentChange(report.revenue, previousReport.revenue)}</b></span>
          <span>Ticket médio filtrado: {currency(report.ticket)} / {currency(previousReport.ticket)} <b>{percentChange(report.ticket, previousReport.ticket)}</b></span>
          <span>Quantidade: {number(report.quantity)} / {number(previousReport.quantity)} <b>{percentChange(report.quantity, previousReport.quantity)}</b></span>
        </div>
        <small>A comparação considera apenas registros ainda presentes no histórico local, inclusive no período anterior.</small>
      </div>}
      <p className="nexus-reports__hint">{coverageNote}</p>
      {paymentFilterWarning && <p className="nexus-reports__notice">
        {paymentMethod ? "O filtro por pagamento seleciona vendas que utilizaram essa forma; não atribui produtos individualmente a ela. " : ""}
        {productCode ? "O filtro por produto seleciona vendas que contêm esse item; os recebimentos representam as vendas completas, não apenas o produto selecionado." : ""}
      </p>}
      {report.unmatched.length > 0 && <p className="nexus-reports__warning" role="alert">
        Atenção: {report.unmatched.length} venda(s) com diferença entre pagamentos registrados (descontado o troco identificado) e valor líquido.
        Diferença acumulada: {currency(report.tenderDifference)}. Confira vendas: {report.unmatched.slice(0, 8).join(", ")}.
      </p>}
      {report.unidentifiedItemPayments.length > 0 && <p className="nexus-reports__notice" role="status">
        {report.unidentifiedItemPayments.length} venda(s) sem identificação confiável do pagamento por item.
        As formas de pagamento da venda continuam disponíveis no resumo, mas não são atribuídas aos produtos sem registro explícito.
        Confira: {report.unidentifiedItemPayments.slice(0, 8).join(", ")}.
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
            <thead><tr><th>Data</th><th>Venda</th><th>Produto</th><th>Marca</th><th>Empreendimento</th><th>Qtd.</th><th>Unitário</th><th>Desconto</th><th>Líquido</th><th>Pagamento do item</th><th>Operador</th><th>Situação</th></tr></thead>
            <tbody>{report.lines.slice(offset, offset + 100).map((r, i) => <tr key={r.number + "/" + r.productCode + "/" + i}>
              <td>{r.date}</td><td>#{r.number}</td><td><strong>{r.productName}</strong><small>{r.productCode} · {r.unit}</small></td><td>{r.brand || "Não informada"}</td><td>{r.producer || "Não informado"}</td>
              <td>{number(r.quantity)}</td><td>{currency(r.unitPrice)}</td><td>{currency(r.discount)}</td>
              <td>{currency(r.net)}</td><td>{r.payments}</td><td>{r.operator}</td>
              <td>{r.status === "cancelled" ? "Cancelada" : "Concluída"}</td>
            </tr>)}</tbody>
          </>}
          {view === "sales" && <>
            <thead><tr><th>Data</th><th>Venda</th><th>Operador</th><th>Cliente</th><th>Itens</th><th>Pagamento(s)</th><th>Situação</th><th>Válido</th><th>Detalhes</th>{canManageTraining && <th>Treinamento</th>}</tr></thead>
            <tbody>{report.sales.slice(offset, offset + 100).map((r, i) => <tr key={r.number + "/" + i} onClick={() => setDetail({ number: r.number, date: r.date, terminalId: r.terminalId })} className="nexus-reports__clickable"><td>{r.date}</td>
              <td>#{r.number}</td><td>{r.operator}</td><td>{r.customer}</td><td>{number(r.quantity)}</td>
              <td>{r.payments}</td><td>{r.status === "cancelled" ? "Cancelada" : "Concluída"}</td>
              <td>{currency(r.total)}</td><td><button type="button" className="nexus-reports__table-action" onClick={() => setDetail({ number: r.number, date: r.date, terminalId: r.terminalId })}>Ver itens</button></td>
              {canManageTraining && <td>{r.status === "completed" ? <button type="button" className="nexus-reports__table-action"
                onClick={(e) => { e.stopPropagation(); beginTrainingChange({ number:r.number, finalizedAt:r.date, terminalId:r.terminalId }, "exclude"); }}>Desconsiderar</button> : "—"}</td>}</tr>)}</tbody>
          </>}
          {view !== "lines" && view !== "sales" && <>
            <thead><tr><th>{view === "products" ? "Produto" : view === "payments" ? "Forma de pagamento" : "Operador"}</th>
              {view === "products" && <><th>Marca</th><th>Empreendimento</th></>}<th>Vendas</th>{view === "products" && <th>Quantidade</th>}<th>Total</th></tr></thead>
            <tbody>{report[view].slice(offset, offset + 100).map(r => <tr key={r.key}><td><button type="button" className="nexus-reports__table-action" onClick={() => { if (view === "products") setProductCode(r.key); if (view === "payments") setPaymentMethod(r.key); if (view === "operators") setOperator(r.key); setView("sales"); }}>{r.label} · Ver vendas</button></td>
              {view === "products" && <><td>{r.brand || "Não informada"}</td><td>{r.producer || "Não informado"}</td></>}
              <td>{r.count}</td>{view === "products" && <td>{number(r.quantity)}</td>}
              <td>{currency(r.total)}</td></tr>)}</tbody>
          </>}
        </table>
        {(noData || (view === "lines" && !report.lines.length)) &&
          <p className="nexus-reports__empty">Nenhum registro corresponde aos filtros selecionados. Experimente “Todo o histórico disponível” ou limpe os filtros.</p>}
      </div>

      {dataLength > 100 && <nav className="nexus-reports__paging" aria-label="Paginação do relatório">
        <span>Exibindo {offset + 1}–{Math.min(dataLength, offset + 100)} de {dataLength} registros</span>
        <button type="button" className="nexus-reports__secondary" disabled={activePage === 1}
          onClick={() => setPage(activePage - 1)}>Anterior</button>
        <strong>Página {activePage} de {pageCount}</strong>
        <button type="button" className="nexus-reports__secondary" disabled={activePage >= pageCount}
          onClick={() => setPage(activePage + 1)}>Próxima</button>
      </nav>}
      {detailSale && <section className="nexus-reports__detail" aria-label="Itens da venda" role="region">
        <div className="nexus-reports__detail-title">
          <strong>Venda #{detailSale.number} — {detailSale.date}</strong>
          <button className="nexus-reports__secondary" type="button" onClick={() => setDetail(null)}>Fechar detalhes</button>
        </div>
        <p>{detailSale.customer} · {detailSale.operator} · {detailSale.status === "cancelled" ? "Cancelada" : "Concluída"}</p>
        <p><strong>Forma(s) de pagamento da venda:</strong> {detailSale.payments}</p>
        <table className="nexus-reports__table">
          <thead><tr><th>Produto</th><th>Quantidade</th><th>Desconto</th><th>Líquido</th></tr></thead>
          <tbody>{detailLines.map((line, i) => <tr key={line.productCode + "-" + i}>
            <td>{line.productName}</td><td>{number(line.quantity)}</td><td>{currency(line.discount)}</td><td>{currency(line.net)}</td>
          </tr>)}</tbody>
        </table>
        <strong>Total válido: {currency(detailSale.total)}</strong>
      </section>}
      {canManageTraining && pendingTraining && <section className="nexus-reports__training-confirm" role="region" aria-label="Confirmação da venda de treinamento">
        <strong>{pendingTraining.action === "exclude" ? "Desconsiderar venda nos relatórios" : "Reincluir venda nos relatórios"}</strong>
        <p>Venda #{pendingTraining.identity.number}. A operação afeta somente relatórios gerenciais e exportações. Não cancela vendas, não devolve mercadorias ao estoque e não modifica pagamentos ou fechamento de caixa.</p>
        <label>Motivo obrigatório (4 a 200 caracteres)
          <input maxLength={200} value={trainingReason} onChange={e => setTrainingReason(e.target.value)}
            placeholder={pendingTraining.action === "exclude" ? "Ex.: Venda simulada durante treinamento" : "Ex.: Venda real, reincluir no relatório"} />
        </label>
        <div className="nexus-reports__training-actions">
          <button type="button" className="nexus-reports__secondary" onClick={() => { setPendingTraining(null); setTrainingReason(""); }}>Cancelar</button>
          <button type="button" className="nexus-reports__primary" disabled={trainingReason.trim().length < 4}
            onClick={confirmTrainingChange}>Confirmar {pendingTraining.action === "exclude" ? "exclusão dos relatórios" : "reinclusão"}</button>
        </div>
      </section>}
      {canManageTraining && <details className="nexus-reports__training-archive">
        <summary>Vendas desconsideradas dos relatórios ({excludedSales.length})</summary>
        <p>Essas vendas continuam registradas no histórico operacional, incluindo seu estoque e recebimentos originais. Reinclua uma venda para devolvê-la aos totais e exportações gerenciais.</p>
        {excludedSales.length ? <div className="nexus-reports__table-wrap">
          <table className="nexus-reports__table"><thead><tr><th>Venda</th><th>Data</th><th>Valor original</th><th>Motivo</th><th>Operador</th><th>Ação</th></tr></thead>
            <tbody>{excludedSales.map(s => <tr key={[s.terminalId ?? "",s.number,s.finalizedAt].join(":")}>
              <td>#{s.number}</td><td>{s.finalizedAt}</td><td>{currency(s.netTotal)}</td>
              <td>{s.reportExclusion?.reason}</td><td>{s.reportExclusion?.excludedBy}</td>
              <td><button type="button" className="nexus-reports__table-action"
                onClick={() => beginTrainingChange({ number: s.number, finalizedAt: s.finalizedAt, terminalId: s.terminalId }, "restore")}>Reincluir no relatório</button></td>
            </tr>)}</tbody>
          </table>
        </div> : <p>Não há vendas desconsideradas.</p>}
      </details>}
      <div className="nexus-reports__footer">
        <p>Marca e empreendimento são preservados conforme registrados na venda. Vendas marcadas como treinamento são omitidas apenas dos relatórios gerenciais; os registros operacionais permanecem intactos.</p>
        {view !== "lines" && <button type="button" className="nexus-reports__secondary" onClick={() => download("lines")}>Baixar itens detalhados (CSV)</button>}
      </div>
      {message && <p className="nexus-reports__feedback" role="status">{message}</p>}
    </div>
  );
}
