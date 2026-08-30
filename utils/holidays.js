/**
 * 日本の祝日（YYYY-MM-DD の Set）
 * 海の日: 2020年以降は7月22日固定、それ以前は7月第3月曜
 */

function pad(n) {
  return String(n).padStart(2, '0');
}

function nthMonday(year, month, n) {
  const first = new Date(year, month - 1, 1);
  const day = first.getDay();
  const d = 1 + (n - 1) * 7 + (8 - day) % 7;
  return `${year}-${pad(month)}-${pad(d)}`;
}

export function getHolidays(year) {
  const set = new Set();
  set.add(`${year}-01-01`);
  set.add(`${year}-02-11`);
  set.add(`${year}-02-23`);
  set.add(`${year}-04-29`);
  set.add(`${year}-05-03`);
  set.add(`${year}-05-04`);
  set.add(`${year}-05-05`);
  set.add(`${year}-08-11`);
  set.add(`${year}-11-03`);
  set.add(`${year}-11-23`);

  if (year >= 2020) {
    set.add(`${year}-07-22`);
  }

  set.add(nthMonday(year, 1, 2));
  if (year < 2020) set.add(nthMonday(year, 7, 3));
  set.add(nthMonday(year, 9, 3));
  set.add(nthMonday(year, 10, 2));

  const vernal = year <= 2099
    ? Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
    : 20;
  const autumnal = year <= 2099
    ? Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
    : 23;
  set.add(`${year}-03-${pad(vernal)}`);
  set.add(`${year}-09-${pad(autumnal)}`);

  return set;
}

export function isHoliday(dateStr, year) {
  return getHolidays(year).has(dateStr);
}
