// api/index.js — PROXY SIMPLES (como a configuração que funcionava)
export const config = {
  runtime: 'edge',
};

const VPS_HOST = 'vps.1site.pp.ua';
const VPS_PORT = 8383;

const BLOCKED_HEADERS = new Set([
  'host', 'connection', 'x-forwarded-for',
  'x-forwarded-host', 'x-forwarded-proto',
  'x-vercel-id', 'x-vercel-cache', 'cdn-loop',
  'cf-connecting-ip', 'content-length',
]);

export default async function handler(req) {
  const url = new URL(req.url);
  const target = `http://${VPS_HOST}:${VPS_PORT}${url.pathname}${url.search}`;

  const newHeaders = new Headers();
  for (const [key, value] of req.headers.entries()) {
    if (!BLOCKED_HEADERS.has(key.toLowerCase())) {
      newHeaders.set(key, value);
    }
  }
  
  // Preserva o Host que o Xray espera
  newHeaders.set('host', 'vercel.1site.pp.ua');
  newHeaders.set('connection', 'keep-alive');

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
    return new Response('Bad Gateway', { status: 502 });
  }
}
