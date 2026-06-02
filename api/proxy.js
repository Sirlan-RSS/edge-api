import http from 'http';

const agent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 10000,
  maxSockets: 100,
  maxFreeSockets: 50,
  timeout: 60000,
});

const BLOCKED_HEADERS = new Set([
  'host', 'connection', 'x-forwarded-for',
  'x-forwarded-host', 'x-forwarded-proto',
  'x-vercel-id', 'x-vercel-cache',
  'cdn-loop', 'cf-connecting-ip',
]);

// IP da VPS - SUBSTITUA PELO SEU!
const VPS_IP = '164.152.43.13';
const VPS_PORT = 8383;

export default async function handler(req, res) {
  const target = `http://${VPS_IP}:${VPS_PORT}${req.url}`;

  const cleanHeaders = Object.fromEntries(
    Object.entries(req.headers).filter(([k]) => !BLOCKED_HEADERS.has(k.toLowerCase()))
  );

  const options = {
    method: req.method,
    headers: {
      ...cleanHeaders,
      host: VPS_IP,
      connection: 'keep-alive',
    },
    agent,
    timeout: 60000,
  };

  try {
    const proxyReq = http.request(target, options, (proxyRes) => {
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Cache-Control', 'no-store');
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true, highWaterMark: 64 * 1024 });
    });

    proxyReq.on('socket', (socket) => {
      socket.setNoDelay(true);
      socket.setKeepAlive(true, 10000);
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!res.headersSent) res.status(504).end('Gateway Timeout');
    });

    proxyReq.on('error', (err) => {
      console.error('Proxy error:', err.message);
      if (!res.headersSent) res.status(502).end('Bad Gateway');
    });

    req.pipe(proxyReq, { end: true, highWaterMark: 64 * 1024 });
  } catch (err) {
    console.error('Handler error:', err.message);
    res.status(500).end('Internal Server Error');
  }
}

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};
