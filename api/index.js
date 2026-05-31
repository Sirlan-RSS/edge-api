export const config = {
  runtime: 'edge',
};

const VPS_HOST = 'vps.1site.pp.ua';
const VPS_PORT = 8383;
const TOKEN_TTL = 300000;

const BLOCKED_HEADERS = new Set([
  'host', 'connection', 'x-forwarded-for',
  'x-forwarded-host', 'x-forwarded-proto',
  'x-vercel-id', 'x-vercel-cache', 'cdn-loop',
  'cf-connecting-ip', 'content-length',
]);

const tokenCache = new Map();

function generateToken(clientIP) {
  const token = crypto.randomUUID();
  const expires = Date.now() + TOKEN_TTL;
  tokenCache.set(token, { clientIP, expires });
  setTimeout(() => tokenCache.delete(token), TOKEN_TTL + 5000);
  return token;
}

function validateToken(token) {
  const data = tokenCache.get(token);
  if (!data) return false;
  if (data.expires < Date.now()) {
    tokenCache.delete(token);
    return false;
  }
  return true;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const path = url.pathname;

  if (path === '/health') {
    return new Response('OK', { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain',
      }
    });
  }

  if (path === '/handshake' || path === '/ws' || path === '/api') {
    
    if (req.headers.get('upgrade') === 'websocket') {
      const token = url.searchParams.get('token');
      if (token && validateToken(token)) {
        return new Response(null, {
          status: 307,
          headers: {
            'Location': `wss://${VPS_HOST}:${VPS_PORT}/tunnel?token=${token}`,
            'Upgrade': 'websocket',
            'Connection': 'Upgrade',
            'Cache-Control': 'no-store',
          },
        });
      }
      return new Response('Invalid or expired token', { status: 403 });
    }

    const target = `http://${VPS_HOST}:${VPS_PORT}${path}${url.search}`;
    
    const newHeaders = new Headers();
    for (const [key, value] of req.headers.entries()) {
      if (!BLOCKED_HEADERS.has(key.toLowerCase())) {
        newHeaders.set(key, value);
      }
    }
    newHeaders.set('host', 'vercel.1site.pp.ua');
    newHeaders.set('connection', 'keep-alive');
    newHeaders.set('x-original-sni', 'bora.claro.com.br');

    try {
      const response = await fetch(target, {
        method: req.method,
        headers: newHeaders,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
        duplex: 'half',
        redirect: 'manual',
      });

      const upgradeToken = generateToken(clientIP);
      
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Cache-Control', 'no-store');
      responseHeaders.set('X-Accel-Buffering', 'no');
      responseHeaders.set('X-Upgrade-Token', upgradeToken);
      responseHeaders.set('X-Upgrade-Endpoint', `wss://${url.host}/handshake?token=${upgradeToken}`);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });

    } catch (error) {
      console.error('Proxy error:', error.message);
      return new Response(`Bad Gateway: ${error.message}`, { status: 502 });
    }
  }

  const target = `http://${VPS_HOST}:${VPS_PORT}${path}${url.search}`;
  
  const newHeaders = new Headers();
  for (const [key, value] of req.headers.entries()) {
    if (!BLOCKED_HEADERS.has(key.toLowerCase())) {
      newHeaders.set(key, value);
    }
  }
  newHeaders.set('host', 'vercel.1site.pp.ua');

  const init = {
    method: req.method,
    headers: newHeaders,
    redirect: 'manual',
    duplex: 'half',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req.body;
  }

  try {
    const response = await fetch(target, init);
    
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('X-Accel-Buffering', 'no');
    responseHeaders.set('Cache-Control', 'no-store');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Proxy error:', error.message);
    return new Response(`Bad Gateway: ${error.message}`, { status: 502 });
  }
}
