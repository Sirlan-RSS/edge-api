export const config = {
runtime: 'edge',
};
const BLOCKED_HEADERS = new Set([
'host', 'connection', 'x-forwarded-for',
'x-forwarded-host', 'x-forwarded-proto',
'x-vercel-id', 'x-vercel-cache',
'cdn-loop', 'cf-connecting-ip',
]);
export default async function handler(req) {
const url = new URL(req.url);
// Defina aqui o subdomínio que aponta para a sua VPS e a porta do Xray
const target = `http:/verceledge.erosrss.pp.ua:8383${url.pathname}${url.search}`;
const newHeaders = new Headers();
for (const [key, value] of req.headers.entries()) {
if (!BLOCKED_HEADERS.has(key.toLowerCase())) {
newHeaders.set(key, value);
}
}
// O Host deve ser idêntico ao subdomínio definido acima
newHeaders.set('host', 'verceledge.erosrss.pp.ua');
newHeaders.set('connection', 'keep-alive');
const init = {
method: req.method,
headers: newHeaders,
redirect: 'manual',};
// init.duplex = 'half' é obrigatório para o xhttp funcionar na Vercel
if (req.method !== 'GET' && req.method !== 'HEAD') {
init.body = req.body;
init.duplex = 'half';
}
try {
const response = await fetch(target, init);
const responseHeaders = new Headers(response.headers);
responseHeaders.set('X-Accel-Bufering', 'no');
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
