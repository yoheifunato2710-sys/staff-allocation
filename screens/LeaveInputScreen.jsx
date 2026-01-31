import React, { useState, useEffect } from 'react';
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

  const saveLeaveData = () => {
    localStorage.setItem('leaveData', JSON.stringify({ leaveData }));
    alert('✅ 休暇・出張データを保存しました');
  };

  const changeMonth = (offset) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentMonth(newDate);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-5 relative overflow-hidden">
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto relative">
        <div className="flex justify-between items-center gap-4 mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-white">休暇・出張管理</h2>
            <span className="text-slate-500 text-sm">登録: <span className="font-medium text-slate-300">{Object.values(leaveData).flat().length}</span>件</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={saveLeaveData} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all">
              保存
            </button>
            <button onClick={onBack} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 text-sm font-medium transition-all">
              ← メインメニュー
            </button>
          </div>
        </div>

        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl mb-6 text-sm text-rose-200 backdrop-blur-sm">
          <strong>📌 使い方：</strong> カレンダー上で日付をドラッグして範囲選択 → 職員と種類を選択して登録
        </div>

        <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => changeMonth(-1)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all">← 前月</button>
            <h3 className="text-2xl font-bold text-white">{currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月</h3>
            <button onClick={() => changeMonth(1)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all">次月 →</button>
          </div>
          <div className="grid grid-cols-7 gap-2" onMouseUp={handleDateMouseUp} onMouseLeave={() => setIsSelecting(false)}>
            {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
              <div key={day} className={`text-center font-bold py-2 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'}`}>{day}</div>
            ))}
            {monthCalendar.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="min-h-[100px] rounded-lg border-2 border-transparent bg-slate-800/20" />;
              }
              const isSelected = selectedDates.includes(day.date);
              const dayLeaves = leaveData[day.date] || [];
              const colorMap = { '週休': 'bg-violet-500/30 text-violet-200', '年休': 'bg-emerald-500/30 text-emerald-200', 'リフ休': 'bg-purple-500/30 text-purple-200', '特別休': 'bg-amber-500/30 text-amber-200', '出張': 'bg-red-500/30 text-red-200' };
              const isSun = day.dayOfWeekNum === 0;
              const isHoliday = holidays.has(day.date);
              const dateColor = isSun || isHoliday ? 'text-red-400' : day.dayOfWeekNum === 6 ? 'text-blue-400' : 'text-white';
              return (
                <div
                  key={day.date}
                  onMouseDown={() => handleDateMouseDown(day.date)}
                  onMouseEnter={() => handleDateMouseEnter(day.date)}
                  className={`min-h-[100px] p-2 rounded-lg border-2 cursor-pointer transition-all select-none ${isSelected ? 'bg-rose-500/30 border-rose-500' : 'bg-slate-800/30 border-slate-700 hover:border-slate-600'} ${day.isWeekend ? 'bg-slate-800/50' : ''}`}
                >
                  <div className={`font-bold mb-1 ${dateColor}`}>{day.day}</div>
                  <div className="space-y-1">
                    {dayLeaves.map((leave, leaveIdx) => {
                      const staff = staffData.find(s => s.id === leave.staffId);
                      return (
                        <div key={leaveIdx} onClick={(e) => { e.stopPropagation(); removeLeave(day.date, leave.staffId); }} className={`text-xs px-2 py-1 rounded ${colorMap[leave.leaveType]} hover:opacity-75 transition-opacity`}>
                          {staff?.name || leave.staffId}<br />({leave.leaveType})
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {showLeaveModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5 z-50">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white text-xl">休暇・出張登録{selectedDates.length > 1 && <span className="text-rose-400 ml-2">({selectedDates.length}日間)</span>}</h3>
                <button onClick={() => { setShowLeaveModal(false); setSelectedDates([]); }} className="text-slate-400 hover:text-white transition-colors text-2xl">✕</button>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg mb-4 text-sm text-slate-300">期間: {selectedDates[0]} 〜 {selectedDates[selectedDates.length - 1]}</div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-2 font-semibold text-slate-300 uppercase tracking-wider">職員を選択 *</label>
                  <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} className="w-full p-3 bg-slate-800 border-2 border-slate-700 rounded-xl text-white focus:border-rose-500 outline-none transition-all">
                    <option value="">-- 職員を選択 --</option>
                    {staffData.map(s => (<option key={s.id} value={s.id}>{s.name} ({s.id})</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-2 font-semibold text-slate-300 uppercase tracking-wider">種類を選択 *</label>
                  <select value={selectedLeaveType} onChange={(e) => setSelectedLeaveType(e.target.value)} className="w-full p-3 bg-slate-800 border-2 border-slate-700 rounded-xl text-white focus:border-rose-500 outline-none transition-all">
                    <option value="">-- 種類を選択 --</option>
                    {leaveTypes.map(type => (<option key={type} value={type}>{type}</option>))}
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={addLeave} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-3 rounded-xl transition-all font-semibold">✓ 登録</button>
                  <button onClick={() => { setShowLeaveModal(false); setSelectedDates([]); }} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl transition-all font-semibold">キャンセル</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
