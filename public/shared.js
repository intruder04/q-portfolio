'use strict';
{
// Helpers shared by the parser (lots.js), the performance page (perf.js) and the sell check
// (report-template.html). The sell check carries a copy, so a saved report works offline;
// scripts/sync.mjs keeps that copy in step with this file.

// ---------- dates ----------
const DAY_MS = 86400000;
function anniversary(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  if (m === 2 && d === 29) return `${y + 1}-03-01`;
  return `${y + 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function addDays(iso, n) {
  const t = new Date(iso + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY_MS);

// ---------- New York dates ----------
// Trade dates and price times are the exchange's, so "today" is New York's day wherever
// you are. `ms` is a time in milliseconds.
const nyParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
function nyStamp(ms) {                           // 'YYYY-MM-DD HH:MM'
  const p = Object.fromEntries(nyParts.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
const nyDay = (ms) => nyStamp(ms).slice(0, 10);

// ---------- which shares a sale takes ----------
// FIFO: oldest first (the IRS default). LIFO: newest first. HIFO: most expensive first.
// TAXOPT: the tax-minimizing order some brokers use: losses first (short-term, then
// long-term), then long-term gains, then short-term gains, most expensive first in each.
// A lot's holding period starts at `held` when a wash sale moved it earlier, else at `d`.
function sellOrder(lots, method, price, dateIso) {
  const byDate = (a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
  if (method === 'FIFO') return [...lots].sort(byDate);
  if (method === 'LIFO') return [...lots].sort((a, b) => byDate(b, a));
  if (method === 'HIFO') return [...lots].sort((a, b) => b.c - a.c);
  if (method === 'TAXOPT') {
    const group = (l) => {
      const long = dateIso > anniversary(l.held || l.d);
      return l.c > price ? (long ? 1 : 0) : (long ? 2 : 3);
    };
    return [...lots].sort((a, b) => group(a) - group(b) || b.c - a.c || byDate(a, b));
  }
  throw new Error(`Unknown lot order: ${method}`);
}

// ---------- tax estimate ----------
// Your rates as fractions: { ordinary, longTerm, state, niit }. Short-term gains are taxed
// like income; long-term at the lower rate. State tax and the 3.8% net investment income
// tax apply to both.
const DEFAULT_TAX = { ordinary: 0.24, longTerm: 0.15, state: 0, niit: false };
function taxRates(s = DEFAULT_TAX) {
  const extra = (s.state || 0) + (s.niit ? 0.038 : 0);
  return { short: s.ordinary + extra, long: s.longTerm + extra };
}
// Tax on a sale's long- and short-term gains. A loss of one kind first offsets a gain of
// the other, as on a tax return. Losses themselves aren't counted as savings.
function estimateTax(longGain, shortGain, rates) {
  let lt = longGain, st = shortGain;
  if (st < 0 && lt > 0) { lt = Math.max(0, lt + st); st = 0; }
  else if (lt < 0 && st > 0) { st = Math.max(0, st + lt); lt = 0; }
  return Math.max(0, lt) * rates.long + Math.max(0, st) * rates.short;
}

// ---------- selling at a loss ----------
// What a sale's losses come to, and how much of them a wash sale would block. `lots` are one
// stock's purchases ({ d, sh, c, lt }), `takes[i]` the shares sold from lots[i]. A loss is a
// wash sale to the extent you bought the same stock in the 30 days before the sale and still
// hold those shares afterwards (buying again in the 30 days after counts too, but that
// hasn't happened yet). Losses are positive numbers.
function lossSale(lots, takes, price, asof) {
  const from = addDays(asof, -30);
  const r = { sh: 0, stLoss: 0, ltLoss: 0, washSh: 0, washLoss: 0, lastBuy: null, clearOn: null };
  let recentKept = 0;
  lots.forEach((l, i) => {
    const take = Math.min(l.sh, takes[i] || 0);
    if (take > 1e-9 && l.c > price) {
      r.sh += take;
      r[asof >= l.lt ? 'ltLoss' : 'stLoss'] += take * (l.c - price);
    }
    if (l.d >= from && l.sh - take > 1e-9) {
      recentKept += l.sh - take;
      if (!r.lastBuy || l.d > r.lastBuy) r.lastBuy = l.d;
    }
  });
  if (r.sh > 1e-9 && recentKept > 1e-9) {
    r.washSh = Math.min(r.sh, recentKept);
    r.washLoss = (r.stLoss + r.ltLoss) * (r.washSh / r.sh);
    r.clearOn = addDays(r.lastBuy, 31);          // the first day the recent purchase no longer counts
  } else r.lastBuy = null;
  return r;
}
// The same, for selling every share that's below cost today.
const harvest = (lots, price, asof) => lossSale(lots, lots.map((l) => (l.c > price ? l.sh : 0)), price, asof);

// ---------- sales by tax year ----------
// Gains and losses from sales, by calendar year, newest first. A wash sale's blocked loss
// isn't counted that year (it moved into the replacement shares' cost). Returns null for a
// result saved before sales were split into short- and long-term.
function realizedByYear(realized) {
  if (!realized?.length) return [];
  if (realized.some((r) => r.st == null)) return null;
  const years = {};
  for (const r of realized) {
    const y = (years[r.d.slice(0, 4)] ||= { year: r.d.slice(0, 4), sales: 0, proceeds: 0, st: 0, lt: 0, wash: 0 });
    y.sales++; y.proceeds += r.proceeds;
    y.st += r.st + (r.washSt || 0); y.lt += r.lt + (r.washLt || 0);
    y.wash += r.disallowed || 0;
  }
  return Object.values(years).sort((a, b) => (a.year < b.year ? 1 : -1));
}

// ---------- hide amounts ----------
// "Hide amounts" in the toolbar masks every dollar amount and share count, leaving
// percentages, so a screenshot can be shared. Kept in this browser.
let hidden = false;
try { hidden = typeof window !== 'undefined' && window.localStorage.getItem('tlv-hide') === '1'; } catch {}
const MASK = '•••';
const sign = (v) => (v > 0 ? '+' : v < 0 ? '−' : '');

// ---------- language (i18n.js) ----------
// Text and number formats follow the chosen language. Without i18n.js (the tests), English.
const I18N = typeof window !== 'undefined' ? window.I18n : null;
const LOCALE = I18N?.locale || 'en-US';
const t = I18N ? I18N.t : (s, v) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m)) : s);
const plural = I18N ? I18N.plural : (n, one, many) => (n === 1 ? one : many);
const point = (s) => (LOCALE === 'en-US' ? s : s.replace('.', ','));   // decimal comma in Russian
const noYear = (s) => s.replace(/\s?г\.$/, '');                          // "24 нояб. 2026 г." → "24 нояб. 2026"
// a short month and year, for chart axes
const axisDate = (d, withYear) => noYear(d.toLocaleDateString(LOCALE, { month: 'short', year: withYear, timeZone: 'UTC' }));

// ---------- formatting ----------
const money = (v, dp = 0) => hidden ? (v < 0 ? '−' : '') + '$' + MASK : (v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString(LOCALE, { minimumFractionDigits: dp, maximumFractionDigits: dp });
const signed = (v) => { v = Math.round(v); if (hidden) return sign(v) + '$' + MASK; return (v > 0 ? '+' : v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString(LOCALE); };
const compact = (v) => hidden ? (v < 0 ? '−' : '') + '$' + MASK : (v < 0 ? '−' : '') + '$' + Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 }).format(Math.abs(v));
const signedCompact = (v) => (v > 0 ? '+' : '') + compact(v);
const pct = (v, dp = 1) => (v == null ? '—' : point((v * 100).toFixed(dp)) + '%');
const signedPct = (v, dp = 1) => (v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + point(Math.abs(v * 100).toFixed(dp)) + '%');
const num = (v, dp = 3) => hidden ? MASK : v.toLocaleString(LOCALE, { maximumFractionDigits: dp });
const count = (v) => v.toLocaleString(LOCALE);                           // a count, never hidden
const fmtDate = (iso) => noYear(new Date(iso + 'T00:00:00Z').toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }));
const fmtMonth = (ym, short) => {
  const s = noYear(new Date(ym + '-01T00:00:00Z').toLocaleDateString(LOCALE, { month: short ? 'short' : 'long', year: short ? '2-digit' : 'numeric', timeZone: 'UTC' }));
  return short ? s : s[0].toUpperCase() + s.slice(1);                    // "ноябрь 2026" → "Ноябрь 2026"
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const cls = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
const clsUsd = (v) => cls(Math.round(v)); // dollars: no color for amounts that round to $0

// ---------- company logos ----------
// A small square logo beside a ticker, fetched through this site's /api/logo, so the logo
// service sees Cloudflare, never you. The ticker's first letter shows until the image
// loads, and stays if there's no logo (or in a saved report opened offline).
const logo = (t, size = 20) =>
  `<span class="logo" data-l="${esc(String(t)[0] || '')}" style="--s:${size}px" aria-hidden="true"><img src="api/logo?symbol=${encodeURIComponent(t)}" alt="" loading="lazy" decoding="async"></span>`;
// Some logos are white artwork on a transparent background, made for dark backgrounds;
// on the usual white tile they'd vanish. True when most of the drawn pixels are near-white
// and a fair part of the image is see-through (an opaque logo keeps its own background).
function lightLogo(img) {
  try {
    const n = 32, c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, n, n);
    const px = g.getImageData(0, 0, n, n).data;
    let clear = 0, drawn = 0, white = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 40) { clear++; continue; }
      drawn++;
      if (px[i] > 225 && px[i + 1] > 225 && px[i + 2] > 225) white++;
    }
    return drawn > 0 && clear / (n * n) > 0.15 && white / drawn > 0.5;
  } catch { return false; }
}
if (typeof document !== 'undefined') {
  document.addEventListener('load', (e) => {
    if (!e.target.matches?.('.logo img')) return;
    if (lightLogo(e.target)) e.target.classList.add('on-dark');
    e.target.classList.add('ok');
  }, true);
  document.addEventListener('error', (e) => { if (e.target.matches?.('.logo img')) e.target.remove(); }, true);
}

// ---------- charts ----------
const niceStep = (raw) => { const p = 10 ** Math.floor(Math.log10(raw || 1)), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; };
const NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent?.appendChild(e);
  return e;
}

const api = {
  hidden, DAY_MS, anniversary, addDays, daysBetween, nyStamp, nyDay, sellOrder,
  lossSale, harvest, realizedByYear,
  DEFAULT_TAX, taxRates, estimateTax,
  money, signed, compact, signedCompact, pct, signedPct, num, count, fmtDate, fmtMonth, axisDate, esc, cls, clsUsd,
  niceStep, svgEl, logo, lightLogo, t, plural, LOCALE,
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else window.Shared = api;
}
