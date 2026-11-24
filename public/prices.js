'use strict';
// Prices come from this site's own /api/chart, which asks Yahoo Finance.
// The request carries only the ticker symbol.
(() => {
  const t = (s, v) => window.Shared.t(s, v);
  async function chart(symbol, range, interval) {
    const url = `/api/chart?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=${interval}`;
    let last = t('no response');
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin', referrerPolicy: 'no-referrer' });
        const body = await res.json().catch(() => ({}));
        if (res.ok) return body;
        last = body.error || `HTTP ${res.status}`;
        if (res.status < 500) break; // a rejected request won't succeed on retry
      } catch {
        last = t('network error');
      }
      if (attempt < 2) await new Promise((ok) => setTimeout(ok, 1000 * (attempt + 1)));
    }
    throw new Error(t('Couldn\'t get prices for {symbol} ({reason}). Check your internet connection and try again.', { symbol, reason: last }));
  }

  // price times as New York dates, wherever the browser is
  const isoDay = (ts) => window.Shared.nyDay(ts * 1000);
  // weekly history: 5 years, or longer when the first purchase is older than that
  const weeklyRange = (sinceIso) => {
    const years = (Date.now() - Date.parse(sinceIso + 'T00:00:00Z')) / (365.25 * 864e5);
    return years < 4.9 ? '5y' : years < 9.9 ? '10y' : 'max';
  };

  async function fetchQuote(symbol, sinceIso) {
    const [full, weekly] = await Promise.all([chart(symbol, 'max', '1mo'), chart(symbol, weeklyRange(sinceIso), '1wk')]);
    const q = full.indicators.quote[0];
    let ath = -Infinity, athTs = 0;
    full.timestamp.forEach((ts, i) => { const h = q.high[i]; if (h != null && h > ath) { ath = h; athTs = ts; } });
    const wq = weekly.indicators.quote[0];
    const series = [];
    weekly.timestamp.forEach((ts, i) => {
      const c = wq.close[i], day = isoDay(ts);
      if (c != null && day >= sinceIso) series.push([day, Math.round(c * 1e4) / 1e4]);
    });
    const price = Number(full.meta.regularMarketPrice);
    if (!Number.isFinite(price)) throw new Error(t('No current price for {symbol}.', { symbol }));
    return {
      prevClose: previousClose(full.meta, price),
      name: String(full.meta.longName || full.meta.shortName || symbol).slice(0, 120),
      price,
      ath: Math.round(Math.max(ath, price) * 1e4) / 1e4,
      athDate: isoDay(athTs).slice(0, 7),
      series,
      time: full.meta.regularMarketTime,
    };
  }

  // The last trading day's previous close, from the day's change Yahoo reports with the price.
  function previousClose(meta, price) {
    const prev = Number(meta.regularMarketPreviousClose);
    if (Number.isFinite(prev) && prev > 0) return prev;
    const change = Number(meta.regularMarketChangePercent);
    return Number.isFinite(change) ? Math.round((price / (1 + change / 100)) * 1e4) / 1e4 : null;
  }

  // Weekly closes since `sinceIso`, and the last trading day's change. With `totalReturn`,
  // closes include reinvested dividends (Yahoo's adjusted close), fair for a market index.
  async function fetchSeries(symbol, sinceIso, totalReturn = false) {
    const weekly = await chart(symbol, weeklyRange(sinceIso), '1wk');
    const closes = (totalReturn && weekly.indicators.adjclose?.[0]?.adjclose) || weekly.indicators.quote[0].close;
    const series = [];
    weekly.timestamp.forEach((ts, i) => {
      const c = closes[i], day = isoDay(ts);
      if (c != null && day >= sinceIso) series.push([day, Math.round(c * 1e4) / 1e4]);
    });
    if (!series.length) throw new Error(t('No price history for {symbol}.', { symbol }));
    const price = Number(weekly.meta.regularMarketPrice), prev = previousClose(weekly.meta, price);
    return { series, dayChange: prev ? price / prev - 1 : null };
  }

  // Today's price and the weekly history in one lookup: what an automatic update needs.
  async function fetchLatest(symbol, sinceIso) {
    const weekly = await chart(symbol, weeklyRange(sinceIso), '1wk');
    const wq = weekly.indicators.quote[0];
    const series = [];
    weekly.timestamp.forEach((ts, i) => {
      const c = wq.close[i], day = isoDay(ts);
      if (c != null && day >= sinceIso) series.push([day, Math.round(c * 1e4) / 1e4]);
    });
    const price = Number(weekly.meta.regularMarketPrice);
    if (!Number.isFinite(price)) throw new Error(t('No current price for {symbol}.', { symbol }));
    return { price, prevClose: previousClose(weekly.meta, price), series, time: weekly.meta.regularMarketTime };
  }

  // A stock's sector and industry (funds have none).
  async function fetchProfile(symbol) {
    const res = await fetch(`/api/profile?symbol=${encodeURIComponent(symbol)}`, { cache: 'no-store', credentials: 'same-origin', referrerPolicy: 'no-referrer' });
    if (res.status === 404) return { symbol, type: null, sector: null, industry: null };
    if (!res.ok) throw new Error(t('Couldn\'t get details for {symbol}.', { symbol }));
    return res.json();
  }

  window.Prices = { fetchQuote, fetchSeries, fetchLatest, fetchProfile };
})();
