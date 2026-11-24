'use strict';
// The share card on the performance page: your returns as percentages only, drawn as an
// image to save or copy. It holds no dollar amounts or share counts, and it's made in
// this browser; nothing is sent anywhere.
(() => {
  const open = document.getElementById('share-open'), dlg = document.getElementById('share');
  if (!open || !dlg) return;
  const P = window.PerfCalc, S = window.Shared;
  const tr = S.t;                                // text in the chosen language (i18n.js)
  const BENCH = { SPY: 'S&P 500', QQQ: 'Nasdaq 100', VTI: tr('total US market') };
  const W = 1200, H = 630;                       // the usual size for a shared link image
  const $ = (id) => document.getElementById(id);
  const say = (text) => { $('share-status').textContent = text; };

  // What the card shows. `span` is 'all' (since your first purchase) or 'year' (since
  // January 1): the headline return against the index, the best stocks over that span,
  // three more periods, and the span's largest drop.
  function stats(span) {
    const data = window.TLV.loadResult();
    let bench = 'SPY';
    try { if (BENCH[localStorage.getItem('tlv-bench')]) bench = localStorage.getItem('tlv-bench'); } catch {}
    if (!data?.activity?.length || !data.bench?.[bench]) return null;
    const points = P.timeline(data, bench), last = points.length - 1;
    const per = (r) => P.period(points, P.rangeStart(points, r), last);
    const best = (rows) => rows.filter((h) => h.value > 0 && h.gainPct != null).sort((a, b) => b.gainPct - a.gainPct).slice(0, 5);
    // the largest drop over the span's weeks, and the index's over the same weeks
    const drop = (from) => {
      const pts = points.slice(from).filter((p) => p.twr != null);
      return { dd: P.maxDrawdown(pts.map((p) => p.twr)), bench: P.maxDrawdown(pts.map((p) => p.bench)).drawdown };
    };
    const base = { data, name: BENCH[bench] };
    if (span === 'year') {
      const year = data.asof.slice(0, 4), i0 = P.rangeStart(points, 'YTD'), ytd = per('YTD');
      const m1 = per('1M'), m3 = per('3M'), y1 = per('1Y');
      return {
        ...base, mine: ytd.twr, theirs: ytd.benchReturn,
        heading: tr('Return so far in {year}', { year }),
        top: best(P.periodReturns(data, `${year}-01-01`)),
        tiles: [[tr('Last month'), m1.twr, m1.benchReturn], [tr('Last 3 months'), m3.twr, m3.benchReturn], [tr('Last 12 months'), y1.twr, y1.benchReturn]],
        drop: drop(i0),
        footer: tr('Percentages only · time-weighted returns with dividends; best performers by their return this year'),
      };
    }
    const sum = P.summary(data, points), ytd = per('YTD'), y1 = per('1Y'), m6 = per('6M');
    return {
      ...base, mine: sum.twr, theirs: sum.benchReturn,
      heading: tr('Total return since {month}', { month: S.fmtMonth(sum.since.slice(0, 7)) }),
      top: best(P.holdings(data, bench).filter((h) => h.open)),
      tiles: [[tr('This year'), ytd.twr, ytd.benchReturn], [tr('Last 12 months'), y1.twr, y1.benchReturn],
        sum.irr != null ? [tr('Per year'), sum.irr, sum.marketIrr] : [tr('Last 6 months'), m6.twr, m6.benchReturn]],
      drop: drop(0),
      footer: tr('Percentages only · time-weighted returns with dividends; "per year" is money-weighted'),
    };
  }

  function card(x) {
    const css = getComputedStyle(document.documentElement);
    const c = (n) => css.getPropertyValue(n).trim();
    const col = { bg: c('--bg'), panel: c('--panel'), fg: c('--fg'), muted: c('--muted'), line: c('--line'), good: c('--good'), bad: c('--bad'), accent: c('--lt') };
    const tone = (v) => (v == null ? col.muted : v > 0 ? col.good : v < 0 ? col.bad : col.fg);
    const p = (v) => S.signedPct(v);
    const sans = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;
    const serif = `'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif`;
    const t = (x, y, size, fill, text, more = '') =>
      `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-family="${sans}" ${more}>${S.esc(text)}</text>`;
    const B = x.name, ahead = x.mine - x.theirs;

    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <rect width="${W}" height="${H}" fill="${col.bg}"/>
      <rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="22" fill="${col.panel}" stroke="${col.line}" stroke-width="2"/>`;
    out += t(64, 92, 30, col.fg, tr('My portfolio'), 'font-weight="700"');
    out += t(W - 64, 92, 24, col.muted, tr('As of {date}', { date: S.fmtDate(x.data.asof.slice(0, 10)) }), 'text-anchor="end"');

    // headline: the span's return, against the index
    out += t(64, 160, 24, col.muted, x.heading);
    out += `<text x="60" y="272" font-size="112" fill="${tone(x.mine)}" font-family="${serif}">${S.esc(p(x.mine))}</text>`;
    out += t(64, 320, 26, col.muted, `${B}: ${p(x.theirs)}`);
    const badge = Math.abs(ahead) < 0.0005 ? tr('Same return as the {index}', { index: B })
      : tr(ahead > 0 ? '{pct} more return than the {index}' : '{pct} less return than the {index}', { pct: S.pct(Math.abs(ahead)), index: B });
    const bw = textWidth(badge, `600 22px ${sans}`) + 40;
    out += `<rect x="64" y="342" width="${bw}" height="44" rx="22" fill="${ahead >= 0 ? col.good : col.bad}" fill-opacity="0.16"/>`;
    out += t(84, 372, 22, ahead >= 0 ? col.good : col.bad, badge, 'font-weight="600"');

    // best stocks by return
    if (x.top.length) {
      const X0 = 760;
      out += t(X0, 160, 24, col.muted, tr('Best performers'));
      x.top.forEach((h, i) => {
        const y = 206 + i * 44;                     // five rows fit above the period tiles
        // logo (or the first letter, when there's none) left of the ticker
        out += `<clipPath id="lg${i}"><rect x="${X0}" y="${y - 25}" width="32" height="32" rx="8"/></clipPath>`;
        out += x.logos[h.t]
          ? `<rect x="${X0}" y="${y - 25}" width="32" height="32" rx="8" fill="${x.logos[h.t].dark ? '#1f2328' : '#fff'}"/><image href="${x.logos[h.t].src}" x="${X0}" y="${y - 25}" width="32" height="32" preserveAspectRatio="xMidYMid meet" clip-path="url(#lg${i})"/>`
          : `<rect x="${X0}" y="${y - 25}" width="32" height="32" rx="8" fill="${col.line}"/>` + t(X0 + 16, y - 2, 17, col.muted, h.t[0], 'text-anchor="middle" font-weight="700"');
        out += t(X0 + 44, y, 28, col.fg, h.t, 'font-weight="700"');
        out += t(W - 64, y, 28, tone(h.gainPct), p(h.gainPct), 'text-anchor="end" font-weight="600"');
        if (i < x.top.length - 1) out += `<line x1="${X0}" x2="${W - 64}" y1="${y + 16}" y2="${y + 16}" stroke="${col.line}" stroke-width="1.5"/>`;
      });
    }

    // four periods along the bottom
    // three returns, then risk: your largest fall from a high against the index's
    const dd = x.drop.dd;
    const tiles = [...x.tiles, [tr('Largest drop'), dd.drawdown, x.drop.bench]];
    // under the largest drop: how far you've come back since the low
    const comeback = dd.index != null && dd.drawdown < -0.0005 && dd.rise > 0.0005 ? tr('{pct} since the low', { pct: p(dd.rise) }) : null;
    const tw = (W - 128 - 3 * 20) / 4;
    tiles.forEach(([k, mine, theirs], i) => {
      const tx = 64 + i * (tw + 20), ty = 412;
      out += `<rect x="${tx}" y="${ty}" width="${tw}" height="152" rx="14" fill="${col.bg}" stroke="${col.line}" stroke-width="1.5"/>`;
      out += t(tx + 20, ty + 36, 20, col.muted, k);
      out += `<text x="${tx + 20}" y="${ty + 86}" font-size="44" fill="${tone(mine)}" font-family="${serif}">${S.esc(p(mine))}</text>`;
      if (theirs != null) out += t(tx + 20, ty + 116, 19, col.muted, `${B} ${p(theirs)}`);
      if (i === 3 && comeback) out += t(tx + 20, ty + 140, 19, col.good, comeback, 'font-weight="600"');
    });
    out += t(64, H - 44, 17, col.muted, x.footer);
    return out + '</svg>';
  }

  // how wide a line of text is drawn, so the badge fits it in any language
  let ctx;
  function textWidth(text, font) {
    ctx ||= document.createElement('canvas').getContext('2d');
    ctx.font = font;
    return ctx.measureText(text).width;
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

  // All time or This year, kept in this browser
  const SPAN = 'tlv-share-span';
  let span = 'all';
  try { if (localStorage.getItem(SPAN) === 'year') span = 'year'; } catch {}
  const spanBox = $('share-span');
  const showSpan = () => spanBox.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === span)));

  let svg = '';
  const logos = {};                              // fetched once per stock while the page is open
  async function draw() {
    const x = stats(span);
    if (!x) return false;
    await Promise.all(x.top.filter((h) => !(h.t in logos)).map(async (h) => { logos[h.t] = await logoData(h.t); }));
    x.logos = logos;
    svg = card(x);
    $('share-preview').innerHTML = svg;
    showSpan();
    say('');
    return true;
  }
  open.addEventListener('click', async () => {
    open.disabled = true;
    const ok = await draw();
    open.disabled = false;
    if (ok) dlg.showModal();
  });
  spanBox.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b || b.dataset.v === span) return;
    span = b.dataset.v;
    try { localStorage.setItem(SPAN, span); } catch {}
    showSpan();
    await draw();
  });
  spanBox.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); spanBox.querySelector(`button:not([data-v="${span}"])`).click(); }
  });
  $('share-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  // the card as a PNG, drawn at twice the size for sharp text
  async function png() {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const canvas = Object.assign(document.createElement('canvas'), { width: W * 2, height: H * 2 });
    canvas.getContext('2d').drawImage(img, 0, 0, W * 2, H * 2);
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
