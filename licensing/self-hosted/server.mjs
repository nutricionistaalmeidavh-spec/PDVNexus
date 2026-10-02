import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const HOST=process.env.PDV_LICENSE_HOST||'127.0.0.1';
const PORT=Number(process.env.PDV_LICENSE_PORT||8790);
const ADMIN_TOKEN=String(process.env.PDV_LICENSE_ADMIN_TOKEN||'');
const DB_PATH=process.env.PDV_LICENSE_DB||path.resolve('data/pdv-nexus-licenses.sqlite');
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function normalizeEmail(value){const email=String(value||'').trim().toLowerCase();if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Object.assign(new Error('E-mail inválido.'),{status:422});return email;}
function normalizeCode(value){const code=String(value||'').trim().toUpperCase().replace(/\s+/g,'');if(!/^[A-Z0-9-]{6,64}$/.test(code))throw Object.assign(new Error('Código de licença inválido.'),{status:422});return code;}
function codeHash(code){return crypto.createHash('sha256').update(normalizeCode(code)).digest('hex');}
function generateCode(){const bytes=crypto.randomBytes(12),chars=[...bytes].map(v=>ALPHABET[v%ALPHABET.length]);return 'NX-'+[0,4,8].map(i=>chars.slice(i,i+4).join('')).join('-');}
function openDb(filePath=DB_PATH){mkdirSync(path.dirname(filePath),{recursive:true});const db=new DatabaseSync(filePath);db.exec(`CREATE TABLE IF NOT EXISTS licenses (id TEXT PRIMARY KEY,email TEXT NOT NULL,code_hash TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'active',max_devices INTEGER NOT NULL DEFAULT 1,expires_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email);CREATE TABLE IF NOT EXISTS license_activations (id TEXT PRIMARY KEY,license_id TEXT NOT NULL,installation_id TEXT NOT NULL,app_version TEXT NOT NULL,channel TEXT NOT NULL,activated_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,UNIQUE(license_id,installation_id));`);return db;}
function readJson(req){return new Promise((resolve,reject)=>{let raw='';req.setEncoding('utf8');req.on('data',chunk=>{raw+=chunk;if(raw.length>131072)req.destroy();});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{});}catch{reject(Object.assign(new Error('JSON inválido.'),{status:400}));}});req.on('error',reject);});}
function send(res,status,payload){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(payload));}
function authorized(req){return Boolean(ADMIN_TOKEN)&&req.headers.authorization==='Bearer '+ADMIN_TOKEN;}

async function handle(req,res,db){
 try{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/health')return send(res,200,{ok:true,service:'pdv-nexus-license-self-hosted'});
  if(req.method==='POST'&&url.pathname==='/v1/admin/licenses'){
   if(!authorized(req))return send(res,401,{error:'Não autorizado.'});const input=await readJson(req),now=new Date().toISOString(),email=normalizeEmail(input.email),code=input.code?normalizeCode(input.code):generateCode(),id=crypto.randomUUID(),max=Math.max(1,Math.min(50,Number(input.max_devices||1)||1)),expires=input.expires_at?new Date(input.expires_at).toISOString():null;
   db.prepare("INSERT INTO licenses (id,email,code_hash,status,max_devices,expires_at,created_at,updated_at) VALUES (?,?,?,'active',?,?,?,?)").run(id,email,codeHash(code),max,expires,now,now);
   return send(res,201,{id,email,code,status:'active',max_devices:max,expires_at:expires,created_at:now});
  }
  if(req.method==='GET'&&url.pathname==='/v1/admin/licenses'){
   if(!authorized(req))return send(res,401,{error:'Não autorizado.'});const rows=db.prepare(`SELECT l.id,l.email,l.status,l.max_devices,l.expires_at,l.created_at,l.updated_at,COUNT(a.id) active_devices FROM licenses l LEFT JOIN license_activations a ON a.license_id=l.id GROUP BY l.id ORDER BY l.created_at DESC`).all();return send(res,200,{licenses:rows});
  }
  if(req.method==='POST'&&url.pathname==='/v1/admin/licenses/revoke'){
   if(!authorized(req))return send(res,401,{error:'Não autorizado.'});const input=await readJson(req),now=new Date().toISOString(),id=String(input.license_id||'').trim(),info=db.prepare("UPDATE licenses SET status='revoked',updated_at=? WHERE id=?").run(now,id);if(!Number(info.changes||0))return send(res,404,{error:'Licença não encontrada.'});return send(res,200,{id,status:'revoked',updated_at:now});
  }
  if(req.method==='POST'&&url.pathname==='/v1/licenses/activate'){
   const input=await readJson(req),email=normalizeEmail(input.email),code=normalizeCode(input.code),installationId=String(input.installation_id||'').trim();if(installationId.length<16)return send(res,422,{error:'installation_id inválido.'});
   const lic=db.prepare('SELECT id,email,status,max_devices,expires_at FROM licenses WHERE email=? AND code_hash=? LIMIT 1').get(email,codeHash(code));if(!lic)return send(res,401,{error:'E-mail ou código de ativação inválido.'});if(lic.status!=='active')return send(res,403,{error:'Esta licença está desativada.'});
   const now=new Date().toISOString();if(lic.expires_at&&Date.parse(lic.expires_at)<=Date.parse(now))return send(res,403,{error:'Esta licença expirou.'});
   let act=db.prepare('SELECT id FROM license_activations WHERE license_id=? AND installation_id=? LIMIT 1').get(lic.id,installationId);
   if(!act){const count=Number(db.prepare('SELECT COUNT(*) count FROM license_activations WHERE license_id=?').get(lic.id).count||0);if(count>=Number(lic.max_devices||1))return send(res,409,{error:'Esta licença já atingiu o limite de computadores.'});act={id:crypto.randomUUID()};db.prepare('INSERT INTO license_activations (id,license_id,installation_id,app_version,channel,activated_at,last_seen_at) VALUES (?,?,?,?,?,?,?)').run(act.id,lic.id,installationId,String(input.app_version||'0.0.0').slice(0,64),String(input.channel||'unknown').slice(0,64),now,now);}else{db.prepare('UPDATE license_activations SET app_version=?,channel=?,last_seen_at=? WHERE id=?').run(String(input.app_version||'0.0.0').slice(0,64),String(input.channel||'unknown').slice(0,64),now,act.id);}
   return send(res,200,{activation_id:act.id,activated_at:now,license:{id:lic.id,email:lic.email,status:lic.status,max_devices:Number(lic.max_devices||1),expires_at:lic.expires_at||null}});
  }
  return send(res,404,{error:'Not found.'});
 }catch(error){const status=Number(error?.status)||500;return send(res,status,{error:status>=500?'Internal server error.':String(error?.message||'Falha.')});}
}
function createServer({dbPath=DB_PATH}={}){const db=openDb(dbPath),server=http.createServer((req,res)=>void handle(req,res,db));server.on('close',()=>{try{db.close();}catch{}});return server;}
if(import.meta.url===new URL(process.argv[1]||'', 'file://').href){createServer().listen(PORT,HOST,()=>console.log(`PDV Nexus licensing em http://${HOST}:${PORT}`));}
export {createServer,normalizeEmail,normalizeCode,generateCode};
