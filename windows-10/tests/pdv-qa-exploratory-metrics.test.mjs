import test from "node:test";
import assert from "node:assert/strict";
import { PDV_ROUTES, inspectCanonicalStore, canonicalSignature, classifyExploration } from "../qa/exploratory-metrics.mjs";

test("cobre todos os menus operacionais, sem focar apenas na tela de caixa", () => {
  assert.deepEqual(PDV_ROUTES.map(([name]) => name), ["caixa", "produtos", "clientes", "financeiro", "administracao", "balanca", "configuracoes"]);
});
test("reprova estoque negativo mesmo quando a interface parece normal", () => {
  const data = { catalogProducts: [{ productCode: "P1", stock: -1, unitPrice: 10 }] };
  assert.equal(inspectCanonicalStore(data)[0].type, "invalid-stock");
});
test("detecta vendas duplicadas e totais invalidos", () => {
  const data = { completedSales: [{ id: "A", netTotal: 10 }, { id: "A", netTotal: -3 }] };
  const types = inspectCanonicalStore(data).map(x => x.type);
  assert.ok(types.includes("duplicate-sale-id")); assert.ok(types.includes("invalid-sale-total"));
});
test("assinatura de dados identifica perda de persistencia apos reload", () => {
  const base = { catalogProducts: [{ productCode: "P", stock: 5 }], completedSales: [] };
  assert.notEqual(canonicalSignature(base), canonicalSignature({ ...base, catalogProducts: [{ productCode: "P", stock: 4 }] }));
});
test("erros reais nao podem ser ocultados por sucesso da IA", () => {
  const r = classifyExploration({ route: "#/caixa", expectedRoute: "#/caixa", before: {}, after: {}, errors: ["Uncaught TypeError"], actions: 20 });
  assert.equal(r.critical[0].type, "renderer-error");
});
test("acessibilidade e catalogada sem confundí-la com falha funcional", () => {
  const r = classifyExploration({ route: "#/produtos", expectedRoute: "#/produtos", after: {}, errors: [], actions: 10, accessibility: [{ id: "label", impact: "serious", description: "Campo sem rotulo", nodes: 2 }] });
  assert.equal(r.critical.length, 0);
  assert.equal(r.warnings[0].type, "accessibility");
});
test("nunca trata falta de dados canonicos como sucesso", () => {
  assert.equal(inspectCanonicalStore(null)[0].type, "missing-canonical-store");
});
