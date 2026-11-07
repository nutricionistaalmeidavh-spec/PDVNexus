import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readPersonaConfig, parseDecision, goalAchieved, buildPrompt, buildDecisionSchema } from "../qa/ollama-persona-core.mjs";

const config = await readPersonaConfig(new URL("../qa/ollama-personas.config.json", import.meta.url));
const controls = [
  { id: 1, tag: "A", href: "#/produtos", disabled: false },
  { id: 2, tag: "INPUT", type: "text", disabled: false },
  { id: 3, tag: "SELECT", options: [{ value: "pix" }], disabled: false },
  { id: 4, tag: "A", href: "https://example.org", disabled: false }
];

test("10 personas com metas verificaveis, sem IDs duplicados", () => {
  assert.equal(config.personas.length, 10);
  assert.ok(config.personas.every((p) => !!p.goal.kind && !!p.objective));
  assert.ok(config.maxSteps <= 20);
});
test("agent só pode clicar em controles apresentados", () => {
  assert.deepEqual(parseDecision('{"action":"click","elementId":1}', controls).action, "click");
  assert.throws(() => parseDecision('{"action":"click","elementId":999}', controls));
  assert.throws(() => parseDecision('{"action":"click","elementId":4}', controls));
  assert.throws(() => parseDecision('{"action":"javascript","elementId":1}', controls));
});
test("limita preenchimento, selecao e teclas", () => {
  assert.equal(parseDecision('{"action":"fill","elementId":2,"value":"QA IA Banana"}', controls).value, "QA IA Banana");
  assert.throws(() => parseDecision(JSON.stringify({ action: "fill", elementId: 2, value: "x".repeat(100) }), controls));
  assert.throws(() => parseDecision('{"action":"press","elementId":2,"key":"Control+Alt+Delete"}', controls));
  assert.equal(parseDecision('{"action":"select","elementId":3,"value":"pix"}', controls).value, "pix");
  assert.throws(() => parseDecision('{"action":"select","elementId":3,"value":"admin"}', controls));
});
test("LLM nao pode declarar sucesso sem prova no estado do PDV", () => {
  assert.equal(goalAchieved({kind:"saleCompleted"}, {route:"#/caixa",store:{completedSales:[]}}), false);
  assert.equal(goalAchieved({kind:"saleCompleted"}, {route:"#/caixa",store:{completedSales:[{id:"sale-1"}]}}), true);
  assert.equal(goalAchieved({kind:"cashOpen"}, {route:"#/caixa",store:{cashSession:null}}), false);
  assert.equal(goalAchieved({kind:"cashOpen"}, {route:"#/caixa",store:{cashSession:{initialAmount:150}}}), true);
});
test("prompt inclui os controles e objetivo, nao executa codigo arbitrario", () => {
  const prompt=buildPrompt(config.personas[0],{route:"#/caixa",controls,indicators:{}},[],12);
  assert.match(prompt,/Controles visiveis/);
  assert.match(prompt,/comerciante|Comerciante/);
});

test("Ollama e agentes executam no mesmo step (processo nao morre entre etapas)", () => {
  const yml = readFileSync(new URL("../../.github/workflows/qa-ollama-personas.yml", import.meta.url), "utf8");
  const step = yml.split("      - name: Inicializar Ollama local e baixar modelo")[1]?.split("      - name: Relatorio no resumo")[0];
  assert.ok(step, "step Ollama ausente");
  assert.match(step, /Start-Process -FilePath/);
  assert.match(step, /node qa\/run-ollama-personas\.mjs/);
  assert.equal((yml.match(/node qa\/run-ollama-personas\.mjs/g) || []).length, 1);
});

test("prompt de navegacao prioriza links reais e nunca revela indice interno do DOM", () => {
  const persona=config.personas[0];
  const prompt=buildPrompt(persona, {route:"#/caixa", controls:[{id:1,domIndex:24,tag:"A",href:"#/produtos",name:"Produtos"}],indicators:{}},[],14);
  assert.match(prompt,/#\/produtos/);
  assert.doesNotMatch(prompt,/domIndex/);
  assert.match(prompt,/EXATAMENTE/);
});

test("schema da IA limita elementId aos controles realmente visiveis", () => {
  const schema = buildDecisionSchema([
    { id: 1, tag: "A", disabled: false },
    { id: 2, tag: "INPUT", disabled: true },
    { id: 3, tag: "BUTTON", disabled: false }
  ]);
  assert.deepEqual(schema.properties.elementId.enum, [1, 3]);
  assert.throws(() => buildDecisionSchema([]), /Nenhum controle/);
});
