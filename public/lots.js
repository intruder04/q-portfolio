'use strict';
{
// Parse a brokerage's Quicken export (QFX/OFX) and rebuild open tax lots.
// Reads only securities, trades, splits, dividends and positions:
// account numbers, user ids and bank transactions are never read.

const field = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`));
  return m ? m[1].trim() : null;
};
const num = (s) => (s == null || s === '' ? 0 : Number(s));
const qfxDate = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
const blocks = (text, tag) => text.match(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, 'g')) || [];

const { anniversary, addDays, daysBetween, sellOrder, nyStamp } =
  typeof module !== 'undefined' && module.exports ? require('./shared') : window.Shared;

function readQfx(text) {
  if (!/OFXHEADER|<OFX>/i.test(text.slice(0, 2000))) throw new Error("This doesn't look like a Quicken (.qfx) export.");
  const tickers = {};
  for (const b of blocks(text, 'SECINFO')) tickers[field(b, 'UNIQUEID')] = field(b, 'TICKER');
  const tick = (cusip) => tickers[cusip] || cusip;

  const positions = {};
  for (const b of blocks(text, 'POSSTOCK')) {
    const t = tick(field(b, 'UNIQUEID'));
    positions[t] = (positions[t] || 0) + num(field(b, 'UNITS'));
  }

  const events = [];
  const re = /<(BUYSTOCK|SELLSTOCK|TRANSFER|SPLIT)>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = re.exec(text))) {
    const [, kind, b] = m;
    const dt = field(b, 'DTTRADE');
    if (!dt) continue;
    // keyed by ticker, so a CUSIP change after a reverse split (e.g. FUBO) merges
    const e = { kind, date: qfxDate(dt), t: tick(field(b, 'UNIQUEID')) };
    if (kind === 'SPLIT') Object.assign(e, { old: num(field(b, 'OLDUNITS')), new: num(field(b, 'NEWUNITS')) });
    else Object.assign(e, { units: num(field(b, 'UNITS')), total: num(field(b, 'TOTAL')), price: num(field(b, 'UNITPRICE')) });
    events.push(e);
  }

  // dividends and other income paid by a security
  const income = [];
  for (const b of blocks(text, 'INCOME')) {
    const dt = field(b, 'DTTRADE'), amount = num(field(b, 'TOTAL'));
    if (dt && amount) income.push({ d: qfxDate(dt), t: tick(field(b, 'UNIQUEID')), type: field(b, 'INCOMETYPE') || 'DIV', amount });
  }
  return { events, positions, income };
}

// Wash sales: a sale at a loss is a wash sale to the extent the same stock was bought in
// the 30 days before or after it. The disallowed loss is added to the cost of those
// replacement shares, and the sold shares' holding time carries over to them, so they
// become long-term sooner. Replacement shares are matched oldest first, each one at most
// once; a purchase that only partly replaces is split into two lots.
function applyWash(q, losses, lot, saleDate, rec) {
  let disallowed = 0;
  let avail = lot.sh;
  while (avail > 1e-9 && losses.length) {
    const piece = losses[0];
    const m = Math.min(avail, piece.sh);
    // the replacement part becomes its own lot with the higher cost and earlier start
    const held = addDays(lot.d, -daysBetween(piece.held, saleDate));
    const part = { ...lot, sh: m, c: lot.c + piece.loss, held: held < lot.held ? held : lot.held,
      replaced: true, wash: { add: (lot.wash?.add || 0) + piece.loss, from: saleDate } };
    lot.sh -= m; avail -= m;
    q.push(part);
    disallowed += m * piece.loss;
    rec[piece.long ? 'washLt' : 'washSt'] += m * piece.loss;
    piece.sh -= m;
    if (piece.sh <= 1e-9) losses.shift();
  }
  return disallowed;
}

function rebuildLots(events, method = 'FIFO') {
  const rank = (e) => (e.kind === 'BUYSTOCK' || (e.kind === 'TRANSFER' && e.units > 0) ? 0 : e.kind === 'SPLIT' ? 1 : 2);
  const sorted = events.map((e, i) => [e, i]).sort(([a, i], [b, j]) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : rank(a) - rank(b) || i - j).map(([e]) => e);

  const lots = {}, splits = [], warnings = [];
  const splitEvents = [], realized = [], activity = [], washSales = [];
  const pending = {}; // ticker -> wash sales still looking for replacement buys in the next 30 days
  const round = (v, dp) => Math.round(v * 10 ** dp) / 10 ** dp;
  for (const e of sorted) {
    const q = (lots[e.t] ||= []);
    if (e.kind === 'SPLIT') {
      const held = q.reduce((x, l) => x + l.sh, 0);
      if (held <= 0) continue;
      // some exports write OLDUNITS=0 with NEWUNITS = shares added
      const ratio = e.old === 0 ? (held + e.new) / held : e.new / e.old;
      for (const l of q) { l.sh *= ratio; l.c /= ratio; if (l.wash) l.wash = { ...l.wash, add: l.wash.add / ratio }; }
      for (const w of pending[e.t] || []) for (const p of w.losses) { p.sh *= ratio; p.loss /= ratio; }
      splitEvents.push({ t: e.t, d: e.date, ratio });
      splits.push(`${e.t} ${new Date(e.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })}`);
    } else if (e.units > 0) {
      const cost = e.total ? Math.abs(e.total) / e.units : e.price;
      const lot = { d: e.date, sh: e.units, c: cost, held: e.date };
      q.push(lot);
      // a purchase within 30 days after a loss sale replaces the sold shares
      for (const w of pending[e.t] || []) {
        if (w.until < e.date || !w.losses.length || lot.sh <= 1e-9) continue;
        const add = applyWash(q, w.losses, lot, w.rec.d, w.rec);
        w.rec.disallowed = round(w.rec.disallowed + add, 2);
        w.rec.washSt = round(w.rec.washSt, 2); w.rec.washLt = round(w.rec.washLt, 2);
        w.summary.disallowed = w.rec.disallowed;
      }
      if (pending[e.t]) pending[e.t] = pending[e.t].filter((w) => w.until >= e.date && w.losses.length);
      lots[e.t] = q.filter((l) => l.sh > 1e-9);
      const transfer = e.kind === 'TRANSFER';
      activity.push({ d: e.date, type: transfer ? 'IN' : 'BUY', t: e.t, sh: round(e.units, 6), price: round(cost, 4), amount: transfer ? null : round(Math.abs(e.total) || e.units * e.price, 2) });
    } else {
      let need = -e.units, cost = 0;
      const sold = need;
      const price = e.price || Math.abs(e.total) / need;
      const pieces = [];
      for (const l of sellOrder(q, method, price, e.date)) {
        if (need <= 1e-9) break;
        const take = Math.min(l.sh, need);
        l.sh -= take; need -= take; cost += take * l.c;
        pieces.push({ sh: take, c: l.c, held: l.held || l.d, long: e.date > anniversary(l.held || l.d) });
      }
      if (e.kind === 'TRANSFER') {
        activity.push({ d: e.date, type: 'OUT', t: e.t, sh: round(-e.units, 6), price: null, amount: null });
      } else {
        const proceeds = Math.abs(e.total) || -e.units * price;
        activity.push({ d: e.date, type: 'SELL', t: e.t, sh: round(-e.units, 6), price: round(price, 4), amount: round(proceeds, 2) });
        const perShare = proceeds / sold;
        // the gain by holding period: `st` short-term, `lt` long-term (losses negative);
        // washSt / washLt are the losses a wash sale blocks, to add back
        const gainOf = (long) => round(pieces.filter((p) => p.long === long).reduce((s, p) => s + p.sh * (perShare - p.c), 0), 2);
        const rec = { t: e.t, d: e.date, proceeds: round(proceeds, 2), cost: round(cost, 2), disallowed: 0, st: gainOf(false), lt: gainOf(true), washSt: 0, washLt: 0 };
        realized.push(rec);
        // shares sold at a loss: look for replacement purchases
        const losses = pieces.filter((p) => p.c > perShare + 1e-9).map((p) => ({ sh: p.sh, loss: p.c - perShare, held: p.held, long: p.long }));
        if (losses.length) {
          const summary = { t: e.t, d: e.date, loss: round(losses.reduce((s, p) => s + p.sh * p.loss, 0), 2), disallowed: 0 };
          const from = addDays(e.date, -30);
          const before = q.filter((l) => l.sh > 1e-9 && !l.replaced && l.d >= from && l.d <= e.date).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
          for (const l of before) rec.disallowed += applyWash(q, losses, l, e.date, rec);
          rec.disallowed = round(rec.disallowed, 2);
          rec.washSt = round(rec.washSt, 2); rec.washLt = round(rec.washLt, 2);
          summary.disallowed = rec.disallowed;
          if (losses.length) (pending[e.t] ||= []).push({ until: addDays(e.date, 30), losses, rec, summary });
          washSales.push(summary);
        }
      }
      lots[e.t] = q.filter((l) => l.sh > 1e-9);
      if (need > 1e-4) warnings.push(`${e.t}: sold ${need.toFixed(4)} more shares than bought on ${e.date}`);
    }
  }
  for (const t of Object.keys(lots)) if (lots[t].reduce((x, l) => x + l.sh, 0) <= 1e-6) delete lots[t];
  return { lots, splits, warnings, splitEvents, realized, activity, washSales: washSales.filter((w) => w.disallowed > 0.005) };
}

// Runs `fn` over `items`, a few at a time, keeping their order.
const LOOKUPS = 4;
async function pool(items, fn, limit = LOOKUPS) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}
// A lookup's answer, or { error } when it failed, so one stock can't stop the rest.
const attempt = async (fn) => { try { return await fn(); } catch (error) { return { error }; } };
// A stock with no price available is valued at what you last paid, and marked `noPrice`.
function unpriced(t, lots) {
  const last = [...lots].sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0))[0];
  const price = Math.round(last.c * 1e4) / 1e4;
  return { name: t, price, prevClose: null, ath: price, athDate: '', series: [], noPrice: true };
}

// Build the report data. `fetchQuote(ticker, sinceIso)` supplies current prices;
// `fetchSeries(ticker, sinceIso, totalReturn)` supplies weekly price history for stocks
// no longer held and for the market benchmark (performance page).
async function buildData(text, { method = 'FIFO', fetchQuote, fetchSeries, benchmark = 'SPY', onProgress = () => {} }) {
  const { events, positions, income } = readQfx(text);
  const { lots, splits, warnings, splitEvents, realized, activity, washSales } = rebuildLots(events, method);
  const tickers = Object.keys(lots).sort();
  if (!tickers.length) throw new Error('No open stock positions were found in this export. If the shares were transferred out, export the account they moved to.');

  const mismatches = [];
  if (Object.keys(positions).length) {
    for (const t of new Set([...tickers, ...Object.keys(positions)])) {
      const held = (lots[t] || []).reduce((x, l) => x + l.sh, 0);
      if (Math.abs(held - (positions[t] || 0)) > 1e-3) mismatches.push(t);
    }
  }

  const traded = [...new Set(activity.map((a) => a.t))].sort();
  const closed = traded.filter((t) => !lots[t]);
  const since = priceHistoryStart(activity.map((a) => a.d));
  const total = tickers.length + (fetchSeries ? closed.length + 1 : 0);
  let done = 0;
  const step = (ticker) => onProgress({ step: 'prices', done: ++done, total, ticker });
  onProgress({ step: 'prices', done: 0, total });

  // every lookup runs a few at a time; a stock whose price can't be had doesn't stop the rest
  const quotesJob = pool(tickers, async (t) => { const q = await attempt(() => fetchQuote(t, since)); step(t); return q; });
  const historyJob = fetchSeries ? pool(closed, async (t) => { const r = await attempt(() => fetchSeries(t, since, false)); step(t); return r; }) : [];
  const benchJob = fetchSeries ? fetchSeries(benchmark, since, true).then((b) => { step(benchmark); return b; }) : null;
  const [quotes, histories, b] = await Promise.all([quotesJob, historyJob, benchJob]);
  if (quotes.every((q) => q.error)) throw quotes[0].error;

  const stocks = {};
  let asof = null;
  for (const [i, t] of tickers.entries()) {
    const q = quotes[i].error ? unpriced(t, lots[t]) : quotes[i];
    if (q.time && (!asof || q.time > asof)) asof = q.time;
    stocks[t] = {
      name: q.name, price: q.price, prevClose: q.prevClose ?? null, ath: q.ath, athDate: q.athDate, series: q.series,
      ...(q.noPrice ? { noPrice: true } : {}),
      lots: [...lots[t]].sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0)).map((l) => ({
        d: l.d, sh: Math.round(l.sh * 1e6) / 1e6, c: Math.round(l.c * 1e4) / 1e4,
        // a wash sale moves the holding period's start earlier
        lt: addDays(anniversary(l.held || l.d), 1),
        ...(l.wash ? { wash: { add: Math.round(l.wash.add * 1e4) / 1e4, from: l.wash.from } } : {}),
      })),
    };
  }

  // weekly prices for stocks you no longer own, and for the market to compare with
  const history = {}, bench = {}, benchDay = {};
  if (fetchSeries) {
    closed.forEach((t, i) => { history[t] = histories[i].error ? [] : histories[i].series; }); // e.g. delisted
    bench[benchmark] = b.series;
    benchDay[benchmark] = b.dayChange;
  }
  onProgress({ step: 'prices', done: total, total });

  const owned = new Set(traded);
  return {
    asof: formatAsof(asof), stocks,
    activity, realized, splitEvents, washSales,
    income: income.filter((i) => owned.has(i.t)).map((i) => ({ ...i, amount: Math.round(i.amount * 100) / 100 })),
    history, bench, benchDay,
    meta: { method, splits, mismatches, warnings },
  };
}

// Price history starts two months before the first purchase.
const priceHistoryStart = (days) => addDays([...days].sort()[0].slice(0, 8) + '01', -60);

// The time of the newest price, in New York time.
const formatAsof = (ts) => nyStamp(ts * 1000);

// New prices for a saved result: the purchases stay as they are, only prices change.
async function refreshPrices(data, { fetchQuote, fetchSeries, onProgress = () => {} }) {
  const tickers = Object.keys(data.stocks).sort();
  const closed = Object.keys(data.history || {}).sort();
  const benches = Object.keys(data.bench || {});
  const days = data.activity?.length ? data.activity.map((a) => a.d) : tickers.flatMap((t) => data.stocks[t].lots.map((l) => l.d));
  const since = priceHistoryStart(days);
  const total = tickers.length + (fetchSeries ? closed.length + benches.length : 0);
  let done = 0;
  const step = (ticker) => onProgress({ step: 'prices', done: ++done, total, ticker });
  onProgress({ step: 'prices', done: 0, total });
  const lookup = (list, fn) => pool(list, async (t) => { const r = await attempt(() => fn(t)); step(t); return r; });
  const [quotes, histories, benchSeries] = await Promise.all([
    lookup(tickers, (t) => fetchQuote(t, since)),
    fetchSeries ? lookup(closed, (t) => fetchSeries(t, since, false)) : [],
    fetchSeries ? lookup(benches, (b) => fetchSeries(b, since, true)) : [],
  ]);
  if (quotes.every((q) => q.error)) throw quotes[0].error;

  // a stock whose lookup failed keeps the prices it had
  const stocks = {};
  let asof = null;
  for (const [i, t] of tickers.entries()) {
    const q = quotes[i];
    if (q.error) { stocks[t] = data.stocks[t]; continue; }
    if (!asof || q.time > asof) asof = q.time;
    const { noPrice, ...kept } = data.stocks[t];
    stocks[t] = { ...kept, name: q.name, price: q.price, prevClose: q.prevClose ?? null, ath: q.ath, athDate: q.athDate, series: q.series };
  }
  const history = { ...data.history }, bench = { ...data.bench }, benchDay = { ...data.benchDay };
  closed.forEach((t, i) => { if (histories[i] && !histories[i].error) history[t] = histories[i].series; });
  benches.forEach((b, i) => { const r = benchSeries[i]; if (r && !r.error) { bench[b] = r.series; benchDay[b] = r.dayChange; } });
  onProgress({ step: 'prices', done: total, total });
  return { ...data, asof: formatAsof(asof), stocks, history, bench, benchDay };
}

// A lighter update for automatic refreshes: one lookup per stock held (today's price and
// weekly history) plus the comparison indexes. All-time highs only move up, to today's price.
async function updatePrices(data, { fetchLatest, fetchSeries, onProgress = () => {} }) {
  const tickers = Object.keys(data.stocks).sort();
  const benches = Object.keys(data.bench || {});
  const days = data.activity?.length ? data.activity.map((a) => a.d) : tickers.flatMap((t) => data.stocks[t].lots.map((l) => l.d));
  const since = priceHistoryStart(days);
  const total = tickers.length + benches.length;
  let done = 0, asof = null;
  const step = (ticker) => onProgress({ step: 'prices', done: ++done, total, ticker });
  onProgress({ step: 'prices', done: 0, total });
  const lookup = (list, fn) => pool(list, async (t) => { const r = await attempt(() => fn(t)); step(t); return r; });
  const [latest, benchSeries] = await Promise.all([
    // a stock with no price stays as it is until the next full refresh
    lookup(tickers, (t) => (data.stocks[t].noPrice ? Promise.reject(new Error('no price')) : fetchLatest(t, since))),
    lookup(benches, (b) => fetchSeries(b, since, true)),
  ]);
  if (latest.every((q) => q.error)) throw latest.find((q, i) => !data.stocks[tickers[i]].noPrice)?.error || latest[0].error;
  const stocks = {};
  for (const [i, t] of tickers.entries()) {
    const q = latest[i], s = data.stocks[t];
    if (q.error) { stocks[t] = s; continue; }
    if (!asof || q.time > asof) asof = q.time;
    const high = q.price > s.ath;
    stocks[t] = { ...s, price: q.price, prevClose: q.prevClose ?? null, series: q.series,
      ath: high ? q.price : s.ath, athDate: high ? formatAsof(q.time).slice(0, 7) : s.athDate };
  }
  const bench = { ...data.bench }, benchDay = { ...data.benchDay };
  benches.forEach((b, i) => { const r = benchSeries[i]; if (!r.error) { bench[b] = r.series; benchDay[b] = r.dayChange; } });
  onProgress({ step: 'prices', done: total, total });
  return { ...data, asof: formatAsof(asof), stocks, bench, benchDay };
}

const api = { readQfx, rebuildLots, buildData, refreshPrices, updatePrices, priceHistoryStart, pool, sellOrder, anniversary, addDays };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else window.Lots = api;
}
