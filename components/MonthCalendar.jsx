import React from 'react';
import { getHolidays } from '../utils/holidays';
import { WEEK_LABELS, getMonthCells } from '../utils/date';

const weekLabelColor = (dow) => (dow === 0 ? 'text-red-600' : dow === 6 ? 'text-blue-700' : 'text-stone-600');

function NavButton({ label, path, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border-2 border-slate-400 text-stone-600 hover:text-stone-800 transition-all shrink-0"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
      </svg>
    </button>
  );
}

/**
 * 月表示カレンダー。monthDate は月初の Date。
 * renderCell には { dateStr, day, dow, isWeekend, dateColor } が渡る（key は呼び出し側で dateStr を付ける）。
 */
export default function MonthCalendar({ monthDate, onChangeMonth, renderCell, gridProps, hint, children }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const holidays = getHolidays(year);
  const changeMonth = (delta) => onChangeMonth(new Date(year, month + delta, 1));

  return (
    <div className="bg-slate-50/95 backdrop-blur-sm rounded-2xl border-2 border-slate-400 shadow-sm p-4 flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-center gap-3 mb-3 shrink-0">
        <NavButton label="前月" path="M15 19l-7-7 7-7" onClick={() => changeMonth(-1)} />
        <h2 className="text-xl font-bold text-stone-900 min-w-[120px] text-center">{year}年 {month + 1}月</h2>
        <NavButton label="次月" path="M9 5l7 7-7 7" onClick={() => changeMonth(1)} />
      </div>
      <div className="grid grid-cols-7 gap-2 flex-1 min-h-0 auto-rows-fr" {...gridProps}>
        {WEEK_LABELS.map((label, i) => (
          <div key={label} className={`text-center text-sm font-semibold py-1 ${weekLabelColor(i)}`}>{label}</div>
        ))}
        {getMonthCells(year, month).map((cell, idx) => {
          if (!cell) return <div key={`empty-${idx}`} className="min-h-[88px]" />;
          const dateColor = cell.dow === 0 || holidays.has(cell.dateStr) ? 'text-red-700' : cell.dow === 6 ? 'text-blue-700' : 'text-stone-900';
          return renderCell({ ...cell, isWeekend: cell.dow === 0 || cell.dow === 6, dateColor });
        })}
      </div>
      {hint && <p className="text-stone-700 text-sm mt-2 shrink-0 font-medium">{hint}</p>}
      {children}
    </div>
  );
}
