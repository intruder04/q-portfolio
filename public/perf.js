'use strict';
// The performance page: draws the saved result's history against a market index.
(() => {
  const P = window.PerfCalc;
  let data = window.TLV.loadResult();
  if (!data) return location.replace('./?new');

  // text in the chosen language (i18n.js); `tr`, because `t` is a ticker everywhere below
  const { t: tr, plural, count } = window.Shared;
  const stocksN = (n) => `${n} ${plural(n, 'stock', 'stocks', 'акция', 'акции', 'акций')}`;
  const BENCH = { SPY: 'S&P 500', QQQ: 'Nasdaq 100', VTI: tr('total US market') };
  const RANGES = { '6M': tr('In the last 6 months'), YTD: tr('This year'), '1Y': tr('In the last year'), '2Y': tr('In the last 2 years'), ALL: tr('Since your first purchase') };
  const pref = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };
  let bench = BENCH[pref.get('tlv-bench')] ? pref.get('tlv-bench') : 'SPY';
  let range = RANGES[pref.get('tlv-range')] ? pref.get('tlv-range') : 'ALL';
  let mode = pref.get('tlv-mode') === 'return' ? 'return' : 'value';
  if (window.Shared.hidden) mode = 'return';     // amounts hidden: the growth chart shows percentages

  const $ = (id) => document.getElementById(id);
  if (!data.activity?.length || !data.bench) {
    $('empty').hidden = false;
    $('content').hidden = true;
    document.querySelectorAll('.controls button').forEach((b) => { b.disabled = true; });
    return;
  }

  // ---------- formatting (shared.js) ----------
  const ms = (iso) => Date.parse(iso + 'T00:00:00Z');
  const { money, signed, compact, signedCompact, pct, signedPct, fmtDate, fmtMonth, num, esc, niceStep } = window.Shared;
  const cls = window.Shared.clsUsd; // dollars: no color for amounts that round to $0
  const el = window.Shared.svgEl;

  // ---------- controls ----------
  function setSeg(id, value) {
    for (const b of $(id).querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.v === value));
  }
  function wireSeg(id, onPick) {
    const group = $(id);
    group.addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (b && !b.disabled) onPick(b.dataset.v); });
    group.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const buttons = [...group.querySelectorAll('button')];
      const i = buttons.indexOf(document.activeElement);
      const next = buttons[(i + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
      next.focus(); onPick(next.dataset.v);
    });
  }
  wireSeg('range', (v) => { range = v; pref.set('tlv-range', v); setSeg('range', v); drawGrowth(); });
  if (window.Shared.hidden) {
    const b = $('mode').querySelector('[data-v="value"]');
    b.disabled = true; b.title = tr('Amounts are hidden');
  }
  wireSeg('mode', (v) => { mode = v; pref.set('tlv-mode', v); setSeg('mode', v); drawGrowth(); });
  // An index's prices are fetched the first time it's chosen, then kept with the result.
  async function ensureBench(v) {
    if (data.bench[v]?.length) return true;
    const buttons = $('bench').querySelectorAll('button');
    buttons.forEach((b) => { b.disabled = true; });
    $('growth-note').textContent = tr('Getting {index} prices…', { index: BENCH[v] });
    try {
      const since = window.Lots.priceHistoryStart(data.activity.map((a) => a.d));
      const { series, dayChange } = await window.Prices.fetchSeries(v, since, true);
      data = { ...data, bench: { ...data.bench, [v]: series }, benchDay: { ...data.benchDay, [v]: dayChange } };
      window.TLV.saveResult(data);
      return true;
    } catch (err) {
      $('growth-note').textContent = String(err?.message || err);
      return false;
    } finally {
      buttons.forEach((b) => { b.disabled = false; });
    }
  }
  wireSeg('bench', async (v) => {
    if (v === bench || !(await ensureBench(v))) return;
    bench = v; pref.set('tlv-bench', v); setSeg('bench', v);
    render();
  });
  setSeg('range', range); setSeg('mode', mode); setSeg('bench', bench);

  // ---------- tooltip ----------
  const tip = $('tip');
  function showTip(html, clientX, clientY) {
    tip.innerHTML = html; tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(clientX + 14, innerWidth - w - 8) - (clientX + 14 + w > innerWidth ? w + 28 : 0)) + 'px';
    tip.style.top = Math.max(8, Math.min(clientY - h - 12, innerHeight - h - 8)) + 'px';
  }
  const hideTip = () => { tip.hidden = true; };
  addEventListener('scroll', hideTip, { passive: true });

  // ---------- data ----------
  let points, sum;
  function render() {
    try {
      points = P.timeline(data, bench);
      if (!points) throw new Error(tr('No {index} prices to compare with.', { index: BENCH[bench] }));
      sum = P.summary(data, points);
    } catch (err) {
      showProblem(err);
      throw err;
    }
    drawHeader(); drawChanges(); drawTiles(); drawTreemap(); drawGrowth(); drawHoldings();
  }

  // ---------- gains today, last week, this year, last N years ----------
  const yearsInput = $('years');
  const savedYears = Number(pref.get('tlv-years'));
  if (savedYears >= 0.5 && savedYears <= 50) yearsInput.value = String(savedYears);
  yearsInput.addEventListener('input', () => {
    if (yearsInput.validity.valid && Number(yearsInput.value) > 0) { pref.set('tlv-years', yearsInput.value); drawChanges(); }
  });

  function drawChanges() {
    const B = BENCH[bench];
    const show = (id, gain, mine, theirs) => {
      // amounts hidden: the percentage becomes the headline
      $(id).textContent = window.Shared.hidden ? signedPct(mine) : signed(gain);
      $(id).className = 'v ' + (window.Shared.hidden ? window.Shared.cls(mine || 0) : cls(gain));
      $(id + '-s').innerHTML = `<b class="${window.Shared.cls(mine || 0)}">${signedPct(mine)}</b> · ${esc(B)} ${signedPct(theirs)}`;
    };
    // last trading day
    const t = P.today(data, bench);
    const asofDay = data.asof.slice(0, 10);
    $('c-day-k').textContent = asofDay === window.Shared.nyDay(Date.now()) ? tr('Today') : tr('{date} (last trading day)', { date: fmtDate(asofDay) });
    if (t.pct == null) { $('c-day').textContent = '—'; $('c-day-s').textContent = tr('Refresh prices to see today'); }
    else show('c-day', t.change, t.pct, t.benchPct);

    const last = points.length - 1;
    for (const [id, r] of [['c-week', 'W'], ['c-ytd', 'YTD']]) {
      const p = P.period(points, P.rangeStart(points, r), last);
      show(id, p.gain, p.twr, p.benchReturn);
    }
    const n = Number(yearsInput.value);
    if (!(n > 0)) return;
    $('years-last').textContent = plural(n, 'Last', 'Last', 'За последний', 'За последние', 'За последние');
    $('years-unit').textContent = plural(n, 'year', 'years', 'год', 'года', 'лет');
    const i = P.rangeStart(points, `${n}Y`);
    const p = P.period(points, i, last);
    show('c-years', p.gain, p.twr, p.benchReturn);
    if (i === 0) {
      const held = (ms(points[last].d) - ms(points[0].d)) / (365.25 * 864e5);
      $('c-years-s').innerHTML += ` · <span>${tr('you\'ve invested {n} years', { n: held.toLocaleString(window.Shared.LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}</span>`;
    }
  }

  function drawHeader() {
    const held = Object.keys(data.stocks).length;
    const unpriced = Object.keys(data.stocks).filter((t) => data.stocks[t].noPrice);
    const trades = data.activity.length;
    $('asof').textContent = tr('Prices as of {date}, {time} New York time', { date: fmtDate(data.asof.slice(0, 10)), time: data.asof.slice(11) }) + ' · ' +
      tr('{stocks} held', { stocks: stocksN(held) }) + ' · ' +
      tr('{n} {trades} since {date}', { n: count(trades), trades: plural(trades, 'trade', 'trades', 'сделка', 'сделки', 'сделок'), date: fmtDate(sum.since) }) +
      (unpriced.length ? ' · ' + tr('No price found for {list}: valued at what you last paid', { list: unpriced.join(', ') }) : '');
    const B = BENCH[bench];
    const ahead = sum.vsMarket >= 0;
    const change = tr(sum.gain >= 0 ? 'up {amount}' : 'down {amount}', { amount: money(Math.abs(sum.gain)) });
    const diff = tr(ahead ? '{amount} ahead of' : '{amount} behind', { amount: money(Math.abs(sum.vsMarket)) });
    $('lede').innerHTML =
      tr('Your stocks are worth {value}. You put in {invested} net, so you\'re {change}', {
        value: `<b>${money(sum.value)}</b>`, invested: `<b>${money(sum.invested)}</b>`, change: `<b class="${cls(sum.gain)}">${change}</b>`,
      }) +
      (sum.gainPct != null ? ` (${signedPct(sum.gainPct)})` : '') +
      (sum.divs > 0.5 ? tr(', counting {amount} of dividends', { amount: money(sum.divs) }) : '') + '. ' +
      tr('The same money in the {index} would be worth {value}, so you\'re {diff} the market.', {
        index: B, value: money(sum.shadow), diff: `<b class="${cls(sum.vsMarket)}">${diff}</b>`,
      });
  }

  function drawTiles() {
    const B = BENCH[bench];
    $('t-value').textContent = compact(sum.value);
    $('t-value-s').textContent = stocksN(Object.keys(data.stocks).length) + ' · ' + tr('{amount} put in', { amount: compact(sum.invested) });
    const hidden = window.Shared.hidden;            // amounts hidden: percentages as headlines
    $('t-gain').textContent = hidden ? signedPct(sum.gainPct) : signedCompact(sum.gain);
    $('t-gain').className = 'v ' + cls(sum.gain);
    $('t-gain-s').textContent = tr('{pct} on what you put in', { pct: signedPct(sum.gainPct) }) + (sum.divs > 0.5 ? ' · ' + tr('{amount} dividends', { amount: compact(sum.divs) }) : '');
    $('t-vs-k').textContent = tr('Compared with the {index}', { index: B });
    $('t-vs').textContent = hidden ? signedPct(sum.twr - sum.benchReturn) : signedCompact(sum.vsMarket);
    $('t-vs').className = 'v ' + cls(sum.vsMarket);
    $('t-vs-s').textContent = hidden
      ? tr(sum.twr >= sum.benchReturn ? 'More return than the {index}: you {mine}, {index} {theirs}' : 'Less return than the {index}: you {mine}, {index} {theirs}',
        { index: B, mine: signedPct(sum.twr), theirs: signedPct(sum.benchReturn) })
      : tr(sum.vsMarket >= 0 ? 'Ahead · the same money there: {amount}' : 'Behind · the same money there: {amount}', { amount: compact(sum.shadow) });
    $('t-irr').textContent = sum.irr == null ? '—' : signedPct(sum.irr);
    $('t-irr-s').textContent = sum.irr == null ? tr('Shown after a year of history') : tr('{index}: {pct} a year with the same money', { index: B, pct: signedPct(sum.marketIrr) });
    const dd = sum.drawdown;
    $('t-dd').textContent = dd.drawdown < -0.0005 ? signedPct(dd.drawdown) : '0%';
    $('t-dd-s').textContent = dd.index != null && dd.drawdown < -0.0005 ? tr('From a previous high, low in the week of {date}', { date: fmtDate(points[dd.index].d) }) : tr('No fall from a high so far');
    $('h-vs-label').textContent = tr('vs {index}', { index: B });
    $('h-vs-th').textContent = tr('vs {index}', { index: B });
  }

  // ---------- what you own: treemap ----------
  // Sector colors: the chart guide's validated 8-color palette, one fixed color per sector
  // (color follows the sector, never its size). Funds and the rarer sectors are neutral;
  // every group is labeled, so nothing depends on color alone.
  const SECTOR_SLOT = {
    Technology: 0, 'Communication Services': 1, 'Consumer Cyclical': 2, Industrials: 3,
    Healthcare: 4, 'Financial Services': 5, 'Consumer Defensive': 6, Energy: 7,
  };
  const PALETTE = {
    light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
    dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
  };
  const NEUTRAL = { light: { funds: '#7d8590', other: '#b3b8bf' }, dark: { funds: '#5f6775', other: '#474e59' } };
  const scheme = () => {
    const t = (window.TLV_THEMES || []).find((x) => x.id === document.documentElement.getAttribute('data-theme'));
    return t ? t.scheme : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };
  const sectorColor = (name) => {
    const s = scheme();
    if (name in SECTOR_SLOT) return PALETTE[s][SECTOR_SLOT[name]];
    return name === 'Funds (ETFs)' ? NEUTRAL[s].funds : NEUTRAL[s].other;
  };
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const lum = (hex) => {
    const [r, g, b] = rgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  // black or white text, whichever reads better on the tile
  const inkFor = (hex) => ((1.05) / (lum(hex) + 0.05) > (lum(hex) + 0.05) / 0.05 ? '#ffffff' : '#111111');
  const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const mixHex = (a, b, t) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
  // gain view: neutral at cost, toward red below and green above, full color at ±50%
  const gainColor = (pct) => {
    const base = token('--neutral-bg');
    if (pct == null) return base;
    return mixHex(base, pct >= 0 ? token('--good') : token('--bad'), Math.min(1, Math.abs(pct) / 0.5));
  };

  let tmColor = pref.get('tlv-tm') === 'gain' ? 'gain' : 'sector';
  setSeg('tm-color', tmColor);
  wireSeg('tm-color', (v) => { tmColor = v; pref.set('tlv-tm', v); setSeg('tm-color', v); drawTreemap(); });
  addEventListener('tlv-theme', () => { if (points) drawTreemap(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (points) drawTreemap(); });

  const TM_NOTE = tr('Each tile is a stock, sized by its share of your portfolio and grouped by sector. Hover a tile for details; click one to change its sector. Holdings under 1.5% are drawn at 1.5% so they stay visible, with their real share on the label.');
  const sectorName = (name) => tr(name);          // sectors are kept in English, shown translated
  const MIN_SHARE = 0.015;

  // Sectors you've chosen yourself, kept in this browser: { TICKER: 'Sector' }.
  const SECTORS = ['Technology', 'Communication Services', 'Consumer Cyclical', 'Consumer Defensive', 'Healthcare',
    'Financial Services', 'Industrials', 'Energy', 'Utilities', 'Real Estate', 'Basic Materials', 'Funds (ETFs)'];
  const loadOverrides = () => { try { return JSON.parse(pref.get('tlv-sectors') || '{}') || {}; } catch { return {}; } };
  let overrides = loadOverrides();

  const pop = document.createElement('div');
  pop.className = 'tm-pop';
  pop.hidden = true;
  pop.setAttribute('role', 'dialog');
  document.body.append(pop);
  let popFor = null;
  function closePop(focusTile = true) {
    if (pop.hidden) return;
    pop.hidden = true;
    if (focusTile) document.querySelector(`.tm-tile[data-t="${CSS.escape(popFor)}"]`)?.focus();
    popFor = null;
  }
  function openPop(t, tile) {
    hideTip();
    popFor = t.t;
    pop.setAttribute('aria-label', tr('Sector for {ticker}', { ticker: t.t }));
    const label = document.createElement('label');
    label.htmlFor = 'tm-pop-sel';
    label.innerHTML = tr('Sector for {ticker}', { ticker: `<b>${esc(t.t)}</b>` });
    const sel = document.createElement('select');
    sel.id = 'tm-pop-sel';
    sel.append(new Option(tr('As Yahoo lists it: {sector}', { sector: sectorName(t.yahooSector) }), ''), ...SECTORS.map((s) => new Option(sectorName(s), s)));
    sel.value = overrides[t.t] || '';
    sel.addEventListener('change', () => {
      if (sel.value) overrides[t.t] = sel.value; else delete overrides[t.t];
      pref.set('tlv-sectors', JSON.stringify(overrides));
      closePop(false);
      drawTreemap();
      document.querySelector(`.tm-tile[data-t="${CSS.escape(t.t)}"]`)?.focus();
    });
    const hint = document.createElement('p');
    hint.textContent = tr('Saved in this browser. Choose the first option to go back to Yahoo’s sector.');
    pop.replaceChildren(label, sel, hint);
    pop.hidden = false;
    const r = tile.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8)) + 'px';
    pop.style.top = (r.bottom + 8 + h < innerHeight ? r.bottom + 8 : Math.max(8, r.top - h - 8)) + 'px';
    sel.focus();
  }
  pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closePop(); } });
  document.addEventListener('pointerdown', (e) => {
    if (!pop.hidden && !pop.contains(e.target) && !e.target.closest('.tm-tile')) closePop(false);
  });
  addEventListener('scroll', () => closePop(false), { passive: true });

  function drawTreemap() {
    const box = $('treemap');
    box.replaceChildren();
    const comp = P.composition(data, { overrides, minShare: MIN_SHARE });
    const W = box.clientWidth;
    if (!W || !comp.total) return;
    const H = Math.round(Math.max(320, Math.min(640, W < 560 ? W * 1.2 : W * 0.48)));
    box.style.height = H + 'px';
    const gap = 6, header = 20;

    // laid out by drawing size (small holdings enlarged); labels show the real share
    const place = (list, x, y, w, h) => P.squarify(list.map((it) => ({ it, value: it.size })), x, y, w, h)
      .map((r) => Object.assign(Object.create(null), r.it, { x: r.x, y: r.y, w: r.w, h: r.h }));
    for (const g of place(comp.groups, 0, 0, W, H)) {
      const gx = g.x + gap / 2, gy = g.y + gap / 2, gw = g.w - gap, gh = g.h - gap;
      const color = sectorColor(g.name);
      const head = gh > 60 && gw > 64 ? header : 0;
      if (head) {
        const h = document.createElement('div');
        h.className = 'tm-group-h';
        Object.assign(h.style, { left: gx + 'px', top: gy + 'px', width: gw + 'px', height: head + 'px' });
        const chip = document.createElement('i');
        chip.style.background = color;
        const share = document.createElement('span');
        share.textContent = pct(g.share);
        h.append(chip, document.createTextNode(sectorName(g.name) + ' '), share);
        box.append(h);
      }
      for (const t of place(g.items, gx, gy + head, gw, gh - head)) {
        const x = t.x + 1, y = t.y + 1, w = t.w - 2, h = t.h - 2;
        if (w <= 0 || h <= 0) continue;
        const bg = tmColor === 'gain' ? gainColor(t.gainPct) : color;
        const tile = document.createElement('div');
        tile.className = 'tm-tile';
        tile.tabIndex = 0;
        tile.dataset.t = t.t;
        tile.setAttribute('role', 'listitem');
        tile.setAttribute('aria-haspopup', 'dialog');
        tile.setAttribute('aria-label', tr('{ticker}, {sector}, {share} of your stocks, {value}, {gain} on shares held. Press Enter to change its sector.', { ticker: t.t, sector: sectorName(g.name), share: pct(t.share), value: money(t.value), gain: signed(t.gain) }));
        Object.assign(tile.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', background: bg, color: inkFor(bg) });
        const fs = Math.max(9, Math.min(34, w / (t.t.length * 0.66 + 0.6), h / 2.6));
        const label = tmColor === 'gain' ? signedPct(t.gainPct) : pct(t.share);
        if (w < 40 && h >= 48 && h > w * 1.6) {
          // a narrow strip: write the label along it
          const b = document.createElement('b');
          b.className = 'vert';
          b.style.fontSize = Math.max(10, Math.min(16, w * 0.62)) + 'px';
          b.textContent = h >= t.t.length * 11 + 60 ? `${t.t} ${label}` : t.t;
          tile.append(b);
        } else if (h < 26 && w >= 48 && w > h * 1.6) {
          // a flat strip: one line
          const b = document.createElement('b');
          b.style.fontSize = Math.max(9, Math.min(13, h * 0.62)) + 'px';
          b.textContent = w >= t.t.length * 9 + 50 ? `${t.t} ${label}` : t.t;
          tile.append(b);
        } else if (w >= 20 && h >= 14) {
          const b = document.createElement('b');
          // roomy tiles get the company logo beside the ticker
          const withLogo = w >= 72 && h >= 40;
          const size = withLogo ? Math.max(9, Math.min(30, w / (t.t.length * 0.66 + 2), h / 2.6)) : fs;
          if (withLogo) { b.className = 'with-logo'; b.innerHTML = window.Shared.logo(t.t, Math.round(size * 1.05)); }
          b.append(t.t);
          b.style.fontSize = size + 'px';
          tile.append(b);
          if (h >= size * 2.5 && w >= 38) {
            const sm = document.createElement('small');
            sm.textContent = label;
            sm.style.fontSize = Math.max(10, size * 0.5) + 'px';
            tile.append(sm);
          }
        }
        const show = (cx, cy) => showTip(
          `<div class="h">${esc(t.t)} · ${esc(t.name)}</div>` +
          `<div class="r"><span>${esc(sectorName(g.name))}${overrides[t.t] ? ' ' + tr('(your choice)') : ''}</span><b>${esc(t.industry || '')}</b></div>` +
          `<div class="r"><span>${tr('Value')}</span><b>${money(t.value)}</b></div>` +
          `<div class="r"><span>${tr('Share of your stocks')}</span><b>${pct(t.share)}</b></div>` +
          `<div class="r"><span>${tr('Gain on shares held')}</span><b class="${cls(t.gain)}">${signed(t.gain)} (${signedPct(t.gainPct)})</b></div>` +
          `<div class="r"><span>${tr('Long-term shares')}</span><b>${tr('{a} of {b}', { a: num(t.longShares, 1), b: num(t.shares, 1) })}</b></div>`,
          cx, cy);
        tile.addEventListener('pointermove', (e) => show(e.clientX, e.clientY));
        tile.addEventListener('pointerleave', hideTip);
        tile.addEventListener('focus', () => { const r = tile.getBoundingClientRect(); show(r.left + r.width / 2, r.top + 12); });
        tile.addEventListener('blur', hideTip);
        tile.addEventListener('click', () => openPop(t, tile));
        tile.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPop(t, tile); } });
        box.append(tile);
      }
    }

    $('tm-legend').innerHTML = tmColor === 'gain'
      ? `<span>${tr('Below what you paid')}</span><span class="ramp" style="background:linear-gradient(90deg, ${token('--bad')}, ${token('--neutral-bg')}, ${token('--good')})"></span><span>${tr('Above · full color at ±50%')}</span>`
      : comp.groups.map((g) => `<span><i style="background:${sectorColor(g.name)}"></i>${esc(sectorName(g.name))} ${pct(g.share)}</span>`).join('');
  }

  // Sectors come from a lookup per stock, done once and kept with the result.
  async function ensureProfiles() {
    const missing = Object.keys(data.stocks).filter((t) => !data.profiles?.[t] && !data.stocks[t].noPrice);
    if (!missing.length) return;
    $('tm-note').textContent = tr('Looking up sectors for {stocks}…', { stocks: stocksN(missing.length) });
    const found = {};
    await window.Lots.pool(missing, async (t) => {
      try { found[t] = await window.Prices.fetchProfile(t); } catch { /* try again next visit */ }
    });
    data = { ...data, profiles: { ...data.profiles, ...found } };
    window.TLV.saveResult(data);
    $('tm-note').textContent = TM_NOTE;
  }

  // ---------- growth chart ----------
  const chartBox = $('chart');
  function drawGrowth() {
    chartBox.querySelector('svg')?.remove();
    const B = BENCH[bench];
    const i0 = P.rangeStart(points, range);
    const pts = points.slice(i0);
    const last = pts[pts.length - 1];
    const per = P.period(points, i0, points.length - 1);
    const base = pts.find((p) => p.twr != null);
    const yours = (p) => (p.twr == null || !base ? null : p.twr / base.twr - 1);
    const market = (p) => p.bench / (base || pts[0]).bench - 1;

    // legend and notes
    const sw = (style, extra = '') => `<i class="sw ${extra}" style="${style}"></i>`;
    $('legend').innerHTML = mode === 'value'
      ? `<span>${sw('border-color:var(--lt)')}${tr('Your stocks')} <b>${money(last.value)}</b></span>` +
        `<span>${sw('border-color:var(--price)', 'dash')}${tr('Same money in the {index}', { index: B })} <b>${money(last.shadow)}</b></span>` +
        `<span>${sw('background:var(--neutral-bg);border:1px solid var(--st)', 'area')}${tr('Put in, net')} <b>${money(last.invested)}</b></span>` +
        `<span>${sw('background:var(--lt)', 'bar')}${tr('Bought')}</span><span>${sw('background:var(--ath)', 'bar')}${tr('Sold')}</span>`
      : `<span>${sw('border-color:var(--lt)')}${tr('Your stocks (time-weighted)')} <b>${signedPct(per.twr)}</b></span>` +
        `<span>${sw('border-color:var(--price)', 'dash')}${B} <b>${signedPct(per.benchReturn)}</b></span>` +
        `<span>${sw('background:var(--lt)', 'bar')}${tr('Bought')}</span><span>${sw('background:var(--ath)', 'bar')}${tr('Sold')}</span>`;
    $('growth-note').textContent = mode === 'value'
      ? tr('Each week\'s value of your stocks, against the same money put into the {index} on the same days. The bars underneath show what you bought and sold each week.', { index: B })
      : tr('How your stocks grew with your deposits taken out (time-weighted), against the {index}, from the start of the period.', { index: B });
    $('period').innerHTML =
      RANGES[range] + (range === 'ALL' ? '' : ' ' + tr('(from {date})', { date: fmtDate(per.from) })) + ': ' +
      tr('you put in {added} net (bought {bought}, sold {sold}), and your stocks gained {gain}', {
        added: `<b>${money(per.added)}</b>`, bought: money(per.bought), sold: money(per.sold), gain: `<b class="${cls(per.gain)}">${signed(per.gain)}</b>`,
      }) +
      (per.divs > 0.5 ? tr(' including {amount} of dividends', { amount: money(per.divs) }) : '') + '. ' +
      tr('The same money in the {index} would have gained {gain}.', { index: B, gain: `<b class="${cls(per.marketGain)}">${signed(per.marketGain)}</b>` }) + ' ' +
      tr('Time-weighted: you {mine}, the {index} {theirs}.', { index: B, mine: `<b>${signedPct(per.twr)}</b>`, theirs: `<b>${signedPct(per.benchReturn)}</b>` });

    // geometry
    const W = Math.max(320, chartBox.clientWidth), H = W < 560 ? 320 : 400;
    const strip = 70, gap = 22, m = { t: 12, r: 16, b: 26, l: 66 };
    const plotH = H - m.t - m.b - strip - gap;
    const x0 = ms(pts[0].d), x1 = Math.max(x0 + 1, ms(last.d));
    const X = (d) => m.l + ((ms(d) - x0) / (x1 - x0)) * (W - m.l - m.r);
    const lines = mode === 'value'
      ? [{ get: (p) => p.invested, area: true }, { get: (p) => p.shadow, color: 'var(--price)', dash: true }, { get: (p) => p.value, color: 'var(--lt)' }]
      : [{ get: market, color: 'var(--price)', dash: true }, { get: yours, color: 'var(--lt)' }];
    const vals = lines.flatMap((l) => pts.map(l.get)).filter((v) => v != null && isFinite(v));
    let lo = Math.min(...vals, 0), hi = Math.max(...vals, mode === 'value' ? 1 : 0.01);
    const pad = (hi - lo) * 0.06; hi += pad; if (lo < 0) lo -= pad;
    const Y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * plotH;
    const fmtY = mode === 'value' ? (v) => compact(v) : (v) => `${Math.round(v * 100)}%`;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': mode === 'value' ? tr('Value of your stocks against the {index}', { index: B }) : tr('Time-weighted return against the {index}', { index: B }) });
    chartBox.appendChild(svg);

    // y grid and labels
    const step = niceStep((hi - lo) / 5);
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
      el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), stroke: Math.abs(v) < 1e-9 ? 'var(--line)' : 'var(--grid)' }, svg);
      el('text', { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end' }, svg).textContent = fmtY(v);
    }
    // x ticks: months, spaced to fit
    const months = Math.max(1, Math.round((x1 - x0) / (30.44 * 864e5)));
    const every = [1, 2, 3, 6, 12, 24].find((k) => months / k <= Math.max(3, Math.floor((W - m.l - m.r) / 80))) || 24;
    const d = new Date(x0); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1);
    while (d.getUTCMonth() % every !== 0 && every < 12) d.setUTCMonth(d.getUTCMonth() + 1);
    if (every >= 12) { d.setUTCMonth(0); if (d.getTime() < x0) d.setUTCFullYear(d.getUTCFullYear() + 1); }
    for (; d.getTime() <= x1; d.setUTCMonth(d.getUTCMonth() + every)) {
      const iso = d.toISOString().slice(0, 10), x = X(iso);
      el('line', { x1: x, x2: x, y1: H - m.b, y2: H - m.b + 4, stroke: 'var(--line)' }, svg);
      el('text', { x, y: H - 8, 'text-anchor': 'middle' }, svg).textContent =
        window.Shared.axisDate(d, every >= 12 || d.getUTCMonth() === 0 ? 'numeric' : undefined);
    }

    // series
    const pathOf = (get, step) => {
      let s = '', prev = null;
      for (const p of pts) {
        const v = get(p);
        if (v == null || !isFinite(v)) { prev = null; continue; }
        const x = X(p.d).toFixed(1), y = Y(v).toFixed(1);
        s += prev == null ? `M${x},${y}` : step ? `H${x}V${y}` : `L${x},${y}`;
        prev = y;
      }
      return s;
    };
    for (const l of lines) {
      if (l.area) {
        const top = pathOf(l.get, true);
        el('path', { d: `${top}V${Y(Math.max(lo, 0))}H${X(pts[0].d)}Z`, fill: 'var(--neutral-bg)', opacity: 0.9 }, svg);
        el('path', { d: top, fill: 'none', stroke: 'var(--st)', 'stroke-width': 1 }, svg);
      } else {
        el('path', { d: pathOf(l.get), fill: 'none', stroke: l.color, 'stroke-width': l.dash ? 2 : 2.4, 'stroke-dasharray': l.dash ? '6 4' : 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
        const v = l.get(last);
        if (v != null) el('circle', { cx: X(last.d), cy: Y(v), r: 3.5, fill: l.color, stroke: 'var(--panel)', 'stroke-width': 2 }, svg);
      }
    }

    // trading strip: buys up, sales down, on the same timeline
    const stripTop = m.t + plotH + gap, mid = stripTop + strip / 2;
    const maxFlow = Math.max(1, ...pts.map((p) => Math.max(p.flowIn, p.flowOut)));
    const bw = Math.max(1.5, Math.min(10, ((W - m.l - m.r) / pts.length) * 0.7));
    el('line', { x1: m.l, x2: W - m.r, y1: mid, y2: mid, stroke: 'var(--line)' }, svg);
    el('text', { x: m.l - 8, y: stripTop + 12, 'text-anchor': 'end', class: 'strip-label' }, svg).textContent = tr('Bought');
    el('text', { x: m.l - 8, y: stripTop + strip - 2, 'text-anchor': 'end', class: 'strip-label' }, svg).textContent = tr('Sold');
    for (const p of pts.slice(1)) {
      const x = X(p.d) - bw / 2;
      if (p.flowIn > 0) { const h = Math.max(1.5, (p.flowIn / maxFlow) * (strip / 2 - 2)); el('rect', { x, y: mid - h, width: bw, height: h, rx: 1, fill: 'var(--lt)', opacity: 0.75 }, svg); }
      if (p.flowOut > 0) { const h = Math.max(1.5, (p.flowOut / maxFlow) * (strip / 2 - 2)); el('rect', { x, y: mid, width: bw, height: h, rx: 1, fill: 'var(--ath)' }, svg); }
    }

    // hover: crosshair, dots and a tooltip for the nearest week
    const cross = el('line', { y1: m.t, y2: stripTop + strip, stroke: 'var(--fg)', 'stroke-opacity': 0.35, visibility: 'hidden' }, svg);
    const dots = lines.filter((l) => !l.area).map((l) => el('circle', { r: 4, fill: l.color, stroke: 'var(--panel)', 'stroke-width': 2, visibility: 'hidden' }, svg));
    const xs = pts.map((p) => X(p.d));
    const hit = el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: stripTop + strip - m.t, fill: 'transparent' }, svg);
    hit.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect(), mx = ((e.clientX - r.left) * W) / r.width;
      let i = 0;
      for (let k = 1; k < xs.length; k++) if (Math.abs(xs[k] - mx) < Math.abs(xs[i] - mx)) i = k;
      const p = pts[i];
      cross.setAttribute('x1', xs[i]); cross.setAttribute('x2', xs[i]); cross.setAttribute('visibility', 'visible');
      lines.filter((l) => !l.area).forEach((l, k) => {
        const v = l.get(p);
        dots[k].setAttribute('visibility', v == null ? 'hidden' : 'visible');
        if (v != null) { dots[k].setAttribute('cx', xs[i]); dots[k].setAttribute('cy', Y(v)); }
      });
      const row = (color, label, value, dash) => `<div class="r"><span><i style="background:${color};${dash ? 'opacity:.7' : ''}"></i>${label}</span><b>${value}</b></div>`;
      const traded = (type) => {
        const byT = {};
        for (const t of p.trades) if (t.type === type) byT[t.t] = (byT[t.t] || 0) + t.amount;
        const list = Object.entries(byT).sort((a, b) => b[1] - a[1]);
        return list.length ? list.slice(0, 5).map(([t, v]) => `${esc(t)} ${compact(v)}`).join(', ') + (list.length > 5 ? tr(', +{n} more', { n: list.length - 5 }) : '') : '';
      };
      let html = `<div class="h">${p.now ? tr('Today') : tr('Week ending {date}', { date: fmtDate(p.d) })}</div>`;
      html += mode === 'value'
        ? row('var(--lt)', tr('Your stocks'), money(p.value)) + row('var(--price)', tr('Same money in the {index}', { index: B }), money(p.shadow), true) + row('var(--st)', tr('Put in, net'), money(p.invested))
        : row('var(--lt)', tr('Your stocks'), signedPct(yours(p))) + row('var(--price)', B, signedPct(market(p)), true);
      if (p.flowIn > 0 && i > 0) html += row('var(--lt)', tr('Bought'), money(p.flowIn)) + `<div class="t">${traded('BUY')}</div>`;
      if (p.flowOut > 0 && i > 0) html += row('var(--ath)', tr('Sold'), money(p.flowOut)) + `<div class="t">${traded('SELL')}</div>`;
      showTip(html, e.clientX, e.clientY);
    });
    hit.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); dots.forEach((dt) => dt.setAttribute('visibility', 'hidden')); hideTip(); });
  }

  // ---------- per-stock table ----------
  let sortKey = 'value', sortDir = -1;
  const showSold = $('show-sold');
  showSold.checked = pref.get('tlv-show-sold') === '1';
  showSold.addEventListener('change', () => { pref.set('tlv-show-sold', showSold.checked ? '1' : '0'); drawHoldings(); });
  document.querySelectorAll('#hold-table th').forEach((th) => th.querySelector('button').addEventListener('click', () => {
    const k = th.dataset.k;
    sortDir = sortKey === k ? -sortDir : k === 't' || k === 'first' ? 1 : -1;
    sortKey = k; drawHoldings();
  }));

  function drawHoldings() {
    const all = P.holdings(data, bench);
    const rows = all.filter((r) => r.open || showSold.checked);
    rows.sort((a, b) => {
      const x = a[sortKey], y = b[sortKey];
      return (x == null ? -Infinity : x) > (y == null ? -Infinity : y) ? sortDir : (x == null ? -Infinity : x) < (y == null ? -Infinity : y) ? -sortDir : 0;
    });
    document.querySelectorAll('#hold-table th').forEach((th) => th.setAttribute('aria-sort', th.dataset.k === sortKey ? (sortDir > 0 ? 'ascending' : 'descending') : 'none'));
    const maxGain = Math.max(1, ...rows.map((r) => Math.abs(r.gain)));
    const dash = '<span class="note">—</span>';
    const cell = (v, f = signed) => (Math.abs(v) < 0.5 ? dash : `<span class="${cls(v)}">${f(v)}</span>`);
    document.querySelector('#hold-table tbody').innerHTML = rows.map((r) => {
      const w = (Math.abs(r.gain) / maxGain) * 50;
      return `<tr class="${r.open ? '' : 'sold'}">
        <td class="l"><span class="stock">${window.Shared.logo(r.t, 26)}<span><span class="tkr">${esc(r.t)}</span><span class="nm" title="${esc(r.name)}">${r.open ? esc(r.name) : tr('Sold') + ' · ' + esc(r.name)}</span></span></span></td>
        <td>${r.open ? money(r.value) : dash}</td>
        <td class="l">${r.open ? `<span class="wbar"><i style="width:${(r.weight * 100).toFixed(1)}%"></i></span>${pct(r.weight)}` : dash}</td>
        <td>${r.open ? cell(r.unrealized) : dash}</td>
        <td>${cell(r.realized)}</td>
        <td>${r.divs >= 0.5 ? money(r.divs) : dash}</td>
        <td class="l"><span class="dbar"><i class="${r.gain >= 0 ? 'up' : 'down'}" style="width:${w.toFixed(1)}%"></i></span><span class="${cls(r.gain)}">${signed(r.gain)}</span></td>
        <td class="${window.Shared.cls(r.gainPct || 0)}">${signedPct(r.gainPct)}</td>
        <td>${cell(r.vsMarket)}</td>
        <td class="wide-only">${fmtDate(r.first)}</td>
      </tr>`;
    }).join('');
  }

  // ---------- monthly buying and selling ----------
  const monthsBox = $('months');
  const monthRows = P.monthly(data);
  function drawMonths() {
    monthsBox.querySelector('svg')?.remove();
    if (!monthRows.length) return;
    const W = Math.max(320, monthsBox.clientWidth), H = 220, m = { t: 10, r: 12, b: 26, l: 66 };
    const maxUp = Math.max(1, ...monthRows.map((r) => r.bought)), maxDown = Math.max(...monthRows.map((r) => r.sold), 0);
    const total = maxUp + maxDown, plotH = H - m.t - m.b;
    const Y = (v) => m.t + ((maxUp - v) / total) * plotH; // v > 0 bought, v < 0 sold
    const slot = (W - m.l - m.r) / monthRows.length, bw = Math.max(2, Math.min(28, slot * 0.7));
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': tr('Money put in and taken out each month') });
    monthsBox.appendChild(svg);
    const step = niceStep(total / 4);
    for (let v = -Math.floor(maxDown / step) * step; v <= maxUp + 1e-9; v += step) {
      el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), stroke: Math.abs(v) < 1e-9 ? 'var(--line)' : 'var(--grid)' }, svg);
      el('text', { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end' }, svg).textContent = compact(Math.abs(v));
    }
    const labelEvery = Math.ceil(monthRows.length / Math.max(3, Math.floor((W - m.l - m.r) / 60)));
    monthRows.forEach((r, i) => {
      const cx = m.l + slot * (i + 0.5);
      if (r.bought > 0) el('rect', { x: cx - bw / 2, y: Y(r.bought), width: bw, height: Y(0) - Y(r.bought), rx: 2, fill: 'var(--lt)', opacity: 0.8 }, svg);
      if (r.sold > 0) el('rect', { x: cx - bw / 2, y: Y(0), width: bw, height: Y(-r.sold) - Y(0), rx: 2, fill: 'var(--ath)' }, svg);
      if (i % labelEvery === 0) el('text', { x: cx, y: H - 8, 'text-anchor': 'middle' }, svg).textContent = fmtMonth(r.month, true);
      const hit = el('rect', { x: m.l + slot * i, y: m.t, width: slot, height: plotH, fill: 'transparent' }, svg);
      hit.addEventListener('pointermove', (e) => showTip(
        `<div class="h">${fmtMonth(r.month)}</div>` +
        `<div class="r"><span><i style="background:var(--lt)"></i>${tr('Bought')} (${r.buys})</span><b>${money(r.bought)}</b></div>` +
        (r.sold ? `<div class="r"><span><i style="background:var(--ath)"></i>${tr('Sold')} (${r.sells})</span><b>${money(r.sold)}</b></div>` : '') +
        (r.divs ? `<div class="r"><span><i style="background:var(--good)"></i>${tr('Dividends')}</span><b>${money(r.divs, 2)}</b></div>` : ''),
        e.clientX, e.clientY));
      hit.addEventListener('pointerleave', hideTip);
    });
  }

  // ---------- every transaction ----------
  const TYPE = { BUY: [tr('Buy'), 'p-buy'], SELL: [tr('Sale'), 'p-sell'], DIV: [tr('Dividend'), 'p-div'], IN: [tr('Moved in'), 'p-xfer'], OUT: [tr('Moved out'), 'p-xfer'] };
  const allRows = [
    ...data.activity,
    ...(data.income || []).map((i) => ({ d: i.d, type: 'DIV', t: i.t, sh: null, price: null, amount: i.amount })),
  ].sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
  const fStock = $('f-stock'), fType = $('f-type');
  fStock.replaceChildren(new Option(tr('All stocks'), ''), ...[...new Set(allRows.map((r) => r.t))].sort().map((t) => new Option(t, t)));
  function drawActivity() {
    const rows = allRows.filter((r) => (!fStock.value || r.t === fStock.value) && (fType.value === 'all' || r.type === fType.value));
    $('f-count').textContent = tr('{a} of {b}', { a: count(rows.length), b: count(allRows.length) });
    document.querySelector('#act-table tbody').innerHTML = rows.map((r) => {
      const [label, pill] = TYPE[r.type] || [r.type, 'p-xfer'];
      return `<tr><td class="l">${fmtDate(r.d)}</td><td class="l"><span class="pill ${pill}">${label}</span></td><td class="l tkr">${window.Shared.logo(r.t, 18)}${esc(r.t)}</td>` +
        `<td>${r.sh == null ? '' : num(r.sh, 4)}</td><td>${r.price == null ? '' : money(r.price, 2)}</td><td>${r.amount == null ? '' : money(r.amount, 2)}</td></tr>`;
    }).join('');
  }
  fStock.addEventListener('change', drawActivity);
  fType.addEventListener('change', drawActivity);

  // ---------- go ----------
  // Say what went wrong instead of leaving the page blank.
  function showProblem(err) {
    $('lede').innerHTML = `<b class="neg">${tr('This page couldn\'t be drawn:')}</b> ${esc(String(err?.message || err))}. ` +
      tr('Try <b>Refresh prices</b>, or upload your file again.');
  }
  addEventListener('error', (e) => showProblem(e.error || e.message));

  (async () => {
    // the remembered index may not have been fetched for this upload yet
    if (!(await ensureBench(bench))) { bench = 'SPY'; setSeg('bench', bench); await ensureBench(bench); }
    render();
    drawMonths();
    drawActivity();
    await ensureProfiles();
    drawTreemap();
  })().catch(showProblem);
  let rz;
  new ResizeObserver(() => {
    clearTimeout(rz);
    rz = setTimeout(() => { if (!points) return; drawGrowth(); drawMonths(); drawTreemap(); }, 80);
  }).observe(chartBox);
})();
