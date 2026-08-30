import React, { useState, useEffect, useRef } from 'react';
import MenuButton from '../components/MenuButton';
import { useData } from '../context/DataContext';
import { getHolidays } from '../utils/holidays';
import { getWeeklyOffIds } from '../utils/weeklyOff';
import {
  getLeaveData,
  setLeaveData as persistLeaveData,
  getCalendarComments,
  setCalendarComments as persistCalendarComments,
  getMonthlyComments,
  setMonthlyComments as persistMonthlyComments,
  getAllocationData,
  getScheduleData,
  getModalityData,
  getStaffData,
} from '../utils/storage';

const LEAVE_TYPES = ['週休', '年休', 'リフ休', '特別休', '出張'];

const CALENDAR_ROWS = 6;
const CALENDAR_CELLS = 7 * CALENDAR_ROWS;

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
  const { backupAll, backupStaffModality, restoreBackup, resetAllData } = useData();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [comments, setComments] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [editComment, setEditComment] = useState('');
  const [monthlyComments, setMonthlyComments] = useState({});
  const [leaveData, setLeaveData] = useState({});
  const [showAddLeaveForm, setShowAddLeaveForm] = useState(false);
  const [addLeaveStaff, setAddLeaveStaff] = useState('');
  const [addLeaveType, setAddLeaveType] = useState('');
  const editCommentRef = useRef('');
  const commentsRef = useRef({});
  const textareaRef = useRef(null);
  const restoreInputRef = useRef(null);

  useEffect(() => {
    setLeaveData(getLeaveData());
  }, []);

  useEffect(() => {
    if (selectedDate === null) return;
    setLeaveData(getLeaveData());
  }, [selectedDate]);

  const saveLeaveData = (next) => {
    try {
      persistLeaveData(next);
    } catch (_) {}
  };

  const addLeaveForDate = (dateStr, staffId, leaveType) => {
    const next = { ...leaveData };
    if (!next[dateStr]) next[dateStr] = [];
    if (next[dateStr].some((item) => item.staffId === staffId)) return;
    next[dateStr] = [...next[dateStr], { staffId, leaveType }];
    setLeaveData(next);
    saveLeaveData(next);
  };

  const removeLeaveForDate = (dateStr, staffId) => {
    if (!confirm('削除しますか？')) return;
    const next = { ...leaveData };
    next[dateStr] = (next[dateStr] || []).filter((item) => item.staffId !== staffId);
    if (next[dateStr].length === 0) delete next[dateStr];
    setLeaveData(next);
    saveLeaveData(next);
  };

  const updateLeaveTypeForDate = (dateStr, staffId, newLeaveType) => {
    const next = { ...leaveData };
    if (!next[dateStr]) return;
    const idx = next[dateStr].findIndex((item) => item.staffId === staffId);
    if (idx === -1) return;
    next[dateStr] = [...next[dateStr]];
    next[dateStr][idx] = { ...next[dateStr][idx], leaveType: newLeaveType };
    setLeaveData(next);
    saveLeaveData(next);
  };

  useEffect(() => {
    const parsed = getCalendarComments();
    setComments(parsed);
    commentsRef.current = parsed;
    setMonthlyComments(getMonthlyComments());
  }, []);

  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  const days = getMonthDays(year, month);
  const weekLabels = ['日', '月', '火', '水', '木', '金', '土'];
  const holidays = getHolidays(year);

  const formatDateHeader = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    return `${mm}/${dd} ${w}`;
  };

  /** 配置表を画像と同じ形式（夜勤・B → モダリティ → 日勤・サポート → 休暇者）で描画 */
  const renderAllocationTable = (dateStr, allocation, modalityData, staffData, name, manualStaff, scheduleRow, leaveInfo) => {
    const dayAlloc = dateStr && allocation[dateStr] ? allocation[dateStr] : null;
    const hasAllocation = !!dayAlloc;
    const renderScheduleRow = (label, staffId) => (
      <tr key={label} className="border-b border-stone-200 hover:bg-slate-50/50">
        <td className="py-2 px-3 font-semibold text-stone-700 bg-slate-50/80">{label}</td>
        <td className="py-2 px-3 align-top border-l-2 border-stone-200 text-stone-800">{staffId ? name(staffId) : '－'}</td>
        <td className="py-2 px-3 align-top border-l border-stone-200 text-stone-800">{staffId ? name(staffId) : '－'}</td>
      </tr>
    );

    const leaveLines = leaveInfo ? (() => {
      const parts = [];
      if (leaveInfo.dayOffId) parts.push(`非番：${name(leaveInfo.dayOffId)}`);
      const woIds = leaveInfo.weeklyOffIds || [];
      const leave週休 = (leaveInfo.dayLeaves || []).filter(l => l.leaveType === '週休').map(l => l.staffId);
      const 週休Ids = [...new Set([...woIds, ...leave週休])];
      if (週休Ids.length) parts.push(`週休：${週休Ids.map(name).join('、')}`);
      ['出張', 'リフ休', '年休', '特別休'].forEach(t => {
        const byType = (leaveInfo.dayLeaves || []).filter(l => l.leaveType === t).map(l => name(l.staffId));
        if (byType.length) parts.push(`${t}：${byType.join('、')}`);
      });
      return parts;
    })() : [];

    return (
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b-2 border-stone-400">
            <th className="py-2.5 px-3 font-bold text-stone-800 bg-slate-100 w-[140px]">モダリティ</th>
            <th className="py-2.5 px-3 font-bold text-stone-800 bg-slate-100 border-l-2 border-stone-300">{formatDateHeader(dateStr)} AM</th>
            <th className="py-2.5 px-3 font-bold text-stone-800 bg-slate-100 border-l border-stone-300">{formatDateHeader(dateStr)} PM</th>
          </tr>
        </thead>
        <tbody>
          {hasAllocation && modalityData.map((mod) => {
            const slot = dayAlloc[mod.id];
            const am = Array.isArray(slot) ? [] : (slot?.am || []);
            const pm = Array.isArray(slot) ? [] : (slot?.pm || []);
            const amSorted = [...am].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
            const pmSorted = [...pm].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
            return (
              <tr key={mod.id} className="border-b border-stone-200 hover:bg-slate-50/50">
                <td className="py-2 px-3 font-semibold text-stone-700 bg-slate-50/80">{mod.name}</td>
                <td className="py-2 px-3 align-top border-l-2 border-stone-200 text-stone-800">
                  <div className="flex flex-col gap-0.5">
                    {amSorted.length ? amSorted.map((id) => (
                      <span key={id} className={manualStaff.includes(id) ? 'text-red-600 font-medium' : ''}>{name(id)}</span>
                    )) : '－'}
                  </div>
                </td>
                <td className="py-2 px-3 align-top border-l border-stone-200 text-stone-800">
                  <div className="flex flex-col gap-0.5">
                    {pmSorted.length ? pmSorted.map((id) => (
                      <span key={id} className={manualStaff.includes(id) ? 'text-red-600 font-medium' : ''}>{name(id)}</span>
                    )) : '－'}
                  </div>
                </td>
              </tr>
            );
          })}
          {!hasAllocation && (
            <tr>
              <td colSpan={3} className="py-3 px-3 text-stone-600 text-sm">この日のモダリティ配置データがありません。配置表作成で作成・保存してください。</td>
            </tr>
          )}
          {scheduleRow && (
            <>
              {renderScheduleRow('日勤者', scheduleRow.dayShift)}
              {renderScheduleRow('サポート', scheduleRow.support)}
              {renderScheduleRow('夜勤者', scheduleRow.nightShift)}
              {renderScheduleRow('B', scheduleRow.b)}
            </>
          )}
          <tr className="border-b border-stone-200 hover:bg-slate-50/50">
            <td className="py-2 px-3 font-semibold text-stone-700 bg-slate-50/80">休暇者</td>
            <td colSpan={2} className="py-2 px-3 align-top border-l-2 border-stone-200 text-stone-800">
              {leaveLines.length ? (
                <div className="flex flex-col gap-0.5">
                  {leaveLines.map((line, i) => (<span key={i}>{line}</span>))}
                </div>
              ) : '－'}
            </td>
          </tr>
        </tbody>
      </table>
    );
  };

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
    setShowAddLeaveForm(false);
    setAddLeaveStaff('');
    setAddLeaveType('');
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
    const prev = getCalendarComments();
    const next = trimmed
      ? { ...prev, [dateToSave]: trimmed }
      : (() => {
          const n = { ...prev };
          delete n[dateToSave];
          return n;
        })();
    try {
      persistCalendarComments(next);
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
    persistMonthlyComments(next);
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
    <div className="min-h-screen bg-violet-400 flex p-5 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-violet-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-200/30 rounded-full blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-0 w-full max-w-6xl mx-auto flex-1 min-h-0">
        {/* 左：ボタン / 右：カレンダー */}
        <div className="flex gap-6 w-full items-stretch flex-1 min-h-0">
          <div className="relative z-10 shrink-0 w-[420px] flex flex-col min-h-0 bg-slate-50 rounded-2xl border-2 border-slate-400 shadow-sm p-1.5">
            <div className="flex-1 flex flex-col gap-1 min-h-0 min-w-0 overflow-y-auto">
              <MenuButton compact className="shrink-0 min-h-[52px]" icon="📝" title="職員情報登録" detail="職員の登録・編集、各モダリティの配置スコア（0〜4）を設定" onClick={() => onNavigate('staff-db')} accent="violet" />
              <MenuButton compact className="shrink-0 min-h-[52px]" icon="⚙️" title="モダリティ情報入力" detail="配置先モダリティの追加、必要人数（一律または曜日別）の設定" onClick={() => onNavigate('modality-db')} accent="cyan" />
              <MenuButton compact className="shrink-0 min-h-[52px]" icon="🏖️" title="休暇・出張入力" detail="休暇・出張の日付と職員を登録し、カレンダーに反映" onClick={() => onNavigate('leave-input')} accent="rose" />
              <MenuButton compact className="shrink-0 min-h-[52px]" icon="🗓️" title="当番表・配置表作成" detail="期間設定、当番表の作成・週休割当のあと、その下で配置表を自動作成・保存" onClick={() => onNavigate('shift-schedule')} onPointerDown={() => onNavigate('shift-schedule')} accent="amber" />
              <MenuButton compact className="shrink-0 min-h-[52px]" icon="📜" title="ルール" detail="使い方の流れ、配置スコア・配置対象外・自動配置のルール確認" onClick={() => onNavigate('rules')} accent="emerald" />
              <input
                ref={restoreInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    try {
                      await restoreBackup(f);
                    } catch (err) {
                      const msg = (err && (err.message || String(err))) || '不明なエラー';
                      alert(`バックアップファイルの復元に失敗しました。\n\n${msg}`);
                    }
                  }
                  e.target.value = '';
                }}
              />
              <div className="mt-1.5 pt-1.5 border-t-2 border-slate-300 shrink-0">
                <p className="text-xs font-bold text-stone-600 uppercase tracking-wider mb-1 px-0.5">データのバックアップ</p>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => { try { backupAll(); alert('バックアップをダウンロードしました'); } catch (_) { alert('バックアップの作成に失敗しました'); } }}
                    className="pl-3 pr-3 py-1.5 bg-amber-50 hover:bg-amber-100 border-2 border-amber-400 rounded-xl text-amber-900 font-semibold text-base transition-all flex items-center gap-2 text-left w-full leading-tight"
                  >
                    <span className="shrink-0 text-lg">📦</span>
                    <span>今のデータをファイルに保存</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { try { backupStaffModality(); alert('職員・モダリティのバックアップをダウンロードしました'); } catch (_) { alert('バックアップの作成に失敗しました'); } }}
                    className="pl-3 pr-3 py-1.5 bg-teal-50 hover:bg-teal-100 border-2 border-teal-400 rounded-xl text-teal-900 font-semibold text-base transition-all flex items-center gap-2 text-left w-full leading-tight"
                  >
                    <span className="shrink-0 text-lg">👥</span>
                    <span>職員・モダリティのみバックアップ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => restoreInputRef.current?.click()}
                    className="pl-3 pr-3 py-1.5 bg-violet-50 hover:bg-violet-100 border-2 border-violet-400 rounded-xl text-violet-900 font-semibold text-base transition-all flex items-center gap-2 text-left w-full leading-tight"
                  >
                    <span className="shrink-0 text-lg">📥</span>
                    <span>ファイルからデータを復元</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const msg = 'すべてのデータ（職員・モダリティ・当番表・休暇・配置表・カレンダーコメント）を削除してリセットします。\n元に戻せません。よろしいですか？';
                      if (!window.confirm(msg)) return;
                      try {
                        resetAllData();
                        alert('データをリセットしました。画面を再読み込みします。');
                      } catch (_) {
                        alert('リセットに失敗しました');
                      }
                    }}
                    className="pl-3 pr-3 py-1.5 bg-rose-50 hover:bg-rose-100 border-2 border-rose-400 rounded-xl text-rose-800 font-semibold text-base transition-all flex items-center gap-2 text-left w-full leading-tight"
                  >
                    <span className="shrink-0 text-lg">🗑️</span>
                    <span>全データをリセット</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 右：カレンダー（日付クリックでその日の配置表＋コメントをモーダル表示） */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="bg-slate-50/95 backdrop-blur-sm rounded-2xl border-2 border-slate-400 shadow-sm p-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-center gap-3 mb-3 shrink-0">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border-2 border-slate-400 text-stone-600 hover:text-stone-800 transition-all shrink-0"
                aria-label="前月"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-xl font-bold text-stone-900 min-w-[120px] text-center">
                {year}年 {month + 1}月
              </h2>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border-2 border-slate-400 text-stone-600 hover:text-stone-800 transition-all shrink-0"
                aria-label="次月"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-7 gap-2 flex-1 min-h-0 auto-rows-fr">
              {weekLabels.map((label, i) => (
                <div
                  key={label}
                  className={`text-center text-sm font-semibold py-1 ${i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-700' : 'text-stone-600'}`}
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
                const dayColor = isHoliday || isSun ? 'text-red-700' : isSat ? 'text-blue-700' : 'text-stone-900';
                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => openComment(cell.dateStr)}
                    className={`min-h-[88px] p-2 rounded-lg border-2 border-slate-400 hover:border-violet-500 hover:bg-violet-50/50 text-left transition-all flex flex-col ${isSun || isSat ? 'bg-slate-100' : 'bg-slate-50/50'}`}
                  >
                    <span className={`text-lg font-bold ${dayColor} shrink-0`}>
                      {cell.day}
                    </span>
                    {comment ? (
                      <span className="mt-0.5 text-xs text-stone-700 leading-tight break-words line-clamp-2 block font-medium">
                        {comment}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <p className="text-stone-700 text-sm mt-2 shrink-0 font-medium">日付をクリックでコメントを追加・編集</p>

            <div className="mt-2 shrink-0">
              <label className="block text-stone-800 text-sm font-semibold mb-1 shrink-0">{year}年{month + 1}月のメモ</label>
              <textarea
                value={monthlyComment}
                onChange={(e) => saveMonthlyComment(e.target.value)}
                placeholder="月ごとの自由メモ..."
                className="w-full min-h-[52px] max-h-[80px] p-2 bg-slate-50 border-2 border-slate-400 rounded-lg text-stone-900 placeholder-stone-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none resize-y text-sm font-medium"
              />
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* 日付クリック時モーダル（その日の配置表 + コメント） */}
      {selectedDate !== null && (() => {
        const dateStr = selectedDate;
        const allocationData = getAllocationData();
        const scheduleData = getScheduleData();
        const modalityData = getModalityData();
        const staffData = getStaffData();
        const schedule = scheduleData?.schedule || {};
        const manualOverrides = scheduleData?.manualOverrides || {};
        const weeklyOff = scheduleData?.weeklyOff || {};
        const surgeryDays = scheduleData?.surgeryDays || [];
        const dayLeavesList = leaveData[dateStr] || [];
        const allocation = allocationData?.allocation || {};
        const mergeSched = (d) => {
          const s = schedule[d] || {};
          const o = manualOverrides[d] || {};
          return { ...s, ...o };
        };
        const name = (id) => (id ? (staffData.find(s => s.id === id)?.name || id) : '');
        const daySched = mergeSched(dateStr);
        const nextDate = (() => {
          const d = new Date(dateStr + 'T12:00:00');
          d.setDate(d.getDate() + 1);
          const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        })();
        const nextSched = mergeSched(nextDate);
        const bPerson = surgeryDays.includes(dateStr) ? (nextSched.nightShift ?? nextSched.nightShiftManual) : (daySched.b ?? daySched.bManual);
        const scheduleRow = {
          dayShift: daySched.dayShift ?? daySched.dayShiftManual,
          support: daySched.support ?? daySched.supportManual,
          nightShift: daySched.nightShift ?? daySched.nightShiftManual,
          b: bPerson
        };
        const leaveInfo = {
          dayOffId: daySched.dayOff ?? daySched.dayOffManual,
          weeklyOffIds: getWeeklyOffIds(weeklyOff, dateStr),
          dayLeaves: dayLeavesList
        };
        const manualStaff = allocation[dateStr]?._manualStaff || [];

        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-stone-50 border-2 border-stone-300 rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
              <div className="flex justify-between items-center mb-3 shrink-0">
                <h3 className="font-bold text-stone-800 text-lg">{dateStr}</h3>
                <button
                  type="button"
                  onClick={() => closeComment('')}
                  className="text-stone-400 hover:text-stone-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
                {/* 左：その日の配置表（画像と同じ形式・モダリティ×AM/PM） */}
                <div className="flex-1 min-w-0 overflow-y-auto border border-slate-300 rounded-xl bg-white p-3">
                  {renderAllocationTable(dateStr, allocation, modalityData, staffData, name, manualStaff, scheduleRow, leaveInfo)}
                </div>

                {/* 右：コメント ＋ 休暇・出張 */}
                <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-hidden">
                  <form
                    className="flex flex-col min-h-0 border border-slate-300 rounded-xl bg-white p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      closeComment();
                    }}
                  >
                    <label className="text-stone-700 font-semibold text-sm mb-2 shrink-0">コメント・メモ</label>
                    <textarea
                      ref={textareaRef}
                      value={editComment}
                      onChange={handleEditChange}
                      placeholder="メモを入力..."
                      className="w-full flex-1 min-h-[100px] p-3 bg-slate-50 border-2 border-slate-400 rounded-xl text-stone-900 text-base font-medium placeholder-stone-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none resize-none"
                    />
                    <div className="flex gap-2 mt-3 shrink-0">
                      <button
                        type="submit"
                        className="btn-add flex-1 py-2.5 rounded-xl text-lg font-semibold"
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        onClick={() => closeComment('')}
                        className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-lg font-medium transition-all"
                      >
                        クリア
                      </button>
                    </div>
                  </form>

                  <div className="flex flex-col min-h-0 border border-slate-300 rounded-xl bg-white p-3 shrink-0">
                    <label className="text-stone-700 font-semibold text-sm mb-2 shrink-0">休暇・出張</label>
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-2 mb-3">
                      {dayLeavesList.length === 0 ? (
                        <p className="text-stone-500 text-sm">この日は登録がありません</p>
                      ) : (
                        dayLeavesList.map((leave, leaveIdx) => {
                          const staff = staffData.find((s) => s.id === leave.staffId);
                          return (
                            <div key={leaveIdx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                              <span className="font-medium text-stone-800 text-sm min-w-[100px] truncate">{staff?.name || leave.staffId}</span>
                              <select
                                value={leave.leaveType}
                                onChange={(e) => updateLeaveTypeForDate(dateStr, leave.staffId, e.target.value)}
                                className="flex-1 min-w-0 p-1.5 text-sm bg-white border border-slate-400 rounded-lg text-stone-800 focus:border-rose-400 outline-none"
                              >
                                {LEAVE_TYPES.map((type) => (
                                  <option key={type} value={type}>{type}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => removeLeaveForDate(dateStr, leave.staffId)}
                                className="shrink-0 px-2 py-1 text-sm rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-medium"
                              >
                                削除
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                    {showAddLeaveForm ? (
                      <div className="space-y-2 p-2 bg-rose-50/50 rounded-lg border border-rose-200">
                        <div className="flex gap-2 flex-wrap items-center">
                          <select
                            value={addLeaveStaff}
                            onChange={(e) => setAddLeaveStaff(e.target.value)}
                            className="flex-1 min-w-[120px] p-2 text-sm bg-white border-2 border-slate-400 rounded-lg text-stone-800 focus:border-rose-400 outline-none"
                          >
                            <option value="">職員を選択</option>
                            {staffData.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <select
                            value={addLeaveType}
                            onChange={(e) => setAddLeaveType(e.target.value)}
                            className="flex-1 min-w-[100px] p-2 text-sm bg-white border-2 border-slate-400 rounded-lg text-stone-800 focus:border-rose-400 outline-none"
                          >
                            <option value="">種類</option>
                            {LEAVE_TYPES.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (addLeaveStaff && addLeaveType) {
                                addLeaveForDate(dateStr, addLeaveStaff, addLeaveType);
                                setAddLeaveStaff('');
                                setAddLeaveType('');
                                setShowAddLeaveForm(false);
                              } else {
                                alert('⚠️ 職員と種類を選択してください');
                              }
                            }}
                            className="btn-add flex-1 text-sm py-2"
                          >
                            登録
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowAddLeaveForm(false); setAddLeaveStaff(''); setAddLeaveType(''); }}
                            className="btn-panel bg-white border-2 border-slate-600 text-stone-800 text-sm py-2"
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowAddLeaveForm(true)}
                        className="btn-add w-full text-sm py-2"
                      >
                        ＋ この日に追加
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
