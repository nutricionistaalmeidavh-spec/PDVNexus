#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "../tools/artisys-qa/node_modules/playwright/index.mjs";
import { PDV_BUSINESS_BASELINE, MAIN_PDV_STORE_KEY } from "./pdv-business-baseline.mjs";
import { CONTROL_SELECTOR, readPersonaConfig, parseDecision, buildPrompt, goalAchieved } from "./ollama-persona-core.mjs";

const cwd = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(cwd, "..");
const endpoint = "http://127.0.0.1:11434";
const args = Object.fromEntries(process.argv.slice(2).reduce((out, item, i, all) => {
  if (item.startsWith("--")) out.push([item.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true]);
  return out;
}, []));
const output = path.resolve(args.output || "qa-ollama-artifacts");

async function jsonFetch(url, request, timeoutMs = 90000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...request, signal: controller.signal });
    if (!res.ok) throw new Error("Ollama HTTP " + res.status + ": " + (await res.text()).slice(0, 300));
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const schema = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["click", "fill", "press", "select", "done"] },
    elementId: { type: "integer" },
    value: { type: "string" },
    key: { type: "string" },
    reason: { type: "string" }
  },
  required: ["action", "elementId", "value", "key", "reason"]
};

async function nextDecision(persona, state, history, maxSteps, model) {
  const prompt = buildPrompt(persona, state, history, maxSteps);
  let error;
  let rejection = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const body = {
        model, stream: false, think: false, keep_alive: "2m",
        format: schema, options: { temperature: 0, num_predict: 160, num_ctx: 8192 },
        messages: [
          { role: "system", content: "Voce age somente sobre controles visiveis do PDV ficticio. Responda exclusivamente JSON conforme schema. Nunca invente conclusao." },
          { role: "user", content: prompt + (attempt ? "\nSUA RESPOSTA ANTERIOR FOI INVALIDA: " + rejection + ". Escolha exclusivamente um elementId deste conjunto: " + state.controls.map((c) => c.id).join(", ") + "." : "") }
        ]
      };
      const response = await jsonFetch(endpoint + "/api/chat", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
      });
      return parseDecision(response.message?.content || "", state.controls);
    } catch (reason) {
      error = reason;
      rejection = String(reason.message || reason).slice(0, 250);
    }
  }
  throw new Error("Falha de decisao do agente: " + (error?.message || error));
}

async function observe(page, persona) {
  const allControls = await page.locator(CONTROL_SELECTOR).evaluateAll((nodes) => nodes.map((el, index) => {
    const style = window.getComputedStyle(el);
    if (el.getClientRects().length === 0 || style.visibility === "hidden" || style.display === "none") return null;
    const tag = el.tagName;
    const options = tag === "SELECT" ? [...el.options].slice(0, 15).map((opt) => ({
      value: opt.value.slice(0, 70), text: opt.textContent.trim().slice(0, 60)
    })) : undefined;
    return {
      id: index, tag, type: (el.getAttribute("type") || "").toLowerCase(),
      name: (el.innerText || el.getAttribute("aria-label") || el.getAttribute("title") || "").trim().slice(0, 75),
      placeholder: (el.getAttribute("placeholder") || "").slice(0, 75),
      href: el.getAttribute("href") || "",
      disabled: Boolean(el.disabled),
      options
    };
  }).filter(Boolean).slice(0, 100));
  const pageState = await page.evaluate(async (key) => {
    let store = null;
    try {
      const bridge = window.nexusDesktop?.pdvStore;
      const row = bridge?.load ? await bridge.load(key) : null;
      const raw = row?.snapshotJson ?? window.localStorage.getItem(key);
      store = raw ? JSON.parse(raw) : null;
    } catch { /* reported as missing state */ }
    return {
      route: window.location.hash,
      pageText: (document.body?.innerText || "").slice(0, 12000),
      store
    };
  }, MAIN_PDV_STORE_KEY);
  // IDs curtos e consecutivos para o LLM; domIndex preserva indice real do locator.
  // Personas de navegacao recebem exclusivamente os links do menu, evitando que
  // modelos CPU pequenos confundam o destino com botoes do caixa.
  const menuOnly = ["route", "routeText"].includes(persona.goal.kind);
  const candidates = menuOnly
    ? allControls.filter((c) => c.tag === "A" && c.href.startsWith("#/"))
    : allControls.slice(0, 60);
  const controls = candidates.map((control, index) => ({
    ...control, domIndex: control.id, id: index + 1
  }));
  return {
    ...pageState,
    controls,
    indicators: {
      cashOpen: Boolean(pageState.store?.cashSession && !pageState.store.cashSession.closedAt),
      completedSales: pageState.store?.completedSales?.length || 0,
      products: pageState.store?.catalogProducts?.length || 0,
      customers: pageState.store?.registeredCustomers?.length || 0
    }
  };
}

async function applyDecision(page, decision, controls) {
  if (decision.action === "done") return;
  const control = controls.find((item) => item.id === decision.elementId);
  if (!control) throw new Error("Controle nao estava na lista visivel");
  const target = page.locator(CONTROL_SELECTOR).nth(control.domIndex);
  if (!(await target.isVisible()) || !(await target.isEnabled())) throw new Error("Controle mudou desde a observacao");
  if (decision.action === "click") await target.click({ timeout: 3500 });
  else if (decision.action === "fill") await target.fill(decision.value, { timeout: 3500 });
  else if (decision.action === "press") await target.press(decision.key, { timeout: 3500 });
  else if (decision.action === "select") await target.selectOption(decision.value, { timeout: 3500 });
  await page.waitForTimeout(220);
}

async function runPersona(persona, model, maxSteps) {
  const folder = path.join(output, persona.id);
  await fs.mkdir(folder, { recursive: true });
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), "pdv-ollama-persona-"));
  const entry = path.join(root, "qa", "ollama-persona-entry.cjs");
  const binary = path.join(root, "node_modules", "electron", "dist", process.platform === "win32" ? "electron.exe" : "electron");
  const result = { persona: persona.id, profile: persona.profile, objective: persona.objective, goal: persona.goal,
    status: "failed", error: null, actions: [], screenshots: [], runtimeErrors: [], startedAt: new Date().toISOString() };
  let app, context, page;
  let tracing = false;
  try {
    app = await electron.launch({
      args: [entry], executablePath: binary, cwd: root, timeout: 45000,
      env: {
        ...process.env,
        NEXUS_APP: "pdv-demo",
        NEXUS_QA_USER_DATA_DIR: userData,
        NEXUS_QA: "1",
        OLLAMA_NO_CLOUD: "1"
      }
    });
    context = app.context();
    // Requisicoes HTTP externas do renderer sao bloqueadas: sem endpoints de clientes.
    await context.route("**/*", async (route) => {
      const uri = route.request().url();
      if (/^https?:/i.test(uri) && !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/i.test(uri)) {
        await route.abort("blockedbyclient");
      } else {
        await route.continue();
      }
    });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    tracing = true;
    page = await app.firstWindow();
    page.on("pageerror", (e) => result.runtimeErrors.push(String(e.message).slice(0, 300)));
    await page.waitForSelector('a[href="#/caixa"]', { timeout: 25000 });
    // Apenas fixtures sinteticas em SQLite exclusivo por persona; nenhuma instalacao do cliente.
    await page.evaluate(async ({ key, baseline }) => {
      const raw = JSON.stringify(baseline);
      window.localStorage.setItem(key, raw);
      if (window.nexusDesktop?.pdvStore?.save) await window.nexusDesktop.pdvStore.save(key, raw);
    }, { key: MAIN_PDV_STORE_KEY, baseline: PDV_BUSINESS_BASELINE });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('a[href="#/caixa"]', { timeout: 25000 });
    const initial = path.join(folder, "00-inicio.png");
    await page.screenshot({ path: initial });
    result.screenshots.push(path.relative(output, initial));

    for (let index = 0; index < maxSteps; index += 1) {
      const state = await observe(page, persona);
      if (goalAchieved(persona.goal, state)) {
        result.status = "passed";
        break;
      }
      let decision;
      try {
        decision = await nextDecision(persona, state, result.actions, maxSteps, model);
      } catch (error) {
        result.error = error.message;
        break;
      }
      const action = { step: index + 1, action: decision.action, elementId: decision.elementId ?? null,
        reason: decision.reason || "", outcome: "attempted" };
      // Registrar o valor apenas quando for um dado ficticio e curto, sem capturar dados pessoais.
      if (decision.action === "fill" && /^(QA |00101|98001|150|9[,.]90)/i.test(decision.value)) action.value = decision.value;
      result.actions.push(action);
      if (decision.action === "done") {
        action.outcome = "declared-done";
        result.error = "Agente declarou termino sem comprovacao da meta";
        break;
      }
      try {
        await applyDecision(page, decision, state.controls);
        action.outcome = "executed";
      } catch (error) {
        action.outcome = "interaction-error";
        action.error = String(error.message).slice(0, 300);
      }
      const screenshot = path.join(folder, String(index + 1).padStart(2, "0") + "-apos-acao.png");
      await page.screenshot({ path: screenshot }).catch(() => {});
      result.screenshots.push(path.relative(output, screenshot));
    }
    if (page && goalAchieved(persona.goal, await observe(page, persona))) {
      result.status = "passed";
      result.error = null;
    } else if (!result.error) result.error = "Meta nao atingida no limite de passos";
  } catch (error) {
    result.error = String(error.message || error).slice(0, 500);
    if (page) await page.screenshot({ path: path.join(folder, "falha.png") }).catch(() => {});
  } finally {
    if (tracing) await context.tracing.stop({ path: path.join(folder, "trace.zip") }).catch(() => {});
    if (app) await app.close().catch(() => {});
    await fs.rm(userData, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 }).catch(() => {});
    result.finishedAt = new Date().toISOString();
    await fs.writeFile(path.join(folder, "result.json"), JSON.stringify(result, null, 2) + "\n");
  }
  console.log((result.status === "passed" ? "PASS " : "FAIL ") + persona.id + (result.error ? ": " + result.error : ""));
  return result;
}

function reportMarkdown(data) {
  const rows = data.results.map((r) =>
    "| " + r.persona + " | " + (r.status === "passed" ? "APROVADO" : "FALHOU") +
    " | " + r.actions.length + " | " + (r.error || "-").replaceAll("|", "/").replaceAll("\n", " ").slice(0, 150) + " |");
  return [
    "# PDV Nexus - Auditoria com clientes sinteticos Ollama",
    "",
    "- Origem: GitHub Actions, Electron real, Ollama local (sem API paga)",
    "- Modelo: " + data.model,
    "- Inicio: " + data.startedAt,
    "- Fim: " + data.finishedAt,
    "- Personas: " + data.total + " | Aprovadas: " + data.passed + " | Falharam: " + data.failed,
    "- Aprovar = objetivo verificado por rota, DOM ou snapshot de dados; nunca por declaracao do modelo.",
    "",
    "| Persona | Resultado | Acoes | Motivo |",
    "| --- | --- | ---: | --- |",
    ...rows, "",
    "## Escopo e limites", "",
    "Os perfis sao sintéticos, nao pessoas reais. Nao houve teste de carga nem medicao de acessibilidade formal.",
    "As falhas podem decorrer de instrucoes do modelo, UI pouco intuitiva, tempo limite ou bug funcional.",
    "Consulte capturas e traces por persona antes de atribuir causa. Sem publicacao e sem uso de dados reais.",
    ""
  ].join("\n");
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const config = await readPersonaConfig(path.resolve(args.config || path.join(cwd, "ollama-personas.config.json")));
  const count = Math.min(config.personas.length, Math.max(1, Number.parseInt(String(args.count || config.personas.length), 10) || 1));
  const model = String(args.model || config.defaultModel);
  if (!/^qwen3:(0\.6b|1\.7b)$/.test(model)) throw new Error("Modelo fora da allowlist local: " + model);
  const models = await jsonFetch(endpoint + "/api/tags", { method: "GET" }, 15000);
  if (!(models.models || []).some((m) => m.name === model || m.model === model)) throw new Error("Modelo Ollama local nao instalado: " + model);
  const startedAt = new Date().toISOString();
  const results = [];
  for (const persona of config.personas.slice(0, count)) {
    results.push(await runPersona(persona, model, Math.min(20, Number(config.maxSteps) || 12)));
  }
  const summary = { schemaVersion: 1, model, startedAt, finishedAt: new Date().toISOString(),
    total: results.length, passed: results.filter((r) => r.status === "passed").length,
    failed: results.filter((r) => r.status !== "passed").length, results };
  await fs.writeFile(path.join(output, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  await fs.writeFile(path.join(output, "report.md"), reportMarkdown(summary));
  console.log("TOTAL " + summary.total + " PASS " + summary.passed + " FAIL " + summary.failed);
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error("ERRO INFRAESTRUTURA QA OLLAMA:", error);
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, "infra-error.txt"), String(error?.stack || error).slice(0, 4000) + "\n");
  process.exitCode = 1;
});
