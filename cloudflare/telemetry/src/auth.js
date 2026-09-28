function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function createCredential(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function hashCredential(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function authenticateRequest(request, db) {
  const header = String(request.headers.get('authorization') || '');
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;
  const credentialHash = await hashCredential(match[1].trim());
  return db.prepare('SELECT installation_id FROM installations WHERE credential_hash = ?').bind(credentialHash).first();
}

export { createCredential, hashCredential, authenticateRequest };
