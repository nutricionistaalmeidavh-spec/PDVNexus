import http from 'node:http';

const bridgePort = Number(process.env.NEXUS_TEF_BRIDGE_PORT ?? '9090') || 9090;
const bridgeHost = process.env.NEXUS_TEF_BRIDGE_HOST ?? '127.0.0.1';

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('error', reject);
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function stableDigits(seed, size) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return String(hash).padStart(size, '0').slice(-size);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${bridgeHost}:${bridgePort}`}`);

  if (request.method === 'OPTIONS') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'GET' && (url.pathname === '/health' || url.pathname === '/pay')) {
    sendJson(response, 200, {
      ok: true,
      status: 'bridge-online',
      provider: 'Nexus Demo Bridge',
      endpoint: '/pay',
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/pay') {
    const rawBody = await readBody(request);
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const seed = `${payload.saleNumber ?? '000000'}-${payload.method ?? 'UNKNOWN'}-${payload.amount ?? 0}`;
    sendJson(response, 200, {
      id: `TEF-${Date.now()}`,
      authorizationCode: stableDigits(`${seed}-AUTH`, 6),
      nsu: stableDigits(`${seed}-NSU`, 9),
      status: 'approved',
      provider: payload.provider ?? 'Nexus Demo Bridge',
      saleNumber: payload.saleNumber ?? '000000',
      method: payload.method ?? 'UNKNOWN',
      amount: payload.amount ?? 0,
      approvedAt: new Date().toISOString(),
      message: 'Pagamento homologado pela ponte TEF local.'
    });
    return;
  }

  sendJson(response, 404, {
    ok: false,
    error: 'Route not found',
    expectedRoutes: ['GET /health', 'GET /pay', 'POST /pay']
  });
});

server.listen(bridgePort, bridgeHost, () => {
  console.log(`Nexus TEF bridge listening on http://${bridgeHost}:${bridgePort}/pay`);
});
