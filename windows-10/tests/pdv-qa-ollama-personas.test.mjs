import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readPersonaConfig, parseDecision, goalAchieved, buildPrompt, buildDecisionSchema, selectPersonaControls } from "../qa/ollama-persona-core.mjs";

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


test("seleciona controles relevantes e habilitados com ID visual reindexado, mantendo índice real", () => {
  const all = Array.from({length:95}, (_,i) => ({
    id:i, domIndex:i, tag:i===0 ? "A" : "BUTTON", href:i===0 ? "#/produtos" : "",
    disabled:i===4, name:i===85 ? "Cadastrar produto" : "Ação secundária",
    placeholder:i===92 ? "Nome do produto" : ""
  }));
  const selected=selectPersonaControls(all,{kind:"productExists"},75,"#/produtos");
  assert.ok(selected.some(x=>x.domIndex===85), "ação útil deve permanecer visível além dos 60 primeiros controles");
  assert.ok(selected.some(x=>x.domIndex===92), "campo relevante não pode sumir da observação");
  assert.ok(selected.every(x=>!x.disabled));
  assert.deepEqual(selected.map(x=>x.id), Array.from({length:selected.length},(_,i)=>i+1));
  assert.ok(selected.every(x=>Number.isSafeInteger(x.domIndex)));
});

test("metas comerciais conferem os produtos, os valores e o meio de pagamento gravados, não apenas contagens", () => {
  const catalog={catalogProducts:[{productCode:"98001",productName:"QA IA Banana",unitPrice:12}]};
  const productGoal={kind:"productExists",value:"QA IA Banana",code:"98001",unitPrice:9.9};
  assert.equal(goalAchieved(productGoal,{store:catalog}),false);
  assert.equal(goalAchieved(productGoal,{store:{catalogProducts:[{...catalog.catalogProducts[0],unitPrice:9.9}]}}),true);
  const cashGoal={kind:"cashOpen",initialAmount:150};
  assert.equal(goalAchieved(cashGoal,{store:{cashSession:{initialAmount:0}}}),false);
  assert.equal(goalAchieved(cashGoal,{store:{cashSession:{initialAmount:150}}}),true);
  const saleGoal={kind:"saleCompleted",productCode:"00101",paymentMethod:"A VISTA"};
  const sale={items:[{productCode:"00102"}],payments:[{method:"A VISTA",amount:100}]};
  assert.equal(goalAchieved(saleGoal,{store:{completedSales:[sale]}}),false);
  assert.equal(goalAchieved(saleGoal,{store:{completedSales:[{...sale,items:[{productCode:"00101"}]}]}}),true);
});

test("cadastro e abertura de caixa com valor exigem navegar antes de atuar no caixa errado", () => {
  const controls = [
    {id:0,domIndex:0,tag:"A",href:"#/caixa",name:"Caixa",disabled:false},
    {id:1,domIndex:1,tag:"A",href:"#/produtos",name:"Produtos",disabled:false},
    {id:2,domIndex:2,tag:"A",href:"#/fechamento",name:"Fechamento de caixa",disabled:false},
    {id:3,domIndex:3,tag:"INPUT",placeholder:"Bipe ou pesquise por código",disabled:false},
    {id:4,domIndex:4,tag:"BUTTON",name:"Abrir caixa",disabled:false}
  ];
  assert.deepEqual(selectPersonaControls(controls,{kind:"productExists"} ,75,"#/caixa").map(c=>c.href),["#/produtos"]);
  assert.deepEqual(selectPersonaControls(controls,{kind:"cashOpen",initialAmount:150},75,"#/caixa").map(c=>c.href),["#/fechamento"]);
  assert.ok(selectPersonaControls(controls,{kind:"saleCompleted"},75,"#/caixa").some(c=>c.name==="Abrir caixa"));
});

test("o agente não aceita done sem estado real nem usa instrução de finalizar uma venda para cadastrar produto", () => {
  const runner=readFileSync(new URL("../qa/run-ollama-personas.mjs", import.meta.url),"utf8");
  assert.match(runner, /parsed.action === "done" && !goalAchieved\(persona.goal, state\)/);
  const productPrompt=buildPrompt(config.personas.find(p=>p.id==="cadastro-produto"),{route:"#/produtos",controls,indicators:{}},[],20);
  assert.match(productPrompt,/98001/);
  assert.match(productPrompt,/QA IA Banana/);
  assert.match(productPrompt,/9,90/);
  assert.doesNotMatch(productPrompt,/Para finalizar uma venda primeiro abra caixa/);
});
