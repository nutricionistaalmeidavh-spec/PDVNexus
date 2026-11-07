// Oraculos independentes do agente: ajudam a diferenciar falha do produto de falha do LLM.
export const PDV_ROUTES = Object.freeze([
  ["caixa", "#/caixa"], ["produtos", "#/produtos"], ["clientes", "#/clientes"],
  ["financeiro", "#/financeiro"], ["administracao", "#/administracao"],
  ["balanca", "#/balanca"], ["configuracoes", "#/configuracoes"]
]);

export function inspectCanonicalStore(snapshot) {
  const issues = [];
  if (snapshot == null) return [{ type: "missing-canonical-store", severity: "critical", description: "Bridge SQLite nao retornou snapshot canonico" }];
  if (typeof snapshot !== "object" || Array.isArray(snapshot)) return [{ type: "invalid-canonical-store", severity: "critical", description: "Snapshot nao e um objeto" }];
  for (const [index, product] of (snapshot.catalogProducts || []).entries()) {
    if (product.stock != null && (!Number.isFinite(Number(product.stock)) || Number(product.stock) < -0.000001)) {
      issues.push({ type: "invalid-stock", severity: "critical", description: "Estoque invalido no produto " + index });
    }
    if (product.unitPrice != null && (!Number.isFinite(Number(product.unitPrice)) || Number(product.unitPrice) < 0)) {
      issues.push({ type: "invalid-unit-price", severity: "critical", description: "Preco invalido no produto " + index });
    }
  }
  const seen = new Set();
  for (const [index, sale] of (snapshot.completedSales || []).entries()) {
    if (sale.id != null) {
      if (seen.has(sale.id)) issues.push({ type: "duplicate-sale-id", severity: "critical", description: "ID de venda duplicado " + String(sale.id).slice(0, 60) });
      seen.add(sale.id);
    }
    if (sale.netTotal != null && (!Number.isFinite(Number(sale.netTotal)) || Number(sale.netTotal) < 0)) {
      issues.push({ type: "invalid-sale-total", severity: "critical", description: "Total invalido na venda " + index });
    }
  }
  if (snapshot.cashSession?.initialAmount != null && (!Number.isFinite(Number(snapshot.cashSession.initialAmount)) || Number(snapshot.cashSession.initialAmount) < 0)) {
    issues.push({ type: "invalid-cash-opening", severity: "critical", description: "Caixa abriu com troco invalido" });
  }
  return issues;
}

export function canonicalSignature(snapshot) {
  if (!snapshot) return null;
  // Comparar estado persistido real antes/depois do reload sem incluir propriedades volateis.
  const p = snapshot.catalogProducts || [];
  const s = snapshot.completedSales || [];
  const c = snapshot.registeredCustomers || [];
  return JSON.stringify({
    products: p.map(x => [x.productCode, x.stock, x.unitPrice, x.productName]),
    sales: s.map(x => [x.id, x.netTotal, x.status]),
    customers: c.map(x => [x.id, x.name, x.creditUsed]),
    cash: snapshot.cashSession
  });
}

export function classifyExploration({ route, expectedRoute, before, after, errors = [], accessibility = [], actions = 0 }) {
  const findings = [];
  if (route !== expectedRoute) findings.push({ type: "navigation-mismatch", severity: "high", description: "Esperado " + expectedRoute + ", obtido " + route });
  findings.push(...inspectCanonicalStore(after));
  for (const e of errors.slice(0, 20)) findings.push({ type: "renderer-error", severity: "critical", description: String(e).slice(0, 240) });
  for (const a of accessibility.slice(0, 30)) {
    findings.push({ type: "accessibility", severity: ["critical", "serious"].includes(a.impact) ? "high" : "medium", description: a.id + ": " + a.description, nodes: a.nodes });
  }
  if (actions < 1) findings.push({ type: "no-random-actions", severity: "high", description: "Gremlins nao gerou eventos de teste" });
  return { findings, critical: findings.filter(x => x.severity === "critical"), warnings: findings.filter(x => x.severity !== "critical") };
}
