'use strict';
// Performance math, checked against cases with known answers. Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../public/perf-calc');
const { buildData, readQfx, rebuildLots } = require('../public/lots');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b}`);
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

// A weekly series from `from` for `weeks` weeks, price = f(week number).
const weekly = (from, weeks, f) => Array.from({ length: weeks }, (_, i) => [addDays(from, 7 * i), f(i)]);

test('xirr finds a known annual rate', () => {
  near(P.xirr([{ d: '2024-01-01', amt: -1000 }, { d: '2025-01-01', amt: 1100 }]), 0.1, 0.001, 'one year at 10%');
  near(P.xirr([{ d: '2024-01-01', amt: -1000 }, { d: '2024-07-01', amt: -1000 }, { d: '2025-01-01', amt: 2150 }]), 0.1, 0.01, 'two deposits');
  assert.equal(P.xirr([{ d: '2024-01-01', amt: -1000 }]), null);
});

test('owning the index itself matches "the same money in the market"', () => {
  const bench = weekly('2024-01-01', 104, (i) => 100 + i);          // rises from 100 to 203
  const activity = [];
  for (let m = 0; m < 24; m++) {
    const d = addDays('2024-01-01', 30 * m + 2);
    const price = P.priceAt(bench, d);
    activity.push({ d, type: 'BUY', t: 'IDX', sh: 100 / price, price, amount: 100 });
  }
  const last = bench[bench.length - 1];
  const data = {
    asof: `${addDays(last[0], 4)} 16:00`,
    stocks: { IDX: { price: last[1], series: bench, lots: [{ d: '2024-01-03', sh: activity.reduce((s, a) => s + a.sh, 0), c: 1 }] } },
    activity, realized: [], income: [], splitEvents: [], history: {}, bench: { SPY: bench },
  };
  const points = P.timeline(data, 'SPY');
  const s = P.summary(data, points);
  near(s.value, s.shadow, 0.01, 'value equals the same money in the index');
  near(s.vsMarket, 0, 0.01, 'no difference vs market');
  near(s.twr, s.benchReturn, 0.01, 'time-weighted return equals the index return');
  near(s.irr, s.marketIrr, 1e-4, 'same annual return');
  assert.ok(s.gain > 0 && s.drawdown.drawdown === 0, 'only rising prices: a gain and no drawdown');
});

test('a split counts earlier shares in today\'s units', () => {
  // 10 shares at $100; a 2-for-1 split later; prices are split-adjusted (so $50 before it)
  const series = weekly('2024-01-01', 30, (i) => (i < 20 ? 50 : 60));
  const data = {
    asof: `${addDays(series[29][0], 4)} 16:00`,
    stocks: { ABC: { price: 60, series, lots: [{ d: '2024-01-02', sh: 20, c: 50 }] } },
    activity: [{ d: '2024-01-02', type: 'BUY', t: 'ABC', sh: 10, price: 100, amount: 1000 }],
    realized: [], income: [], history: {},
    splitEvents: [{ t: 'ABC', d: '2024-03-04', ratio: 2 }],
    bench: { SPY: series },
  };
  const points = P.timeline(data, 'SPY');
  near(points[0].value, 0, 0, 'starts from nothing');
  near(points[1].value, 1000, 0.01, 'first week: 20 split-adjusted shares at $50');
  near(points[points.length - 1].value, 1200, 0.01, 'today: 20 shares at $60');
});

test('per-stock results add up realized, unrealized and dividends', () => {
  const bench = weekly('2024-01-01', 60, () => 100);                 // flat market
  const data = {
    asof: '2025-02-20 16:00',
    stocks: { XYZ: { name: 'XYZ', price: 20, series: weekly('2024-01-01', 60, () => 20), lots: [{ d: '2024-01-02', sh: 5, c: 10 }] } },
    activity: [
      { d: '2024-01-02', type: 'BUY', t: 'XYZ', sh: 10, price: 10, amount: 100 },
      { d: '2024-06-03', type: 'SELL', t: 'XYZ', sh: 5, price: 20, amount: 100 },
    ],
    realized: [{ t: 'XYZ', d: '2024-06-03', proceeds: 100, cost: 50 }],
    income: [{ d: '2024-09-01', t: 'XYZ', type: 'DIV', amount: 5 }],
    splitEvents: [], history: {}, bench: { SPY: bench },
  };
  const [r] = P.holdings(data, 'SPY');
  near(r.value, 100, 1e-9); near(r.unrealized, 50, 1e-9); near(r.realized, 50, 1e-9); near(r.divs, 5, 1e-9);
  near(r.gain, 105, 1e-9, 'total');
  near(r.marketGain, 0, 1e-9, 'a flat market gains nothing');
  near(r.vsMarket, 105, 1e-9);
  near(r.weight, 1, 1e-9);
  const [month] = P.monthly(data);
  assert.equal(month.month, '2024-01'); near(month.bought, 100, 1e-9);
});

test('ranges and periods', () => {
  const bench = weekly('2024-01-01', 104, (i) => 100 + i);
  const data = {
    asof: `${addDays(bench[103][0], 4)} 16:00`,
    stocks: { IDX: { price: bench[103][1], series: bench, lots: [{ d: '2024-01-02', sh: 10, c: 100 }] } },
    activity: [{ d: '2024-01-02', type: 'BUY', t: 'IDX', sh: 10, price: 100, amount: 1000 }],
    realized: [], income: [], splitEvents: [], history: {}, bench: { SPY: bench },
  };
  const points = P.timeline(data, 'SPY');
  const i = P.rangeStart(points, '1Y');
  assert.ok(i > 0 && i < points.length - 1);
  const p = P.period(points, i, points.length - 1);
  near(p.added, 0, 1e-9, 'nothing added in the last year');
  near(p.gain, p.valueChange, 1e-9);
  near(p.twr, p.benchReturn, 0.01);
  assert.equal(P.rangeStart(points, 'ALL'), 0);
  const all = P.period(points, 0, points.length - 1);
  near(all.added, 1000, 1e-9, 'the whole history counts every dollar put in');
  near(all.bought, 1000, 1e-9);
});

test('the parser keeps the history the performance page needs', async () => {
  const text = fs.readFileSync(path.join(__dirname, 'fixtures', 'demo.qfx'), 'latin1');
  const { activity, realized } = rebuildLots(readQfx(text).events, 'FIFO');
  assert.equal(activity.filter((a) => a.type === 'BUY').length, 11);
  assert.equal(activity.filter((a) => a.type === 'SELL').length, 2);
  assert.equal(realized.length, 2);
  const vti = realized.find((r) => r.d === '2025-06-01');
  near(vti.proceeds - vti.cost, 3 * 290 - 3 * 235, 0.01, 'sold the oldest VTI shares');
  assert.equal(readQfx(text).income.length, 2);

  const quote = async (t) => ({ name: t, price: 100, ath: 120, athDate: '2025-01', series: [['2024-01-01', 100]], time: 1767225600 });
  const asked = [];
  const series = async (t, since, total) => { asked.push([t, total]); return { series: [['2024-01-01', 100]], dayChange: 0.01 }; };
  const data = await buildData(text, { fetchQuote: quote, fetchSeries: series });
  assert.deepEqual(asked, [['KO', false], ['SPY', true]], 'history for the stock sold, then the market index');
  assert.ok(data.bench.SPY.length && data.activity.length === 13 && data.history.KO.length);
  assert.equal(data.income.length, 2);
  assert.equal(data.benchDay.SPY, 0.01);
});

test('last week, a number of years, and the last trading day', () => {
  const bench = weekly('2023-01-02', 156, (i) => 100 + i);
  const data = {
    asof: `${addDays(bench[155][0], 4)} 16:00`,
    stocks: { IDX: { price: 260, prevClose: 250, series: bench, lots: [{ d: '2023-01-03', sh: 10, c: 100 }] } },
    activity: [{ d: '2023-01-03', type: 'BUY', t: 'IDX', sh: 10, price: 100, amount: 1000 }],
    realized: [], income: [], splitEvents: [], history: {}, bench: { SPY: bench }, benchDay: { SPY: 0.02 },
  };
  const points = P.timeline(data, 'SPY');
  assert.equal(P.rangeStart(points, 'W'), points.length - 2);
  assert.equal(new Set(points.map((p) => p.d)).size, points.length, 'one point per date');
  // a bar for today next to this week's bar (as Yahoo sends) still gives one point for today
  const withToday = { ...data, bench: { SPY: [...bench, [data.asof.slice(0, 10), 256]] } };
  const p2 = P.timeline(withToday, 'SPY');
  assert.equal(new Set(p2.map((p) => p.d)).size, p2.length);
  const two = P.rangeStart(points, '2Y'), half = P.rangeStart(points, '1.5Y');
  assert.ok(two < half && half < points.length - 1, 'longer periods start earlier');
  assert.equal(P.rangeStart(points, '10Y'), 0, 'more years than the history: from the start');
  const t = P.today(data, 'SPY');
  near(t.change, 100, 1e-9, '10 shares up $10');
  near(t.pct, 100 / 2500, 1e-9);
  assert.equal(t.benchPct, 0.02);
});

test('treemap tiles fill the space in proportion, without overlapping', () => {
  const items = [6, 6, 4, 3, 2, 2, 1].map((value, i) => ({ id: i, value }));
  const W = 600, H = 400;
  const tiles = P.squarify(items, 0, 0, W, H);
  assert.equal(tiles.length, items.length);
  const total = items.reduce((s, it) => s + it.value, 0);
  for (const t of tiles) {
    near(t.w * t.h, (t.value / total) * W * H, 1e-6, `tile ${t.id} area`);
    assert.ok(t.x >= -1e-9 && t.y >= -1e-9 && t.x + t.w <= W + 1e-6 && t.y + t.h <= H + 1e-6, `tile ${t.id} inside`);
  }
  for (const a of tiles) for (const b of tiles) {
    if (a === b) continue;
    const overlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    assert.ok(overlap < 1e-6, `tiles ${a.id} and ${b.id} overlap`);
  }
  const worstRatio = Math.max(...tiles.map((t) => Math.max(t.w / t.h, t.h / t.w)));
  assert.ok(worstRatio < 4, `tiles stay close to square (worst ${worstRatio.toFixed(2)})`);
});

test('holdings are grouped by sector, funds together', () => {
  const lots = (sh, c) => [{ d: '2024-01-02', sh, c, lt: '2025-01-03' }];
  const data = {
    asof: '2026-10-30 16:00',
    stocks: {
      AAPL: { name: 'Apple', price: 200, lots: lots(10, 100) },
      MSFT: { name: 'Microsoft', price: 500, lots: lots(2, 400) },
      VTI: { name: 'Total market', price: 300, lots: lots(5, 250) },
    },
    profiles: {
      AAPL: { type: 'EQUITY', sector: 'Technology', industry: 'Consumer Electronics' },
      MSFT: { type: 'EQUITY', sector: 'Technology', industry: 'Software' },
      VTI: { type: 'ETF', sector: null, industry: null },
    },
  };
  const c = P.composition(data);
  near(c.total, 2000 + 1000 + 1500, 1e-9);
  assert.deepEqual(c.groups.map((g) => g.name), ['Technology', 'Funds (ETFs)']);
  near(c.groups[0].share, 3000 / 4500, 1e-9);
  assert.deepEqual(c.groups[0].items.map((i) => i.t), ['AAPL', 'MSFT']);
  near(c.groups[0].items[0].gainPct, 1, 1e-9, 'AAPL doubled');
});

test('automatic updates run only while the market is open, plus once after the close', () => {
  const M = require('../public/market');
  const ny = (iso) => Date.parse(iso);                         // times given with New York's offset
  const tue = (hm) => ny(`2026-10-27T${hm}:00-04:00`);
  assert.equal(M.marketState(tue('10:00')).open, true);
  assert.equal(M.marketState(tue('09:00')).open, false);
  assert.equal(M.marketState(tue('16:00')).open, false);
  assert.equal(M.marketState(ny('2026-10-31T12:00:00-04:00')).open, false, 'Saturday');
  assert.equal(M.marketState(ny('2026-12-01T10:00:00-05:00')).open, true, 'winter time');

  const five = 5;
  assert.equal(M.updateDue(tue('10:00'), tue('09:56'), five), false, '4 minutes since the last update');
  assert.equal(M.updateDue(tue('10:00'), tue('09:55'), five), true);
  assert.equal(M.updateDue(tue('10:00'), tue('09:55'), 0), false, 'turned off');
  assert.equal(M.updateDue(tue('16:10'), tue('15:58'), five), true, 'once after the close');
  assert.equal(M.updateDue(tue('16:12'), tue('16:10'), five), false, 'already caught the close');
  assert.equal(M.updateDue(tue('20:00'), tue('15:58'), five), false, 'evening: nothing');
  assert.equal(M.updateDue(ny('2026-10-31T12:00:00-04:00'), 0, five), false, 'weekend: nothing');
});

test('your sector choices win, and tiny holdings get a visible size', () => {
  const lots = (sh, c) => [{ d: '2024-01-02', sh, c, lt: '2025-01-03' }];
  const data = {
    asof: '2026-10-30 16:00',
    stocks: {
      GOOGL: { name: 'Alphabet', price: 300, lots: lots(10, 100) },
      AAPL: { name: 'Apple', price: 200, lots: lots(10, 100) },
      TINY: { name: 'Tiny', price: 1, lots: lots(10, 5) },
    },
    profiles: {
      GOOGL: { type: 'EQUITY', sector: 'Communication Services' },
      AAPL: { type: 'EQUITY', sector: 'Technology' },
      TINY: { type: 'EQUITY', sector: 'Communication Services' },
    },
  };
  const c = P.composition(data, { overrides: { GOOGL: 'Technology' }, minShare: 0.015 });
  const tech = c.groups.find((g) => g.name === 'Technology');
  assert.deepEqual(tech.items.map((i) => i.t), ['GOOGL', 'AAPL']);
  assert.equal(tech.items[0].yahooSector, 'Communication Services', 'still knows what Yahoo says');
  const tiny = c.groups.find((g) => g.name === 'Communication Services').items[0];
  near(tiny.share, 10 / 5010, 1e-9, 'the real share is kept');
  near(tiny.size, 5010 * 0.015, 1e-9, 'drawn at 1.5%');
  near(tech.items[0].size, 3000, 1e-9, 'bigger holdings keep their size');
});

test('exchange holidays and early closes', () => {
  const M = require('../public/market');
  // the published NYSE calendars for 2025 and 2026
  const closed = (y) => Object.entries(M.holidays(y)).filter(([, k]) => k === 'closed').map(([d]) => d).sort();
  assert.deepEqual(closed(2025), ['2025-01-01', '2025-01-20', '2025-02-17', '2025-04-18', '2025-05-26', '2025-06-19', '2025-07-04', '2025-09-01', '2025-11-27', '2025-12-25']);
  assert.deepEqual(closed(2026), ['2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25']);
  assert.equal(M.holidays(2026)['2026-11-27'], 'early', 'the day after Thanksgiving');
  assert.equal(M.holidays(2026)['2026-12-24'], 'early', 'Christmas Eve');
  assert.equal(M.holidays(2027)['2027-12-24'], 'closed', 'Christmas on a Saturday: closed Friday');
  // 2022-01-01 was a Saturday: no closure that year for New Year's Day, and none in late December 2021
  assert.ok(!Object.keys(M.holidays(2022)).some((d) => d === '2022-01-01' || d.startsWith('2021')));
  assert.equal(M.holidays(2021)['2021-12-31'], undefined, 'New Year on a Saturday is not moved back');

  const at = (isoTime) => M.marketState(Date.parse(isoTime));
  assert.equal(at('2026-11-26T11:00:00-05:00').open, false, 'Thanksgiving');
  assert.equal(at('2026-11-27T12:30:00-05:00').open, true, 'early-close day, before 1 PM');
  assert.equal(at('2026-11-27T13:30:00-05:00').open, false, 'early-close day, after 1 PM');
  assert.equal(at('2026-11-27T13:10:00-05:00').justClosed, true, 'catch the early close');
  assert.equal(M.updateDue(Date.parse('2026-11-26T11:00:00-05:00'), 0, 5), false, 'no updates on a holiday');
});

test('the logo lookup accepts only a ticker', async () => {
  const { parseLogoRequest } = await import('../src/chart.mjs');
  const u = (q) => new URL('https://x.test/api/logo?' + q);
  assert.deepEqual(parseLogoRequest(u('symbol=BRK.B')), { symbol: 'BRK.B' });
  assert.ok(parseLogoRequest(u('symbol=aapl')).error);
  assert.ok(parseLogoRequest(u('symbol=AAPL&size=999')).error);
  assert.ok(parseLogoRequest(u('symbol=../x')).error);
});
