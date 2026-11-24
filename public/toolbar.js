'use strict';
// The toolbar on both result pages: refresh prices, save the sell-check report, forget.
(() => {
  const data = window.TLV.loadResult();
  if (!data) return;
  const t = window.Shared.t;

  const status = document.getElementById('wb-status');
  const say = (text) => { status.textContent = text; };
  const pref = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };

  // After an update the page reloads; come back to the same place on it.
  const SCROLL = 'tlv-scroll';
  const reloadInPlace = () => {
    try { sessionStorage.setItem(SCROLL, JSON.stringify({ path: location.pathname, y: scrollY })); } catch {}
    location.reload();
  };
  try {
    const back = JSON.parse(sessionStorage.getItem(SCROLL) || 'null');
    sessionStorage.removeItem(SCROLL);
    if (back?.path === location.pathname) {
      // the pages draw after loading, so wait for their height before scrolling
      addEventListener('load', () => setTimeout(() => scrollTo(0, back.y), 350));
    }
  } catch {}
  const updated = () => pref.set('tlv-last-update', String(Date.now()));

  // ---- refresh prices: the purchases stay, only prices are fetched again ----
  const refresh = document.getElementById('wb-refresh');
  refresh?.addEventListener('click', async () => {
    refresh.disabled = true;
    try {
      const next = await window.Lots.refreshPrices(data, {
        fetchQuote: window.Prices.fetchQuote,
        fetchSeries: window.Prices.fetchSeries,
        onProgress: (p) => say(p.done < p.total ? t('Getting prices · {n} of {total}', { n: p.done + 1, total: p.total }) : t('Updating…')),
      });
      window.TLV.saveResult(next);
      updated();
      reloadInPlace();
    } catch (err) {
      say(String(err?.message || err));
      refresh.disabled = false;
    }
  });

  // ---- automatic updates: while the market is open, plus once after the close ----
  const auto = document.getElementById('wb-auto');
  if (auto) {
    const every = () => Number(auto.value) || 0;
    auto.value = ['0', '5', '15', '30', '60'].includes(pref.get('tlv-auto')) ? pref.get('tlv-auto') : '0';
    let busy = false;
    async function check() {
      if (busy || document.hidden || refresh?.disabled) return;
      const last = Number(pref.get('tlv-last-update')) || 0;
      if (!window.Market.updateDue(Date.now(), last, every())) return;
      busy = true;
      try {
        const next = await window.Lots.updatePrices(window.TLV.loadResult() || data, {
          fetchLatest: window.Prices.fetchLatest,
          fetchSeries: window.Prices.fetchSeries,
          onProgress: (p) => say(p.done < p.total ? t('Updating prices · {n} of {total}', { n: p.done + 1, total: p.total }) : t('Updating…')),
        });
        window.TLV.saveResult(next);
        updated();
        reloadInPlace();
      } catch (err) {
        // try again at the next interval rather than every 30 seconds
        updated();
        say(t('Automatic update failed: {reason}', { reason: String(err?.message || err) }));
        busy = false;
      }
    }
    auto.addEventListener('change', () => { pref.set('tlv-auto', auto.value); check(); });
    setInterval(check, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    check();
  }

  // ---- hide amounts: percentages only, for sharing a screenshot ----
  const hide = document.getElementById('wb-hide');
  if (hide) {
    const on = window.Shared.hidden;
    hide.setAttribute('aria-pressed', String(on));       // the icon follows (web.css)
    if (on) hide.title = t('Show amounts');
    hide.classList.toggle('primary', on);
    hide.addEventListener('click', () => { pref.set('tlv-hide', on ? '0' : '1'); reloadInPlace(); });
  }

  // ---- save a standalone copy of the sell check, in the theme you're using ----
  const save = document.getElementById('wb-save');
  if (save && window.Shared.hidden) {
    // the saved file holds your full figures, whatever is shown on screen
    save.disabled = true;
    save.style.cursor = 'not-allowed';
    save.title = t('Show amounts first: a saved report always contains your dollar figures.');
  }
  save?.addEventListener('click', async () => {
    try {
      const template = await (await fetch('report-template', { cache: 'no-store' })).text();
      // the saved file needs only what the sell check shows, not your full history
      const { activity, income, history, bench, benchDay, splitEvents, profiles, ...sellCheck } = data;
      // the chart of buys and sales: date, ticker, shares, price and amount of each
      sellCheck.trades = (activity || []).filter((x) => x.type === 'BUY' || x.type === 'SELL');
      let html = template.replace('__DATA__', () => JSON.stringify(sellCheck).replace(/</g, '\\u003c'));
      const theme = window.TLV.theme();
      // the saved file opens in this theme and this language
      const lang = window.I18n?.lang || 'en';
      html = html.replace('<html lang="en">', `<html lang="${lang}" data-lang="${lang}"${theme ? ` data-theme="${theme}"` : ''}>`);
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: t('Long-Term Sell Check {date}.html', { date: data.asof.slice(0, 10) }) });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      say(t('The report couldn\'t be saved. Try again.'));
    }
  });

  // ---- forget: a second click confirms ----
  const forget = document.getElementById('wb-forget');
  const confirm = forget?.querySelector('.wb-confirm');
  let armed = null;
  forget?.addEventListener('click', () => {
    if (armed) {
      window.TLV.forgetResult();
      // these name your stocks too: the sectors you chose, the groups you opened, the last stock viewed
      for (const k of ['tlv-sectors', 'tlv-open-groups']) { try { localStorage.removeItem(k); } catch {} }
      try { sessionStorage.removeItem('tlv-sel'); } catch {}
      return location.assign('./?new');
    }
    // the icon button says what a second click does, for a few seconds
    confirm.textContent = t('Click again to forget');
    forget.classList.add('danger');
    armed = setTimeout(() => { armed = null; confirm.textContent = ''; forget.classList.remove('danger'); }, 4000);
  });
})();
