'use strict';
// The share card on the performance page: your returns as percentages only, drawn as an
// image to save or copy. It holds no dollar amounts or share counts, and it's made in
// this browser; nothing is sent anywhere.
(() => {
  const open = document.getElementById('share-open'), dlg = document.getElementById('share');
  if (!open || !dlg) return;
  const P = window.PerfCalc, S = window.Shared;
  const BENCH = { SPY: 'S&P 500', QQQ: 'Nasdaq 100', VTI: 'total US market' };
  const W = 1200, H = 630;                       // the usual size for a shared link image
  const $ = (id) => document.getElementById(id);
  const say = (text) => { $('share-status').textContent = text; };

  function stats() {
    const data = window.TLV.loadResult();
    let bench = 'SPY';
    try { if (BENCH[localStorage.getItem('tlv-bench')]) bench = localStorage.getItem('tlv-bench'); } catch {}
    if (!data?.activity?.length || !data.bench?.[bench]) return null;
    const points = P.timeline(data, bench), last = points.length - 1;
    const per = (r) => P.period(points, P.rangeStart(points, r), last);
    const top = P.holdings(data, bench).filter((h) => h.open && h.gainPct != null)
      .sort((a, b) => b.gainPct - a.gainPct).slice(0, 5);
    // the index's largest drop over the same weeks as yours, for comparison
    const benchDrop = P.maxDrawdown(points.filter((p) => p.twr != null).map((p) => p.bench)).drawdown;
    return { data, name: BENCH[bench], sum: P.summary(data, points), ytd: per('YTD'), y1: per('1Y'), m6: per('6M'), benchDrop, top };
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
    const s = x.sum, B = x.name, ahead = s.twr - s.benchReturn;

    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <rect width="${W}" height="${H}" fill="${col.bg}"/>
      <rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="22" fill="${col.panel}" stroke="${col.line}" stroke-width="2"/>`;
    out += t(64, 92, 30, col.fg, 'My portfolio', 'font-weight="700"');
    out += t(W - 64, 92, 24, col.muted, `As of ${S.fmtDate(x.data.asof.slice(0, 10))}`, 'text-anchor="end"');

    // headline: return since the first purchase, against the index
    out += t(64, 160, 24, col.muted, `Total return since ${S.fmtMonth(s.since.slice(0, 7))}`);
    out += `<text x="60" y="272" font-size="112" fill="${tone(s.twr)}" font-family="${serif}">${S.esc(p(s.twr))}</text>`;
    out += t(64, 320, 26, col.muted, `${B}: ${p(s.benchReturn)}`);
    const badge = Math.abs(ahead) < 0.0005 ? `Same return as the ${B}` : `${Math.abs(ahead * 100).toFixed(1)}% ${ahead > 0 ? 'more' : 'less'} return than the ${B}`;
    const bw = badge.length * 12.6 + 40;
    out += `<rect x="64" y="342" width="${bw}" height="44" rx="22" fill="${ahead >= 0 ? col.good : col.bad}" fill-opacity="0.16"/>`;
    out += t(84, 372, 22, ahead >= 0 ? col.good : col.bad, badge, 'font-weight="600"');

    // best stocks by return
    if (x.top.length) {
      const X0 = 760;
      out += t(X0, 160, 24, col.muted, 'Best performers');
      x.top.forEach((h, i) => {
        const y = 206 + i * 44;                     // five rows fit above the period tiles
        // logo (or the first letter, when there's none) left of the ticker
        out += `<clipPath id="lg${i}"><rect x="${X0}" y="${y - 25}" width="32" height="32" rx="8"/></clipPath>`;
        out += x.logos[h.t]
          ? `<rect x="${X0}" y="${y - 25}" width="32" height="32" rx="8" fill="#fff"/><image href="${x.logos[h.t]}" x="${X0}" y="${y - 25}" width="32" height="32" preserveAspectRatio="xMidYMid meet" clip-path="url(#lg${i})"/>`
          : `<rect x="${X0}" y="${y - 25}" width="32" height="32" rx="8" fill="${col.line}"/>` + t(X0 + 16, y - 2, 17, col.muted, h.t[0], 'text-anchor="middle" font-weight="700"');
        out += t(X0 + 44, y, 28, col.fg, h.t, 'font-weight="700"');
        out += t(W - 64, y, 28, tone(h.gainPct), p(h.gainPct), 'text-anchor="end" font-weight="600"');
        if (i < x.top.length - 1) out += `<line x1="${X0}" x2="${W - 64}" y1="${y + 16}" y2="${y + 16}" stroke="${col.line}" stroke-width="1.5"/>`;
      });
    }

    // four periods along the bottom
    // three returns, then risk: your largest fall from a high against the index's
    const tiles = [
      ['This year', x.ytd.twr, x.ytd.benchReturn],
      ['Last 12 months', x.y1.twr, x.y1.benchReturn],
      s.irr != null ? ['Per year', s.irr, s.marketIrr] : ['Last 6 months', x.m6.twr, x.m6.benchReturn],
      ['Largest drop', s.drawdown.drawdown, x.benchDrop],
    ];
    const tw = (W - 128 - 3 * 20) / 4;
    tiles.forEach(([k, mine, theirs], i) => {
      const tx = 64 + i * (tw + 20), ty = 422;
      out += `<rect x="${tx}" y="${ty}" width="${tw}" height="132" rx="14" fill="${col.bg}" stroke="${col.line}" stroke-width="1.5"/>`;
      out += t(tx + 20, ty + 36, 20, col.muted, k);
      out += `<text x="${tx + 20}" y="${ty + 86}" font-size="44" fill="${tone(mine)}" font-family="${serif}">${S.esc(p(mine))}</text>`;
      if (theirs != null) out += t(tx + 20, ty + 116, 19, col.muted, `${B} ${p(theirs)}`);
    });
    out += t(64, H - 44, 17, col.muted, 'Percentages only · time-weighted returns with dividends; "per year" is money-weighted');
    return out + '</svg>';
  }

  // each logo as image data, so it's part of the saved picture; none if it can't be had
  async function logoData(t) {
    try {
      const res = await fetch(`api/logo?symbol=${encodeURIComponent(t)}`);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(blob); });
    } catch { return null; }
  }

  let svg = '';
  open.addEventListener('click', async () => {
    const x = stats();
    if (!x) return;
    open.disabled = true;
    const found = await Promise.all(x.top.map((h) => logoData(h.t)));
    open.disabled = false;
    x.logos = Object.fromEntries(x.top.map((h, i) => [h.t, found[i]]));
    svg = card(x);
    $('share-preview').innerHTML = svg;
    say('');
    dlg.showModal();
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
    return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('Could not make the image'))), 'image/png'));
  }
  $('share-save').addEventListener('click', async () => {
    try {
      const url = URL.createObjectURL(await png());
      const a = Object.assign(document.createElement('a'), { href: url, download: `Portfolio performance ${new Date().toISOString().slice(0, 10)}.png` });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      say('Saved to your downloads.');
    } catch (err) { say(String(err?.message || err)); }
  });
  $('share-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png() })]);
      say('Copied. Paste it into a message or post.');
    } catch { say('This browser didn’t allow copying; use Save image instead.'); }
  });
})();
