// Q portfolio: serves the site and looks up stock prices, sectors and company logos.
//
// Your Quicken file never reaches this Worker: it's read in your browser. The only thing
// the browser sends here is a ticker symbol per lookup. Nothing is logged or stored
// (observability is off in wrangler.jsonc); price answers are cached briefly by ticker only.

import { parseChartRequest, parseProfileRequest, parseLogoRequest, refuseRequest, PRICE_HOST } from './chart.mjs';

const MAX_UPSTREAM_BYTES = 2 * 1024 * 1024;

const SECURITY_HEADERS = {
  // Only this site's own files may load; the pages can talk only to this site.
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'", // the report sets bar widths with inline styles
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  'Strict-Transport-Security': 'max-age=31536000',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const response =
      url.pathname === '/api/chart' ? await chart(request, url, ctx)
      : url.pathname === '/api/profile' ? await profile(request, url, ctx)
      : url.pathname === '/api/logo' ? await logo(request, url, ctx)
      : await env.ASSETS.fetch(request);
    const out = withHeaders(response, SECURITY_HEADERS);
    // Scripts and styles are requested as name?v=<fingerprint of the file> (scripts/sync.mjs),
    // so a browser can keep them for good: a changed file gets a new address.
    if (url.searchParams.has('v') && /\.(js|css)$/.test(url.pathname) && (out.status === 200 || out.status === 304)) {
      out.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    }
    return out;
  },
};

function withHeaders(response, headers) {
  const out = new Response(response.body, response);
  for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
  return out;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

// Yahoo serves the same data from two hosts; the second is used when the first fails.
const BACKUP_HOST = 'query2.finance.yahoo.com';
async function fetchYahoo(pathAndQuery) {
  const init = { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, redirect: 'manual' };
  try {
    const res = await fetch(`https://${PRICE_HOST}${pathAndQuery}`, init);
    if (res.ok || res.status === 404) return res;
  } catch {}
  return fetch(`https://${BACKUP_HOST}${pathAndQuery}`, init);
}

// Checks shared by every lookup: GET only, and only from this site's own pages.
function refuse(request) {
  const no = refuseRequest(request.method, request.headers.get('Sec-Fetch-Site'));
  return no ? json({ error: no.error }, no.status) : null;
}

// A stock's sector and industry, from Yahoo Finance's search. Funds have none.
async function profile(request, url, ctx) {
  const no = refuse(request);
  if (no) return no;
  const q = parseProfileRequest(url);
  if (q.error) return json({ error: q.error }, 400);

  const cache = caches.default;
  const key = new Request(`https://profile-cache.invalid/${q.symbol}`);
  const cached = await cache.match(key);
  if (cached) return withHeaders(cached, { 'Cache-Control': 'no-store' });

  const search = new URLSearchParams({ q: q.symbol, quotesCount: '1', newsCount: '0', listsCount: '0', enableFuzzyQuery: 'false' });
  const upstream = await fetchYahoo(`/v1/finance/search?${search}`);
  if (!upstream.ok) return json({ error: `The lookup service answered ${upstream.status}.` }, 502);
  const body = await upstream.json();
  const hit = (body?.quotes || []).find((x) => x.symbol === q.symbol);
  if (!hit) return json({ error: 'No details for that ticker.' }, 404);

  const fresh = json({ symbol: q.symbol, type: hit.quoteType || null, sector: hit.sector || null, industry: hit.industry || null });
  fresh.headers.set('Cache-Control', 'public, max-age=86400');
  ctx.waitUntil(cache.put(key, fresh.clone()));
  return withHeaders(fresh, { 'Cache-Control': 'no-store' });
}

// A company's logo, as a small square image. Two free logo services, the second used when
// the first has none. Only PNG, JPEG or WebP images are passed on (never SVG, which can
// carry scripts), and only up to 300 KB. Cached for a week by ticker; "no logo" for a day.
const LOGO_SOURCES = [
  (s) => `https://assets.parqet.com/logos/symbol/${encodeURIComponent(s)}?format=png&size=128`,
  (s) => `https://images.financialmodelingprep.com/symbol/${encodeURIComponent(s)}.png`,
];
const LOGO_TYPES = /^image\/(png|jpeg|webp)$/;
const MAX_LOGO_BYTES = 300 * 1024;
async function logo(request, url, ctx) {
  const no = refuse(request);
  if (no) return no;
  const q = parseLogoRequest(url);
  if (q.error) return json({ error: q.error }, 400);

  const cache = caches.default;
  const key = new Request(`https://logo-cache.invalid/${q.symbol}`);
  const cached = await cache.match(key);
  if (cached) return cached;

  for (const source of LOGO_SOURCES) {
    try {
      const res = await fetch(source(q.symbol), { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/png,image/*' }, redirect: 'follow' });
      const type = (res.headers.get('Content-Type') || '').split(';')[0].trim();
      if (!res.ok || !LOGO_TYPES.test(type)) continue;
      const bytes = await res.arrayBuffer();
      if (!bytes.byteLength || bytes.byteLength > MAX_LOGO_BYTES) continue;
      const fresh = new Response(bytes, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=604800' } });
      ctx.waitUntil(cache.put(key, fresh.clone()));
      return fresh;
    } catch {}
  }
  const none = json({ error: 'No logo for that ticker.' }, 404);
  none.headers.set('Cache-Control', 'public, max-age=86400'); // browsers remember, and don't ask on every page
  ctx.waitUntil(cache.put(key, none.clone()).catch(() => {}));
  return none;
}

async function chart(request, url, ctx) {
  const no = refuse(request);
  if (no) return no;

  const q = parseChartRequest(url);
  if (q.error) return json({ error: q.error }, 400);

  // Cached by ticker only, for 5 minutes, so repeat visits don't hit Yahoo again.
  const cache = caches.default;
  const key = new Request(`https://chart-cache.invalid/${q.symbol}/${q.range}/${q.interval}`);
  const cached = await cache.match(key);
  if (cached) return withHeaders(cached, { 'Cache-Control': 'no-store' });

  // Asked for "max" with weekly bars, Yahoo answers with quarterly ones; by dates it
  // gives the weeks. (Only histories older than 10 years need this.)
  const span = q.range === 'max' && q.interval === '1wk' ? `period1=0&period2=${Math.floor(Date.now() / 1000)}` : `range=${q.range}`;
  const upstream = await fetchYahoo(`/v8/finance/chart/${q.symbol}?${span}&interval=${q.interval}`);
  // an unknown ticker is a plain "not found", which the page doesn't retry
  if (upstream.status === 404) return json({ error: 'No price data for that ticker.' }, 404);
  if (!upstream.ok) return json({ error: `The price service answered ${upstream.status}.` }, 502);
  const size = Number(upstream.headers.get('Content-Length') || 0);
  if (size > MAX_UPSTREAM_BYTES) return json({ error: 'The price answer was too large.' }, 502);

  const body = await upstream.json();
  const result = body?.chart?.result?.[0];
  if (!result) return json({ error: 'No price data for that ticker.' }, 502);

  const fresh = json(result);
  fresh.headers.set('Cache-Control', 'public, max-age=300');
  ctx.waitUntil(cache.put(key, fresh.clone()));
  return withHeaders(fresh, { 'Cache-Control': 'no-store' });
}
