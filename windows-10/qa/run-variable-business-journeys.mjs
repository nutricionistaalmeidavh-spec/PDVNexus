#!/usr/bin/env node
import {mkdir,mkdtemp,rm,writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {loadQaManifest,resolveEnvironment,resolveViewport} from "../tools/artisys-qa/src/manifest.js";
import {runQaFlow} from "../tools/artisys-qa/src/runner.js";
import {hydratePdvBusinessFlowSteps} from "./pdv-business-baseline.mjs";
import {planVariableJourneys} from "./variable-business-journeys.mjs";

const argv=process.argv.slice(2);
const args={};
for(let i=0;i<argv.length;i++)if(argv[i].startsWith("--"))args[argv[i].slice(2)]=argv[++i];
const output=path.resolve(args.output||"qa-variable-artifacts");
const seeds=(args.seeds||"1101,1102,1103,1104").split(",").map(x=>Number(x));
if(seeds.length>8)throw Error("No maximo oito jornadas por job");
const journeys=planVariableJourneys(seeds);
const {manifest,rootDir}=await loadQaManifest("qa/artisys-qa.config.json");
const {name:environmentName,environment}=resolveEnvironment(manifest);
const viewport=resolveViewport(manifest);
const scratch=await mkdtemp(path.join(os.tmpdir(),"pdv-sequences-"));
const records=[];
await mkdir(output,{recursive:true});
try{
  for(const journey of journeys){
    const filename=path.join(scratch,journey.id+".json");
    await writeFile(filename,JSON.stringify({id:journey.id,steps:hydratePdvBusinessFlowSteps(journey.steps)},null,2));
    const started=Date.now();
    const record={id:journey.id,seed:journey.seed,operations:journey.operations,product:journey.product,
      stockEntry:journey.quantity,expectedFinalStock:journey.expectedFinalStock,
      assertions:journey.steps.filter(s=>["expectDesktopStoreJson","expectText"].includes(s.action)).length,
      totalSteps:journey.steps.length,status:"failed"};
    try{
      const evidence=await runQaFlow({
        manifest,rootDir,environmentName,environment,flowName:journey.id,flowFile:filename,
        viewport,outputRoot:path.join(output,journey.id)
      });
      record.status="passed";record.evidenceDir=path.relative(output,evidence.outputDir);
      console.log("PASS "+journey.id+" ("+record.assertions+" assertivas) "+journey.operations.join(" > "));
    }catch(error){
      record.reason=String(error?.summary?.failure?.message||error?.message||error).slice(0,700);
      console.error("FAIL "+journey.id+": "+record.reason);
    }
    record.durationMs=Date.now()-started;records.push(record);
  }
}finally{await rm(scratch,{recursive:true,force:true});}
const summary={schemaVersion:1,kind:"variable-commercial-sequences",total:records.length,
  passed:records.filter(r=>r.status==="passed").length,
  failed:records.filter(r=>r.status!=="passed").length,
  totalAssertions:records.reduce((n,r)=>n+r.assertions,0),records};
await writeFile(path.join(output,"summary.json"),JSON.stringify(summary,null,2)+"\n");
await writeFile(path.join(output,"report.md"),[
  "# PDV Nexus - Jornadas comerciais variaveis e verificacao canonica","",
  "Varias operacoes na MESMA instancia Electron e SQLite por jornada, sem reset entre operacoes.",
  "Depois de cada etapa: verificacao canonica, reload, nova verificacao e comparacao do dashboard.","",
  "| Jornada | Produto | Operacoes | Assertivas | Status |","|---|---|---|---:|---|",
  ...records.map(r=>"| "+r.id+" | "+r.product+" | "+r.operations.join(" > ")+" | "+r.assertions+" | "+r.status+" |"),
  "","## Falhas",...records.filter(r=>r.reason).map(r=>"- "+r.id+": "+r.reason),
  ...(summary.failed===0?["Nenhuma falha encontrada nas sequencias executadas."]:[]),
  "","## Limites","Seeds deterministicas nao representam clientes humanos nem carga simultanea. O teste nao verifica todas as combinacoes possiveis.",
  "Nenhum dado real, credencial de producao, servico pago ou publicacao utilizados.",""
].join("\n"));
console.log("SEQUENCES TOTAL="+summary.total+" PASS="+summary.passed+" FAIL="+summary.failed+" ASSERTS="+summary.totalAssertions);
if(summary.failed)process.exitCode=1;
