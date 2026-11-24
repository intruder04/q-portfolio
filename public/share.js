'use strict';
// The share card on the performance page: your returns as percentages only, drawn as an
// image to save or copy. It holds no dollar amounts or share counts, and it's made in
// this browser; nothing is sent anywhere.
//
// Two spans (all time, this year) and three formats, each laid out from the same parts:
// a headline return against the index, a chart of your return and the index's over the
// span, a table of periods (you, the index, the difference), and your best performers.
(() => {
  const open = document.getElementById('share-open'), dlg = document.getElementById('share');
  if (!open || !dlg) return;
  const P = window.PerfCalc, S = window.Shared;
  const tr = S.t;                                // text in the chosen language (i18n.js)
  const BENCH = { SPY: 'S&P 500', QQQ: 'Nasdaq 100', VTI: tr('total US market') };
  const $ = (id) => document.getElementById(id);
  const say = (text) => { $('share-status').textContent = text; };

  // ---------- the numbers ----------
  // `span` is 'all' (since your first purchase) or 'year' (since January 1).
  function stats(span) {
    const data = window.TLV.loadResult();
    let bench = 'SPY';
    try { if (BENCH[localStorage.getItem('tlv-bench')]) bench = localStorage.getItem('tlv-bench'); } catch {}
    if (!data?.activity?.length || !data.bench?.[bench]) return null;
    const points = P.timeline(data, bench), last = points.length - 1;
    const per = (r) => P.period(points, P.rangeStart(points, r), last);
    const row = (label, r) => ({ label, mine: r.twr, theirs: r.benchReturn });
    const best = (rows) => rows.filter((h) => h.value > 0 && h.gainPct != null).sort((a, b) => b.gainPct - a.gainPct).slice(0, 5);
    // the span's weeks: your return and the index's from its start, and the largest drop in it
    const weeks = (from) => {
      const pts = points.slice(from).filter((p) => p.twr != null);
      const a = pts[0];
      return {
        series: pts.map((p) => ({ d: p.d, you: p.twr / a.twr - 1, idx: p.bench / a.bench - 1 })),
        dd: P.maxDrawdown(pts.map((p) => p.twr)),
        benchDrop: P.maxDrawdown(pts.map((p) => p.bench)).drawdown,
      };
    };
    const base = { data, name: BENCH[bench], asof: data.asof.slice(0, 10) };
    if (span === 'year') {
      const year = data.asof.slice(0, 4), ytd = per('YTD');
      return {
        ...base, ...weeks(P.rangeStart(points, 'YTD')), mine: ytd.twr, theirs: ytd.benchReturn,
        heading: tr('Return so far in {year}', { year }), spanLabel: tr('This year'),
        top: best(P.periodReturns(data, `${year}-01-01`)),
        periods: [row(tr('Last month'), per('1M')), row(tr('Last 3 months'), per('3M')), row(tr('Last 12 months'), per('1Y'))],
        footer: tr('Percentages only · time-weighted returns with dividends; best performers by their return this year'),
        footerShort: tr('Percentages only · time-weighted returns with dividends'),   // for a card without stocks
      };
    }
    const sum = P.summary(data, points);
    return {
      ...base, ...weeks(0), mine: sum.twr, theirs: sum.benchReturn,
      heading: tr('Total return since {month}', { month: S.fmtMonth(sum.since.slice(0, 7)) }), spanLabel: tr('All time'),
      top: best(P.holdings(data, bench).filter((h) => h.open)),
      periods: [row(tr('This year'), per('YTD')), row(tr('Last 12 months'), per('1Y')),
        sum.irr != null ? { label: tr('Per year'), mine: sum.irr, theirs: sum.marketIrr } : row(tr('Last 6 months'), per('6M'))],
      footer: tr('Percentages only · time-weighted returns with dividends; "per year" is money-weighted'),
    };
  }

  // ---------- drawing ----------
  // Cards are seen small, in a feed or a chat, so the type is large: the smallest text is
  // about 1/70 of the card's width. Numbers line up on the right; a difference carries
  // ▲ or ▼ as well as its color.
  const sans = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;
  const serif = `'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif`;
  let ctx;
  // how wide a line of text is drawn, so badges, labels and columns fit it in any language
  function textWidth(text, size, weight = 400) {
    ctx ||= document.createElement('canvas').getContext('2d');
    ctx.font = `${weight} ${size}px ${sans}`;
    return ctx.measureText(text).width;
  }

  // The parts of a card, in the type sizes `z` of its format. Each returns SVG.
  function parts(x, col, z) {
    const p = (v) => S.signedPct(v);
    const tone = (v) => (v == null ? col.muted : v > 0 ? col.good : v < 0 ? col.bad : col.fg);
    const T = (tx, ty, size, fill, text, more = '') =>
      `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" font-size="${size}" fill="${fill}" font-family="${sans}" ${more}>${S.esc(text)}</text>`;
    const B = x.name;
    const diff = (v) => (v == null ? '—' : Math.abs(v) < 0.0005 ? '0%' : `${v > 0 ? '▲' : '▼'} ${S.pct(Math.abs(v))}`);
    const axisPct = (v) => `${v < -1e-9 ? '−' : ''}${Math.abs(Math.round(v * 100))}%`;
    const dd = x.dd, fell = dd.index != null && dd.drawdown < -0.0005;
    const comeback = fell && dd.rise > 0.0005 ? tr('{pct} since the low', { pct: p(dd.rise) }) : null;

    return {
      frame: (W, H) => `<rect width="${W}" height="${H}" fill="${col.bg}"/>` +
        `<rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="28" fill="${col.panel}" stroke="${col.line}" stroke-width="2"/>`,

      // title on the left; the span and the date on the right (y is the baseline)
      header: (x0, y, right) =>
        T(x0, y, z.title, col.fg, tr('My portfolio'), 'font-weight="700"') +
        T(right, y, z.meta, col.muted, `${x.spanLabel} · ${tr('As of {date}', { date: S.fmtDate(x.asof) })}`, 'text-anchor="end"'),

      // the span's return, big, then the index's and how far ahead or behind you are;
      // the badge moves under the index when they don't fit side by side in `w`
      hero: (x0, y, w) => {
        const ahead = x.mine - x.theirs;
        const badge = Math.abs(ahead) < 0.0005 ? tr('Same return as the {index}', { index: B })
          : tr(ahead > 0 ? '{pct} more return than the {index}' : '{pct} less return than the {index}', { pct: S.pct(Math.abs(ahead)), index: B });
        const idx = `${B}: ${p(x.theirs)}`;
        const idxW = textWidth(idx, z.body), bw = textWidth(badge, z.small, 600) + z.small * 1.6, bh = z.small * 1.9;
        const base = y + z.label + 8 + z.hero * 0.82;            // the big number's baseline
        const line = base + z.body * 1.9;                          // the index's baseline
        const side = idxW + 20 + bw <= w;
        const bx = side ? x0 + idxW + 20 : x0, by = side ? line - z.body * 0.82 - (bh - z.body) / 2 : line + 16;
        return T(x0, y + z.label, z.label, col.muted, x.heading) +
          `<text x="${x0 - z.hero * 0.03}" y="${base}" font-size="${z.hero}" fill="${tone(x.mine)}" font-family="${serif}">${S.esc(p(x.mine))}</text>` +
          T(x0, line, z.body, col.muted, idx) +
          `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${bh / 2}" fill="${ahead >= 0 ? col.good : col.bad}" fill-opacity="0.16"/>` +
          T(bx + z.small * 0.8, by + bh / 2 + z.small * 0.36, z.small, ahead >= 0 ? col.good : col.bad, badge, 'font-weight="600"');
      },

      // your return and the index's over the span, from 0% at its start, labeled at their
      // ends (no legend needed); the largest drop's low is marked
      chart: (x0, y0, w, h) => {
        const s = x.series;
        if (s.length < 3) return T(x0, y0 + h / 2, z.small, col.muted, tr('Not enough weeks yet for a chart'));
        const end = s[s.length - 1];
        const youL = `${tr('You')} ${p(end.you)}`, idxL = `${B} ${p(end.idx)}`;
        const labelW = Math.max(textWidth(youL, z.small + 2, 700), textWidth(idxL, z.small)) + 20;
        const L = x0 + textWidth('−100%', z.axis) + 14, R = x0 + w - labelW, top = y0 + 10, bottom = y0 + h - z.axis - 14;
        let lo = Math.min(0, ...s.map((q) => Math.min(q.you, q.idx))), hi = Math.max(0, ...s.map((q) => Math.max(q.you, q.idx)));
        const pad = (hi - lo) * 0.08 || 0.01; lo -= pad; hi += pad;
        const t0 = Date.parse(s[0].d), t1 = Math.max(t0 + 1, Date.parse(end.d));
        const X = (d) => L + ((Date.parse(d) - t0) / (t1 - t0)) * (R - L);
        const Y = (v) => top + (1 - (v - lo) / (hi - lo)) * (bottom - top);
        let out = '';
        const halo = `stroke="${col.panel}" stroke-width="6" stroke-linejoin="round" paint-order="stroke"`;   // keeps a label readable over the lines
        const step = S.niceStep((hi - lo) / 4);
        for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
          const zero = Math.abs(v) < 1e-9;
          out += `<line x1="${L}" x2="${R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${col.line}" stroke-width="${zero ? 2.5 : 1.2}"${zero ? '' : ' stroke-opacity="0.75"'}/>`;
          out += T(L - 12, Y(v) + z.axis * 0.35, z.axis, col.muted, axisPct(v), 'text-anchor="end"');
        }
        out += T(L, bottom + z.axis + 10, z.axis, col.muted, S.fmtDate(s[0].d)) +
          T(R, bottom + z.axis + 10, z.axis, col.muted, S.fmtDate(end.d), 'text-anchor="end"');
        const path = (k) => s.map((q, i) => `${i ? 'L' : 'M'}${X(q.d).toFixed(1)},${Y(q[k]).toFixed(1)}`).join('');
        out += `<path d="${path('you')}L${X(end.d).toFixed(1)},${Y(0).toFixed(1)}L${X(s[0].d).toFixed(1)},${Y(0).toFixed(1)}Z" fill="${col.accent}" fill-opacity="0.12"/>`;
        out += `<path d="${path('idx')}" fill="none" stroke="${col.muted}" stroke-width="2.5" stroke-dasharray="8 7" stroke-linejoin="round"/>`;
        out += `<path d="${path('you')}" fill="none" stroke="${col.accent}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`;
        if (fell && dd.drawdown < -0.02 && s[dd.index]) {
          const q = s[dd.index], cx = X(q.d), cy = Y(q.you);
          const below = cy + z.axis + 16 <= bottom;
          out += `<circle cx="${cx}" cy="${cy}" r="7" fill="${col.panel}" stroke="${col.bad}" stroke-width="3"/>`;
          out += T(cx, below ? cy + z.axis + 14 : cy - 16, z.axis, col.bad, p(dd.drawdown), `text-anchor="middle" font-weight="700" ${halo}`);
        }
        let yy = Y(end.you), yi = Y(end.idx);
        const gap = z.small + 10;
        if (Math.abs(yy - yi) < gap) { const m = (yy + yi) / 2, up = yy <= yi ? -1 : 1; yy = m + up * gap / 2; yi = m - up * gap / 2; }
        out += `<circle cx="${X(end.d)}" cy="${Y(end.idx)}" r="5" fill="${col.muted}" stroke="${col.panel}" stroke-width="2"/>`;
        out += `<circle cx="${X(end.d)}" cy="${Y(end.you)}" r="7" fill="${col.accent}" stroke="${col.panel}" stroke-width="3"/>`;
        out += T(R + 16, yy + z.small * 0.36, z.small + 2, col.fg, youL, `font-weight="700" ${halo}`);
        out += T(R + 16, yi + z.small * 0.36, z.small, col.muted, idxL, halo);
        return out;
      },

      // periods: you, the index and the difference, then the largest drop with how far
      // you've come back since its low. Columns are as wide as their contents.
      table: (x0, y0, w) => {
        const rows = [...x.periods, { label: tr('Largest drop'), mine: fell ? dd.drawdown : 0, theirs: x.benchDrop < -0.0005 ? x.benchDrop : 0, note: comeback }];
        const gapC = z.body * 1.3;
        const wDiff = Math.max(textWidth(tr('Difference'), z.axis), ...rows.map((r) => textWidth(diff(r.mine - r.theirs), z.body, 600)));
        const wIdx = Math.max(textWidth(B, z.axis), ...rows.map((r) => textWidth(p(r.theirs), z.body)));
        const c3 = x0 + w, c2 = c3 - wDiff - gapC, c1 = c2 - wIdx - gapC;
        const rowH = z.body * (z.rowK || 2.3);
        let out = T(c1, y0 + z.axis, z.axis, col.muted, tr('You'), 'text-anchor="end"') +
          T(c2, y0 + z.axis, z.axis, col.muted, B, 'text-anchor="end"') +
          T(c3, y0 + z.axis, z.axis, col.muted, tr('Difference'), 'text-anchor="end"');
        let y = y0 + z.axis + 14;
        for (const r of rows) {
          const h = r.note ? rowH + z.small * 1.1 : rowH;
          const base = y + rowH * 0.62;
          const d = r.mine == null || r.theirs == null ? null : r.mine - r.theirs;
          out += `<line x1="${x0}" x2="${c3}" y1="${y}" y2="${y}" stroke="${col.line}" stroke-width="1.5"/>`;
          out += T(x0, base, z.body, col.fg, r.label) +
            T(c1, base, z.value, col.fg, p(r.mine), 'text-anchor="end" font-weight="700"') +
            T(c2, base, z.body, col.muted, p(r.theirs), 'text-anchor="end"') +
            T(c3, base, z.body, d == null ? col.muted : tone(d), diff(d), 'text-anchor="end" font-weight="600"');
          if (r.note) out += T(x0, base + z.small * 1.25, z.small, col.good, r.note, 'font-weight="600"');
          y += h;
        }
        return out;
      },

      // best performers: logo, ticker, a bar for the return, the return
      performers: (x0, y0, w, n = 5) => {
        const rows = x.top.slice(0, n);
        if (!rows.length) return '';
        const rowH = z.body * (z.listK || 2.05), lg = Math.round(z.body * 1.4);
        const maxAbs = Math.max(...rows.map((h) => Math.abs(h.gainPct)), 0.0001);
        const numW = Math.max(...rows.map((h) => textWidth(p(h.gainPct), z.value, 700)));
        const tkW = Math.max(...rows.map((h) => textWidth(h.t, z.value, 700)));
        const bx = x0 + lg + 14 + tkW + 24, bw = Math.max(40, x0 + w - numW - 24 - bx);
        let out = T(x0, y0 + z.label, z.label, col.muted, tr('Best performers'));
        rows.forEach((h, i) => {
          const mid = y0 + z.label + 14 + i * rowH + rowH / 2, top = mid - lg / 2;
          const logo = x.logos[h.t];
          out += `<clipPath id="lg${i}"><rect x="${x0}" y="${top}" width="${lg}" height="${lg}" rx="${lg * 0.24}"/></clipPath>`;
          out += logo
            ? `<rect x="${x0}" y="${top}" width="${lg}" height="${lg}" rx="${lg * 0.24}" fill="${logo.dark ? '#1f2328' : '#fff'}"/><image href="${logo.src}" x="${x0}" y="${top}" width="${lg}" height="${lg}" preserveAspectRatio="xMidYMid meet" clip-path="url(#lg${i})"/>`
            : `<rect x="${x0}" y="${top}" width="${lg}" height="${lg}" rx="${lg * 0.24}" fill="${col.line}"/>` + T(x0 + lg / 2, mid + lg * 0.18, lg * 0.5, col.muted, h.t[0], 'text-anchor="middle" font-weight="700"');
          out += T(x0 + lg + 14, mid + z.value * 0.35, z.value, col.fg, h.t, 'font-weight="700"');
          out += `<rect x="${bx}" y="${mid - 6}" width="${bw}" height="12" rx="6" fill="${col.line}" fill-opacity="0.6"/>`;
          out += `<rect x="${bx}" y="${mid - 6}" width="${Math.max(8, (Math.abs(h.gainPct) / maxAbs) * bw)}" height="12" rx="6" fill="${h.gainPct >= 0 ? col.good : col.bad}"/>`;
          out += T(x0 + w, mid + z.value * 0.35, z.value, col.fg, p(h.gainPct), 'text-anchor="end" font-weight="700"');
        });
        return out;
      },

      // a row of periods for the compact card: label above, your return below, index beside
      strip: (x0, y0, w) => {
        const items = x.periods, cw = w / items.length;
        return items.map((r, i) => {
          const cx = x0 + i * cw;
          return T(cx, y0 + z.small, z.small, col.muted, r.label) +
            T(cx, y0 + z.small + z.value + 10, z.value, tone(r.mine), p(r.mine), 'font-weight="700"') +
            T(cx + textWidth(p(r.mine), z.value, 700) + 12, y0 + z.small + z.value + 10, z.small, col.muted, `${B} ${p(r.theirs)}`);
        }).join('');
      },

      // the footnote, wrapped to `w`; its last line sits on the baseline `y`
      footer: (x0, y, w, short = false) => {
        const lines = [''];
        for (const word of ((short && x.footerShort) || x.footer).split(' ')) {
          const next = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
          if (textWidth(next, z.foot) > w && lines[lines.length - 1]) lines.push(word); else lines[lines.length - 1] = next;
        }
        return lines.map((l, i) => T(x0, y - (lines.length - 1 - i) * z.foot * 1.3, z.foot, col.muted, l)).join('');
      },
    };
  }

  // Three formats: a size, type sizes, and a layout.
  const FORMATS = {
    // 16:9, for posts and link previews: a 2×2 grid. Headline and chart on top; best
    // performers and the periods underneath.
    wide: { W: 1600, H: 900, z: { title: 40, meta: 26, label: 28, hero: 132, body: 28, value: 30, small: 24, axis: 22, foot: 22 },
      draw: (k) =>
        k.header(72, 108, 1528) +
        k.hero(72, 142, 640) +
        k.chart(760, 146, 768, 318) +
        k.performers(72, 472, 600) +
        k.table(760, 494, 768) +
        k.footer(72, 856, 1456) },
    // 4:5, for a phone screen: everything in one column
    tall: { W: 1080, H: 1350, z: { title: 38, meta: 24, label: 26, hero: 112, body: 27, value: 29, small: 23, axis: 21, foot: 20, rowK: 2.1, listK: 1.95 },
      draw: (k) =>
        k.header(72, 104, 1008) +
        k.hero(72, 138, 936) +
        k.chart(72, 362, 936, 240) +
        k.table(72, 628, 936) +
        k.performers(72, 940, 936) +
        k.footer(72, 1302, 936) },
    // 16:9 and small: headline and chart side by side, the periods underneath; no stock names
    compact: { W: 1200, H: 675, z: { title: 34, meta: 22, label: 24, hero: 108, body: 24, value: 28, small: 20, axis: 19, foot: 18 },
      draw: (k) =>
        k.header(64, 96, 1136) +
        k.hero(64, 128, 500) +
        k.chart(600, 132, 536, 330) +
        k.strip(64, 500, 1072) +
        k.footer(64, 630, 1072, true) },
  };

  function card(x, format) {
    const css = getComputedStyle(document.documentElement);
    const c = (n) => css.getPropertyValue(n).trim();
    const col = { bg: c('--bg'), panel: c('--panel'), fg: c('--fg'), muted: c('--muted'), line: c('--line'), good: c('--good'), bad: c('--bad'), accent: c('--lt') };
    const f = FORMATS[format];
    const k = parts(x, col, f.z);
    return { W: f.W, H: f.H, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${f.W}" height="${f.H}" viewBox="0 0 ${f.W} ${f.H}">${k.frame(f.W, f.H)}${f.draw(k)}</svg>` };
  }

  // each logo as image data, so it's part of the saved picture, and whether it's white
  // artwork that needs a dark tile (see shared.js); none if it can't be had
  async function logoData(t) {
    try {
      const res = await fetch(`api/logo?symbol=${encodeURIComponent(t)}`);
      if (!res.ok) return null;
      const blob = await res.blob();
      const src = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(blob); });
      if (!src) return null;
      const img = new Image();
      img.src = src;
      await img.decode();
      return { src, dark: S.lightLogo(img) };
    } catch { return null; }
  }

  // ---------- the dialog ----------
  // the span and the format, kept in this browser
  const pref = {
    get: (k, ok, d) => { try { const v = localStorage.getItem(k); return ok.includes(v) ? v : d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };
  let span = pref.get('tlv-share-span', ['all', 'year'], 'all');
  let format = pref.get('tlv-share-format', Object.keys(FORMATS), 'wide');
  const seg = (id, get, set) => {
    const box = $(id);
    const show = () => box.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === get())));
    box.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b || b.dataset.v === get()) return;
      set(b.dataset.v); show(); await draw();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const bs = [...box.querySelectorAll('button')], i = bs.findIndex((b) => b.dataset.v === get());
      const next = bs[(i + (e.key === 'ArrowRight' ? 1 : -1) + bs.length) % bs.length];
      next.focus(); next.click();
    });
    return show;
  };
  const showSpan = seg('share-span', () => span, (v) => { span = v; pref.set('tlv-share-span', v); });
  const showFormat = seg('share-format', () => format, (v) => { format = v; pref.set('tlv-share-format', v); });

  let drawn = null;                              // { svg, W, H } of the card on screen
  const logos = {};                              // fetched once per stock while the page is open
  async function draw() {
    const x = stats(span);
    if (!x) return false;
    await Promise.all(x.top.filter((h) => !(h.t in logos)).map(async (h) => { logos[h.t] = await logoData(h.t); }));
    x.logos = logos;
    drawn = card(x, format);
    // shown as an image, exactly as it's saved
    const img = new Image();
    img.alt = tr('Share card preview');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(drawn.svg);
    $('share-preview').replaceChildren(img);
    showSpan(); showFormat();
    say('');
    return true;
  }
  open.addEventListener('click', async () => {
    open.disabled = true;
    const ok = await draw();
    open.disabled = false;
    if (ok) dlg.showModal();
  });
  $('share-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  // the card as a PNG, drawn at twice the size for sharp text
  async function png() {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(drawn.svg);
    await img.decode();
    const canvas = Object.assign(document.createElement('canvas'), { width: drawn.W * 2, height: drawn.H * 2 });
    canvas.getContext('2d').drawImage(img, 0, 0, drawn.W * 2, drawn.H * 2);
    return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error(tr('Could not make the image')))), 'image/png'));
  }
  $('share-save').addEventListener('click', async () => {
    try {
      const url = URL.createObjectURL(await png());
      const a = Object.assign(document.createElement('a'), { href: url, download: tr('Portfolio performance {date}.png', { date: new Date().toISOString().slice(0, 10) }) });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      say(tr('Saved to your downloads.'));
    } catch (err) { say(String(err?.message || err)); }
  });
  $('share-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png() })]);
      say(tr('Copied. Paste it into a message or post.'));
    } catch { say(tr('This browser didn’t allow copying; use Save image instead.')); }
  });
})();
