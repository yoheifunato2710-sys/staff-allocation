import React, { useState, useEffect, useRef } from 'react';
import MenuButton from '../components/MenuButton';

const STORAGE_KEY = 'mainMenuCalendarComments';
const STORAGE_KEY_MONTHLY = 'mainMenuMonthlyComments';

function getBackupFilename() {
  try {
    const raw = localStorage.getItem('allocationData');
    if (raw) {
      const data = JSON.parse(raw);
      const dateStr = data.startDate || data.endDate;
      if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return `backup-${dateStr}.json`;
    }
  } catch (_) {}
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `backup-${y}-${m}-${day}.json`;
}

function downloadBackup() {
  try {
    const modalityData = localStorage.getItem('modalityData');
    const staffData = localStorage.getItem('staffData');
    const scheduleData = localStorage.getItem('scheduleData');
    const leaveData = localStorage.getItem('leaveData');
    const allocationData = localStorage.getItem('allocationData');
    const calendarComments = localStorage.getItem(STORAGE_KEY);
    const monthlyComments = localStorage.getItem(STORAGE_KEY_MONTHLY);
    const backup = {
      modalityData: modalityData ? JSON.parse(modalityData) : [],
      staffData: staffData ? JSON.parse(staffData) : [],
      scheduleData: scheduleData ? JSON.parse(scheduleData) : null,
      leaveData: leaveData ? JSON.parse(leaveData) : null,
      allocationData: allocationData ? JSON.parse(allocationData) : null,
      calendarComments: calendarComments ? JSON.parse(calendarComments) : {},
      monthlyComments: monthlyComments ? JSON.parse(monthlyComments) : {},
      backupAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getBackupFilename();
    a.click();
    URL.revokeObjectURL(url);
    alert('バックアップをダウンロードしました');
  } catch (e) {
    alert('バックアップの作成に失敗しました');
  }
}

function restoreFromBackup(file, onDone) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const backup = JSON.parse(reader.result);
      if (backup.modalityData != null) localStorage.setItem('modalityData', JSON.stringify(backup.modalityData));
      if (backup.staffData != null) localStorage.setItem('staffData', JSON.stringify(backup.staffData));
      if (backup.scheduleData != null) localStorage.setItem('scheduleData', JSON.stringify(backup.scheduleData));
      if (backup.leaveData != null) localStorage.setItem('leaveData', JSON.stringify(backup.leaveData));
      if (backup.allocationData != null) localStorage.setItem('allocationData', JSON.stringify(backup.allocationData));
      if (backup.calendarComments != null) localStorage.setItem(STORAGE_KEY, JSON.stringify(backup.calendarComments));
      if (backup.monthlyComments != null) localStorage.setItem(STORAGE_KEY_MONTHLY, JSON.stringify(backup.monthlyComments));
      onDone?.();
      alert('復元しました。画面を再読み込みします');
      window.location.reload();
    } catch (e) {
      alert('バックアップファイルの復元に失敗しました');
    }
  };
  reader.onerror = () => alert('ファイルの読み込みに失敗しました');
  reader.readAsText(file, 'UTF-8');
}

/** 日本の祝日（指定年の祝日日付を YYYY-MM-DD の Set で返す） */
function getHolidays(year) {
  const pad = (n) => String(n).padStart(2, '0');
  const set = new Set();
  set.add(`${year}-01-01`); // 元日
  set.add(`${year}-02-11`); // 建国記念の日
  set.add(`${year}-02-23`); // 天皇誕生日
  set.add(`${year}-04-29`); // 昭和の日
  set.add(`${year}-05-03`); // 憲法記念日
  set.add(`${year}-05-04`); // みどりの日
  set.add(`${year}-05-05`); // こどもの日
  set.add(`${year}-08-11`); // 山の日
  set.add(`${year}-11-03`); // 文化の日
  set.add(`${year}-11-23`); // 勤労感謝の日
  const nthMonday = (m, n) => {
    const first = new Date(year, m - 1, 1);
    const day = first.getDay();
    const d = 1 + (n - 1) * 7 + (8 - day) % 7;
    return `${year}-${pad(m)}-${pad(d)}`;
  };
  set.add(nthMonday(1, 2));  // 成人の日（1月第2月曜）
  set.add(nthMonday(7, 3));  // 海の日（7月第3月曜）
  set.add(nthMonday(9, 3));  // 敬老の日（9月第3月曜）
  set.add(nthMonday(10, 2)); // スポーツの日（10月第2月曜）
  const vernal = year <= 2099 ? Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)) : 20;
  const autumnal = year <= 2099 ? Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)) : 23;
  set.add(`${year}-03-${pad(vernal)}`);  // 春分の日
  set.add(`${year}-09-${pad(autumnal)}`); // 秋分の日
  return set;
}

const CALENDAR_ROWS = 6;
const CALENDAR_CELLS = 7 * CALENDAR_ROWS; // 42

function getMonthDays(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days = [];
  const startPad = first.getDay();
  for (let i = 0; i < startPad; i++) {
    days.push(null);
  }
  const pad = (n) => String(n).padStart(2, '0');
  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(year, month, d);
    const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
    days.push({
      dateStr,
      day: d,
      dayOfWeek: date.getDay()
    });
  }
  while (days.length < CALENDAR_CELLS) {
    days.push(null);
  }
  return days;
}

export default function MainMenu({ onNavigate }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [comments, setComments] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [editComment, setEditComment] = useState('');
  const [monthlyComments, setMonthlyComments] = useState({});
  const editCommentRef = useRef('');
  const commentsRef = useRef({});
  const textareaRef = useRef(null);
  const restoreInputRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setComments(parsed);
        commentsRef.current = parsed;
      }
      const savedMonthly = localStorage.getItem(STORAGE_KEY_MONTHLY);
      if (savedMonthly) setMonthlyComments(JSON.parse(savedMonthly));
    } catch (_) {}
  }, []);

  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  const days = getMonthDays(year, month);
  const weekLabels = ['日', '月', '火', '水', '木', '金', '土'];
  const holidays = getHolidays(year);

  const openComment = (dateStr) => {
    setSelectedDate(dateStr);
    const text = comments[dateStr] || '';
    setEditComment(text);
    editCommentRef.current = text;
  };

  const handleEditChange = (e) => {
    const v = e.target.value;
    setEditComment(v);
    editCommentRef.current = v;
  };

  const closeComment = (overrideValue) => {
    const dateToSave = selectedDate;
    if (dateToSave === null) {
      setSelectedDate(null);
      setEditComment('');
      editCommentRef.current = '';
      return;
    }
    // 保存するテキスト: 引数 > textarea DOM > ref
    let value = overrideValue;
    if (value === undefined && textareaRef.current) {
      value = textareaRef.current.value;
    }
    if (value === undefined) value = editCommentRef.current;
    const trimmed = typeof value === 'string' ? String(value).trim() : '';
    // 保存時は必ず localStorage から現在値を読んでマージ（state に依存しない）
    let prev = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) prev = JSON.parse(raw);
    } catch (_) {}
    const next = trimmed
      ? { ...prev, [dateToSave]: trimmed }
      : (() => {
          const n = { ...prev };
          delete n[dateToSave];
          return n;
        })();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (_) {}
    setComments(next);
    setSelectedDate(null);
    setEditComment('');
    editCommentRef.current = '';
  };

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthlyComment = monthlyComments[monthKey] || '';

  const saveMonthlyComment = (value) => {
    const next = { ...monthlyComments, [monthKey]: value };
    setMonthlyComments(next);
    localStorage.setItem(STORAGE_KEY_MONTHLY, JSON.stringify(next));
  };

  const changeMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m += 12;
      y -= 1;
    } else if (m > 11) {
      m -= 12;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex p-5 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-0 w-full max-w-6xl mx-auto flex-1 min-h-0">
        {/* 左：ボタン / 右：カレンダー */}
        <div className="flex gap-6 w-full items-stretch flex-1 min-h-0">
          <div className="shrink-0 w-[260px] flex flex-col min-h-0">
            <div className="flex-1 flex flex-col gap-2 min-h-0">
              <MenuButton compact className="flex-1 min-h-0" icon="📝" title="職員情報入力" detail="職員の登録・編集・管理" onClick={() => onNavigate('staff-db')} accent="violet" />
              <MenuButton compact className="flex-1 min-h-0" icon="⚙️" title="モダリティ情報入力" detail="モダリティの設定・追加" onClick={() => onNavigate('modality-db')} accent="cyan" />
              <MenuButton compact className="flex-1 min-h-0" icon="🏖️" title="休暇・出張管理" detail="休暇・出張の入力・管理" onClick={() => onNavigate('leave-input')} accent="rose" />
              <MenuButton compact className="flex-1 min-h-0" icon="🗓️" title="当番表作成" detail="夜勤・日勤・週休の作成" onClick={() => onNavigate('shift-schedule')} accent="amber" />
              <MenuButton compact className="flex-1 min-h-0" icon="📊" title="配置表作成" detail="自動配置の作成" onClick={() => onNavigate('allocation')} accent="indigo" />
              <MenuButton compact className="flex-1 min-h-0" icon="📜" title="ルール確認" detail="配置ルールの確認" onClick={() => onNavigate('rules')} accent="emerald" />
              <input
                ref={restoreInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) restoreFromBackup(f);
                  e.target.value = '';
                }}
              />
              <div className="mt-2 flex flex-col gap-2 shrink-0">
                <button
                  type="button"
                  onClick={downloadBackup}
                  className="px-4 py-2.5 bg-slate-700/80 hover:bg-slate-600 border border-slate-600 rounded-xl text-slate-200 text-sm font-medium transition-all flex items-center justify-center gap-2"
                >
                  📦 すべての入力情報をバックアップ
                </button>
                <button
                  type="button"
                  onClick={() => restoreInputRef.current?.click()}
                  className="px-4 py-2.5 bg-slate-600/80 hover:bg-slate-500 border border-slate-500 rounded-xl text-slate-200 text-sm font-medium transition-all flex items-center justify-center gap-2"
                >
                  📥 バックアップから復元
                </button>
              </div>
            </div>
          </div>

          {/* カレンダー（職員DBボタン上端と揃う） */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="bg-slate-900/40 backdrop-blur-sm rounded-2xl border border-slate-800 p-6 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-center gap-4 mb-4 shrink-0">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="p-2 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 text-slate-300 hover:text-white transition-all shrink-0"
                aria-label="前月"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-2xl font-bold text-white min-w-[140px] text-center">
                {year}年 {month + 1}月
              </h2>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="p-2 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 text-slate-300 hover:text-white transition-all shrink-0"
                aria-label="次月"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {weekLabels.map((label, i) => (
                <div
                  key={label}
                  className={`text-center text-sm font-semibold py-2 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'}`}
                >
                  {label}
                </div>
              ))}
              {days.map((cell, idx) => {
                if (!cell) {
                  return <div key={`empty-${idx}`} className="min-h-[88px]" />;
                }
                const comment = comments[cell.dateStr];
                const isSun = cell.dayOfWeek === 0;
                const isSat = cell.dayOfWeek === 6;
                const isHoliday = holidays.has(cell.dateStr);
                const dayColor = isHoliday || isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-white';
                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => openComment(cell.dateStr)}
                    className={`min-h-[88px] p-2.5 rounded-lg border border-slate-700/50 hover:border-violet-500/50 hover:bg-slate-800/50 text-left transition-all flex flex-col ${isSun || isSat ? 'bg-slate-800/20' : 'bg-slate-800/10'}`}
                  >
                    <span className={`text-base font-bold ${dayColor} shrink-0`}>
                      {cell.day}
                    </span>
                    {comment ? (
                      <span className="mt-1.5 text-[11px] text-slate-300 leading-tight break-words line-clamp-2 block min-h-[2rem]">
                        {comment}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <p className="text-slate-500 text-xs mt-3 shrink-0">日付をクリックでコメントを追加・編集</p>

            <div className="mt-4 flex-1 flex flex-col min-h-0">
              <label className="block text-slate-400 text-sm font-semibold mb-2 shrink-0">{year}年{month + 1}月のメモ</label>
              <textarea
                value={monthlyComment}
                onChange={(e) => saveMonthlyComment(e.target.value)}
                placeholder="月ごとの自由メモ..."
                className="w-full flex-1 min-h-[120px] p-3 bg-slate-800/50 border-2 border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-violet-500/50 outline-none resize-none text-sm"
              />
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* コメント編集モーダル */}
      {selectedDate !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-white text-lg">{selectedDate} のコメント</h3>
              <button
                type="button"
                onClick={() => closeComment('')}
                className="text-slate-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                closeComment();
              }}
            >
              <textarea
                ref={textareaRef}
                value={editComment}
                onChange={handleEditChange}
                placeholder="メモを入力..."
                className="w-full p-3 bg-slate-800 border-2 border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-violet-500 outline-none resize-y min-h-[120px]"
                rows={4}
              />
              <div className="flex gap-2 mt-4">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold transition-all"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => closeComment('')}
                  className="py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-medium transition-all"
                >
                  クリア
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
