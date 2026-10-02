'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const LICENSE_STATE_VERSION = 1;

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.');
  return email;
}

function normalizeCode(value) {
  const code = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9-]{6,64}$/.test(code)) throw new Error('Informe um código de ativação válido.');
  return code;
}

function atomicWrite(filePath, buffer) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = filePath + '.tmp';
  fs.writeFileSync(tempPath, buffer);
  fs.renameSync(tempPath, filePath);
}

function createPdvLicenseStore({ app, safeStorage, randomUUID = crypto.randomUUID } = {}) {
  const rootDir = app.getPath('userData');
  const installationPath = path.join(rootDir, 'pdv-license-installation.json');
  const licensePath = path.join(rootDir, 'pdv-license.bin');
  const encryptionAvailable = () => {
    try { return Boolean(safeStorage?.isEncryptionAvailable?.()); } catch { return false; }
  };
  function getInstallationId() {
    try {
      const saved = JSON.parse(fs.readFileSync(installationPath, 'utf8'));
      if (typeof saved.installation_id === 'string' && saved.installation_id.length >= 16) return saved.installation_id;
    } catch {}
    const installationId = String(randomUUID());
    atomicWrite(installationPath, Buffer.from(JSON.stringify({ schema_version: 1, installation_id: installationId, created_at: new Date().toISOString() }, null, 2)));
    return installationId;
  }
  function load() {
    if (!encryptionAvailable() || !fs.existsSync(licensePath)) return null;
    try {
      const parsed = JSON.parse(safeStorage.decryptString(fs.readFileSync(licensePath)));
      return parsed?.schema_version === LICENSE_STATE_VERSION && parsed?.status === 'active' ? parsed : null;
    } catch { return null; }
  }
  function save(record) {
    if (!encryptionAvailable()) throw new Error('O armazenamento seguro do Windows não está disponível.');
    const payload = {
      schema_version: LICENSE_STATE_VERSION,
      license_id: String(record.license_id || ''),
      activation_id: String(record.activation_id || ''),
      email: normalizeEmail(record.email),
      installation_id: String(record.installation_id || ''),
      status: 'active',
      activated_at: String(record.activated_at || new Date().toISOString())
    };
    atomicWrite(licensePath, safeStorage.encryptString(JSON.stringify(payload)));
    return payload;
  }
  function clear() { try { fs.rmSync(licensePath, { force: true }); } catch {} }
  return { getInstallationId, load, save, clear, encryptionAvailable };
}

function requestJson(url, { method = 'GET', headers = {}, body = null, timeoutMs = 7000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(new URL(url), { method, headers, timeout: timeoutMs }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let payload = null; try { payload = raw ? JSON.parse(raw) : null; } catch {}
        resolve({ status: Number(res.statusCode || 0), payload });
      });
    });
    req.on('timeout', () => req.destroy(new Error('Tempo esgotado ao validar a licença.')));
    req.on('error', reject);
    if (body != null) req.write(body);
    req.end();
  });
}

function createLicenseHttpClient({ endpoint, timeoutMs = 7000 } = {}) {
  const base = String(endpoint || '').trim().replace(/\/+$/, '');
  return { async activate({ email, code, installationId, appVersion, channel }) {
    if (!base) throw new Error('Servidor de licenças não configurado.');
    const response = await requestJson(base + '/v1/licenses/activate', {
      method: 'POST', timeoutMs,
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email: normalizeEmail(email), code: normalizeCode(code), installation_id: String(installationId || ''), app_version: String(appVersion || '0.0.0'), channel: String(channel || 'unknown') })
    });
    if (response.status < 200 || response.status >= 300) throw new Error(String(response.payload?.error || 'Não foi possível ativar esta licença.'));
    return response.payload;
  }};
}

function activationHtml() {
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ativar PDV Nexus</title>
 <style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f4f6f8;font-family:Segoe UI,Arial,sans-serif;color:#111827}.card{width:min(460px,100%);background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:28px;box-shadow:0 18px 50px rgba(17,24,39,.12)}.brand{font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#6b7280}h1{margin:8px 0;font-size:27px}p{color:#4b5563;line-height:1.5}label{display:block;font-size:13px;font-weight:700;margin:15px 0 7px}input{width:100%;height:46px;border:1px solid #d1d5db;border-radius:10px;padding:0 12px;font-size:15px}.actions{display:flex;gap:10px;margin-top:22px}button{height:44px;border-radius:10px;padding:0 18px;font-weight:800;cursor:pointer}.primary{flex:1;border:0;background:#111827;color:#fff}.secondary{border:1px solid #d1d5db;background:#fff}.status{min-height:22px;margin-top:14px;font-size:13px;color:#b91c1c}.ok{color:#047857}.small{font-size:12px;color:#6b7280;margin-top:16px}</style></head>
 <body><div class="card"><div class="brand">PDV Nexus</div><h1>Ativação da licença</h1><p>Informe o e-mail usado na compra e o código recebido. A internet é necessária somente nesta primeira ativação.</p>
 <form id="f"><label>E-mail</label><input id="email" type="email" required><label>Código de ativação</label><input id="code" required autocomplete="off"><div class="actions"><button class="secondary" id="exit" type="button">Sair</button><button class="primary" id="go">Ativar</button></div><div class="status" id="s"></div></form><div class="small">Depois de ativado, o caixa continua operando localmente mesmo sem internet.</div></div>
 <script>const f=document.getElementById('f'),s=document.getElementById('s'),go=document.getElementById('go');document.getElementById('exit').onclick=()=>window.pdvLicense.close();f.onsubmit=async e=>{e.preventDefault();go.disabled=true;s.className='status';s.textContent='Validando licença...';try{const r=await window.pdvLicense.activate({email:email.value,code:code.value});if(!r?.ok)throw new Error(r?.error||'Falha na ativação.');s.className='status ok';s.textContent='Licença ativada. Abrindo o PDV...';}catch(err){s.textContent=err?.message||'Falha na ativação.';go.disabled=false;}};</script></body></html>`;
}

async function promptForActivation({ BrowserWindow, ipcMain, store, client, installationId, packageMetadata }) {
 return new Promise(resolve => {
  let settled=false;
  const finish=value=>{if(settled)return;settled=true;ipcMain.removeHandler('pdv-license:activate');ipcMain.removeHandler('pdv-license:close');resolve(value);};
  const win=new BrowserWindow({width:520,height:620,resizable:false,maximizable:false,fullscreenable:false,show:false,title:'Ativar PDV Nexus',webPreferences:{preload:path.join(__dirname,'pdv-license-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:false}});
  ipcMain.removeHandler('pdv-license:activate'); ipcMain.removeHandler('pdv-license:close');
  ipcMain.handle('pdv-license:activate',async(_event,input)=>{try{const p=await client.activate({email:input?.email,code:input?.code,installationId,appVersion:packageMetadata.version,channel:packageMetadata.pdvUpdateChannel});const saved=store.save({license_id:p?.license?.id,activation_id:p?.activation_id,email:p?.license?.email||input?.email,installation_id:installationId,activated_at:p?.activated_at});setTimeout(()=>{try{win.close();}catch{}finish({licensed:true,source:'online-activation',license:saved});},250);return{ok:true};}catch(error){return{ok:false,error:String(error?.message||'Falha na ativação.')}}});
  ipcMain.handle('pdv-license:close',async()=>{try{win.close();}catch{}return true;});
  win.once('ready-to-show',()=>win.show()); win.on('closed',()=>finish({licensed:false,source:'cancelled'})); win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(activationHtml()));
 });
}

async function ensurePdvLicense({ app, BrowserWindow, ipcMain, safeStorage, packageMetadata = {}, endpoint = '' } = {}) {
 if (!packageMetadata.pdvLicenseRequired) return { licensed:true, source:'not-required' };
 const store=createPdvLicenseStore({app,safeStorage}); const installationId=store.getInstallationId(); const cached=store.load();
 if(cached?.status==='active'&&cached.installation_id===installationId&&cached.email) return {licensed:true,source:'local',license:cached};
 return promptForActivation({BrowserWindow,ipcMain,store,client:createLicenseHttpClient({endpoint}),installationId,packageMetadata});
}

module.exports={LICENSE_STATE_VERSION,normalizeEmail,normalizeCode,createPdvLicenseStore,createLicenseHttpClient,ensurePdvLicense};
