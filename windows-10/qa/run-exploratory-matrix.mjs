#!/usr/bin/env node
// Fuzz deterministico de UI (Gremlins.js) e acessibilidade (axe-core) sobre Electron real.
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "../tools/artisys-qa/node_modules/playwright/index.mjs";
import { PDV_BUSINESS_BASELINE, MAIN_PDV_STORE_KEY } from "./pdv-business-baseline.mjs";
import { PDV_ROUTES, canonicalSignature, classifyExploration, businessStateDelta } from "./exploratory-metrics.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "..");
const opts = Object.fromEntries(process.argv.slice(2).reduce((a, s, i, v) => {
  if (s.startsWith("--")) a.push([s.slice(2), v[i+1] && !v[i+1].startsWith("--") ? v[i+1] : true]);
  return a;
}, []));
const output = path.resolve(opts.output || "qa-exploration-artifacts");
const seeds = Number(opts.seeds || 2);
const actions = Number(opts.actions || 50);
if (!Number.isInteger(seeds) || seeds < 1 || seeds > 4) throw new Error("seeds fora de 1..4");
if (!Number.isInteger(actions) || actions < 10 || actions > 200) throw new Error("actions fora de 10..200");

const deps = path.join(root, "tools", "artisys-qa", "node_modules");
const gremlinsScript = path.join(deps, "gremlins.js", "dist", "gremlins.min.js");
const axeScript = path.join(deps, "axe-core", "axe.min.js");
const entry = path.join(dir, "ollama-persona-entry.cjs");
const binary = path.join(root, "node_modules", "electron", "dist", process.platform === "win32" ? "electron.exe" : "electron");

async function readStore(page) {
  return page.evaluate(async key => {
    const bridge = window.nexusDesktop?.pdvStore;
    if (!bridge?.load) throw new Error("Bridge SQLite canonico indisponivel");
    const row = await bridge.load(key);
    return row?.snapshotJson ? JSON.parse(row.snapshotJson) : null;
  }, MAIN_PDV_STORE_KEY);
}
async function seedStore(page) {
  await page.evaluate(async ({key, baseline}) => {
    const raw=JSON.stringify(baseline);
    window.localStorage.setItem(key, raw);
    const bridge=window.nexusDesktop?.pdvStore;
    if (!bridge?.save) throw new Error("Bridge SQLite indisponivel para teste");
    await bridge.save(key,raw);
  }, {key:MAIN_PDV_STORE_KEY,baseline:PDV_BUSINESS_BASELINE});
  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator('a[href="#/caixa"]').waitFor({timeout:20000});
}
async function runScenario(name,hash,seed) {
  const id=name+"-"+seed;
  const folder=path.join(output,id);
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),"pdv-exploratory-"));
  await fs.mkdir(folder,{recursive:true});
  const result={id,route:hash,seed,status:"failed",actions:0,issues:[],a11y:[],pageErrors:[],screenshots:[],businessEffects:null};
  let app,context,page,traceStarted=false;
  try {
    app=await electron.launch({
      args:[entry],executablePath:binary,cwd:root,timeout:45000,
      env:{...process.env,NEXUS_APP:"pdv-demo",NEXUS_QA_USER_DATA_DIR:temp,NEXUS_QA:"1",OLLAMA_NO_CLOUD:"1"}
    });
    context=app.context();
    await context.route("**/*",async route=>{
      const u=route.request().url();
      if (/^https?:/i.test(u) && !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/i.test(u)) await route.abort("blockedbyclient");
      else await route.continue();
    });
    await context.tracing.start({screenshots:true,snapshots:true,sources:true});
    traceStarted=true;
    page=await app.firstWindow();
    page.on("pageerror",e=>result.pageErrors.push(String(e.message).slice(0,240)));
    await page.locator('a[href="#/caixa"]').waitFor({timeout:25000});
    await seedStore(page);
    await page.locator('a[href="'+hash+'"]').click();
    await page.waitForTimeout(200);
    if (await page.evaluate(()=>location.hash)!==hash) throw new Error("Falha ao entrar em "+hash);
    const baselineStore=await readStore(page);
    await page.screenshot({path:path.join(folder,"01-inicio.png")});
    result.screenshots.push("01-inicio.png");
    await page.addScriptTag({path:axeScript});
    result.a11y=await page.evaluate(async()=>{
      const a=await window.axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}});
      return a.violations.map(v=>({id:v.id,impact:v.impact,description:v.help,nodes:v.nodes.length}));
    });
    await page.addScriptTag({path:gremlinsScript});
    const executed=await page.evaluate(async ({seed,actions})=>{
      if (!window.gremlins?.createHorde) throw new Error("gremlins nao carregado");
      const events=[];
      const actual={ click:0, input:0, change:0, scroll:0, keydown:0 };
      const samples=[];
      const watch=(e)=>{
        if (!(e.type in actual)) return;
        actual[e.type] += 1;
        if(samples.length < 200) samples.push({
          type:e.type,
          tag:e.target?.tagName || "?",
          name:(e.target?.getAttribute?.("aria-label") || e.target?.getAttribute?.("placeholder") || "").slice(0,65)
        });
      };
      for(const type of Object.keys(actual)) document.addEventListener(type,watch,true);
      const log={log:(...v)=>events.push(v.join(" ").slice(0,180)),info:(...v)=>events.push(v.join(" ").slice(0,180)),
        warn:(...v)=>events.push(v.join(" ").slice(0,180)),error:(...v)=>events.push(v.join(" ").slice(0,180))};
      const g=window.gremlins;
      const h=g.createHorde({
        randomizer:new g.Chance(seed),logger:log,
        species:[
          g.species.clicker({clickTypes:["click"],canClick:el=>{
            const href=el?.closest?.("a")?.getAttribute("href");
            return !href || href.startsWith("#");
          },showAction:()=>{}}),
          g.species.formFiller(),
          g.species.scroller()
        ],
        strategies:[g.strategies.allTogether({nb:actions})]
      });
      try { await h.unleash(); }
      finally { for(const type of Object.keys(actual)) document.removeEventListener(type,watch,true); }
      return { counts:actual, observed:samples, gremlinsLog:events.slice(0,300) };
    },{seed,actions});
    result.actions=Object.values(executed.counts).reduce((a,b)=>a+b,0);
    result.eventCounts=executed.counts;
    await fs.writeFile(path.join(folder,"gremlins-events.json"),JSON.stringify(executed,null,2));
    await page.screenshot({path:path.join(folder,"02-fuzz.png")});
    result.screenshots.push("02-fuzz.png");
    await page.waitForTimeout(500);
    const before=await readStore(page);
    result.businessEffects=businessStateDelta(baselineStore,before);
    await page.reload({waitUntil:"domcontentloaded"});
    await page.locator('a[href="#/caixa"]').waitFor({timeout:20000});
    const after=await readStore(page);
    await page.screenshot({path:path.join(folder,"03-reload.png")});
    result.screenshots.push("03-reload.png");
    const review=classifyExploration({route:hash,expectedRoute:hash,before,after,errors:result.pageErrors,
      accessibility:result.a11y,actions:result.actions});
    result.issues=review.findings;
    if (canonicalSignature(before)!==canonicalSignature(after)) result.issues.push({
      type:"persistence-regression",severity:"critical",description:"SQLite mudou entre antes/depois de recarregar"});
    result.status=result.issues.some(x=>x.severity==="critical")?"failed":"checked";
  }catch(e){
    result.issues.push({type:"scenario-error",severity:"critical",description:String(e.message||e).slice(0,300)});
    if(page)await page.screenshot({path:path.join(folder,"failure.png")}).catch(()=>{});
  }finally{
    if(traceStarted)await context.tracing.stop({path:path.join(folder,"trace.zip")}).catch(()=>{});
    if(app)await app.close().catch(()=>{});
    await fs.rm(temp,{recursive:true,force:true,maxRetries:4,retryDelay:250}).catch(()=>{});
    await fs.writeFile(path.join(folder,"result.json"),JSON.stringify(result,null,2)+"\n");
  }
  console.log(result.status.toUpperCase()+" "+id+" issues="+result.issues.length);
  return result;
}
async function main(){
  await fs.mkdir(output,{recursive:true});
  await Promise.all([fs.access(gremlinsScript),fs.access(axeScript)]);
  const results=[];
  for(let i=0;i<seeds;i++)for(const [name,hash] of PDV_ROUTES)
    results.push(await runScenario(name,hash,20261106+i));
  const summary={total:results.length,checked:results.filter(x=>x.status==="checked").length,
    failed:results.filter(x=>x.status==="failed").length,plannedActions:results.length*actions,
    observedEvents:results.reduce((total,r)=>total+r.actions,0),
    campaignsWithBusinessChanges:results.filter(r=>r.businessEffects?.changed===true).length,
    businessChangesByScenario:results.map(r=>({scenario:r.id,...(r.businessEffects||{changed:false})})),
    results};
  await fs.writeFile(path.join(output,"summary.json"),JSON.stringify(summary,null,2)+"\n");
  const lines=["# PDV Nexus - Exploracao independente da IA","",
    "Gremlins.js 2.2.0 + axe-core + Playwright/Electron; testes locais e isolados.","",
    "Cenarios: "+summary.total+" | Ataques programados: "+summary.plannedActions+" | Eventos DOM observados: "+summary.observedEvents+
    " | Campanhas com alteracao canonica: "+summary.campaignsWithBusinessChanges+" | Falhas criticas: "+summary.failed,"",
    "| Cenario | Resultado | Eventos DOM | Dados do negocio mudaram? | Achados |","|---|---|---:|---|---:|",
    ...results.map(r=>"| "+r.id+" | "+r.status+" | "+r.actions+" | "+(r.businessEffects?.changed===true?"Sim":"Nao")+
      " | "+r.issues.length+" |"),"",
    "## Efeito nas fontes canonicas",
    ...results.map(r=>"- "+r.id+": "+JSON.stringify(r.businessEffects)),
    "",
    "Interpretacao: evento DOM nao equivale a operacao comercial. Se nao houve alteracao canonica, a campanha so comprovou robustez de interacao; nao conclusao de negocio.","",
    "## Achados",...results.flatMap(r=>r.issues.slice(0,8).map(f=>"- "+r.id+" ["+f.severity+"] "+f.type+": "+f.description)),"",
    "Sem falha critica nao significa ausência de bugs. Cobertura funcional dos 25 fluxos permanece em outra suite.",
    "Traces, logs, prints e seeds permitem reproduzir cada achado. A quantidade de eventos nao prova cobertura de negocio.",""];
  await fs.writeFile(path.join(output,"report.md"),lines.join("\n"));
  console.log("TOTAL "+summary.total+" CHECKED "+summary.checked+" FAILED "+summary.failed);
  if(summary.failed)process.exitCode=1;
}
main().catch(async e=>{console.error(e);await fs.mkdir(output,{recursive:true});
  await fs.writeFile(path.join(output,"infra-error.txt"),String(e.stack||e));
  process.exitCode=1;});
