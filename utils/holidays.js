/**
 * 日本の祝日（YYYY-MM-DD の Set）
 * 海の日: 2020年以降は7月22日固定、それ以前は7月第3月曜
 */
import { pad } from './date';

const FIXED_HOLIDAYS = ['01-01', '02-11', '02-23', '04-29', '05-03', '05-04', '05-05', '08-11', '11-03', '11-23'];

function nthMonday(year, month, n) {
  const firstDow = new Date(year, month - 1, 1).getDay();
  return `${year}-${pad(month)}-${pad(1 + (n - 1) * 7 + ((8 - firstDow) % 7))}`;
}

function equinoxDay(base, year) {
  return year <= 2099 ? Math.floor(base + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)) : Math.floor(base);
}

export function getHolidays(year) {
  const set = new Set(FIXED_HOLIDAYS.map((md) => `${year}-${md}`));
  set.add(year >= 2020 ? `${year}-07-22` : nthMonday(year, 7, 3));
  set.add(nthMonday(year, 1, 2));
  set.add(nthMonday(year, 9, 3));
  set.add(nthMonday(year, 10, 2));
  set.add(`${year}-03-${pad(equinoxDay(20.8431, year))}`);
  set.add(`${year}-09-${pad(equinoxDay(23.2488, year))}`);
  return set;
}
