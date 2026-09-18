import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { hydratePdvBusinessFlowSteps, PDV_BUSINESS_BASELINE } from "../qa/pdv-business-baseline.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const suitePath = resolve(root, "qa/business-flows.json");
const runnerPath = resolve(root, "qa/run-business-flows.mjs");
const suite = JSON.parse(readFileSync(suitePath, "utf8"));

test("suite de jornadas de negocio mantem entre 20 e 30 fluxos E2E criticos", () => {
  assert.ok(Array.isArray(suite.flows));
  assert.ok(suite.flows.length >= 20);
  assert.ok(suite.flows.length <= 30);
});

test("suite cobre todos os dominios criticos do PDV", () => {
  const categories = new Set(suite.flows.map((flow) => flow.category));
  for (const category of ["caixa", "vendas", "clientes", "produtos", "estoque", "financeiro", "seguranca", "configuracoes", "relatorios", "promocoes"]) {
    assert.ok(categories.has(category), `categoria ausente: ${category}`);
  }
});

test("cada jornada tem acao real de usuario e assercao", () => {
  const ids = new Set();
  for (const flow of suite.flows) {
    assert.ok(flow.id && !ids.has(flow.id), `id duplicado/invalido: ${flow.id}`);
    ids.add(flow.id);
    assert.equal(flow.critical, true, `${flow.id}: jornada critica deve bloquear CI`);
    assert.ok(Array.isArray(flow.steps) && flow.steps.length >= 4, `${flow.id}: poucos passos`);
    const actions = new Set(flow.steps.map((step) => step.action));
    assert.ok([...actions].some((action) => ["click", "clickIfVisible", "fill", "press", "selectOption", "check", "uncheck"].includes(action)), `${flow.id}: sem acao real do usuario`);
    assert.ok([...actions].some((action) => action.startsWith("expect")), `${flow.id}: sem assercao`);
  }
});

test("runner da suite de jornadas existe", () => {
  assert.ok(existsSync(runnerPath), "qa/run-business-flows.mjs ausente");
});

test("baseline E2E reproduz catalogo, clientes e pagamentos iniciais do PDV", () => {
  assert.equal(PDV_BUSINESS_BASELINE.catalogProducts.length, 5);
  assert.equal(PDV_BUSINESS_BASELINE.registeredCustomers.length, 3);
  assert.equal(PDV_BUSINESS_BASELINE.paymentOptions.length, 7);
  assert.equal(PDV_BUSINESS_BASELINE.catalogProducts[2].productCode, "00101");
  assert.equal(PDV_BUSINESS_BASELINE.registeredCustomers[1].id, "CLI-002");
});

test("reset vazio de jornada vira baseline completo antes de chegar ao SQLite", () => {
  const [step] = hydratePdvBusinessFlowSteps([{ action: "desktopStoreSet", key: "nexus-core:pdv-store:v1", value: {} }]);
  assert.equal(step.value.catalogProducts.length, 5);
  assert.equal(step.value.registeredCustomers.length, 3);
  assert.equal(step.value.paymentOptions.length, 7);
  assert.deepEqual(step.value.completedSales, []);
});

test("seed parcial substitui somente o dominio informado e preserva o restante do baseline", () => {
  const [step] = hydratePdvBusinessFlowSteps([{ action: "desktopStoreSet", key: "nexus-core:pdv-store:v1", value: { registeredCustomers: [{ id: "CLI-QA", name: "QA", document: "QA", city: "QA", creditLimit: 10, creditUsed: 0 }], extensions: { users: [{ id: "GER-QA", name: "Gerente QA", role: "manager", active: true }] } } }]);
  assert.equal(step.value.registeredCustomers.length, 1);
  assert.equal(step.value.registeredCustomers[0].id, "CLI-QA");
  assert.equal(step.value.catalogProducts.length, 5);
  assert.equal(step.value.paymentOptions.length, 7);
  assert.equal(step.value.extensions.users.length, 1);
  assert.equal(step.value.extensions.storeSettings.storeName, "PDV Nexus");
  assert.deepEqual(step.value.extensions.inventoryMovements, []);
});
