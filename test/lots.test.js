'use strict';
// Run with: npm test  (uses only the synthetic export in test/fixtures)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readQfx, rebuildLots, buildData, refreshPrices, updatePrices, sellOrder, anniversary } = require('../public/lots');

const text = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.qfx'), 'latin1');
const total = (q) => q.reduce((x, l) => x + l.sh, 0);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('reads trades, splits and positions', () => {
  const { events, positions } = readQfx(text);
  assert.equal(events.length, 8);
  assert.deepEqual(positions, { AAA: 50, BBB: 12 });
});

test('FIFO sells the oldest lot, then a split scales shares and cost', () => {
  const { lots, splits } = rebuildLots(readQfx(text).events, 'FIFO');
  // 30 bought, 5 sold from Jan lot, then 25 shares added by a 2-for-1 split
  close(total(lots.AAA), 50);
  close(lots.AAA[0].sh, 10); close(lots.AAA[0].c, 50);   // Jan: 5 left -> 10 at $50
  assert.equal(splits.length, 2);
});

test('HIFO and LIFO pick different lots', () => {
  const { events } = readQfx(text);
  const hifo = rebuildLots(events, 'HIFO').lots.AAA;
  const lifo = rebuildLots(events, 'LIFO').lots.AAA;
  close(hifo.find((l) => l.d === '2024-02-05').sh, 10);  // $120 Feb lot sold down to 5 -> 10
  close(lifo.find((l) => l.d === '2024-03-05').sh, 10);  // newest Mar lot sold down to 5 -> 10
});

test('reverse split with a new CUSIP merges under one ticker', () => {
  const { lots } = rebuildLots(readQfx(text).events, 'FIFO');
  close(total(lots.BBB), 12);
  close(lots.BBB[0].c, 60);                               // $5 x 12
});

test('long-term starts the day after the one-year anniversary', () => {
  assert.equal(anniversary('2024-01-05'), '2025-01-05');
  assert.equal(anniversary('2024-02-29'), '2025-03-01');
});

test('buildData reconciles with positions and never includes the file name', async () => {
  const fetchQuote = async (t) => ({ name: t, price: 100, ath: 120, athDate: '2025-01', series: [], time: 1767225600 });
  const data = await buildData(text, { fetchQuote });
  assert.deepEqual(data.meta.mismatches, []);
  assert.equal(data.stocks.AAA.lots[0].lt, '2025-01-06');
  assert.ok(!('source' in data.meta));
});

test('rejects files that are not Quicken exports', () => {
  assert.throws(() => readQfx('hello world'), /Quicken/);
});

test('TAXOPT sells losses first, then long-term gains, then short-term gains', () => {
  const lots = [
    { d: '2024-01-01', sh: 1, c: 50 },   // long-term gain
    { d: '2024-02-01', sh: 1, c: 150 },  // long-term loss
    { d: '2025-06-01', sh: 1, c: 80 },   // short-term gain
    { d: '2025-07-01', sh: 1, c: 140 },  // short-term loss
    { d: '2024-03-01', sh: 1, c: 70 },   // long-term gain, higher cost
  ];
  const order = sellOrder(lots, 'TAXOPT', 100, '2025-10-01').map((l) => l.d);
  assert.deepEqual(order, ['2025-07-01', '2024-02-01', '2024-03-01', '2024-01-01', '2025-06-01']);
});

test('TAXOPT can replay past sales', () => {
  const { lots } = rebuildLots(readQfx(text).events, 'TAXOPT');
  close(total(lots.AAA), 50);
  // the Apr 2024 sale at $130: nothing long-term yet, no losses, so the $120 Feb lot goes first
  close(lots.AAA.find((l) => l.d === '2024-02-05').sh, 10);
});

test('every theme stays readable', async () => {
  const { THEMES, tokens, contrast } = await import('../scripts/themes.mjs');
  for (const t of THEMES) {
    const k = tokens(t);
    for (const role of ['fg', 'muted', 'good', 'warn', 'bad']) assert.ok(contrast(k[role], k.panel) >= 4.5, `${t.id} ${role}`);
    assert.ok(contrast(k['accent-ink'], k.accent) >= 4.5, `${t.id} accent-ink`);
  }
});

test('refreshPrices keeps purchases and replaces only prices', async () => {
  const first = async (t) => ({ name: t, price: 100, ath: 120, athDate: '2025-01', series: [], time: 1767225600 });
  const data = await buildData(text, { fetchQuote: first });
  const later = async (t) => ({ name: t, price: 130, ath: 140, athDate: '2026-01', series: [['2026-01-02', 130]], time: 1767312000 });
  const next = await refreshPrices(data, { fetchQuote: later });
  assert.deepEqual(next.stocks.AAA.lots, data.stocks.AAA.lots);
  assert.equal(next.stocks.AAA.price, 130);
  assert.equal(next.stocks.BBB.ath, 140);
  assert.notEqual(next.asof, data.asof);
  assert.deepEqual(next.meta, data.meta);
});

test('an automatic update changes only prices, and raises all-time highs', async () => {
  const first = async (t) => ({ name: t, price: 100, prevClose: 99, ath: 120, athDate: '2025-01', series: [], time: 1767225600 });
  const data = await buildData(text, { fetchQuote: first });
  const asked = [];
  const latest = async (t) => { asked.push(t); return { price: t === 'AAA' ? 150 : 90, prevClose: 95, series: [['2026-01-05', 150]], time: 1767312000 }; };
  const next = await updatePrices({ ...data, bench: {} }, { fetchLatest: latest, fetchSeries: async () => ({ series: [], dayChange: 0 }) });
  assert.deepEqual(asked, ['AAA', 'BBB'], 'one lookup per stock held');
  assert.deepEqual(next.stocks.AAA.lots, data.stocks.AAA.lots);
  assert.equal(next.stocks.AAA.ath, 150, 'a new high');
  assert.equal(next.stocks.BBB.ath, 120, 'below the old high: unchanged');
  assert.equal(next.stocks.BBB.prevClose, 95);
});

test('the sector lookup accepts only a ticker', async () => {
  const { parseProfileRequest } = await import('../src/chart.mjs');
  const ask = (q) => parseProfileRequest(new URL('https://example.test/api/profile?' + q));
  assert.deepEqual(ask('symbol=AMD'), { symbol: 'AMD' });
  for (const bad of ['symbol=amd', 'symbol=', 'symbol=AMD&q=x', 'q=AMD']) assert.ok(ask(bad).error, bad);
});

test('the price lookup accepts only a ticker and the fixed ranges', async () => {
  const { parseChartRequest } = await import('../src/chart.mjs');
  const ask = (q) => parseChartRequest(new URL('https://example.test/api/chart?' + q));
  assert.deepEqual(ask('symbol=AMD&range=max&interval=1mo'), { symbol: 'AMD', range: 'max', interval: '1mo' });
  assert.deepEqual(ask('symbol=BRK.B&range=5y&interval=1wk'), { symbol: 'BRK.B', range: '5y', interval: '1wk' });
  for (const longer of ['10y', 'max']) assert.equal(ask(`symbol=SPY&range=${longer}&interval=1wk`).range, longer, 'history older than 5 years');
  for (const bad of [
    'symbol=amd&range=max&interval=1mo',                 // lowercase
    'symbol=AMD%2F..%2Fx&range=max&interval=1mo',        // path tricks
    'symbol=TOOLONGTICKER&range=max&interval=1mo',
    'symbol=AMD&range=1d&interval=1m',                   // other ranges
    'symbol=AMD&range=5y&interval=1mo',                  // mismatched pair
    'symbol=AMD&range=max&interval=1mo&shares=12',       // anything extra
  ]) assert.ok(ask(bad).error, bad);
});

// ---- wash sales ----
const buy = (date, units, price) => ({ kind: 'BUYSTOCK', date, t: 'W', units, total: -units * price, price });
const sell = (date, units, price) => ({ kind: 'SELLSTOCK', date, t: 'W', units: -units, total: units * price, price });
const held = (r) => r.lots.W.reduce((s, l) => s + l.sh, 0);

test('wash sale: a loss sale bought back within 30 days', () => {
  const r = rebuildLots([buy('2025-01-02', 10, 100), sell('2025-03-03', 10, 80), buy('2025-03-17', 10, 85)], 'FIFO');
  assert.equal(r.realized[0].disallowed, 200, 'the whole $200 loss is disallowed');
  const [lot] = r.lots.W;
  assert.ok(Math.abs(lot.c - 105) < 1e-9, '$85 plus $20 of disallowed loss per share');
  // held 60 days before the sale: the replacement's holding period starts 60 days before its purchase
  assert.equal(lot.held, '2025-01-16');
  assert.deepEqual(lot.wash, { add: 20, from: '2025-03-03' });
  assert.equal(r.washSales.length, 1);
});

test('wash sale: only the shares bought back count', () => {
  const r = rebuildLots([buy('2025-01-02', 10, 100), sell('2025-03-03', 10, 80), buy('2025-03-17', 4, 85)], 'FIFO');
  assert.equal(r.realized[0].disallowed, 80, '4 of 10 shares: $80 of the $200 loss');
});

test('wash sale: shares bought in the 30 days before the sale also count', () => {
  const r = rebuildLots([buy('2025-01-02', 10, 100), buy('2025-02-20', 5, 90), sell('2025-03-03', 10, 80)], 'FIFO');
  assert.equal(r.realized[0].disallowed, 100, 'the 5 February shares replace 5 sold ones at $20 each');
  const feb = r.lots.W.filter((l) => l.d === '2025-02-20');
  assert.ok(feb.length === 1 && Math.abs(feb[0].c - 110) < 1e-9 && feb[0].sh === 5);
});

test('no wash sale for gains, or for purchases more than 30 days away', () => {
  const gain = rebuildLots([buy('2025-01-02', 10, 100), sell('2025-03-03', 10, 120), buy('2025-03-17', 10, 115)], 'FIFO');
  assert.equal(gain.realized[0].disallowed, 0);
  const late = rebuildLots([buy('2025-01-02', 10, 100), sell('2025-03-03', 10, 80), buy('2025-04-03', 10, 85)], 'FIFO');
  assert.equal(late.realized[0].disallowed, 0, '31 days later');
  assert.equal(late.washSales.length, 0);
});

test('wash sale: a replacement share absorbs only one loss, and a split carries the adjustment', () => {
  const r = rebuildLots([
    buy('2025-01-02', 10, 100), sell('2025-03-03', 5, 80),          // $100 loss on 5 shares
    buy('2025-03-10', 5, 82), sell('2025-03-12', 5, 79),            // sells 5 more old shares at a loss ($105)
    buy('2025-03-20', 5, 81),
  ], 'FIFO');
  assert.equal(r.realized[0].disallowed, 100, 'first loss: replaced by the March 10 shares');
  assert.equal(r.realized[1].disallowed, 105, 'second loss: the March 10 shares are taken, so March 20 replaces');
  assert.ok(Math.abs(held(r) - 10) < 1e-9);
  const split = rebuildLots([buy('2025-01-02', 10, 100), sell('2025-03-03', 10, 80), buy('2025-03-17', 10, 85),
    { kind: 'SPLIT', date: '2025-06-02', t: 'W', old: 10, new: 20 }], 'FIFO');
  assert.ok(Math.abs(split.lots.W[0].c - 52.5) < 1e-9 && Math.abs(split.lots.W[0].wash.add - 10) < 1e-9, 'halved by a 2-for-1 split');
});

test('tax estimate: long- and short-term rates, losses offset the other kind', () => {
  const { taxRates, estimateTax } = require('../public/shared');
  const r = taxRates({ ordinary: 0.24, longTerm: 0.15, state: 0.05, niit: true });
  assert.ok(Math.abs(r.short - 0.328) < 1e-9 && Math.abs(r.long - 0.238) < 1e-9);
  const plain = taxRates({ ordinary: 0.24, longTerm: 0.15, state: 0, niit: false });
  assert.equal(estimateTax(1000, 0, plain), 150);
  assert.equal(estimateTax(0, 1000, plain), 240);
  assert.equal(estimateTax(1000, -400, plain), 90, 'a short-term loss offsets the long-term gain');
  assert.equal(estimateTax(-1000, 300, plain), 0, 'a bigger long-term loss wipes out the short-term gain');
  assert.equal(estimateTax(-500, -500, plain), 0);
});

test('the lookups answer only same-origin GET requests', async () => {
  const { refuseRequest } = await import('../src/chart.mjs');
  assert.equal(refuseRequest('GET', 'same-origin'), null);
  assert.equal(refuseRequest('GET', null).status, 403, 'no browser label: a script or another tool');
  assert.equal(refuseRequest('GET', 'cross-site').status, 403);
  assert.equal(refuseRequest('GET', 'none').status, 403, 'typed into the address bar');
  assert.equal(refuseRequest('POST', 'same-origin').status, 405);
});

test('a stock with no price is kept, valued at what you last paid', async () => {
  const quote = async (t) => {
    if (t === 'BBB') throw new Error('delisted');
    return { name: t, price: 100, ath: 120, athDate: '2025-01', series: [], time: 1767225600 };
  };
  const data = await buildData(text, { fetchQuote: quote });
  assert.equal(data.stocks.AAA.price, 100);
  assert.equal(data.stocks.BBB.noPrice, true);
  const lastPaid = data.stocks.BBB.lots.at(-1).c;
  assert.equal(data.stocks.BBB.price, lastPaid);
  // a later refresh that finds the price clears the mark; one that fails keeps what was there
  const found = await refreshPrices(data, { fetchQuote: async (t) => ({ name: t, price: 50, ath: 60, athDate: '2026-01', series: [], time: 1767312000 }) });
  assert.equal(found.stocks.BBB.price, 50);
  assert.equal(found.stocks.BBB.noPrice, undefined);
  const partly = await refreshPrices(found, { fetchQuote: async (t) => { if (t === 'AAA') throw new Error('down'); return { name: t, price: 55, ath: 60, athDate: '2026-01', series: [], time: 1767398400 }; } });
  assert.equal(partly.stocks.AAA.price, 50, 'kept from the last refresh');
  assert.equal(partly.stocks.BBB.price, 55);
  // nothing at all: that's an error worth showing
  await assert.rejects(buildData(text, { fetchQuote: async () => { throw new Error('offline'); } }), /offline/);
});

test('price lookups run a few at a time and keep their order', async () => {
  const { pool } = require('../public/lots');
  let running = 0, most = 0;
  const out = await pool([5, 1, 4, 2, 3, 6], async (n) => {
    most = Math.max(most, ++running);
    await new Promise((ok) => setTimeout(ok, n));
    running--;
    return n * 10;
  }, 3);
  assert.deepEqual(out, [50, 10, 40, 20, 30, 60]);
  assert.equal(most, 3);
});

test('a sale is split into short- and long-term gain', () => {
  const buy = (date, units, price) => ({ kind: 'BUYSTOCK', date, t: 'XYZ', units, total: -units * price, price });
  const sell = (date, units, price) => ({ kind: 'SELLSTOCK', date, t: 'XYZ', units: -units, total: units * price, price });
  // 10 shares held over a year, 10 held three months; 15 sold at $150, oldest first
  const { realized } = rebuildLots([buy('2024-01-10', 10, 100), buy('2025-03-01', 10, 120), sell('2025-06-02', 15, 150)]);
  assert.equal(realized[0].lt, 500, '10 long-term shares, $50 each');
  assert.equal(realized[0].st, 150, '5 short-term shares, $30 each');
  assert.equal(realized[0].proceeds - realized[0].cost, realized[0].lt + realized[0].st);
});

test('sales by tax year leave out losses a wash sale blocks', () => {
  const { realizedByYear } = require('../public/shared');
  const buy = (date, units, price) => ({ kind: 'BUYSTOCK', date, t: 'XYZ', units, total: -units * price, price });
  const sell = (date, units, price) => ({ kind: 'SELLSTOCK', date, t: 'XYZ', units: -units, total: units * price, price });
  const { realized } = rebuildLots([
    buy('2024-01-10', 10, 100), sell('2024-06-03', 10, 130),   // 2024: +300 short-term
    buy('2025-01-06', 10, 100), sell('2025-03-03', 10, 80),    // 2025: -200 short-term...
    buy('2025-03-10', 4, 85),                                  // ...but 4 shares bought back within 30 days
  ]);
  const years = realizedByYear(realized);
  assert.deepEqual(years.map((y) => y.year), ['2025', '2024']);
  assert.equal(years[0].st, -120, 'only 6 of the 10 losing shares count');
  assert.equal(years[0].wash, 80);
  assert.equal(years[1].st, 300);
  assert.equal(years[1].lt, 0);
  assert.equal(realizedByYear([{ d: '2024-06-03', proceeds: 1, cost: 1 }]), null, 'saved before the split existed');
  assert.deepEqual(realizedByYear([]), []);
});

test('selling at a loss: what counts, and what a recent purchase blocks', () => {
  const { lossSale, harvest } = require('../public/shared');
  const asof = '2026-06-30';
  const lots = [
    { d: '2025-01-10', sh: 10, c: 100, lt: '2026-01-11' },   // long-term, below cost at $90
    { d: '2026-03-02', sh: 5, c: 95, lt: '2027-03-03' },     // short-term, below cost
    { d: '2026-06-15', sh: 4, c: 80, lt: '2027-06-16' },     // bought 15 days ago, at a gain
  ];
  const h = harvest(lots, 90, asof);
  assert.equal(h.sh, 15);
  assert.equal(h.ltLoss, 100);
  assert.equal(h.stLoss, 25);
  assert.equal(h.washSh, 4, 'the 4 shares bought 15 days ago replace 4 of the 15 sold');
  close(h.washLoss, 125 * 4 / 15);
  assert.equal(h.lastBuy, '2026-06-15');
  assert.equal(h.clearOn, '2026-07-16');
  // selling the recent shares too leaves nothing to replace the loss
  assert.equal(lossSale(lots, [10, 5, 4], 90, asof).washSh, 0);
  // an older purchase doesn't count
  assert.equal(harvest(lots.slice(0, 2), 90, asof).washSh, 0);
  // nothing below cost
  assert.equal(harvest(lots, 200, asof).sh, 0);
});

test('price times are New York dates, wherever the browser is', () => {
  const { nyStamp, nyDay } = require('../public/shared');
  assert.equal(nyStamp(Date.UTC(2026, 0, 6, 21, 0)), '2026-01-06 16:00', 'the close, in winter');
  assert.equal(nyStamp(Date.UTC(2026, 6, 6, 20, 0)), '2026-07-06 16:00', 'the close, in summer');
  assert.equal(nyDay(Date.UTC(2026, 0, 7, 3, 0)), '2026-01-06', 'still the 6th in New York');
});
