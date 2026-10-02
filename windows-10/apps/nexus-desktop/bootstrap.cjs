const path = require("node:path");
const electron = require("electron");
const { app, BrowserWindow, dialog, ipcMain } = electron;
const safeStorage = electron.safeStorage || null;
const pkg = require("./package.json");
const { preparePdvVersionMigration, startPdvAutoUpdater } = require("./pdv-lifecycle.cjs");
const { ensurePdvLicense } = require("./pdv-license.cjs");
const { createPdvTelemetry } = require("./pdv-telemetry.cjs");
let DatabaseSync = null; try { ({ DatabaseSync } = require("node:sqlite")); } catch { DatabaseSync = null; }
const isPdv = process.env.NEXUS_APP === "pdv-demo" || Boolean(pkg.pdvUpdateChannel);
let telemetry = null;

function prepareMigration(){if(!isPdv)return null;try{return preparePdvVersionMigration({DatabaseSync,dbPath:path.join(app.getPath("userData"),"pdv-nexus.sqlite"),backupDir:path.join(app.getPath("userData"),"pdv-upgrade-backups"),currentVersion:pkg.version});}catch(error){return error;}}
async function showMigrationError(error){await dialog.showMessageBox({type:"error",title:"Atualização interrompida",message:"O PDV Nexus não foi aberto porque a proteção de dados da atualização falhou.",detail:error?.message||String(error),buttons:["Fechar"]});app.quit();}

function startRuntime(){
 require("./main.cjs");
 if(isPdv){
  app.whenReady().then(async()=>{try{telemetry=createPdvTelemetry({app,dialog,safeStorage,packageMetadata:pkg,endpoint:pkg.pdvTelemetryEndpoint||process.env.PDV_TELEMETRY_ENDPOINT||""});await telemetry.start();}catch{telemetry=null;}});
  process.on("uncaughtExceptionMonitor",(error,origin)=>{try{telemetry?.recordFailure(error,{subsystem:"node",operation:String(origin||"uncaught_exception").slice(0,80)});}catch{}});
  app.on("render-process-gone",(_e,_w,details)=>{try{const reason=String(details?.reason||"render_process_gone").slice(0,80);const error=new Error(reason);error.name="RenderProcessGone";telemetry?.recordFailure(error,{subsystem:"renderer",operation:reason});}catch{}});
  app.on("before-quit",()=>{try{void telemetry?.stop();}catch{}});
 }
 if(isPdv&&pkg.pdvUpdateChannel&&pkg.pdvUpdateManifestUrl){app.whenReady().then(()=>setTimeout(()=>void(async()=>{const result=await startPdvAutoUpdater({app,dialog,channel:pkg.pdvUpdateChannel,manifestUrl:pkg.pdvUpdateManifestUrl});try{telemetry?.recordUpdaterStatus(result);}catch{}})(),8000));}
}

async function bootLicensedPdv(){
 try{
  const result=await ensurePdvLicense({app,BrowserWindow,ipcMain,safeStorage,packageMetadata:pkg,endpoint:pkg.pdvLicenseEndpoint||process.env.PDV_LICENSE_ENDPOINT||""});
  if(!result.licensed){app.quit();return;}
  const migrationError=prepareMigration(); if(migrationError instanceof Error){await showMigrationError(migrationError);return;}
  startRuntime();
 }catch(error){await dialog.showMessageBox({type:"error",title:"Licença do PDV Nexus",message:"Não foi possível iniciar a ativação do PDV Nexus.",detail:error?.message||String(error),buttons:["Fechar"]});app.quit();}
}
if(isPdv&&pkg.pdvLicenseRequired){app.whenReady().then(()=>void bootLicensedPdv());}else{const migrationError=prepareMigration();if(migrationError instanceof Error){app.whenReady().then(()=>void showMigrationError(migrationError));}else{startRuntime();}}
