// Checks a request before anything is sent to Yahoo Finance or a logo service.
// Only a ticker symbol and one of a few fixed history ranges are accepted.

export const PRICE_HOST = 'query1.finance.yahoo.com';

const TICKER = /^[A-Z][A-Z0-9.\-]{0,9}$/;
// range/interval pairs: monthly bars for the all-time high, weekly bars for history
// (5 years, or longer when your first purchase is older than that)
const RANGES = new Set(['max/1mo', '5y/1wk', '10y/1wk', 'max/1wk']);

// The lookups answer only this site's own pages: GET requests that a browser has labeled
// same-origin. A request without that label (a script, another tool) is refused.
export function refuseRequest(method, fetchSite) {
  if (method !== 'GET') return { status: 405, error: 'Method not allowed.' };
  if (fetchSite !== 'same-origin') return { status: 403, error: 'Forbidden.' };
  return null;
}
const PARAMS = new Set(['symbol', 'range', 'interval']);

// A sector lookup takes only a ticker symbol.
export function parseProfileRequest(url) {
  for (const key of url.searchParams.keys()) {
    if (key !== 'symbol') return { error: 'Unexpected parameter.' };
  }
  const symbol = url.searchParams.get('symbol') || '';
  if (!TICKER.test(symbol)) return { error: 'Unexpected ticker symbol.' };
  return { symbol };
}

// A logo lookup takes only a ticker symbol too.
export const parseLogoRequest = parseProfileRequest;

export function parseChartRequest(url) {
  for (const key of url.searchParams.keys()) {
    if (!PARAMS.has(key)) return { error: 'Unexpected parameter.' };
  }
  const symbol = url.searchParams.get('symbol') || '';
  const range = url.searchParams.get('range') || '';
  const interval = url.searchParams.get('interval') || '';
  if (!TICKER.test(symbol)) return { error: 'Unexpected ticker symbol.' };
  if (!RANGES.has(`${range}/${interval}`)) return { error: 'Unsupported price request.' };
  return { symbol, range, interval };
}
