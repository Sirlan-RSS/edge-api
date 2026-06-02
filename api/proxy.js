// api/proxy.js - Vercel Edge Runtime
// Proxy para Xray xhttp via hostname (evita bloqueio de IP direto no Edge)

export const config = {
  runtime: 'edge',
};

const VPS_HOST = 'vps.1site.pp.ua';
const VPS_PORT = 8383;

const BLOCKED_HEADERS = [
  'host', 'connection', 'x-forwarded-for',
  'x-forwarded-host', 'x-forwarded-proto',
  'x-vercel-id', 'x-vercel-cache',
  'cdn-loop', 'cf-connecting-ip',
];

export default async function handler(request) {
  const url = new URL(request.url);
  const target = `http://${VPS_HOST}:${VPS_PORT}${url.pathname}${url.search}`;

  const headers = new Headers();
  for (const [key, value] of request.headers) {
    if (!BLOCKED_HEADERS.includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  }
  headers.set('host', VPS_HOST);
  headers.set('connection', 'keep-alive');

  try {
    const response = await fetch(target, {
      method: request.method,
      headers: headers,
      body: request.body,
      duplex: 'half',
    });

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
    return new Response('Bad Gateway: ' + error.message, { status: 502 });
  }
}
