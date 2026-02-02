import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useData } from '../context/DataContext';

const leaveTypes = ['週休', '年休', 'リフ休', '特別休', '出張'];

/** 日本の祝日（指定年の祝日日付を YYYY-MM-DD の Set で返す） */
function getHolidays(year) {
  const pad = (n) => String(n).padStart(2, '0');
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
  const nthMonday = (m, n) => {
    const first = new Date(year, m - 1, 1);
    const day = first.getDay();
    const d = 1 + (n - 1) * 7 + (8 - day) % 7;
    return `${year}-${pad(m)}-${pad(d)}`;
  };
  set.add(nthMonday(1, 2));
  set.add(nthMonday(7, 3));
  set.add(nthMonday(9, 3));
  set.add(nthMonday(10, 2));
  const vernal = year <= 2099 ? Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)) : 20;
  const autumnal = year <= 2099 ? Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)) : 23;
  set.add(`${year}-03-${pad(vernal)}`);
  set.add(`${year}-09-${pad(autumnal)}`);
  return set;
}

const CALENDAR_ROWS = 6;
const CALENDAR_CELLS = 7 * CALENDAR_ROWS;

function generateMonthCalendar(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const pad = (n) => String(n).padStart(2, '0');
  const days = [];
  const startPad = first.getDay();
  for (let i = 0; i < startPad; i++) {
    days.push(null);
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const currentDate = new Date(year, month, d);
    const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
    const dayOfWeek = currentDate.getDay();
    days.push({
      date: dateStr,
      day: d,
      dayOfWeek: ['日', '月', '火', '水', '木', '金', '土'][dayOfWeek],
      dayOfWeekNum: dayOfWeek,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6
    });
  }
  while (days.length < CALENDAR_CELLS) {
    days.push(null);
  }
  return days;
}

export default function LeaveInputScreen({ onBack }) {
  const { staffData } = useData();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [leaveData, setLeaveData] = useState({});
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedLeaveType, setSelectedLeaveType] = useState('');

  const monthCalendar = generateMonthCalendar(currentMonth);
  const holidays = getHolidays(currentMonth.getFullYear());

  useEffect(() => {
    const saved = localStorage.getItem('leaveData');
    if (saved) {
      const data = JSON.parse(saved);
      setLeaveData(data.leaveData || {});
    }
  }, []);

  const handleDateMouseDown = (date) => {
    setIsSelecting(true);
    setSelectedDates([date]);
  };

  const handleDateMouseEnter = (date) => {
    if (isSelecting && selectedDates.length > 0) {
      const start = selectedDates[0];
      const allDates = monthCalendar.map(d => d.date);
      const startIdx = allDates.indexOf(start);
      const endIdx = allDates.indexOf(date);
      const minIdx = Math.min(startIdx, endIdx);
      const maxIdx = Math.max(startIdx, endIdx);
      setSelectedDates(allDates.slice(minIdx, maxIdx + 1));
    }
  };

  const handleDateMouseUp = () => {
    if (selectedDates.length > 0) {
      setIsSelecting(false);
      setShowLeaveModal(true);
    }
  };

  const addLeave = () => {
    if (!selectedStaff || !selectedLeaveType) {
      alert('⚠️ 職員と種類を選択してください');
      return;
    }
    const newLeaveData = { ...leaveData };
    selectedDates.forEach(date => {
      if (!newLeaveData[date]) newLeaveData[date] = [];
      const exists = newLeaveData[date].some(item => item.staffId === selectedStaff);
      if (!exists) newLeaveData[date].push({ staffId: selectedStaff, leaveType: selectedLeaveType });
    });
    setLeaveData(newLeaveData);
    setShowLeaveModal(false);
    setSelectedDates([]);
    setSelectedStaff('');
    setSelectedLeaveType('');
    alert('✅ 登録しました');
  };

  const removeLeave = (date, staffId) => {
    if (!confirm('削除しますか？')) return;
    const newLeaveData = { ...leaveData };
    newLeaveData[date] = newLeaveData[date].filter(item => item.staffId !== staffId);
    if (newLeaveData[date].length === 0) delete newLeaveData[date];
    setLeaveData(newLeaveData);
    alert('✅ 削除しました');
  };

  const leaveDataLoaded = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => { leaveDataLoaded.current = true; }, 200);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!leaveDataLoaded.current) return;
    localStorage.setItem('leaveData', JSON.stringify({ leaveData }));
  }, [leaveData]);

  const changeMonth = (offset) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentMonth(newDate);
  };

  /** 週休・リフ休のみの職員別日数 { staffId: { 週休: n, リフ休: n } } */
  const staffLeaveCounts = useMemo(() => {
    const counts = {};
    Object.values(leaveData).forEach(leaves => {
      leaves.forEach(({ staffId, leaveType }) => {
        if (leaveType !== '週休' && leaveType !== 'リフ休') return;
        if (!counts[staffId]) counts[staffId] = { 週休: 0, リフ休: 0 };
        counts[staffId][leaveType]++;
      });
    });
    return counts;
  }, [leaveData]);

  const staffListWithCounts = useMemo(() => {
    const ids = Object.keys(staffLeaveCounts);
    return staffData
      .filter(s => ids.includes(s.id))
      .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }))
      .map(s => ({ staff: s, 週休: staffLeaveCounts[s.id].週休, リフ休: staffLeaveCounts[s.id].リフ休 }));
  }, [staffData, staffLeaveCounts]);

  return (
    <div className="min-h-screen bg-violet-400 p-5 relative overflow-hidden">
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-rose-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-full">
        <div className="flex justify-between items-center gap-4 mb-4">
          <h2 className="text-3xl font-bold text-stone-800">休暇・出張管理</h2>
          <button onClick={onBack} className="px-5 py-2.5 bg-stone-50 hover:bg-slate-100 border-2 border-slate-400 rounded-xl text-stone-800 text-lg font-semibold transition-all shadow-sm">
            ← メインメニュー
          </button>
        </div>

        <div className="flex gap-6 items-start">
          {/* 左: 職員一覧（週休・リフ休の日数） */}
          <div className="w-[520px] shrink-0 flex flex-col">
            <div className="bg-slate-50 rounded-xl border-2 border-slate-400 p-4 shadow-md">
              <h3 className="text-xl font-bold text-stone-800 mb-4">職員一覧（週休・リフ休）</h3>
              {staffListWithCounts.length === 0 ? (
                <p className="text-stone-600 text-base">休暇を登録した職員がいません</p>
              ) : (
                <div className="space-y-2.5 overflow-y-auto max-h-[70vh] pr-1">
                  {staffListWithCounts.map(({ staff, 週休, リフ休 }) => (
                    <div key={staff.id} className="bg-white rounded-lg border border-slate-300 p-3 text-base flex items-center justify-between gap-3">
                      <span className="font-semibold text-stone-900 truncate min-w-0">{staff.name}</span>
                      <div className="flex gap-4 shrink-0 text-stone-700 font-medium">
                        <span>週休 <strong className="text-stone-900">{週休}</strong>日</span>
                        <span>リフ休 <strong className="text-stone-900">{リフ休}</strong>日</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右: カレンダー（左寄せ・マス左右を小さく） */}
          <div className="flex-1 min-w-0 flex flex-col items-start">
            <div className="bg-slate-50/95 backdrop-blur-sm rounded-2xl border-2 border-slate-400 p-6 shadow-sm w-full max-w-[960px]">
              <div className="flex items-center justify-center gap-4 mb-4 shrink-0">
                <button
                  type="button"
                  onClick={() => changeMonth(-1)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border-2 border-slate-400 text-stone-600 hover:text-stone-800 transition-all shrink-0"
                  aria-label="前月"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-2xl font-bold text-stone-900 min-w-[140px] text-center">
                  {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月
                </h2>
                <button
                  type="button"
                  onClick={() => changeMonth(1)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border-2 border-slate-400 text-stone-600 hover:text-stone-800 transition-all shrink-0"
                  aria-label="次月"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-7 gap-2" onMouseUp={handleDateMouseUp} onMouseLeave={() => setIsSelecting(false)}>
                {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
                  <div
                    key={day}
                    className={`text-center text-base font-semibold py-2 ${i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-700' : 'text-stone-600'}`}
                  >
                    {day}
                  </div>
                ))}
                {monthCalendar.map((day, idx) => {
                  if (!day) {
                    return <div key={`empty-${idx}`} className="min-h-[88px]" />;
                  }
                  const isSelected = selectedDates.includes(day.date);
                  const dayLeaves = leaveData[day.date] || [];
                  const colorMap = { '週休': 'bg-violet-100 text-violet-800', '年休': 'bg-emerald-100 text-emerald-800', 'リフ休': 'bg-purple-100 text-purple-800', '特別休': 'bg-amber-100 text-amber-800', '出張': 'bg-pink-100 text-pink-800' };
                  const isSun = day.dayOfWeekNum === 0;
                  const isHoliday = holidays.has(day.date);
                  const dateColor = isSun || isHoliday ? 'text-red-700' : day.dayOfWeekNum === 6 ? 'text-blue-700' : 'text-stone-900';
                  const cellBg = isSelected ? 'bg-rose-100 border-rose-400 hover:border-rose-500' : day.isWeekend ? 'bg-slate-100 border-slate-400 hover:border-slate-500' : 'bg-slate-50/50 border-slate-400 hover:border-rose-400 hover:bg-rose-50/50';
                  return (
                    <div
                      key={day.date}
                      role="button"
                      tabIndex={0}
                      onMouseDown={() => handleDateMouseDown(day.date)}
                      onMouseEnter={() => handleDateMouseEnter(day.date)}
                      className={`min-h-[88px] p-3 rounded-lg border-2 cursor-pointer transition-all select-none flex flex-col text-left ${cellBg}`}
                    >
                      <span className={`text-xl font-bold ${dateColor} shrink-0`}>{day.day}</span>
                      <div className="mt-1 space-y-0.5 flex-1 min-h-0 overflow-hidden">
                        {dayLeaves.map((leave, leaveIdx) => {
                          const staff = staffData.find(s => s.id === leave.staffId);
                          return (
                            <div
                              key={leaveIdx}
                              onClick={(e) => { e.stopPropagation(); removeLeave(day.date, leave.staffId); }}
                              className={`text-xs px-1 py-0.5 rounded leading-tight truncate max-w-full ${colorMap[leave.leaveType] || 'bg-stone-200 text-stone-800'} hover:opacity-80 transition-opacity`}
                              title={`${staff?.name || leave.staffId} (${leave.leaveType})`}
                            >
                              {staff?.name || leave.staffId} ({leave.leaveType})
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-stone-700 text-base mt-3 shrink-0 font-medium">日付をドラッグして範囲選択 → 職員・種類を選んで登録。登録済みはクリックで削除</p>
            </div>
          </div>
        </div>

        {showLeaveModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-5 z-50">
            <div className="bg-stone-50 border-2 border-slate-400 rounded-2xl p-6 max-w-md w-full shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-stone-800 text-xl">休暇・出張登録{selectedDates.length > 1 && <span className="text-rose-500 ml-2">({selectedDates.length}日間)</span>}</h3>
                <button onClick={() => { setShowLeaveModal(false); setSelectedDates([]); }} className="text-stone-400 hover:text-stone-700 transition-colors text-2xl">✕</button>
              </div>
              <div className="bg-stone-50 p-3 rounded-lg mb-4 text-base text-stone-700">期間: {selectedDates[0]} 〜 {selectedDates[selectedDates.length - 1]}</div>
              <div className="space-y-4">
                <div>
                  <label className="block text-base mb-2 font-semibold text-stone-700 uppercase tracking-wider">職員を選択 *</label>
                  <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} className="w-full p-3 bg-stone-50 border-2 border-slate-400 rounded-xl text-stone-800 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all">
                    <option value="">-- 職員を選択 --</option>
                    {staffData.map(s => (<option key={s.id} value={s.id}>{s.name} ({s.id})</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-base mb-2 font-semibold text-stone-700 uppercase tracking-wider">種類を選択 *</label>
                  <select value={selectedLeaveType} onChange={(e) => setSelectedLeaveType(e.target.value)} className="w-full p-3 bg-stone-50 border-2 border-slate-400 rounded-xl text-stone-800 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all">
                    <option value="">-- 種類を選択 --</option>
                    {leaveTypes.map(type => (<option key={type} value={type}>{type}</option>))}
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={addLeave} className="flex-1 bg-rose-500 hover:bg-rose-400 text-white py-2.5 rounded-xl text-lg font-semibold transition-all shadow-sm">✓ 登録</button>
                  <button onClick={() => { setShowLeaveModal(false); setSelectedDates([]); }} className="flex-1 bg-slate-100 hover:bg-stone-200 text-stone-700 py-2.5 rounded-xl text-lg font-semibold transition-all">キャンセル</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
