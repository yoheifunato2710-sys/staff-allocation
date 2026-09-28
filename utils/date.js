export const WEEK_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export const pad = (n) => String(n).padStart(2, '0');

export const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 2026-09-11-165900 */
export const timestamp = (d = new Date()) =>
  `${toDateStr(d)}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

export const isDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export const parseDate = (dateStr) => new Date(`${dateStr}T12:00:00`);

export function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** 月カレンダー表示用の 6 週 × 7 日のセル（月外は null） */
export function getMonthCells(year, month) {
  const cells = Array(new Date(year, month, 1).getDay()).fill(null);
  const lastDay = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= lastDay; day++) {
    cells.push({ dateStr: `${year}-${pad(month + 1)}-${pad(day)}`, day, dow: new Date(year, month, day).getDay() });
  }
  while (cells.length < 42) cells.push(null);
  return cells;
}
