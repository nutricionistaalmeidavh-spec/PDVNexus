const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function licenseError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}
function normalizeLicenseEmail(value) {
  const email=String(value||'').trim().toLowerCase();
  if(!email||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw licenseError(422,'E-mail inválido.');
  return email;
}
function normalizeLicenseCode(value) {
  const code=String(value||'').trim().toUpperCase().replace(/\s+/g,'');
  if(!/^[A-Z0-9-]{6,64}$/.test(code)) throw licenseError(422,'Código de licença inválido.');
  return code;
}
function generateLicenseCode(groups=3,groupSize=4) {
  const bytes=new Uint8Array(groups*groupSize);crypto.getRandomValues(bytes);
  const chars=[...bytes].map(v=>CODE_ALPHABET[v%CODE_ALPHABET.length]);
  const parts=[];for(let i=0;i<groups;i+=1)parts.push(chars.slice(i*groupSize,(i+1)*groupSize).join(''));
  return 'NX-'+parts.join('-');
}
async function hashLicenseCode(code) {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalizeLicenseCode(code)));
  return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
async function ensureLicenseSchema(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS licenses (
      id TEXT PRIMARY KEY,email TEXT NOT NULL,code_hash TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'active',
      max_devices INTEGER NOT NULL DEFAULT 1,expires_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS license_activations (
      id TEXT PRIMARY KEY,license_id TEXT NOT NULL,installation_id TEXT NOT NULL,app_version TEXT NOT NULL,
      channel TEXT NOT NULL,activated_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,UNIQUE(license_id,installation_id)
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_license_activations_license ON license_activations(license_id)')
  ]);
}
function validateActivationInput(input={}) {
  const installationId=String(input.installation_id||'').trim();
  if(installationId.length<16||installationId.length>128) throw licenseError(422,'installation_id inválido.');
  return {email:normalizeLicenseEmail(input.email),code:normalizeLicenseCode(input.code),installation_id:installationId,app_version:String(input.app_version||'0.0.0').slice(0,64),channel:String(input.channel||'unknown').slice(0,64)};
}
async function createLicense(db,input={},now=new Date().toISOString()) {
  await ensureLicenseSchema(db);
  const email=normalizeLicenseEmail(input.email),code=input.code?normalizeLicenseCode(input.code):generateLicenseCode(),codeHash=await hashLicenseCode(code);
  const maxDevices=Math.max(1,Math.min(50,Number(input.max_devices||1)||1)),expiresAt=input.expires_at?new Date(input.expires_at).toISOString():null,id=crypto.randomUUID();
  await db.prepare(`INSERT INTO licenses (id,email,code_hash,status,max_devices,expires_at,created_at,updated_at)
    VALUES (?,?,?,'active',?,?,?,?)`).bind(id,email,codeHash,maxDevices,expiresAt,now,now).run();
  return {id,email,code,status:'active',max_devices:maxDevices,expires_at:expiresAt,created_at:now};
}
async function activateLicense(db,input={},now=new Date().toISOString()) {
  await ensureLicenseSchema(db);const data=validateActivationInput(input),codeHash=await hashLicenseCode(data.code);
  const lic=await db.prepare('SELECT id,email,status,max_devices,expires_at FROM licenses WHERE email=? AND code_hash=? LIMIT 1').bind(data.email,codeHash).first();
  if(!lic) throw licenseError(401,'E-mail ou código de ativação inválido.');
  if(lic.status!=='active') throw licenseError(403,'Esta licença está desativada.');
  if(lic.expires_at&&Date.parse(lic.expires_at)<=Date.parse(now)) throw licenseError(403,'Esta licença expirou.');
  let activation=await db.prepare('SELECT id FROM license_activations WHERE license_id=? AND installation_id=? LIMIT 1').bind(lic.id,data.installation_id).first();
  if(!activation){
    const count=await db.prepare('SELECT COUNT(*) AS count FROM license_activations WHERE license_id=?').bind(lic.id).first();
    if(Number(count?.count||0)>=Number(lic.max_devices||1)) throw licenseError(409,'Esta licença já atingiu o limite de computadores.');
    activation={id:crypto.randomUUID()};
    await db.prepare(`INSERT INTO license_activations (id,license_id,installation_id,app_version,channel,activated_at,last_seen_at)
      VALUES (?,?,?,?,?,?,?)`).bind(activation.id,lic.id,data.installation_id,data.app_version,data.channel,now,now).run();
  } else {
    await db.prepare('UPDATE license_activations SET app_version=?,channel=?,last_seen_at=? WHERE id=?').bind(data.app_version,data.channel,now,activation.id).run();
  }
  return {activation_id:activation.id,activated_at:now,license:{id:lic.id,email:lic.email,status:lic.status,max_devices:Number(lic.max_devices||1),expires_at:lic.expires_at||null}};
}
async function listLicenses(db) {
  await ensureLicenseSchema(db);
  const result=await db.prepare(`SELECT l.id,l.email,l.status,l.max_devices,l.expires_at,l.created_at,l.updated_at,
    COUNT(a.id) AS active_devices FROM licenses l LEFT JOIN license_activations a ON a.license_id=l.id
    GROUP BY l.id ORDER BY l.created_at DESC LIMIT 500`).all();
  return result?.results||[];
}
async function revokeLicense(db,licenseId,now=new Date().toISOString()) {
  await ensureLicenseSchema(db);const id=String(licenseId||'').trim();if(!id)throw licenseError(422,'license_id obrigatório.');
  const result=await db.prepare("UPDATE licenses SET status='revoked',updated_at=? WHERE id=?").bind(now,id).run();
  if(!Number(result?.meta?.changes||0)) throw licenseError(404,'Licença não encontrada.');
  return {id,status:'revoked',updated_at:now};
}
export {normalizeLicenseEmail,normalizeLicenseCode,generateLicenseCode,hashLicenseCode,ensureLicenseSchema,validateActivationInput,createLicense,activateLicense,listLicenses,revokeLicense};
