'use strict';
{
// Portfolio performance from a saved result: value over time, the same money put into a
// market index on the same days, time-weighted and money-weighted returns, and results per
// stock. Pure functions with no page or network access; tested in test/perf.test.js.

const DAY = 86400000;
const ms = (iso) => Date.parse(iso + 'T00:00:00Z');
const isoOf = (t) => new Date(t).toISOString().slice(0, 10);
const byDate = (a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
const BUYISH = new Set(['BUY', 'IN']);

// Last price on or before `iso` in a weekly series [[iso, price], ...] (oldest first).
function priceAt(series, iso) {
  if (!series?.length) return null;
  let lo = 0, hi = series.length - 1, hit = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid][0] <= iso) { hit = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return hit >= 0 ? series[hit][1] : series[0][1];
}

// Prices are split-adjusted, so shares traded before a split are counted in today's units.
// On a split day, buys come before the split and sales after it (as in the lot rebuild).
function splitFactor(splitEvents, t, iso, buyish) {
  let f = 1;
  for (const s of splitEvents || []) if (s.t === t && (buyish ? s.d >= iso : s.d > iso)) f *= s.ratio;
  return f;
}

const seriesFor = (data, t) => data.stocks[t]?.series || data.history?.[t] || [];

// One point per week since the first purchase, plus today.
function timeline(data, benchSym) {
  const bench = data.bench?.[benchSym];
  const acts = [...(data.activity || [])].sort(byDate);
  const income = [...(data.income || [])].sort(byDate);
  if (!acts.length || !bench?.length) return null;
  const today = data.asof.slice(0, 10);

  const ends = [];
  for (const [w] of bench) {
    const end = isoOf(ms(w) + 6 * DAY);
    // Yahoo can add a bar for today next to this week's bar: keep one point per date
    const at = end < today ? end : today;
    if (end >= acts[0].d && w <= today && ends[ends.length - 1] !== at) ends.push(at);
  }
  if (!ends.length || ends[ends.length - 1] < today) ends.push(today);

  const shares = {}, lastPx = {};
  let ai = 0, ii = 0, invested = 0, divs = 0, benchShares = 0, prevValue = 0, twr = null;
  // start from nothing the week before the first purchase, so every period sees all the money
  const zero = isoOf(ms(ends[0]) - 7 * DAY);
  const points = [{ d: zero, value: 0, invested: 0, divs: 0, flowIn: 0, flowOut: 0, shadow: 0, twr: null, bench: priceAt(bench, zero), trades: [], now: false }];
  for (const [k, end] of ends.entries()) {
    const isNow = k === ends.length - 1 && end === today;
    let flowIn = 0, flowOut = 0, weekDivs = 0;
    const trades = [];
    while (ai < acts.length && acts[ai].d <= end) {
      const a = acts[ai++];
      const buyish = BUYISH.has(a.type);
      const f = splitFactor(data.splitEvents, a.t, a.d, buyish);
      const sh = a.sh * f;
      if (a.price) lastPx[a.t] = a.price / f;
      const amount = a.amount ?? sh * (priceAt(seriesFor(data, a.t), a.d) ?? lastPx[a.t] ?? 0);
      shares[a.t] = Math.max(0, (shares[a.t] || 0) + (buyish ? sh : -sh));
      const benchPx = priceAt(bench, a.d);
      if (buyish) { flowIn += amount; benchShares += amount / benchPx; }
      else { flowOut += amount; benchShares = Math.max(0, benchShares - amount / benchPx); }
      trades.push({ ...a, amount });
    }
    while (ii < income.length && income[ii].d <= end) weekDivs += income[ii++].amount;
    invested += flowIn - flowOut;
    divs += weekDivs;

    let value = 0;
    for (const [t, sh] of Object.entries(shares)) {
      if (sh < 1e-9) continue;
      const px = isNow && data.stocks[t] ? data.stocks[t].price : priceAt(seriesFor(data, t), end) ?? lastPx[t] ?? 0;
      value += sh * px;
    }
    const benchPx = priceAt(bench, end);
    // time-weighted growth this week. Trades are valued at the week's close, so the money
    // in or out counts at the end of the week and the growth is that of last week's holdings.
    if (twr == null) { if (value > 0) twr = 1; }
    else if (prevValue > 0) twr *= (value + weekDivs - (flowIn - flowOut)) / prevValue;
    points.push({ d: end, value, invested, divs, flowIn, flowOut, shadow: benchShares * benchPx, twr, bench: benchPx, trades, now: isNow });
    prevValue = value;
  }
  return points;
}

// Annual rate r where the cash flows' present value is zero (money in negative).
function xirr(flows) {
  if (flows.length < 2 || !flows.some((f) => f.amt < 0) || !flows.some((f) => f.amt > 0)) return null;
  const start = ms(flows[0].d);
  const years = flows.map((f) => (ms(f.d) - start) / (365.25 * DAY));
  const npv = (r) => flows.reduce((s, f, i) => s + f.amt / (1 + r) ** years[i], 0);
  let lo = -0.9999, hi = 100, flo = npv(lo);
  if (flo * npv(hi) > 0) return null;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2, fm = npv(mid);
    if (Math.abs(fm) < 1e-8 || hi - lo < 1e-10) return mid;
    if (flo * fm < 0) hi = mid; else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

// Largest fall from a previous high in a series of index values, and what came after it:
//   drawdown   the fall, as a negative fraction (0 when the series never fell)
//   index      where the low was; peakIndex, the high before it
//   rise       how much the latest value is above the low (0 when the low is the latest)
//   recovered  whether the latest value is back at or above that high
//   fromPeak   the latest value against that high (negative while still below it)
function maxDrawdown(values) {
  let peak = -Infinity, peakAt = null, worst = 0, at = null, worstPeakAt = null, last = null;
  for (const [i, v] of values.entries()) {
    if (v == null) continue;
    if (v > peak) { peak = v; peakAt = i; }
    const dd = v / peak - 1;
    if (dd < worst) { worst = dd; at = i; worstPeakAt = peakAt; }
    last = v;
  }
  if (at == null) return { drawdown: 0, index: null, peakIndex: null, rise: 0, recovered: true, fromPeak: 0 };
  const low = values[at], high = values[worstPeakAt];
  return { drawdown: worst, index: at, peakIndex: worstPeakAt, rise: last / low - 1, recovered: last >= high, fromPeak: last / high - 1 };
}

// Totals for the whole history, from the timeline's last point.
function summary(data, points) {
  const last = points[points.length - 1];
  const first = points.find((p) => p.twr != null) || points[0];
  const gain = last.value - last.invested + last.divs;
  const marketGain = last.shadow - last.invested;
  const flows = [], shadowFlows = [];
  for (const p of points) {
    for (const t of p.trades) {
      const amt = BUYISH.has(t.type) ? -t.amount : t.amount;
      flows.push({ d: t.d, amt }); shadowFlows.push({ d: t.d, amt });
    }
  }
  for (const i of data.income || []) flows.push({ d: i.d, amt: i.amount });
  flows.sort(byDate); shadowFlows.sort(byDate);
  const longEnough = ms(last.d) - ms(flows[0]?.d || last.d) >= 365 * DAY;
  return {
    value: last.value, invested: last.invested, divs: last.divs, shadow: last.shadow,
    gain, gainPct: last.invested > 0 ? gain / last.invested : null,
    marketGain, vsMarket: gain - marketGain,
    irr: longEnough ? xirr([...flows, { d: last.d, amt: last.value }]) : null,
    marketIrr: longEnough ? xirr([...shadowFlows, { d: last.d, amt: last.shadow }]) : null,
    twr: last.twr / first.twr - 1,
    benchReturn: last.bench / first.bench - 1,
    drawdown: maxDrawdown(points.map((p) => p.twr)),
    since: first.d,
  };
}

// The same, for a slice of the timeline [i0, i1].
function period(points, i0, i1) {
  const a = points[i0], b = points[i1];
  const added = b.invested - a.invested, divs = b.divs - a.divs;
  const base = points.slice(i0, i1 + 1).find((p) => p.twr != null);
  return {
    from: a.d, to: b.d, added, divs,
    valueChange: b.value - a.value,
    gain: b.value - a.value - added + divs,
    marketGain: b.shadow - a.shadow - added,
    twr: base && b.twr != null ? b.twr / base.twr - 1 : null,
    benchReturn: b.bench / (base || a).bench - 1,
    bought: points.slice(i0 + 1, i1 + 1).reduce((s, p) => s + p.flowIn, 0),
    sold: points.slice(i0 + 1, i1 + 1).reduce((s, p) => s + p.flowOut, 0),
  };
}

// Where a range starts: 'W' (last week), '1M', '3M', '6M', 'YTD', a number of years such as '1Y',
// '2Y' or '2.5Y', or 'ALL'.
function rangeStart(points, range) {
  const last = points[points.length - 1].d;
  if (range === 'W') return Math.max(0, points.length - 2);
  const y = Number(last.slice(0, 4));
  const years = /^(\d+(?:\.\d+)?)Y$/.exec(range);
  const from = years ? isoOf(ms(last) - Number(years[1]) * 365.25 * DAY)
    : { '1M': isoOf(ms(last) - 30 * DAY), '3M': isoOf(ms(last) - 91 * DAY), '6M': isoOf(ms(last) - 182 * DAY), YTD: `${y}-01-01` }[range];
  if (!from) return 0;
  const i = points.findIndex((p) => p.d >= from);
  return Math.max(0, i - 1); // start from the last point before the range, so its first week counts
}

// The last trading day: the change in value of the stocks held now, and the index's change.
function today(data, benchSym) {
  let change = 0, value = 0, known = true;
  for (const s of Object.values(data.stocks)) {
    const sh = s.lots.reduce((x, l) => x + l.sh, 0);
    value += sh * s.price;
    if (s.prevClose) change += sh * (s.price - s.prevClose); else known = false;
  }
  return {
    change, pct: value - change > 0 ? change / (value - change) : null, complete: known,
    benchPct: data.benchDay?.[benchSym] ?? null,
  };
}

// Results for every stock ever held, with the same money in the index for comparison.
function holdings(data, benchSym) {
  const bench = data.bench?.[benchSym] || [];
  const today = data.asof.slice(0, 10);
  const benchNow = priceAt(bench, today);
  const rows = {};
  const row = (t) => (rows[t] ||= { t, bought: 0, sold: 0, realized: 0, divs: 0, benchShares: 0, first: null, last: null, trades: 0 });
  for (const a of [...(data.activity || [])].sort(byDate)) {
    const r = row(a.t);
    const buyish = BUYISH.has(a.type);
    const amount = a.amount ?? a.sh * splitFactor(data.splitEvents, a.t, a.d, buyish) * (priceAt(seriesFor(data, a.t), a.d) ?? 0);
    if (buyish) { r.bought += amount; r.benchShares += amount / priceAt(bench, a.d); }
    else { r.sold += amount; r.benchShares = Math.max(0, r.benchShares - amount / priceAt(bench, a.d)); }
    r.first ||= a.d; r.last = a.d; r.trades++;
  }
  for (const x of data.realized || []) row(x.t).realized += x.proceeds - x.cost + (x.disallowed || 0); // a wash sale's disallowed loss moves into the replacement shares' cost
  for (const i of data.income || []) row(i.t).divs += i.amount;

  let total = 0;
  const list = Object.values(rows).map((r) => {
    const s = data.stocks[r.t];
    const shares = s ? s.lots.reduce((x, l) => x + l.sh, 0) : 0;
    const value = s ? shares * s.price : 0;
    const openCost = s ? s.lots.reduce((x, l) => x + l.sh * l.c, 0) : 0;
    const unrealized = value - openCost;
    const gain = unrealized + r.realized + r.divs;
    const marketGain = r.benchShares * benchNow + r.sold - r.bought;
    total += value;
    return {
      t: r.t, name: s?.name || r.t, open: !!s, shares, value, openCost, unrealized,
      realized: r.realized, divs: r.divs, gain, bought: r.bought, sold: r.sold,
      gainPct: r.bought > 0 ? gain / r.bought : null,
      marketGain, vsMarket: gain - marketGain,
      first: r.first, last: r.last, trades: r.trades,
    };
  });
  for (const r of list) r.weight = total > 0 ? r.value / total : 0;
  return list;
}

// Each stock's return since `from` (an ISO date, such as January 1), for the stocks you hold
// now: what it gained since then (its value now, plus sales and dividends since, minus its
// value at `from` and the buys since), against its value at `from` plus the buys since.
function periodReturns(data, from) {
  const rows = {};
  const row = (t) => (rows[t] ||= { sh: 0, bought: 0, sold: 0, divs: 0 });
  for (const a of [...(data.activity || [])].sort(byDate)) {
    const buyish = BUYISH.has(a.type), r = row(a.t);
    const sh = a.sh * splitFactor(data.splitEvents, a.t, a.d, buyish);   // in today's units
    if (a.d < from) { r.sh += buyish ? sh : -sh; continue; }
    const amount = a.amount ?? sh * (priceAt(seriesFor(data, a.t), a.d) ?? 0);
    if (buyish) r.bought += amount; else r.sold += amount;
  }
  for (const i of data.income || []) if (i.d >= from) row(i.t).divs += i.amount;
  return Object.entries(rows).filter(([t]) => data.stocks[t]).map(([t, r]) => {
    const s = data.stocks[t];
    const value = s.lots.reduce((x, l) => x + l.sh, 0) * s.price;
    const start = Math.max(0, r.sh) * (priceAt(seriesFor(data, t), from) ?? 0);
    const gain = value + r.sold + r.divs - start - r.bought, base = start + r.bought;
    return { t, name: s.name, value, start, bought: r.bought, sold: r.sold, divs: r.divs, gain, gainPct: base > 0 ? gain / base : null };
  });
}

// Money in and out per month, with dividends.
function monthly(data) {
  const m = {};
  const at = (d) => (m[d.slice(0, 7)] ||= { month: d.slice(0, 7), bought: 0, sold: 0, divs: 0, buys: 0, sells: 0 });
  for (const a of data.activity || []) {
    if (a.type === 'BUY') { at(a.d).bought += a.amount; at(a.d).buys++; }
    else if (a.type === 'SELL') { at(a.d).sold += a.amount; at(a.d).sells++; }
  }
  for (const i of data.income || []) at(i.d).divs += i.amount;
  return Object.values(m).sort((a, b) => (a.month < b.month ? -1 : 1));
}

// Squarified treemap (Bruls, Huizing & van Wijk): tiles with areas proportional to
// `value`, kept close to square. `items` are laid out in the order given (largest first
// gives the best shapes) inside the rectangle x, y, w, h.
function squarify(items, x, y, w, h) {
  const total = items.reduce((s, it) => s + it.value, 0);
  if (!(total > 0) || w <= 0 || h <= 0) return [];
  const scale = (w * h) / total;
  let rest = items.filter((it) => it.value > 0).map((it) => ({ it, a: it.value * scale }));
  const out = [];
  const worst = (row, side) => {
    const s = row.reduce((t, r) => t + r.a, 0);
    let max = 0, min = Infinity;
    for (const r of row) { max = Math.max(max, r.a); min = Math.min(min, r.a); }
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
  };
  while (rest.length) {
    const side = Math.min(w, h);
    const row = [rest[0]];
    let i = 1;
    while (i < rest.length && worst([...row, rest[i]], side) <= worst(row, side)) row.push(rest[i++]);
    const s = row.reduce((t, r) => t + r.a, 0);
    if (w >= h) {                       // a column on the left
      const cw = rest.length === row.length ? w : s / h;
      let yy = y;
      for (const r of row) { const rh = (r.a / s) * h; out.push({ ...r.it, x, y: yy, w: cw, h: rh }); yy += rh; }
      x += cw; w -= cw;
    } else {                            // a row along the top
      const rh = rest.length === row.length ? h : s / w;
      let xx = x;
      for (const r of row) { const rw = (r.a / s) * w; out.push({ ...r.it, x: xx, y, w: rw, h: rh }); xx += rw; }
      y += rh; h -= rh;
    }
    rest = rest.slice(row.length);
  }
  return out;
}

// Holdings grouped for the overview: by sector, funds together, largest first.
// `overrides` maps a ticker to the sector you chose for it. Each tile also gets a `size`
// for drawing: holdings smaller than `minShare` of the total are drawn at that share so
// they stay visible (their `share` stays the real one).
function composition(data, { overrides = {}, minShare = 0 } = {}) {
  const groups = {};
  let total = 0;
  for (const [t, s] of Object.entries(data.stocks)) {
    const shares = s.lots.reduce((x, l) => x + l.sh, 0);
    const value = shares * s.price;
    if (!(value > 0)) continue;
    const cost = s.lots.reduce((x, l) => x + l.sh * l.c, 0);
    const p = data.profiles?.[t];
    const yahoo = p ? (p.sector || (p.type === 'ETF' || p.type === 'MUTUALFUND' ? 'Funds (ETFs)' : 'Other')) : 'Sector unknown';
    const group = overrides[t] || yahoo;
    (groups[group] ||= { name: group, value: 0, items: [] }).items.push({
      t, name: s.name, value, cost, gain: value - cost, gainPct: cost > 0 ? value / cost - 1 : null,
      industry: p?.industry || null, yahooSector: yahoo, shares, longShares: s.lots.filter((l) => data.asof.slice(0, 10) >= l.lt).reduce((x, l) => x + l.sh, 0),
    });
    groups[group].value += value;
    total += value;
  }
  const list = Object.values(groups);
  for (const g of list) {
    g.items.sort((a, b) => b.value - a.value);
    g.share = total > 0 ? g.value / total : 0;
    for (const it of g.items) {
      it.share = total > 0 ? it.value / total : 0;
      it.size = Math.max(it.value, total * minShare);
    }
    g.size = g.items.reduce((s, it) => s + it.size, 0);
  }
  list.sort((a, b) => b.size - a.size);
  return { total, groups: list };
}

const api = { priceAt, splitFactor, timeline, xirr, maxDrawdown, summary, period, rangeStart, today, holdings, periodReturns, monthly, squarify, composition };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else window.PerfCalc = api;
}
