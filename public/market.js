'use strict';
{
// Whether the US stock market is open, on New York time wherever the viewer is.
// Regular hours: Monday to Friday, 9:30 AM to 4:00 PM, except exchange holidays, with a
// 1:00 PM close on the usual early-close days. Holidays are worked out from the
// exchange's rules, so the calendar never needs updating.
const OPEN = 9 * 60 + 30, CLOSE = 16 * 60, EARLY = 13 * 60, AFTER = 30; // minutes; AFTER = window to catch the close

const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const dow = (y, m, d) => new Date(Date.UTC(y, m, d)).getUTCDay();          // 0 = Sunday
const nth = (y, m, weekday, n) => 1 + ((weekday - dow(y, m, 1) + 7) % 7) + 7 * (n - 1);
const last = (y, m, weekday) => { const end = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); return end - ((dow(y, m, end) - weekday + 7) % 7); };

// Easter Sunday (anonymous Gregorian algorithm), for Good Friday.
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1, day = ((h + l - 7 * m + 114) % 31) + 1;
  return [month, day];
}

// A fixed-date holiday on a weekend moves to Friday or Monday. New Year's Day on a
// Saturday isn't moved back into December.
function observed(y, m, d, newYear = false) {
  const w = dow(y, m, d);
  if (w === 6) return newYear ? null : iso(...ymd(Date.UTC(y, m, d - 1)));
  if (w === 0) return iso(...ymd(Date.UTC(y, m, d + 1)));
  return iso(y, m, d);
}
function ymd(t) { const x = new Date(t); return [x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()]; }

const cache = {};
// { 'YYYY-MM-DD': 'closed' | 'early' } for one year.
function holidays(y) {
  if (cache[y]) return cache[y];
  const days = {};
  const close = (day) => { if (day) days[day] = 'closed'; };
  close(observed(y, 0, 1, true));                 // New Year's Day
  close(iso(y, 0, nth(y, 0, 1, 3)));              // Martin Luther King Jr. Day: 3rd Monday of January
  close(iso(y, 1, nth(y, 1, 1, 3)));              // Washington's Birthday: 3rd Monday of February
  const [em, ed] = easter(y);
  close(iso(...ymd(Date.UTC(y, em, ed - 2))));    // Good Friday
  close(iso(y, 4, last(y, 4, 1)));                // Memorial Day: last Monday of May
  if (y >= 2022) close(observed(y, 5, 19));       // Juneteenth
  close(observed(y, 6, 4));                       // Independence Day
  close(iso(y, 8, nth(y, 8, 1, 1)));              // Labor Day: 1st Monday of September
  const thanksgiving = nth(y, 10, 4, 4);          // 4th Thursday of November
  close(iso(y, 10, thanksgiving));
  close(observed(y, 11, 25));                     // Christmas
  // early closes at 1:00 PM, on weekdays that aren't holidays themselves
  const early = (m, d) => { const day = iso(y, m, d), w = dow(y, m, d); if (w > 0 && w < 6 && !days[day]) days[day] = 'early'; };
  early(6, 3);                                    // the day before Independence Day
  early(10, thanksgiving + 1);                    // the day after Thanksgiving
  early(11, 24);                                  // Christmas Eve
  return (cache[y] = days);
}

const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function marketState(nowMs) {
  const p = Object.fromEntries(parts.formatToParts(new Date(nowMs)).map((x) => [x.type, x.value]));
  const minute = Number(p.hour) * 60 + Number(p.minute);
  const day = `${p.year}-${p.month}-${p.day}`;
  const kind = holidays(Number(p.year))[day];
  const trading = !['Sat', 'Sun'].includes(p.weekday) && kind !== 'closed';
  const close = kind === 'early' ? EARLY : CLOSE;
  return {
    open: trading && minute >= OPEN && minute < close,
    // shortly after the close: one more update picks up the closing prices
    justClosed: trading && minute >= close && minute < close + AFTER,
    closedAt: trading && minute >= close ? nowMs - (minute - close) * 60000 - (nowMs % 60000) : null,
    holiday: kind === 'closed',
  };
}

// Whether an automatic update should run now.
function updateDue(nowMs, lastUpdateMs, everyMinutes) {
  if (!everyMinutes) return false;
  const m = marketState(nowMs);
  if (m.open) return nowMs - lastUpdateMs >= everyMinutes * 60000;
  if (m.justClosed) return lastUpdateMs < m.closedAt;
  return false;
}

const api = { marketState, updateDue, holidays };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else window.Market = api;
}
