import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';

const MAX_UNDO = 50;

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
  // 海の日: 2020年以降は7月22日固定、それ以前は7月第3月曜
  if (year >= 2020) set.add(`${year}-07-22`);
  const nthMonday = (m, n) => {
    const first = new Date(year, m - 1, 1);
    const day = first.getDay();
    const d = 1 + (n - 1) * 7 + (8 - day) % 7;
    return `${year}-${pad(m)}-${pad(d)}`;
  };
  set.add(nthMonday(1, 2));  // 成人の日
  if (year < 2020) set.add(nthMonday(7, 3)); // 海の日（2020未満は7月第3月曜）
  set.add(nthMonday(9, 3));  // 敬老の日
  set.add(nthMonday(10, 2)); // スポーツの日
  const vernal = year <= 2099 ? Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)) : 20;
  const autumnal = year <= 2099 ? Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)) : 23;
  set.add(`${year}-03-${pad(vernal)}`);
  set.add(`${year}-09-${pad(autumnal)}`);
  return set;
}

export default function ShiftScheduleScreen({ onBack }) {
  const { staffData } = useData();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [calendar, setCalendar] = useState([]);
  const [surgeryDays, setSurgeryDays] = useState([]);
  const [internalMedicineDays, setInternalMedicineDays] = useState([]);
  const [nightShiftOrder, setNightShiftOrder] = useState([]);
  const [dayShiftOrder, setDayShiftOrder] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [schedule, setSchedule] = useState({});
  const [weeklyOff, setWeeklyOff] = useState({});
  const [showNightShiftModal, setShowNightShiftModal] = useState(false);
  const [showDayShiftModal, setShowDayShiftModal] = useState(false);
  const [showPairModal, setShowPairModal] = useState(false);
  const [pairIncompleteFirst, setPairIncompleteFirst] = useState(null);
  const [manualPicker, setManualPicker] = useState(null); // { date, field } 手動変更用（右列）
  const [editPicker, setEditPicker] = useState(null); // { date, field } 左列（自動値）の変更用
  const [nightShiftStartId, setNightShiftStartId] = useState(null); // その月の夜勤開始の人
  const [dayShiftStartId, setDayShiftStartId] = useState(null); // その月の日勤開始の人
  const [showNightStartPicker, setShowNightStartPicker] = useState(false);
  const [showDayStartPicker, setShowDayStartPicker] = useState(false);
  const undoHistoryRef = useRef([]);
  const redoHistoryRef = useRef([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  const pushUndoState = () => {
    redoHistoryRef.current = [];
    setRedoCount(0);
    undoHistoryRef.current.push({
      schedule: JSON.parse(JSON.stringify(schedule)),
      surgeryDays: [...surgeryDays],
      internalMedicineDays: [...internalMedicineDays],
      weeklyOff: JSON.parse(JSON.stringify(weeklyOff))
    });
    if (undoHistoryRef.current.length > MAX_UNDO) undoHistoryRef.current.shift();
    setUndoCount(undoHistoryRef.current.length);
  };

  const undo = () => {
    if (undoHistoryRef.current.length === 0) return;
    redoHistoryRef.current.push({
      schedule: JSON.parse(JSON.stringify(schedule)),
      surgeryDays: [...surgeryDays],
      internalMedicineDays: [...internalMedicineDays],
      weeklyOff: JSON.parse(JSON.stringify(weeklyOff))
    });
    setRedoCount(redoHistoryRef.current.length);
    const prev = undoHistoryRef.current.pop();
    setSchedule(prev.schedule);
    setSurgeryDays(prev.surgeryDays);
    setInternalMedicineDays(prev.internalMedicineDays);
    if (prev.weeklyOff != null) setWeeklyOff(prev.weeklyOff);
    setUndoCount(undoHistoryRef.current.length);
  };

  const redo = () => {
    if (redoHistoryRef.current.length === 0) return;
    undoHistoryRef.current.push({
      schedule: JSON.parse(JSON.stringify(schedule)),
      surgeryDays: [...surgeryDays],
      internalMedicineDays: [...internalMedicineDays],
      weeklyOff: JSON.parse(JSON.stringify(weeklyOff))
    });
    setUndoCount(undoHistoryRef.current.length);
    const next = redoHistoryRef.current.pop();
    setSchedule(next.schedule);
    setSurgeryDays(next.surgeryDays);
    setInternalMedicineDays(next.internalMedicineDays);
    if (next.weeklyOff != null) setWeeklyOff(next.weeklyOff);
    setRedoCount(redoHistoryRef.current.length);
  };

  const resetSchedule = () => {
    if (!window.confirm('当番表をリセットしますか？')) return;
    pushUndoState();
    setSchedule({});
  };

  const resetWeeklyOff = () => {
    if (!window.confirm('週休自動割り当てをリセットしますか？')) return;
    pushUndoState();
    setWeeklyOff({});
  };

  const generateCalendar = () => {
    if (!startDate || !endDate) {
      alert('⚠️ 開始日と終了日を入力してください');
      return;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      alert('⚠️ 開始日は終了日より前にしてください');
      return;
    }
    const days = [];
    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const dayOfWeek = current.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const year = current.getFullYear();
      const holidays = getHolidays(year);
      days.push({
        date: dateStr,
        dayOfWeek: ['日', '月', '火', '水', '木', '金', '土'][dayOfWeek],
        dayOfWeekNum: dayOfWeek,
        isWeekend,
        isHoliday: holidays.has(dateStr)
      });
      current.setDate(current.getDate() + 1);
    }
    setCalendar(days);
    alert('✅ カレンダーを生成しました');
  };

  const toggleSurgeryDay = (date) => {
    setSurgeryDays(prev => (prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]));
  };

  const toggleInternalMedicineDay = (date) => {
    setInternalMedicineDays(prev => (prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]));
  };

  const autoAssign = () => {
    let cal = calendar;
    if (cal.length === 0 && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start <= end) {
        const days = [];
        const current = new Date(start);
        while (current <= end) {
          const dateStr = current.toISOString().split('T')[0];
          const dayOfWeek = current.getDay();
          const year = current.getFullYear();
          const holidays = getHolidays(year);
          days.push({
            date: dateStr,
            dayOfWeek: ['日', '月', '火', '水', '木', '金', '土'][dayOfWeek],
            dayOfWeekNum: dayOfWeek,
            isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
            isHoliday: holidays.has(dateStr)
          });
          current.setDate(current.getDate() + 1);
        }
        setCalendar(days);
        cal = days;
      }
    }
    if (cal.length === 0) {
      alert('⚠️ 開始日・終了日を入力してください');
      return;
    }
    if (nightShiftOrder.length === 0) {
      alert('⚠️ 夜勤順番リストを設定してください');
      return;
    }
    const newSchedule = {};
    let nightStartIdx = nightShiftOrder.indexOf(nightShiftStartId);
    if (nightStartIdx < 0) nightStartIdx = 0;
    let dayStartIdx = dayShiftOrder.indexOf(dayShiftStartId);
    if (dayStartIdx < 0) dayStartIdx = 0;
    let nightIndex = nightStartIdx;
    let dayIndex = dayStartIdx;
    cal.forEach((day, idx) => {
      const dateStr = day.date;
      const prevDaySchedule = schedule[dateStr];
      newSchedule[dateStr] = {
        nightShift: null, dayShift: null, support: null, b: null, dayOff: null,
        dayShiftManual: prevDaySchedule?.dayShiftManual ?? null,
        supportManual: prevDaySchedule?.supportManual ?? null,
        nightShiftManual: prevDaySchedule?.nightShiftManual ?? null,
        bManual: prevDaySchedule?.bManual ?? null,
        dayOffManual: prevDaySchedule?.dayOffManual ?? null
      };
      if (nightShiftOrder.length > 0) {
        newSchedule[dateStr].nightShift = nightShiftOrder[nightIndex % nightShiftOrder.length];
        nightIndex++;
      }
      if (idx > 0) {
        const prevDate = calendar[idx - 1].date;
        if (newSchedule[prevDate]?.nightShift) {
          newSchedule[dateStr].dayOff = newSchedule[prevDate].nightShift;
        }
      } else {
        // 初日: 夜勤開始者の前の夜勤者（リストは循環、1人目の前は最後、最後の次は1人目）
        if (nightShiftOrder.length > 0) {
          const startIdx = nightShiftOrder.indexOf(nightShiftStartId) >= 0 ? nightShiftOrder.indexOf(nightShiftStartId) : 0;
          const prevIdx = (startIdx - 1 + nightShiftOrder.length) % nightShiftOrder.length;
          newSchedule[dateStr].dayOff = nightShiftOrder[prevIdx];
        }
      }
      if (day.isWeekend || day.isHoliday) {
        if (dayShiftOrder.length > 0) {
          const dayShiftPerson = dayShiftOrder[dayIndex % dayShiftOrder.length];
          newSchedule[dateStr].dayShift = dayShiftPerson;
          const pair = pairs.find(p => p.person1 === dayShiftPerson || p.person2 === dayShiftPerson);
          if (pair) {
            newSchedule[dateStr].support = pair.person1 === dayShiftPerson ? pair.person2 : pair.person1;
          }
          dayIndex++;
        }
      }
      if (surgeryDays.includes(dateStr) && idx < cal.length - 1) {
        const nextDate = cal[idx + 1].date;
        if (newSchedule[nextDate]?.nightShift) {
          newSchedule[dateStr].b = newSchedule[nextDate].nightShift;
        }
      }
    });
    pushUndoState();
    setSchedule(newSchedule);
    alert('✅ 自動配置が完了しました');
  };

  const autoAssignWeeklyOff = () => {
    if (calendar.length === 0 || Object.keys(schedule).length === 0) {
      alert('⚠️ まず当番表を作成してください');
      return;
    }
    const savedLeaveData = localStorage.getItem('leaveData');
    const leaveData = savedLeaveData ? JSON.parse(savedLeaveData).leaveData || {} : {};
    const weekdays = calendar.filter(d => !d.isWeekend && !d.isHoliday);
    const remaining = {};
    staffData.forEach(staff => {
      const staffId = staff.id;
      let weeklyOffDays = 0;
      calendar.forEach((day, idx) => {
        const dateStr = day.date;
        const daySchedule = schedule[dateStr] || {};
        const nextDay = calendar[idx + 1];
        const bPerson = surgeryDays.includes(dateStr) && nextDay ? (schedule[nextDay.date]?.nightShift ?? schedule[nextDay.date]?.nightShiftManual) : (daySchedule.b ?? daySchedule.bManual);
        const onNight = daySchedule.nightShift === staffId || daySchedule.nightShiftManual === staffId;
        const onDay = daySchedule.dayShift === staffId || daySchedule.dayShiftManual === staffId;
        const onSupport = daySchedule.support === staffId || daySchedule.supportManual === staffId;
        const onB = bPerson === staffId || daySchedule.bManual === staffId;
        if (day.dayOfWeekNum === 5 && onNight) weeklyOffDays += 1;
        if (day.dayOfWeekNum === 6 && onNight) weeklyOffDays += 2;
        if (day.dayOfWeekNum === 6 && (onDay || onSupport)) weeklyOffDays += 1;
        if (day.dayOfWeekNum === 0 && (onDay || onSupport)) weeklyOffDays += 1;
        if (day.dayOfWeekNum === 0 && onNight) weeklyOffDays += 1;
        if ((day.dayOfWeekNum === 6 || day.dayOfWeekNum === 0) && onB) weeklyOffDays += 1;
      });
      remaining[staff.id] = weeklyOffDays;
    });

    const newWeeklyOff = {};
    const staffOrder = [...staffData];
    weekdays.forEach((day, dayIndex) => {
      const dateStr = day.date;
      const daySchedule = schedule[dateStr] || {};
      const calIdx = calendar.findIndex(d => d.date === dateStr);
      const nextDay = calIdx >= 0 ? calendar[calIdx + 1] : null;
      const prevDay = calIdx >= 0 ? calendar[calIdx - 1] : null;
      const bPerson = surgeryDays.includes(dateStr) && nextDay ? (schedule[nextDay?.date]?.nightShift ?? schedule[nextDay?.date]?.nightShiftManual) : (daySchedule.b ?? daySchedule.bManual);
      const dayOffPerson = prevDay ? (schedule[prevDay.date]?.nightShift ?? schedule[prevDay.date]?.nightShiftManual) : (daySchedule.dayOff ?? daySchedule.dayOffManual);
      const totalRemaining = Object.values(remaining).reduce((a, b) => a + b, 0);
      const daysLeft = weekdays.length - dayIndex;
      const quota = Math.min(daysLeft > 0 ? Math.ceil(totalRemaining / daysLeft) : 0, totalRemaining);
      let assigned = 0;
      for (const staff of staffOrder) {
        if (assigned >= quota) break;
        const staffId = staff.id;
        if (remaining[staffId] <= 0) continue;
        const hasOtherLeave = leaveData[dateStr]?.some(leave => leave.staffId === staffId);
        const isAssigned =
          daySchedule.nightShift === staffId || daySchedule.nightShiftManual === staffId ||
          daySchedule.dayShift === staffId || daySchedule.dayShiftManual === staffId ||
          daySchedule.support === staffId || daySchedule.supportManual === staffId ||
          (daySchedule.b ?? bPerson) === staffId || daySchedule.bManual === staffId ||
          (daySchedule.dayOff ?? dayOffPerson) === staffId || daySchedule.dayOffManual === staffId;
        if (!hasOtherLeave && !isAssigned) {
          if (!newWeeklyOff[dateStr]) newWeeklyOff[dateStr] = [];
          newWeeklyOff[dateStr].push(staffId);
          remaining[staffId]--;
          assigned++;
        }
      }
    });
    pushUndoState();
    setWeeklyOff(newWeeklyOff);
    alert('✅ 週休を自動割り当てしました');
  };

  const updateSchedule = (date, field, value) => {
    setSchedule(prev => {
      const next = { ...prev, [date]: { ...prev[date], [field]: value } };
      if (field === 'dayShift' || field === 'support' || field === 'nightShift') {
        next[date] = { ...next[date], [field + 'Edited']: true };
      }
      return next;
    });
  };

  const moveWeeklyOff = (staffId, fromDate, toDate) => {
    const day = calendar.find(d => d.date === toDate);
    if (!day || day.isWeekend || day.isHoliday) return;
    const savedLeaveData = localStorage.getItem('leaveData');
    const leaveData = savedLeaveData ? JSON.parse(savedLeaveData).leaveData || {} : {};
    const hasOtherLeave = leaveData[toDate]?.some(leave => leave.staffId === staffId);
    const daySchedule = schedule[toDate] || {};
    const calIdx = calendar.findIndex(d => d.date === toDate);
    const nextDay = calIdx >= 0 ? calendar[calIdx + 1] : null;
    const prevDay = calIdx >= 0 ? calendar[calIdx - 1] : null;
    const bPerson = surgeryDays.includes(toDate) && nextDay ? (schedule[nextDay?.date]?.nightShift ?? schedule[nextDay?.date]?.nightShiftManual) : (daySchedule.b ?? daySchedule.bManual);
    const dayOffPerson = prevDay ? (schedule[prevDay.date]?.nightShift ?? schedule[prevDay.date]?.nightShiftManual) : (daySchedule.dayOff ?? daySchedule.dayOffManual);
    const isAssigned =
      daySchedule.nightShift === staffId || daySchedule.nightShiftManual === staffId ||
      daySchedule.dayShift === staffId || daySchedule.dayShiftManual === staffId ||
      daySchedule.support === staffId || daySchedule.supportManual === staffId ||
      (daySchedule.b ?? bPerson) === staffId || daySchedule.bManual === staffId ||
      (daySchedule.dayOff ?? dayOffPerson) === staffId || daySchedule.dayOffManual === staffId;
    if (hasOtherLeave || isAssigned) return;
    setWeeklyOff(prev => {
      const next = { ...prev };
      if (next[fromDate]) next[fromDate] = next[fromDate].filter(id => id !== staffId);
      if (next[fromDate]?.length === 0) delete next[fromDate];
      if (!next[toDate]) next[toDate] = [];
      if (!next[toDate].includes(staffId)) next[toDate].push(staffId);
      return next;
    });
  };

  const toggleWeeklyOff = (date, staffId) => {
    setWeeklyOff(prev => {
      const newData = { ...prev };
      if (!newData[date]) newData[date] = [];
      if (newData[date].includes(staffId)) {
        newData[date] = newData[date].filter(id => id !== staffId);
        if (newData[date].length === 0) delete newData[date];
      } else {
        newData[date].push(staffId);
      }
      return newData;
    });
  };

  const addToNightShiftOrder = (staffId) => {
    if (!nightShiftOrder.includes(staffId)) setNightShiftOrder([...nightShiftOrder, staffId]);
  };

  const addToDayShiftOrder = (staffId) => {
    if (!dayShiftOrder.includes(staffId)) setDayShiftOrder([...dayShiftOrder, staffId]);
  };

  const addPair = (person1, person2) => {
    if (person1 && person2 && person1 !== person2) setPairs([...pairs, { person1, person2 }]);
  };

  useEffect(() => {
    const data = { startDate, endDate, calendar, surgeryDays, internalMedicineDays, nightShiftOrder, dayShiftOrder, nightShiftStartId, dayShiftStartId, pairs, schedule, weeklyOff };
    if (!startDate && !endDate && calendar.length === 0) return;
    localStorage.setItem('scheduleData', JSON.stringify(data));
  }, [startDate, endDate, calendar, surgeryDays, internalMedicineDays, nightShiftOrder, dayShiftOrder, nightShiftStartId, dayShiftStartId, pairs, schedule, weeklyOff]);

  useEffect(() => {
    const saved = localStorage.getItem('scheduleData');
    if (saved) {
      const data = JSON.parse(saved);
      setStartDate(data.startDate || '');
      setEndDate(data.endDate || '');
      const cal = data.calendar || [];
      const migrated = cal.map(day => ({
        ...day,
        isHoliday: getHolidays(parseInt(day.date.slice(0, 4), 10)).has(day.date)
      }));
      setCalendar(migrated);
      setSurgeryDays(data.surgeryDays || []);
      setInternalMedicineDays(data.internalMedicineDays || []);
      setNightShiftOrder(data.nightShiftOrder || []);
      setDayShiftOrder(data.dayShiftOrder || []);
      setNightShiftStartId(data.nightShiftStartId ?? null);
      setDayShiftStartId(data.dayShiftStartId ?? null);
      setPairs(data.pairs || []);
      setSchedule(data.schedule || {});
      setWeeklyOff(data.weeklyOff || {});
    }
  }, []);

  return (
    <div className="min-h-screen bg-violet-400 p-5 relative overflow-hidden">
      <div className="absolute top-20 left-20 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-[95vw] w-full mx-auto relative">
        <div className="flex justify-between items-center gap-4 mb-3">
          <h2 className="text-3xl font-bold text-stone-800">当番表作成</h2>
          <button onClick={onBack} className="btn-header">
            ← メインメニュー
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-3 items-end">
          <div className="min-w-0 bg-slate-50 rounded-2xl border-2 border-slate-400 p-4 shadow-sm hover:border-slate-400 transition-all">
            <h3 className="font-bold mb-2 text-stone-800 text-lg">📅 期間設定</h3>
            <div className="space-y-2">
              <div>
                <label className="block text-sm mb-1 font-semibold text-stone-600 uppercase tracking-wider">開始日</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 bg-slate-50 border-2 border-slate-400 rounded-lg text-stone-800 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm mb-1 font-semibold text-stone-600 uppercase tracking-wider">終了日</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 bg-slate-50 border-2 border-slate-400 rounded-lg text-stone-800 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all" />
              </div>
            </div>
          </div>
          <div className="min-w-0 bg-slate-50 rounded-2xl border-2 border-slate-400 p-4 shadow-sm hover:border-slate-400 transition-all">
            <h3 className="font-bold mb-2 text-stone-800 text-lg">👥 順番設定</h3>
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <button onClick={() => setShowNightShiftModal(true)} className="btn-panel flex-1 bg-blue-600 hover:bg-blue-500 text-white shadow-md">夜勤順番 ({nightShiftOrder.length}名)</button>
                <button onClick={() => setShowNightStartPicker(true)} className="min-h-[32px] py-1.5 px-2.5 rounded text-xs font-semibold bg-blue-500 hover:bg-blue-400 text-white border border-blue-600 shrink-0">開始者</button>
                <span className="text-stone-700 text-sm font-medium truncate min-w-0 max-w-[8rem]" title={nightShiftStartId ? (staffData.find(s => s.id === nightShiftStartId)?.name || nightShiftStartId) : ''}>
                  {nightShiftStartId ? (staffData.find(s => s.id === nightShiftStartId)?.name || nightShiftStartId) : '－'}
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <button onClick={() => setShowDayShiftModal(true)} className="btn-panel flex-1 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md">日勤順番 ({dayShiftOrder.length}名)</button>
                <button onClick={() => setShowDayStartPicker(true)} className="min-h-[32px] py-1.5 px-2.5 rounded text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white border border-emerald-600 shrink-0">開始者</button>
                <span className="text-stone-700 text-sm font-medium truncate min-w-0 max-w-[8rem]" title={dayShiftStartId ? (staffData.find(s => s.id === dayShiftStartId)?.name || dayShiftStartId) : ''}>
                  {dayShiftStartId ? (staffData.find(s => s.id === dayShiftStartId)?.name || dayShiftStartId) : '－'}
                </span>
              </div>
              <button onClick={() => setShowPairModal(true)} className="btn-panel w-full bg-orange-600 hover:bg-orange-500 text-white shadow-md">ペア設定 ({pairs.length}組)</button>
            </div>
          </div>
          <div className="min-w-0 bg-slate-50 rounded-2xl border-2 border-slate-400 p-4 shadow-sm hover:border-slate-400 transition-all">
            <h3 className="font-bold mb-2 text-stone-800 text-base">⚙️ 実行</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={autoAssign} className="btn-panel bg-amber-600 hover:bg-amber-500 text-white shadow-md">🎯 当番自動配置</button>
              <button onClick={autoAssignWeeklyOff} className="btn-panel bg-indigo-600 hover:bg-indigo-500 text-white shadow-md">📅 週休自動割当</button>
              <button onClick={resetSchedule} className="btn-panel bg-amber-400 hover:bg-amber-300 text-stone-800 border-2 border-amber-600">当番表リセット</button>
              <button onClick={resetWeeklyOff} className="btn-panel bg-indigo-400 hover:bg-indigo-300 text-stone-800 border-2 border-indigo-600">週休割当リセット</button>
              <button onClick={undo} disabled={undoCount === 0} className="btn-panel bg-slate-500 hover:bg-slate-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-500 text-white border-2 border-slate-600">← 戻る</button>
              <button onClick={redo} disabled={redoCount === 0} className="btn-panel bg-slate-500 hover:bg-slate-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-500 text-white border-2 border-slate-600">進む →</button>
            </div>
          </div>
        </div>

        {calendar.length > 0 && (
          <div className="bg-slate-50 rounded-2xl border-2 border-slate-400 p-6 shadow-sm">
            <h3 className="font-bold mb-3 text-stone-800 text-2xl">📆 当番表カレンダー</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse table-fixed text-lg">
                <colgroup>
                  <col style={{ width: '3.5rem' }} />
                  <col style={{ width: '1.25rem' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '1.75rem' }} />
                  <col style={{ width: '1.75rem' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-400 bg-slate-50">
                    <th className="pl-0.5 pr-0.5 py-2 text-center text-stone-600 font-semibold tracking-wider text-base border-r border-slate-400">日付</th>
                    <th className="pl-0 pr-0.5 py-2 text-center text-stone-600 font-semibold tracking-wider text-base border-r border-slate-400">曜日</th>
                    <th colSpan={2} className="px-0.5 py-2 text-center text-stone-600 font-semibold tracking-wider text-base bg-slate-50 border-r-2 border-slate-500">日勤</th>
                    <th colSpan={2} className="px-0.5 py-2 text-center text-stone-600 font-semibold tracking-wider text-base bg-slate-50 border-r-2 border-slate-500">サポート</th>
                    <th colSpan={2} className="px-0.5 py-2 text-center text-stone-600 font-semibold tracking-wider text-base bg-slate-50 border-r-2 border-slate-500">夜勤</th>
                    <th colSpan={2} className="px-0.5 py-2 text-center text-stone-600 font-semibold tracking-wider text-base bg-slate-50 border-r-2 border-slate-500">B</th>
                    <th colSpan={2} className="px-0.5 py-2 text-center text-stone-600 font-semibold tracking-wider text-base bg-slate-50 border-r-2 border-slate-500">非番</th>
                    <th className="px-0.5 py-2 text-center text-stone-600 font-semibold tracking-wider text-sm bg-white border-r border-slate-400">外科</th>
                    <th className="px-0.5 py-2 text-center text-stone-600 font-semibold tracking-wider text-sm bg-white">内科</th>
                  </tr>
                </thead>
                <tbody>
                  {calendar.map((day, idx) => {
                    const isSurgery = surgeryDays.includes(day.date);
                    const isInternalMedicine = internalMedicineDays.includes(day.date);
                    const daySchedule = schedule[day.date] || {};
                    const nextDay = calendar[idx + 1];
                    const prevDay = calendar[idx - 1];
                    const nextNight = nextDay ? (schedule[nextDay.date]?.nightShift ?? schedule[nextDay.date]?.nightShiftManual) : null;
                    const prevNight = prevDay ? (schedule[prevDay.date]?.nightShift ?? schedule[prevDay.date]?.nightShiftManual) : null;
                    const bPerson = isSurgery && nextDay ? nextNight : (daySchedule.b ?? daySchedule.bManual);
                    const dayOffPerson = prevNight ?? daySchedule.dayOff ?? daySchedule.dayOffManual;
                    const name = (id) => (id ? (staffData.find(s => s.id === id)?.name || id) : '');
                    const isHoliday = day.isHoliday ?? getHolidays(parseInt(day.date.slice(0, 4), 10)).has(day.date);
                    const isWeekendOrHoliday = day.isWeekend || isHoliday;
                    const rowBg = isSurgery ? 'bg-yellow-200' : (isInternalMedicine ? 'bg-pink-200' : (isWeekendOrHoliday ? 'bg-sky-50' : ''));
                    const cellBg = isWeekendOrHoliday && !isSurgery && !isInternalMedicine ? 'bg-sky-100/50' : '';
                    const rowBorder = isSurgery ? 'border-l-4 border-l-amber-500' : (isInternalMedicine ? 'border-l-4 border-l-pink-500' : (isWeekendOrHoliday ? 'border-l-4 border-l-sky-400' : ''));
                    const borderR = 'border-r border-slate-300';
                    const dayShiftDisp = daySchedule.dayShift ?? daySchedule.dayShiftManual;
                    const supportDisp = daySchedule.support ?? daySchedule.supportManual;
                    const nightShiftDisp = daySchedule.nightShift ?? daySchedule.nightShiftManual;
                    const ids = [dayShiftDisp, supportDisp, nightShiftDisp, bPerson].filter(Boolean);
                    const isOverlap = ids.length !== new Set(ids).size;
                    const overlapBg = isOverlap ? 'bg-slate-500' : '';
                    const isDayOffFromManual = prevDay && schedule[prevDay.date]?.nightShiftManual != null;
                    const isBFromManual = isSurgery && nextDay && schedule[nextDay.date]?.nightShiftManual != null;
                    const isDayShiftEdited = daySchedule.dayShiftEdited;
                    const isSupportEdited = daySchedule.supportEdited;
                    const isNightShiftEdited = daySchedule.nightShiftEdited;
                    const isBFromLeftEdit = isSurgery && nextDay && schedule[nextDay.date]?.nightShiftEdited;
                    const isDayOffFromLeftEdit = prevDay && schedule[prevDay.date]?.nightShiftEdited;
                    const manualBox = (field, value, hasAuto) => {
                      if (!hasAuto) return <td className={`px-0.5 py-2 text-center border-r-2 border-slate-500 ${cellBg} ${overlapBg}`} />;
                      return (
                        <td className={`px-0.5 py-2 text-center border-r-2 border-slate-500 ${cellBg} ${overlapBg}`}>
                          <button
                            type="button"
                            onClick={() => setManualPicker({ date: day.date, field })}
                            className={`w-full min-h-[1.75rem] rounded text-base font-medium bg-white/70 hover:bg-white/85 border border-slate-300/80 transition-all ${value ? 'text-red-600' : 'text-stone-500'}`}
                          >
                            {name(value) || ''}
                          </button>
                        </td>
                      );
                    };
                    const autoEditCell = (field, displayValue, isFromManual = false) => (
                      <td className={`px-0.5 py-2 text-center font-bold text-sm ${borderR} ${cellBg} ${overlapBg}`}>
                        <button
                          type="button"
                          onClick={() => { if (window.confirm('変えても良いですか？')) setEditPicker({ date: day.date, field }); }}
                          className={`w-full min-h-[1.75rem] rounded text-base hover:bg-slate-200/60 transition-all cursor-pointer ${isFromManual ? 'text-red-600' : 'text-stone-800'}`}
                        >
                          {name(displayValue) || ''}
                        </button>
                      </td>
                    );
                    return (
                      <tr key={day.date} className={`border-b border-slate-400 transition-all ${rowBg} ${rowBorder}`}>
                        <td className={`pl-0.5 pr-0.5 py-2 text-center text-stone-800 text-base border-r border-slate-400 ${cellBg}`}>{day.date}</td>
                        <td className={`pl-0 pr-0.5 py-2 text-center font-bold text-base border-r border-slate-400 ${cellBg} ${isHoliday ? 'text-red-600' : isWeekendOrHoliday ? 'text-red-600' : 'text-stone-800'}`}>{day.dayOfWeek}</td>
                        {autoEditCell('dayShift', daySchedule.dayShift, isDayShiftEdited)}
                        {manualBox('dayShiftManual', daySchedule.dayShiftManual, !!daySchedule.dayShift)}
                        {autoEditCell('support', daySchedule.support, isSupportEdited)}
                        {manualBox('supportManual', daySchedule.supportManual, !!daySchedule.support)}
                        {autoEditCell('nightShift', daySchedule.nightShift, isNightShiftEdited)}
                        {manualBox('nightShiftManual', daySchedule.nightShiftManual, !!daySchedule.nightShift)}
                        {autoEditCell('b', bPerson ?? daySchedule.b, isBFromManual || isBFromLeftEdit)}
                        {manualBox('bManual', daySchedule.bManual, !!bPerson)}
                        {autoEditCell('dayOff', dayOffPerson ?? daySchedule.dayOff, isDayOffFromManual || isDayOffFromLeftEdit)}
                        {manualBox('dayOffManual', daySchedule.dayOffManual, !!dayOffPerson)}
                        <td className={`px-0.5 py-2 text-center border-r border-slate-400 bg-white`}>
                          <button onClick={() => toggleSurgeryDay(day.date)} className={`min-w-[1.5rem] min-h-[1.5rem] rounded text-base font-semibold transition-all ${isSurgery ? 'bg-red-500 hover:bg-red-400 text-white' : 'bg-stone-300/80 hover:bg-stone-400/80 text-stone-600'}`}>{isSurgery ? '✓' : '−'}</button>
                        </td>
                        <td className="px-0.5 py-2 text-center bg-white">
                          <button onClick={() => toggleInternalMedicineDay(day.date)} className={`min-w-[1.5rem] min-h-[1.5rem] rounded text-base font-semibold transition-all ${isInternalMedicine ? 'bg-pink-500 hover:bg-pink-400 text-white' : 'bg-stone-300/80 hover:bg-stone-400/80 text-stone-600'}`}>{isInternalMedicine ? '✓' : '−'}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-base text-stone-600">※日勤・サポート・夜勤・B・非番は1列目＝自動、2列目＝手動変更（自動で人が入っている隣のボックスをクリックで職員選択）。土日祝は曜日を赤表示し、祝日にも日勤・サポートを自動割当します。外科輪番・内科輪番はボタンで指定。Bは外科輪番の日に翌日夜勤、非番は前日夜勤の担当者を自動表示します。<br />配置表作成では<strong>1列目（左・自動）を優先</strong>して参照し、1列目が空のときだけ2列目（右・手動）を参照します。</div>

            <h3 className="font-bold mb-3 text-stone-800 text-2xl mt-8">📋 週休割り当て結果</h3>
            <p className="text-sm text-stone-600 mb-2">縦＝職員（夜勤順番リスト順）、横＝日付。A＝日勤、16＝夜勤（暗ピンク）、B＝青、非番＝オレンジ、黄色＝週休または土日祝で勤務なし。</p>
            <div className="overflow-x-auto border border-slate-400 rounded-xl">
              <table className="w-full border-collapse text-sm table-fixed" style={{ minWidth: `${calendar.length * 2.5 + 9}rem` }}>
                <colgroup>
                  <col style={{ width: '9rem', minWidth: '9rem' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-400 bg-slate-100">
                    <th className="sticky left-0 z-10 w-[9rem] min-w-[9rem] px-2 py-2 text-left text-stone-600 font-semibold bg-slate-100 border-r border-slate-400">職員</th>
                    {calendar.map((day) => {
                      const isHoliday = getHolidays(parseInt(day.date.slice(0, 4), 10)).has(day.date);
                      const isWeekendOrHoliday = day.isWeekend || isHoliday;
                      return (
                        <th key={day.date} className="px-0.5 py-1 text-center text-stone-600 font-medium border-r border-slate-300 min-w-[2.5rem]">
                          <span className="block text-xs text-stone-500">{day.date.slice(5)}</span>
                          <span className={`font-bold ${isWeekendOrHoliday ? 'text-red-600' : 'text-stone-800'}`}>{day.dayOfWeek}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {nightShiftOrder.map((staffId) => {
                    const staff = staffData.find(s => s.id === staffId);
                    if (!staff) return null;
                    let weeklyOffDays = 0;
                    calendar.forEach((day, idx) => {
                      const dateStr = day.date;
                      const daySchedule = schedule[dateStr] || {};
                      const nextDay = calendar[idx + 1];
                      const bPerson = surgeryDays.includes(dateStr) && nextDay ? (schedule[nextDay.date]?.nightShift ?? schedule[nextDay.date]?.nightShiftManual) : (daySchedule.b ?? daySchedule.bManual);
                      const onNight = daySchedule.nightShift === staffId || daySchedule.nightShiftManual === staffId;
                      const onDay = daySchedule.dayShift === staffId || daySchedule.dayShiftManual === staffId;
                      const onSupport = daySchedule.support === staffId || daySchedule.supportManual === staffId;
                      const onB = bPerson === staffId || daySchedule.bManual === staffId;
                      if (day.dayOfWeekNum === 5 && onNight) weeklyOffDays += 1;
                      if (day.dayOfWeekNum === 6 && onNight) weeklyOffDays += 2;
                      if (day.dayOfWeekNum === 6 && (onDay || onSupport)) weeklyOffDays += 1;
                      if (day.dayOfWeekNum === 0 && (onDay || onSupport)) weeklyOffDays += 1;
                      if (day.dayOfWeekNum === 0 && onNight) weeklyOffDays += 1;
                      if ((day.dayOfWeekNum === 6 || day.dayOfWeekNum === 0) && onB) weeklyOffDays += 1;
                    });
                    return (
                      <tr key={staffId} className="border-b border-slate-300">
                        <td className="sticky left-0 z-10 w-[9rem] min-w-[9rem] px-2 py-1 text-stone-800 font-medium bg-slate-50 border-r border-slate-400 whitespace-nowrap overflow-visible">{staff.name} <span className="text-stone-500 font-normal">({weeklyOffDays})</span></td>
                        {calendar.map((day, idx) => {
                          const dateStr = day.date;
                          const daySchedule = schedule[dateStr] || {};
                          const nextDay = calendar[idx + 1];
                          const prevDay = calendar[idx - 1];
                          const bPerson = surgeryDays.includes(dateStr) && nextDay ? (schedule[nextDay.date]?.nightShift) : (daySchedule.b);
                          const dayOffPerson = prevDay ? (schedule[prevDay.date]?.nightShift) : null;
                          const isHoliday = getHolidays(parseInt(day.date.slice(0, 4), 10)).has(day.date);
                          const isWeekendOrHoliday = day.isWeekend || isHoliday;
                          let label = '';
                          let cellClass = 'px-0.5 py-1 text-center border-r border-slate-200';
                          if (daySchedule.dayShift === staffId) {
                            label = 'A';
                            cellClass += ' bg-emerald-100 text-stone-800';
                          } else if (daySchedule.support === staffId) {
                            label = 'S';
                            cellClass += ' bg-emerald-50 text-stone-700';
                          } else if (daySchedule.nightShift === staffId) {
                            label = '16';
                            cellClass += ' bg-rose-800 text-white';
                          } else if (bPerson === staffId) {
                            label = 'B';
                            cellClass += ' bg-blue-600 text-white';
                          } else if (dayOffPerson === staffId) {
                            label = '非番';
                            cellClass += ' bg-orange-400 text-white';
                          } else if (weeklyOff[dateStr]?.includes(staffId)) {
                            label = '週休';
                            cellClass += ' bg-yellow-300 text-stone-800';
                          } else if (isWeekendOrHoliday) {
                            label = '';
                            cellClass += ' bg-yellow-300 text-stone-800';
                          }
                          const isWeeklyOffCell = weeklyOff[dateStr]?.includes(staffId);
                          const handleDrop = (e) => {
                            e.preventDefault();
                            const raw = e.dataTransfer.getData('text/plain');
                            if (!raw) return;
                            try {
                              const data = JSON.parse(raw);
                              if (data.type === 'weeklyOff' && data.staffId === staffId && data.dateStr !== dateStr) moveWeeklyOff(staffId, data.dateStr, dateStr);
                            } catch (_) {}
                          };
                          return (
                            <td
                              key={dateStr}
                              className={cellClass + (isWeeklyOffCell ? ' cursor-grab active:cursor-grabbing' : '')}
                              draggable={isWeeklyOffCell}
                              onDragStart={isWeeklyOffCell ? (e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'weeklyOff', staffId, dateStr })); e.dataTransfer.effectAllowed = 'move'; } : undefined}
                              onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes('text/plain')) e.dataTransfer.dropEffect = 'move'; }}
                              onDrop={handleDrop}
                            >
                              {label}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-4 bg-slate-100/80 rounded-xl border border-slate-300 text-stone-700 text-sm space-y-2">
              <h4 className="font-bold text-stone-800 text-base">週休を割り当てるルール</h4>
              <p className="font-semibold text-stone-700">【付与する週休の日数】</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>金曜の夜勤 … +1日</li>
                <li>土曜の夜勤 … +2日</li>
                <li>土曜の日勤・サポート … +1日</li>
                <li>日曜の日勤・サポート … +1日</li>
                <li>日曜の夜勤 … +1日</li>
                <li>土日のB … +1日</li>
              </ul>
              <p className="font-semibold text-stone-700 mt-2">【割り当て先】</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>平日のみ（土日祝は割り当て先にしない）</li>
                <li>期間全体でバランスをとり、1日あたりの週休人数が偏らないように割り当てる（配置表で必要人数を満たしやすくするため。不足する場合は週休の割り当てを変更して調整）</li>
              </ul>
              <p className="font-semibold text-stone-700 mt-2">【週休を割り当てない日】</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>その日に休暇入力がある日</li>
                <li>その日に当番表で勤務が入っている日（日勤・サポート・夜勤・B・非番のいずれか。手動変更も含む）</li>
              </ul>
              <p className="text-stone-600 mt-2">※土日祝で勤務が当たっていない日は黄色で表示しますが、付与する週休の日数には含めません。</p>
            </div>
          </div>
        )}

        {manualPicker && (() => {
          const isDayList = manualPicker.field === 'dayShiftManual' || manualPicker.field === 'supportManual';
          const allowedIds = isDayList ? dayShiftOrder : nightShiftOrder;
          const pickerStaff = staffData.filter(s => allowedIds.includes(s.id));
          return (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-5 z-50" onClick={() => setManualPicker(null)}>
              <div className="bg-slate-50 border-2 border-slate-400 rounded-2xl p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-bold text-stone-800 text-xl mb-3">職員を選択（{isDayList ? '日勤' : '夜勤'}リスト）</h3>
                <div className="max-h-64 overflow-y-auto space-y-1 mb-3">
                  {pickerStaff.map(s => (
                    <button key={s.id} type="button" onClick={() => { updateSchedule(manualPicker.date, manualPicker.field, s.id); setManualPicker(null); }} className="w-full text-left px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-stone-800 font-medium text-lg transition-all">
                      {s.name}
                    </button>
                  ))}
                  {pickerStaff.length === 0 && <p className="text-stone-500 text-sm py-2">該当リストに職員がいません</p>}
                </div>
                <button type="button" onClick={() => { updateSchedule(manualPicker.date, manualPicker.field, null); setManualPicker(null); }} className="w-full px-3 py-2 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 font-medium text-lg">
                  クリア
                </button>
              </div>
            </div>
          );
        })()}

        {editPicker && (() => {
          const isDayList = editPicker.field === 'dayShift' || editPicker.field === 'support';
          const allowedIds = isDayList ? dayShiftOrder : nightShiftOrder;
          const pickerStaff = staffData.filter(s => allowedIds.includes(s.id));
          return (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-5 z-50" onClick={() => setEditPicker(null)}>
              <div className="bg-slate-50 border-2 border-slate-400 rounded-2xl p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-bold text-stone-800 text-xl mb-3">職員を選択（{isDayList ? '日勤' : '夜勤'}リスト）</h3>
                <div className="max-h-64 overflow-y-auto space-y-1 mb-3">
                  {pickerStaff.map(s => (
                    <button key={s.id} type="button" onClick={() => { updateSchedule(editPicker.date, editPicker.field, s.id); setEditPicker(null); }} className="w-full text-left px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-stone-800 font-medium text-lg transition-all">
                      {s.name}
                    </button>
                  ))}
                  {pickerStaff.length === 0 && <p className="text-stone-500 text-sm py-2">該当リストに職員がいません</p>}
                </div>
                <button type="button" onClick={() => { updateSchedule(editPicker.date, editPicker.field, null); setEditPicker(null); }} className="w-full px-3 py-2 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 font-medium text-lg">
                  クリア
                </button>
              </div>
            </div>
          );
        })()}

        {showNightStartPicker && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-5 z-50" onClick={() => setShowNightStartPicker(false)}>
            <div className="bg-slate-50 border-2 border-slate-400 rounded-2xl p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-bold text-stone-800 text-xl mb-3">夜勤の開始者を選ぶ</h3>
              <div className="max-h-64 overflow-y-auto space-y-1 mb-3">
                {nightShiftOrder.map((id, idx) => {
                  const staff = staffData.find(s => s.id === id);
                  const isStart = nightShiftStartId === id;
                  return (
                    <button key={id} type="button" onClick={() => { setNightShiftStartId(id); setShowNightStartPicker(false); }} className={`w-full text-left px-3 py-3 rounded-lg border-2 font-medium text-lg transition-all ${isStart ? 'bg-blue-500 border-blue-600 text-white' : 'bg-white border-slate-300 text-stone-800 hover:bg-blue-50'}`}>
                      {isStart ? '★ ' : ''}{idx + 1}. {staff?.name || id}
                    </button>
                  );
                })}
                {nightShiftOrder.length === 0 && <p className="text-stone-500 py-2">夜勤順番リストを設定してください</p>}
              </div>
              <button type="button" onClick={() => setShowNightStartPicker(false)} className="w-full px-3 py-2 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 font-medium text-lg">閉じる</button>
            </div>
          </div>
        )}

        {showDayStartPicker && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-5 z-50" onClick={() => setShowDayStartPicker(false)}>
            <div className="bg-slate-50 border-2 border-slate-400 rounded-2xl p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-bold text-stone-800 text-xl mb-3">日勤の開始者を選ぶ</h3>
              <div className="max-h-64 overflow-y-auto space-y-1 mb-3">
                {dayShiftOrder.map((id, idx) => {
                  const staff = staffData.find(s => s.id === id);
                  const isStart = dayShiftStartId === id;
                  return (
                    <button key={id} type="button" onClick={() => { setDayShiftStartId(id); setShowDayStartPicker(false); }} className={`w-full text-left px-3 py-3 rounded-lg border-2 font-medium text-lg transition-all ${isStart ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-white border-slate-300 text-stone-800 hover:bg-emerald-50'}`}>
                      {isStart ? '★ ' : ''}{idx + 1}. {staff?.name || id}
                    </button>
                  );
                })}
                {dayShiftOrder.length === 0 && <p className="text-stone-500 py-2">日勤順番リストを設定してください</p>}
              </div>
              <button type="button" onClick={() => setShowDayStartPicker(false)} className="w-full px-3 py-2 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 font-medium text-lg">閉じる</button>
            </div>
          </div>
        )}

        {showNightShiftModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-5 z-50">
            <div className="bg-slate-50 border-2 border-slate-400 rounded-2xl p-6 w-full max-w-4xl max-h-[85vh] flex flex-col shadow-xl">
              <div className="flex justify-between items-center mb-3 shrink-0">
                <h3 className="font-bold text-stone-800 text-2xl">夜勤順番リスト設定</h3>
                <button onClick={() => setShowNightShiftModal(false)} className="text-slate-600 hover:text-slate-800 transition-colors text-2xl font-bold">✕</button>
              </div>
              <p className="text-sm text-stone-600 mb-3 shrink-0">左の職員を右へドラッグして順番を構成。右側でドラッグして並び替え可能。右端で「この月の開始」を選ぶと、その人から順に割り当てます。</p>
              <div className="flex gap-4 flex-1 min-h-0">
                <div className="flex-1 min-w-0 flex flex-col border-2 border-slate-300 rounded-xl bg-white overflow-hidden">
                  <h4 className="font-bold text-stone-700 px-3 py-2 bg-slate-100 border-b border-slate-300 shrink-0">職員一覧</h4>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {staffData.filter(s => !nightShiftOrder.includes(s.id)).map(staff => (
                      <div
                        key={staff.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'left', staffId: staff.id })); e.dataTransfer.effectAllowed = 'copy'; }}
                        className="px-3 py-2 rounded-lg border border-slate-300 bg-white cursor-grab active:cursor-grabbing hover:border-blue-400 hover:bg-blue-50 transition-all"
                      >
                        {staff.name} ({staff.id})
                      </div>
                    ))}
                    {staffData.filter(s => !nightShiftOrder.includes(s.id)).length === 0 && (
                      <p className="text-stone-500 text-sm py-4 text-center">全員が右に追加されています</p>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col border-2 border-blue-300 rounded-xl bg-blue-50/30 overflow-hidden">
                  <h4 className="font-bold text-stone-700 px-3 py-2 bg-blue-100 border-b border-blue-300 shrink-0">順番（上から）</h4>
                  <div
                    className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[120px]"
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; e.currentTarget.classList.add('ring-2', 'ring-blue-400'); }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('ring-2', 'ring-blue-400'); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('ring-2', 'ring-blue-400');
                      const raw = e.dataTransfer.getData('text/plain');
                      if (!raw) return;
                      try {
                        const { source, staffId } = JSON.parse(raw);
                        if (source === 'left' && staffId && !nightShiftOrder.includes(staffId)) setNightShiftOrder([...nightShiftOrder, staffId]);
                      } catch (_) {}
                    }}
                  >
                    {nightShiftOrder.map((id, idx) => {
                      const staff = staffData.find(s => s.id === id);
                      return (
                        <div
                          key={`${id}-${idx}`}
                          draggable
                          onDragStart={(e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'right', staffId: id, fromIndex: idx })); e.dataTransfer.effectAllowed = 'move'; }}
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.classList.add('ring-2', 'ring-inset', 'ring-blue-500'); }}
                          onDragLeave={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-inset', 'ring-blue-500'); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.currentTarget.classList.remove('ring-2', 'ring-inset', 'ring-blue-500');
                            const raw = e.dataTransfer.getData('text/plain');
                            if (!raw) return;
try {
                                const data = JSON.parse(raw);
                                if (data.source === 'right' && data.fromIndex !== undefined) {
                                  if (data.fromIndex === idx) return;
                                  const newOrder = nightShiftOrder.filter((_, i) => i !== data.fromIndex);
                                  const insertIdx = data.fromIndex < idx ? idx - 1 : idx;
                                  newOrder.splice(insertIdx, 0, data.staffId);
                                  setNightShiftOrder(newOrder);
                                } else if (data.source === 'left' && data.staffId && !nightShiftOrder.includes(data.staffId)) {
                                const newOrder = [...nightShiftOrder];
                                newOrder.splice(idx, 0, data.staffId);
                                setNightShiftOrder(newOrder);
                              }
                            } catch (_) {}
                          }}
                          className="flex justify-between items-center px-3 py-2 rounded-lg border border-blue-300 bg-white cursor-grab active:cursor-grabbing hover:border-blue-500 transition-all group"
                        >
                          <span className="text-stone-800 font-medium">{idx + 1}. {staff?.name || id}</span>
                          <button type="button" onClick={() => setNightShiftOrder(nightShiftOrder.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-600 font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity">削除</button>
                        </div>
                      );
                    })}
                    {nightShiftOrder.length === 0 && (
                      <p className="text-stone-500 text-sm py-4 text-center border-2 border-dashed border-slate-300 rounded-lg">ここにドロップで追加</p>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col border-2 border-blue-200 rounded-xl bg-blue-50/50 overflow-hidden">
                  <h4 className="font-bold text-stone-700 px-3 py-2 bg-blue-100 border-b border-blue-200 shrink-0">開始選択</h4>
                  <p className="text-xs text-stone-600 px-2 py-1 shrink-0">この月の開始する人を選ぶ</p>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {nightShiftOrder.map((id, idx) => {
                      const staff = staffData.find(s => s.id === id);
                      const isStart = nightShiftStartId === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setNightShiftStartId(id)}
                          className={`w-full text-left px-3 py-4 rounded-lg border-2 font-medium text-lg transition-all ${isStart ? 'bg-blue-500 border-blue-600 text-white' : 'bg-white border-slate-300 text-stone-800 hover:border-blue-400 hover:bg-blue-50'}`}
                        >
                          {isStart ? '★ ' : ''}{idx + 1}. {staff?.name || id}
                        </button>
                      );
                    })}
                    {nightShiftOrder.length === 0 && <p className="text-stone-500 text-sm py-4 text-center">順番を設定してください</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showDayShiftModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-5 z-50">
            <div className="bg-slate-50 border-2 border-slate-400 rounded-2xl p-6 w-full max-w-4xl max-h-[85vh] flex flex-col shadow-xl">
              <div className="flex justify-between items-center mb-3 shrink-0">
                <h3 className="font-bold text-stone-800 text-2xl">日勤順番リスト設定</h3>
                <button onClick={() => setShowDayShiftModal(false)} className="text-slate-600 hover:text-slate-800 transition-colors text-2xl font-bold">✕</button>
              </div>
              <p className="text-sm text-stone-600 mb-3 shrink-0">左の職員を右へドラッグして順番を構成。右側でドラッグして並び替え可能。右端で「この月の開始」を選ぶと、その人から順に割り当てます。</p>
              <div className="flex gap-4 flex-1 min-h-0">
                <div className="flex-1 min-w-0 flex flex-col border-2 border-slate-300 rounded-xl bg-white overflow-hidden">
                  <h4 className="font-bold text-stone-700 px-3 py-2 bg-slate-100 border-b border-slate-300 shrink-0">職員一覧</h4>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {staffData.filter(s => !dayShiftOrder.includes(s.id)).map(staff => (
                      <div
                        key={staff.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'left', staffId: staff.id })); e.dataTransfer.effectAllowed = 'copy'; }}
                        className="px-3 py-2 rounded-lg border border-slate-300 bg-white cursor-grab active:cursor-grabbing hover:border-emerald-400 hover:bg-emerald-50 transition-all"
                      >
                        {staff.name} ({staff.id})
                      </div>
                    ))}
                    {staffData.filter(s => !dayShiftOrder.includes(s.id)).length === 0 && (
                      <p className="text-stone-500 text-sm py-4 text-center">全員が右に追加されています</p>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col border-2 border-emerald-300 rounded-xl bg-emerald-50/30 overflow-hidden">
                  <h4 className="font-bold text-stone-700 px-3 py-2 bg-emerald-100 border-b border-emerald-300 shrink-0">順番（上から）</h4>
                  <div
                    className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[120px]"
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; e.currentTarget.classList.add('ring-2', 'ring-emerald-400'); }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('ring-2', 'ring-emerald-400'); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('ring-2', 'ring-emerald-400');
                      const raw = e.dataTransfer.getData('text/plain');
                      if (!raw) return;
                      try {
                        const { source, staffId } = JSON.parse(raw);
                        if (source === 'left' && staffId && !dayShiftOrder.includes(staffId)) setDayShiftOrder([...dayShiftOrder, staffId]);
                      } catch (_) {}
                    }}
                  >
                    {dayShiftOrder.map((id, idx) => {
                      const staff = staffData.find(s => s.id === id);
                      return (
                        <div
                          key={`${id}-${idx}`}
                          draggable
                          onDragStart={(e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'right', staffId: id, fromIndex: idx })); e.dataTransfer.effectAllowed = 'move'; }}
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.classList.add('ring-2', 'ring-inset', 'ring-emerald-500'); }}
                          onDragLeave={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-inset', 'ring-emerald-500'); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.currentTarget.classList.remove('ring-2', 'ring-inset', 'ring-emerald-500');
                            const raw = e.dataTransfer.getData('text/plain');
                            if (!raw) return;
                            try {
                              const data = JSON.parse(raw);
                              if (data.source === 'right' && data.fromIndex !== undefined) {
                                if (data.fromIndex === idx) return;
                                const newOrder = dayShiftOrder.filter((_, i) => i !== data.fromIndex);
                                const insertIdx = data.fromIndex < idx ? idx - 1 : idx;
                                newOrder.splice(insertIdx, 0, data.staffId);
                                setDayShiftOrder(newOrder);
                              } else if (data.source === 'left' && data.staffId && !dayShiftOrder.includes(data.staffId)) {
                                const newOrder = [...dayShiftOrder];
                                newOrder.splice(idx, 0, data.staffId);
                                setDayShiftOrder(newOrder);
                              }
                            } catch (_) {}
                          }}
                          className="flex justify-between items-center px-3 py-2 rounded-lg border border-emerald-300 bg-white cursor-grab active:cursor-grabbing hover:border-emerald-500 transition-all group"
                        >
                          <span className="text-stone-800 font-medium">{idx + 1}. {staff?.name || id}</span>
                          <button type="button" onClick={() => setDayShiftOrder(dayShiftOrder.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-600 font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity">削除</button>
                        </div>
                      );
                    })}
                    {dayShiftOrder.length === 0 && (
                      <p className="text-stone-500 text-sm py-4 text-center border-2 border-dashed border-slate-300 rounded-lg">ここにドロップで追加</p>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col border-2 border-emerald-200 rounded-xl bg-emerald-50/50 overflow-hidden">
                  <h4 className="font-bold text-stone-700 px-3 py-2 bg-emerald-100 border-b border-emerald-200 shrink-0">開始選択</h4>
                  <p className="text-xs text-stone-600 px-2 py-1 shrink-0">この月の開始する人を選ぶ</p>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {dayShiftOrder.map((id, idx) => {
                      const staff = staffData.find(s => s.id === id);
                      const isStart = dayShiftStartId === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setDayShiftStartId(id)}
                          className={`w-full text-left px-3 py-4 rounded-lg border-2 font-medium text-lg transition-all ${isStart ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-white border-slate-300 text-stone-800 hover:border-emerald-400 hover:bg-emerald-50'}`}
                        >
                          {isStart ? '★ ' : ''}{idx + 1}. {staff?.name || id}
                        </button>
                      );
                    })}
                    {dayShiftOrder.length === 0 && <p className="text-stone-500 text-sm py-4 text-center">順番を設定してください</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showPairModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-5 z-50">
            <div className="bg-slate-50 border-2 border-slate-400 rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl">
              <div className="flex justify-between items-center mb-3 shrink-0">
                <h3 className="font-bold text-stone-800 text-2xl">ペア設定</h3>
                <button onClick={() => { setShowPairModal(false); setPairIncompleteFirst(null); }} className="text-slate-600 hover:text-slate-800 transition-colors text-2xl font-bold">✕</button>
              </div>
              <p className="text-sm text-stone-600 mb-3 shrink-0">左の職員を右へドラッグしてペアを構成。1人目を「新規ペア」にドロップ→2人目をその行にドロップ。</p>
              <div className="flex gap-4 flex-1 min-h-0">
                <div className="flex-1 min-w-0 flex flex-col border-2 border-slate-300 rounded-xl bg-white overflow-hidden">
                  <h4 className="font-bold text-stone-700 px-3 py-2 bg-slate-100 border-b border-slate-300 shrink-0">職員一覧</h4>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {staffData.filter(s => !pairs.some(p => p.person1 === s.id || p.person2 === s.id) && s.id !== pairIncompleteFirst).map(staff => (
                      <div
                        key={staff.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'left', staffId: staff.id })); e.dataTransfer.effectAllowed = 'copy'; }}
                        className="px-3 py-2 rounded-lg border border-slate-300 bg-white cursor-grab active:cursor-grabbing hover:border-orange-400 hover:bg-orange-50 transition-all"
                      >
                        {staff.name} ({staff.id})
                      </div>
                    ))}
                    {staffData.filter(s => !pairs.some(p => p.person1 === s.id || p.person2 === s.id) && s.id !== pairIncompleteFirst).length === 0 && (
                      <p className="text-stone-500 text-sm py-4 text-center">全員がペアに含まれています</p>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col border-2 border-orange-300 rounded-xl bg-orange-50/30 overflow-hidden">
                  <h4 className="font-bold text-stone-700 px-3 py-2 bg-orange-100 border-b border-orange-300 shrink-0">ペア一覧</h4>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[120px]">
                    {pairs.map((pair, idx) => {
                      const staff1 = staffData.find(s => s.id === pair.person1);
                      const staff2 = staffData.find(s => s.id === pair.person2);
                      return (
                        <div key={idx} className="flex justify-between items-center px-3 py-2 rounded-lg border border-orange-300 bg-white transition-all group">
                          <span className="text-stone-800 font-medium">{staff1?.name || pair.person1} ↔ {staff2?.name || pair.person2}</span>
                          <button type="button" onClick={() => setPairs(pairs.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-600 font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity">削除</button>
                        </div>
                      );
                    })}
                    {pairIncompleteFirst && (() => {
                      const staff = staffData.find(s => s.id === pairIncompleteFirst);
                      return (
                        <div
                          className="px-3 py-2 rounded-lg border-2 border-dashed border-orange-400 bg-orange-50 min-h-[44px] flex items-center justify-between"
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; e.currentTarget.classList.add('ring-2', 'ring-orange-400'); }}
                          onDragLeave={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-orange-400'); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('ring-2', 'ring-orange-400');
                            const raw = e.dataTransfer.getData('text/plain');
                            if (!raw) return;
                            try {
                              const { source, staffId } = JSON.parse(raw);
                              if (source === 'left' && staffId && staffId !== pairIncompleteFirst) {
                                addPair(pairIncompleteFirst, staffId);
                                setPairIncompleteFirst(null);
                              }
                            } catch (_) {}
                          }}
                        >
                          <span className="text-stone-700">{staff?.name || pairIncompleteFirst} — </span>
                          <span className="text-orange-600 text-sm font-medium">2人目をここにドロップ</span>
                          <button type="button" onClick={() => setPairIncompleteFirst(null)} className="text-slate-500 hover:text-slate-700 text-sm">キャンセル</button>
                        </div>
                      );
                    })()}
                    {!pairIncompleteFirst && (
                      <div
                        className="text-stone-500 text-sm py-4 text-center border-2 border-dashed border-slate-300 rounded-lg min-h-[52px] flex items-center justify-center"
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; e.currentTarget.classList.add('ring-2', 'ring-orange-400', 'bg-orange-50'); }}
                        onDragLeave={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-orange-400', 'bg-orange-50'); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('ring-2', 'ring-orange-400', 'bg-orange-50');
                          const raw = e.dataTransfer.getData('text/plain');
                          if (!raw) return;
                          try {
                            const { source, staffId } = JSON.parse(raw);
                            if (source === 'left' && staffId) setPairIncompleteFirst(staffId);
                          } catch (_) {}
                        }}
                      >
                        新規ペア: 1人目をここにドロップ
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
