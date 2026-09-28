/**
 * 日本の祝日（YYYY-MM-DD の Set）。振替休日・国民の休日を含む。
 * 2003 年以降のハッピーマンデー制度を前提とする。
 */
import { pad, addDays, parseDate } from './date';

const FIXED_HOLIDAYS = ['01-01', '02-11', '04-29', '05-03', '05-04', '05-05', '11-03', '11-23'];

/** 東京五輪の特例で海の日・スポーツの日・山の日が移動した年 */
const OLYMPIC_HOLIDAYS = {
  2020: ['07-23', '07-24', '08-10'],
  2021: ['07-22', '07-23', '08-08'],
};

/** 天皇即位に伴う休日 */
const EXTRA_HOLIDAYS = {
  2019: ['04-30', '05-01', '05-02', '10-22'],
};

function nthMonday(year, month, n) {
  const firstDow = new Date(year, month - 1, 1).getDay();
  return `${year}-${pad(month)}-${pad(1 + (n - 1) * 7 + ((8 - firstDow) % 7))}`;
}

function equinoxDay(base, year) {
  return year <= 2099 ? Math.floor(base + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)) : Math.floor(base);
}

/** 国民の祝日に関する法律で定められた祝日（振替・国民の休日を除く） */
function nationalHolidays(year) {
  const days = [...FIXED_HOLIDAYS, ...(OLYMPIC_HOLIDAYS[year] || []), ...(EXTRA_HOLIDAYS[year] || [])].map((md) => `${year}-${md}`);
  if (!OLYMPIC_HOLIDAYS[year]) {
    days.push(nthMonday(year, 7, 3), nthMonday(year, 10, 2));
    if (year >= 2016) days.push(`${year}-08-11`);
  }
  if (year >= 2020) days.push(`${year}-02-23`);
  else if (year <= 2018) days.push(`${year}-12-23`);
  days.push(
    nthMonday(year, 1, 2),
    nthMonday(year, 9, 3),
    `${year}-03-${pad(equinoxDay(20.8431, year))}`,
    `${year}-09-${pad(equinoxDay(23.2488, year))}`,
  );
  return new Set(days);
}

const cache = new Map();

export function getHolidays(year) {
  if (cache.has(year)) return cache.get(year);
  const national = nationalHolidays(year);
  const result = new Set(national);
  const isSunday = (d) => parseDate(d).getDay() === 0;

  // 国民の休日: 祝日に挟まれた平日
  national.forEach((d) => {
    const next = addDays(d, 1);
    if (!national.has(next) && national.has(addDays(d, 2)) && !isSunday(next)) result.add(next);
  });

  // 振替休日: 日曜の祝日の後で最初の休日でない日
  national.forEach((d) => {
    if (!isSunday(d)) return;
    let next = addDays(d, 1);
    while (result.has(next)) next = addDays(next, 1);
    result.add(next);
  });

  cache.set(year, result);
  return result;
}
