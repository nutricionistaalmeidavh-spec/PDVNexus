import { readFile } from "node:fs/promises";

export const CONTROL_SELECTOR = 'a[href^="#"], button, input:not([type="hidden"]):not([type="password"]), select, textarea, [role="button"]';
const ACTIONS = new Set(["click", "fill", "press", "select", "done"]);
const KEYS = new Set(["Enter", "Escape", "Tab", "F2", "F6", "F8"]);

export function validateConfig(config) {
  if (!config || !Array.isArray(config.personas) || config.personas.length === 0) throw new Error("Personas ausentes");
  const ids = new Set();
  for (const p of config.personas) {
    if (!p.id || ids.has(p.id) || !/^[a-z0-9-]+$/.test(p.id)) throw new Error("ID de persona duplicado/invalido");
    if (!p.objective || !p.goal || !["route", "routeText", "cashOpen", "saleCompleted", "productExists", "customerExists"].includes(p.goal.kind)) throw new Error("Persona sem objetivo verificavel: " + p.id);
    ids.add(p.id);
  }
  return config;
}

export async function readPersonaConfig(filename) {
  return validateConfig(JSON.parse(await readFile(filename, "utf8")));
}

export function parseDecision(message, controls) {
  let data;
  try { data = JSON.parse(message); } catch { throw new Error("LLM nao retornou JSON valido"); }
  if (!data || !ACTIONS.has(data.action)) throw new Error("Acao nao permitida");
  if (data.action === "done") return { action: "done", reason: String(data.reason || "").slice(0, 160) };
  if (!Number.isSafeInteger(data.elementId)) throw new Error("ID de elemento invalido");
  const control = controls.find((c) => c.id === data.elementId);
  if (!control || control.disabled) throw new Error("Elemento nao disponivel na observacao");
  if (control.tag === "A" && (!String(control.href || "").startsWith("#") || data.action !== "click")) throw new Error("Navegacao externa bloqueada");
  if (data.action === "fill") {
    if (!["INPUT", "TEXTAREA"].includes(control.tag) || ["button", "checkbox", "radio", "file", "password", "submit"].includes(control.type)) throw new Error("Preenchimento bloqueado");
    if (typeof data.value !== "string" || data.value.length > 80) throw new Error("Texto invalido");
    return { action: "fill", elementId: data.elementId, value: data.value, reason: String(data.reason || "").slice(0, 160) };
  }
  if (data.action === "select") {
    if (control.tag !== "SELECT" || !Array.isArray(control.options) || !control.options.some((o) => o.value === data.value)) throw new Error("Opcao nao permitida");
    return { action: "select", elementId: data.elementId, value: data.value, reason: String(data.reason || "").slice(0, 160) };
  }
  if (data.action === "press") {
    if (!KEYS.has(data.key)) throw new Error("Tecla nao permitida");
    return { action: "press", elementId: data.elementId, key: data.key, reason: String(data.reason || "").slice(0, 160) };
  }
  return { action: "click", elementId: data.elementId, reason: String(data.reason || "").slice(0, 160) };
}

export function goalAchieved(goal, state) {
  if (goal.kind === "route") return String(state.route).includes(goal.value);
  if (goal.kind === "routeText") return String(state.route).includes(goal.route) && String(state.pageText).includes(goal.text);
  if (goal.kind === "cashOpen") return state.store?.cashSession != null && Number.isFinite(Number(state.store.cashSession.initialAmount)) && !state.store.cashSession.closedAt;
  if (goal.kind === "saleCompleted") return (state.store?.completedSales?.length || 0) >= 1;
  if (goal.kind === "productExists") return (state.store?.catalogProducts || []).some((p) => String(p.productName || "").toLowerCase().includes(String(goal.value).toLowerCase()));
  if (goal.kind === "customerExists") return (state.store?.registeredCustomers || []).some((p) => String(p.name || "").toLowerCase().includes(String(goal.value).toLowerCase()));
  return false;
}

export function buildPrompt(persona, state, history, maxSteps) {
  return [
    "Voce e um cliente ficticio usando o PDV Nexus em ambiente de teste local e isolado.",
    "Perfil: " + persona.profile,
    "Objetivo: " + persona.objective,
    "Acione somente controles listados e observe os resultados; nao invente sucesso.",
    "Use apenas JSON: {\"action\":\"click|fill|press|select|done\",\"elementId\":0,\"value\":\"\",\"key\":\"Enter\",\"reason\":\"curto\"}.",
    "Para fill, value e texto; para select, value deve ser um valor das options; press aceita Enter/Escape/Tab/F2/F6/F8.",
    "Se nao souber, procure navegacao pelo menu. Para finalizar uma venda primeiro abra caixa, inicie venda, digite codigo 00101, Enter, escolha pagamento e finalize.",
    "A acao done so deve ocorrer quando a tarefa estiver completa; o avaliador checa o estado real.",
    "Passos maximos: " + maxSteps,
    "Rota atual: " + state.route,
    "Indicadores: " + JSON.stringify(state.indicators),
    "Controles visiveis: " + JSON.stringify(state.controls),
    "Historico recente: " + JSON.stringify(history.slice(-5))
  ].join("\n");
}
