import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';

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

const SLOT_FIELDS = ['dayShift', 'support', 'nightShift', 'b', 'dayOff'];

export default function ShiftScheduleScreen({ onBack }) {
  const { staffData } = useData();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [calendar, setCalendar] = useState([]);
  const [surgeryDays, setSurgeryDays] = useState([]);
  const [nightShiftOrder, setNightShiftOrder] = useState([]);
  const [dayShiftOrder, setDayShiftOrder] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [schedule, setSchedule] = useState({});
  const [weeklyOff, setWeeklyOff] = useState({});
  const [showNightShiftModal, setShowNightShiftModal] = useState(false);
  const [showDayShiftModal, setShowDayShiftModal] = useState(false);
  const [showPairModal, setShowPairModal] = useState(false);
  const [nightShiftStartId, setNightShiftStartId] = useState('');
  const [dayShiftStartId, setDayShiftStartId] = useState('');
  const [internalMedicineDays, setInternalMedicineDays] = useState([]);
  const [manualOverrides, setManualOverrides] = useState({});
  const [leftOverrides, setLeftOverrides] = useState({});
  const [pairDraft, setPairDraft] = useState({ person1: null, person2: null });

  useEffect(() => {
    if (!startDate || !endDate) return;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) return;
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    const holidays = new Set();
    for (let y = startYear; y <= endYear; y++) {
      getHolidays(y).forEach(d => holidays.add(d));
    }
    const days = [];
    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const dayOfWeek = current.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
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
  }, [startDate, endDate]);

  const getNextDayNightShift = (dateStr) => {
    const idx = calendar.findIndex(d => d.date === dateStr);
    if (idx < 0 || idx >= calendar.length - 1) return null;
    const nextDate = calendar[idx + 1].date;
    return leftOverrides[nextDate]?.nightShift ?? schedule[nextDate]?.nightShift ?? null;
  };

  const toggleSurgeryDay = (date) => {
    const isAdding = !surgeryDays.includes(date);
    setSurgeryDays(prev => (prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]));
    if (isAdding) {
      const nextNightShift = getNextDayNightShift(date);
      if (nextNightShift) {
        setSchedule(prev => ({ ...prev, [date]: { ...(prev[date] || {}), b: nextNightShift } }));
      }
    } else {
      setSchedule(prev => ({ ...prev, [date]: { ...(prev[date] || {}), b: null } }));
      setLeftOverrides(prev => {
        const next = { ...prev };
        if (next[date]) {
          delete next[date].b;
          if (Object.keys(next[date]).length === 0) delete next[date];
        }
        return next;
      });
      setManualOverrides(prev => {
        const next = { ...prev };
        if (next[date]) {
          delete next[date].b;
          if (Object.keys(next[date]).length === 0) delete next[date];
        }
        return next;
      });
    }
  };

  const toggleInternalMedicineDay = (date) => {
    setInternalMedicineDays(prev => (prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]));
  };

  const getCellValue = (dateStr, field) => manualOverrides[dateStr]?.[field] ?? schedule[dateStr]?.[field] ?? null;

  const setManualOverride = (dateStr, field, staffId) => {
    setManualOverrides(prev => {
      const next = { ...prev };
      if (!next[dateStr]) next[dateStr] = {};
      if (staffId === '' || staffId == null) {
        delete next[dateStr][field];
        if (Object.keys(next[dateStr]).length === 0) delete next[dateStr];
      } else {
        next[dateStr][field] = staffId;
      }
      return next;
    });
  };

  const setLeftOverride = (dateStr, field, staffId) => {
    setLeftOverrides(prev => {
      const next = { ...prev };
      if (!next[dateStr]) next[dateStr] = {};
      if (staffId === '' || staffId == null) {
        delete next[dateStr][field];
        if (Object.keys(next[dateStr]).length === 0) delete next[dateStr];
      } else {
        next[dateStr][field] = staffId;
      }
      return next;
    });
  };

  const applyNightShiftLeftChange = (dateStr, staffId) => {
    const idx = calendar.findIndex(d => d.date === dateStr);
    setLeftOverrides(prev => {
      const next = {};
      Object.keys(prev).forEach(d => { next[d] = { ...prev[d] }; });
      const set = (d, f, v) => {
        if (!next[d]) next[d] = {};
        if (v) next[d][f] = v; else { delete next[d][f]; if (Object.keys(next[d]).length === 0) delete next[d]; }
      };
      set(dateStr, 'nightShift', staffId || null);
      if (idx >= 0 && idx < calendar.length - 1) set(calendar[idx + 1].date, 'dayOff', staffId || null);
      if (idx >= 1 && surgeryDays.includes(calendar[idx - 1].date)) set(calendar[idx - 1].date, 'b', staffId || null);
      return next;
    });
  };

  const applyNightShiftRightChange = (dateStr, staffId) => {
    const idx = calendar.findIndex(d => d.date === dateStr);
    setManualOverrides(prev => {
      const next = {};
      Object.keys(prev).forEach(d => { next[d] = { ...prev[d] }; });
      const set = (d, f, v) => {
        if (!next[d]) next[d] = {};
        if (v) next[d][f] = v; else { delete next[d][f]; if (Object.keys(next[d]).length === 0) delete next[d]; }
      };
      set(dateStr, 'nightShift', staffId || null);
      if (idx >= 0 && idx < calendar.length - 1) set(calendar[idx + 1].date, 'dayOff', staffId || null);
      return next;
    });
    if (idx >= 1 && surgeryDays.includes(calendar[idx - 1].date)) {
      setLeftOverride(calendar[idx - 1].date, 'b', staffId || null);
    }
  };

  const getOrderFromStart = (order, startId) => {
    if (!startId || order.length === 0) return order;
    const idx = order.indexOf(startId);
    if (idx <= 0) return order;
    return [...order.slice(idx), ...order.slice(0, idx)];
  };

  const autoAssign = () => {
    if (calendar.length === 0) {
      alert('⚠️ 開始日・終了日を設定してください');
      return;
    }
    if (nightShiftOrder.length === 0) {
      alert('⚠️ 夜勤順番リストを設定してください');
      return;
    }
    const effectiveNight = getOrderFromStart(nightShiftOrder, nightShiftStartId || null);
    const effectiveDay = getOrderFromStart(dayShiftOrder, dayShiftStartId || null);
    const newSchedule = {};
    let nightIndex = 0;
    let dayIndex = 0;
    calendar.forEach((day, idx) => {
      const dateStr = day.date;
      newSchedule[dateStr] = { nightShift: null, dayShift: null, support: null, b: null, dayOff: null };
      if (effectiveNight.length > 0) {
        newSchedule[dateStr].nightShift = effectiveNight[nightIndex % effectiveNight.length];
        nightIndex++;
      }
      if (day.isWeekend || day.isHoliday) {
        if (effectiveDay.length > 0) {
          const dayShiftPerson = effectiveDay[dayIndex % effectiveDay.length];
          newSchedule[dateStr].dayShift = dayShiftPerson;
          const pair = pairs.find(p => p.person1 === dayShiftPerson || p.person2 === dayShiftPerson);
          if (pair) {
            newSchedule[dateStr].support = pair.person1 === dayShiftPerson ? pair.person2 : pair.person1;
          }
          dayIndex++;
        }
      }
    });
    calendar.forEach((day, idx) => {
      const dateStr = day.date;
      if (idx > 0) {
        const prevDate = calendar[idx - 1].date;
        if (newSchedule[prevDate]?.nightShift) {
          newSchedule[dateStr].dayOff = newSchedule[prevDate].nightShift;
        }
      } else if (idx === 0 && effectiveNight.length > 0) {
        newSchedule[dateStr].dayOff = effectiveNight[effectiveNight.length - 1];
      }
      if (surgeryDays.includes(dateStr) && idx < calendar.length - 1) {
        const nextDate = calendar[idx + 1].date;
        if (newSchedule[nextDate]?.nightShift) {
          newSchedule[dateStr].b = newSchedule[nextDate].nightShift;
        }
      }
    });
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
    const newWeeklyOff = {};
    staffData.forEach(staff => {
      const staffId = staff.id;
      let weeklyOffDays = 0;
      calendar.forEach((day) => {
        const dateStr = day.date;
        const daySchedule = schedule[dateStr];
        if (!daySchedule) return;
        if (day.dayOfWeekNum === 5 && daySchedule.nightShift === staffId) weeklyOffDays += 1;
        if (day.dayOfWeekNum === 6 && daySchedule.nightShift === staffId) weeklyOffDays += 2;
        if (day.dayOfWeekNum === 6 && daySchedule.dayShift === staffId) weeklyOffDays += 1;
        if ((day.dayOfWeekNum === 6 || day.dayOfWeekNum === 0) && daySchedule.b === staffId) weeklyOffDays += 1;
        if (day.dayOfWeekNum === 0 && daySchedule.dayShift === staffId) weeklyOffDays += 1;
        if (day.dayOfWeekNum === 0 && daySchedule.nightShift === staffId) weeklyOffDays += 1;
      });
      let assignedDays = 0;
      for (let i = 0; i < calendar.length && assignedDays < weeklyOffDays; i++) {
        const day = calendar[i];
        const dateStr = day.date;
        if (!day.isWeekend && !day.isHoliday) {
          const hasOtherLeave = leaveData[dateStr]?.some(leave => leave.staffId === staffId);
          const daySchedule = schedule[dateStr];
          const isAssigned = daySchedule?.nightShift === staffId || daySchedule?.dayShift === staffId || daySchedule?.support === staffId || daySchedule?.b === staffId || daySchedule?.dayOff === staffId;
          if (!hasOtherLeave && !isAssigned) {
            if (!newWeeklyOff[dateStr]) newWeeklyOff[dateStr] = [];
            if (!newWeeklyOff[dateStr].includes(staffId)) {
              newWeeklyOff[dateStr].push(staffId);
              assignedDays++;
            }
          }
        }
      }
    });
    // 外科にチェックを入れた日：割り当てる職員は翌日の夜勤者
    surgeryDays.forEach((dateStr) => {
      const idx = calendar.findIndex(d => d.date === dateStr);
      if (idx >= 0 && idx < calendar.length - 1) {
        const nextDate = calendar[idx + 1].date;
        const nextNightShift = schedule[nextDate]?.nightShift;
        if (nextNightShift) {
          if (!newWeeklyOff[dateStr]) newWeeklyOff[dateStr] = [];
          if (!newWeeklyOff[dateStr].includes(nextNightShift)) {
            newWeeklyOff[dateStr].push(nextNightShift);
          }
        }
      }
    });
    setWeeklyOff(newWeeklyOff);
    alert('✅ 週休を自動割り当てしました');
  };

  const updateSchedule = (date, field, value) => {
    setSchedule(prev => ({ ...prev, [date]: { ...prev[date], [field]: value } }));
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

  const getStaffName = (staffId) => staffData.find(s => s.id === staffId)?.name || staffId;

  const staffSortedById = React.useMemo(() =>
    [...staffData].sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true })),
    [staffData]
  );

  const addToNightShiftOrder = (staffId) => {
    if (!nightShiftOrder.includes(staffId)) setNightShiftOrder([...nightShiftOrder, staffId]);
  };

  const addToDayShiftOrder = (staffId) => {
    if (!dayShiftOrder.includes(staffId)) setDayShiftOrder([...dayShiftOrder, staffId]);
  };

  const handleNightOrderDrop = (e, dropIndex) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    try {
      const { type, staffId, index: dragIndex } = JSON.parse(raw);
      if (type === 'staff' && staffId) {
        if (nightShiftOrder.includes(staffId)) return;
        const next = [...nightShiftOrder];
        next.splice(dropIndex, 0, staffId);
        setNightShiftOrder(next);
      } else if (type === 'order' && dragIndex !== undefined && dragIndex !== dropIndex) {
        const next = [...nightShiftOrder];
        const [removed] = next.splice(dragIndex, 1);
        const to = dropIndex > dragIndex ? dropIndex - 1 : dropIndex;
        next.splice(to, 0, removed);
        setNightShiftOrder(next);
      }
    } catch (_) {}
  };

  const handleDayOrderDrop = (e, dropIndex) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    try {
      const { type, staffId, index: dragIndex } = JSON.parse(raw);
      if (type === 'staff' && staffId) {
        if (dayShiftOrder.includes(staffId)) return;
        const next = [...dayShiftOrder];
        next.splice(dropIndex, 0, staffId);
        setDayShiftOrder(next);
      } else if (type === 'order' && dragIndex !== undefined && dragIndex !== dropIndex) {
        const next = [...dayShiftOrder];
        const [removed] = next.splice(dragIndex, 1);
        const to = dropIndex > dragIndex ? dropIndex - 1 : dropIndex;
        next.splice(to, 0, removed);
        setDayShiftOrder(next);
      }
    } catch (_) {}
  };

  const addPair = (person1, person2) => {
    if (person1 && person2 && person1 !== person2) setPairs([...pairs, { person1, person2 }]);
  };

  const handlePairDropZone = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('ring-2', 'ring-orange-400');
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    try {
      const data = raw.startsWith('{') ? JSON.parse(raw) : { staffId: raw };
      const staffId = data.staffId || data;
      if (!staffId) return;
      if (!pairDraft.person1) {
        setPairDraft(prev => ({ ...prev, person1: staffId }));
      } else if (pairDraft.person1 !== staffId) {
        addPair(pairDraft.person1, staffId);
        setPairDraft({ person1: null, person2: null });
      }
    } catch (_) {}
  };

  useEffect(() => {
    const data = { startDate, endDate, calendar, surgeryDays, internalMedicineDays, nightShiftOrder, dayShiftOrder, nightShiftStartId, dayShiftStartId, pairs, schedule, weeklyOff, manualOverrides, leftOverrides };
    if (!startDate && !endDate && calendar.length === 0) return;
    localStorage.setItem('scheduleData', JSON.stringify(data));
  }, [startDate, endDate, calendar, surgeryDays, internalMedicineDays, nightShiftOrder, dayShiftOrder, nightShiftStartId, dayShiftStartId, pairs, schedule, weeklyOff, manualOverrides, leftOverrides]);

  useEffect(() => {
    const saved = localStorage.getItem('scheduleData');
    if (saved) {
      const data = JSON.parse(saved);
      setStartDate(data.startDate || '');
      setEndDate(data.endDate || '');
      setCalendar(data.calendar || []);
      setSurgeryDays(data.surgeryDays || []);
      setInternalMedicineDays(data.internalMedicineDays || []);
      setNightShiftOrder(data.nightShiftOrder || []);
      setDayShiftOrder(data.dayShiftOrder || []);
      setNightShiftStartId(data.nightShiftStartId || '');
      setDayShiftStartId(data.dayShiftStartId || '');
      setPairs(data.pairs || []);
      setSchedule(data.schedule || {});
      setWeeklyOff(data.weeklyOff || {});
      setManualOverrides(data.manualOverrides || {});
      setLeftOverrides(data.leftOverrides || {});
    }
  }, []);

  return (
    <div className="min-h-screen bg-violet-400 p-5 relative overflow-hidden">
      <div className="absolute top-20 left-20 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto relative">
        <div className="flex justify-between items-center gap-4 mb-3">
          <h2 className="text-3xl font-bold text-stone-800">当番表作成</h2>
          <button onClick={onBack} className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 border-2 border-slate-400 rounded-xl text-stone-800 text-lg font-semibold transition-all shadow-sm">
            ← メインメニュー
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-3">
          <div className="min-w-0 bg-slate-50 rounded-2xl border-2 border-slate-400 p-6 shadow-sm hover:border-slate-400 transition-all">
            <h3 className="font-bold mb-3 text-stone-800 text-2xl">📅 期間設定</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-base mb-1.5 font-semibold text-stone-600 uppercase tracking-wider">開始日</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-3 bg-slate-50 border-2 border-slate-400 rounded-xl text-stone-800 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-base mb-1.5 font-semibold text-stone-600 uppercase tracking-wider">終了日</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-3 bg-slate-50 border-2 border-slate-400 rounded-xl text-stone-800 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all" />
              </div>
            </div>
          </div>
          <div className="min-w-0 bg-slate-50 rounded-2xl border-2 border-slate-400 p-6 shadow-sm hover:border-slate-400 transition-all w-full">
            <h3 className="font-bold mb-3 text-stone-800 text-2xl">👥 順番設定</h3>
            <div className="space-y-4 w-full">
              <div className="flex items-center gap-2 w-full min-h-[44px]">
                <button onClick={() => setShowNightShiftModal(true)} className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-base font-semibold shadow-md transition-all shrink-0 h-[44px] flex items-center">夜勤順番 ({nightShiftOrder.length}名)</button>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <label className="text-xs font-medium text-stone-500 shrink-0">開始する人</label>
                  <select value={nightShiftStartId} onChange={(e) => setNightShiftStartId(e.target.value)} className="flex-1 min-w-0 p-2.5 border-2 border-slate-400 rounded-lg text-stone-800 text-sm font-medium bg-white h-[44px]">
                    <option value="">選択</option>
                    {nightShiftOrder.map(id => {
                      const s = staffData.find(x => x.id === id);
                      return <option key={id} value={id}>{s?.name ?? id}</option>;
                    })}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full min-h-[44px]">
                <button onClick={() => setShowDayShiftModal(true)} className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-base font-semibold shadow-md transition-all shrink-0 h-[44px] flex items-center">日勤順番 ({dayShiftOrder.length}名)</button>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <label className="text-xs font-medium text-stone-500 shrink-0">開始する人</label>
                  <select value={dayShiftStartId} onChange={(e) => setDayShiftStartId(e.target.value)} className="flex-1 min-w-0 p-2.5 border-2 border-slate-400 rounded-lg text-stone-800 text-sm font-medium bg-white h-[44px]">
                    <option value="">選択</option>
                    {dayShiftOrder.map(id => {
                      const s = staffData.find(x => x.id === id);
                      return <option key={id} value={id}>{s?.name ?? id}</option>;
                    })}
                  </select>
                </div>
              </div>
              <button onClick={() => setShowPairModal(true)} className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-base font-semibold shadow-md transition-all min-h-[44px] flex items-center justify-center">ペア設定 ({pairs.length}組)</button>
            </div>
          </div>
          <div className="min-w-0 bg-slate-50 rounded-2xl border-2 border-slate-400 p-6 shadow-sm hover:border-slate-400 transition-all">
            <h3 className="font-bold mb-3 text-stone-800 text-2xl">⚙️ 実行</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex flex-col gap-2">
                <button onClick={autoAssign} className="w-full px-5 py-5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-lg font-semibold shadow-md transition-all min-h-[88px] flex flex-col items-center justify-center gap-2">
                  <span className="text-2xl" aria-hidden>🎯</span>
                  <span>当番自動配置</span>
                </button>
                <button onClick={() => { setLeftOverrides({}); setManualOverrides({}); alert('✅ 変更された配置をもとに戻しました'); }} className="w-full px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-stone-700 rounded-xl text-sm font-semibold shadow-sm transition-all">
                  変更された配置をもとに戻す
                </button>
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <button onClick={autoAssignWeeklyOff} className="w-full px-5 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-lg font-semibold shadow-md transition-all min-h-[88px] flex flex-col items-center justify-center gap-2">
                  <span className="text-2xl" aria-hidden>📅</span>
                  <span>週休割り当て</span>
                </button>
                <button onClick={() => { setWeeklyOff({}); alert('✅ 週休割り当てをリセットしました'); }} className="w-full px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-stone-700 rounded-xl text-sm font-semibold shadow-sm transition-all">
                  週休割り当てをリセット
                </button>
              </div>
            </div>
          </div>
        </div>

        {calendar.length > 0 && (
          <div className="bg-slate-50 rounded-2xl border-2 border-slate-400 p-6 shadow-sm">
            <h3 className="font-bold mb-3 text-stone-800 text-2xl">📆 当番表カレンダー</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm table-fixed" style={{ minWidth: '900px' }}>
                <colgroup>
                  <col style={{ width: '90px', minWidth: '90px' }} />
                  <col style={{ width: '32px', minWidth: '32px' }} />
                  {SLOT_FIELDS.map(f => (
                    <React.Fragment key={f}>
                      <col style={{ width: '88px', minWidth: '88px' }} />
                      <col style={{ width: '88px', minWidth: '88px' }} />
                    </React.Fragment>
                  ))}
                  <col style={{ width: '44px', minWidth: '44px' }} />
                  <col style={{ width: '44px', minWidth: '44px' }} />
                </colgroup>
                <thead>
                  <tr className="border border-slate-400 bg-slate-100">
                    <th className="p-1 border border-slate-400 text-center text-stone-600 font-semibold text-xs">日付</th>
                    <th className="p-1 border border-slate-400 text-center text-stone-600 font-semibold text-xs">曜日</th>
                    {['日勤', 'サポート', '夜勤', 'B', '非番'].map(label => (
                      <th key={label} colSpan={2} className="p-1 border border-slate-400 text-center text-stone-700 font-semibold text-xs">{label}</th>
                    ))}
                    <th className="p-1 border border-slate-400 text-center text-stone-600 font-semibold text-xs">外科</th>
                    <th className="p-1 border border-slate-400 text-center text-stone-600 font-semibold text-xs">内科</th>
                  </tr>
                </thead>
                <tbody>
                  {calendar.map(day => {
                    const isSurgery = surgeryDays.includes(day.date);
                    const isInternal = internalMedicineDays.includes(day.date);
                    const daySchedule = schedule[day.date] || {};
                    const hasFrame = isSurgery || isInternal;
                    const frameColor = isSurgery ? 'border-yellow-400' : isInternal ? 'border-pink-700' : '';
                    const isSunSatOrHoliday = day.isWeekend || day.isHoliday;
                    const nightShiftStaff = nightShiftOrder.map(id => staffData.find(s => s.id === id)).filter(Boolean);
                    const dayShiftStaff = dayShiftOrder.map(id => staffData.find(s => s.id === id)).filter(Boolean);
                    const staffOptions = (field) => {
                      if (field === 'nightShift') return nightShiftStaff;
                      if (field === 'dayShift' || field === 'support') return dayShiftStaff;
                      return staffData;
                    };
                    return (
                      <tr key={day.date} className={`transition-all ${day.isWeekend ? 'bg-slate-50' : ''}`}>
                        <td className={`p-1 text-center text-stone-800 text-xs overflow-hidden bg-white border border-slate-400 ${hasFrame ? `border-l-2 border-t-2 border-b-2 ${frameColor}` : ''}`} style={{ minWidth: 0 }}>
                          <span className="inline-block truncate max-w-full" title={day.date}>{day.date}</span>
                        </td>
                        <td className={`p-1 text-center font-bold text-xs bg-white border border-slate-400 ${hasFrame ? `border-t-2 border-b-2 ${frameColor}` : ''} ${isSunSatOrHoliday ? 'text-red-600' : 'text-stone-800'}`}>{day.dayOfWeek}</td>
                        {SLOT_FIELDS.map((field, fieldIdx) => {
                          const slotColors = { dayShift: 'bg-green-50', support: 'bg-yellow-50', nightShift: 'bg-blue-50', b: 'bg-orange-50', dayOff: 'bg-red-50' };
                          const slotColor = slotColors[field] || '';
                          const boxInner = 'm-0.5 rounded min-h-[20px] flex items-center justify-center bg-white/20';
                          const options = staffOptions(field);
                          const isLastSlotCell = fieldIdx === SLOT_FIELDS.length - 1;
                          const rawLeftB = leftOverrides[day.date]?.b ?? schedule[day.date]?.b;
                          const leftValue = field === 'b' && isSurgery
                            ? (rawLeftB ?? getNextDayNightShift(day.date) ?? '')
                            : (leftOverrides[day.date]?.[field] ?? schedule[day.date]?.[field] ?? '');
                          const leftIsEdited = leftOverrides[day.date]?.[field] !== undefined;
                          const rightValue = field === 'b'
                            ? (manualOverrides[day.date]?.b ?? '')
                            : (manualOverrides[day.date]?.[field] ?? '');
                          return (
                            <React.Fragment key={field}>
                              <td className={`p-0.5 text-center text-xs ${slotColor} overflow-hidden align-middle border border-slate-400 ${hasFrame ? `border-t-2 border-b-2 ${frameColor}` : ''} ${leftIsEdited ? 'text-red-600' : 'text-stone-800'}`} style={{ minWidth: 0 }}>
                                <div className={boxInner}>
                                  <select value={leftValue || ''} onChange={(e) => (field === 'nightShift' ? applyNightShiftLeftChange(day.date, e.target.value || null) : setLeftOverride(day.date, field, e.target.value || null))} className={`w-full min-w-0 text-xs font-bold bg-transparent border-0 py-0.5 pr-0 pl-1 focus:ring-0 focus:outline-none cursor-pointer appearance-none text-center ${leftIsEdited ? 'text-red-600' : 'text-stone-800'}`}>
                                    <option value="">－</option>
                                    {options.map(s => (
                                      <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </td>
                              <td className={`p-0.5 align-middle overflow-hidden ${slotColor} border border-slate-400 ${hasFrame ? (isLastSlotCell ? `border-r-2 border-t-2 border-b-2 ${frameColor}` : `border-t-2 border-b-2 ${frameColor}`) : ''}`} style={{ minWidth: 0 }}>
                                <div className={boxInner}>
                                  <select value={rightValue} onChange={(e) => (field === 'nightShift' ? applyNightShiftRightChange(day.date, e.target.value || null) : setManualOverride(day.date, field, e.target.value || null))} className="w-full min-w-0 text-xs font-bold text-red-600 bg-transparent border-0 py-0.5 pr-0 pl-1 focus:ring-0 focus:outline-none cursor-pointer appearance-none text-center">
                                    <option value=""> </option>
                                    {options.map(s => (
                                      <option key={s.id} value={s.id} className="text-red-600 font-bold">{s.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </td>
                            </React.Fragment>
                          );
                        })}
                        <td className="p-1 border border-slate-400 text-center">
                          <button type="button" onClick={() => toggleSurgeryDay(day.date)} className={`px-1.5 py-0.5 rounded text-xs font-semibold transition-all ${isSurgery ? 'bg-amber-500 hover:bg-amber-400 text-white' : 'bg-stone-200 hover:bg-stone-300 text-stone-600'}`}>{isSurgery ? '✓' : '－'}</button>
                        </td>
                        <td className="p-1 border border-slate-400 text-center">
                          <input type="checkbox" checked={isInternal} onChange={() => toggleInternalMedicineDay(day.date)} className="w-3.5 h-3.5 rounded border-slate-400 text-pink-700 focus:ring-pink-500" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showNightShiftModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-5 z-50">
            <div className="bg-slate-50 border-2 border-slate-400 rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl">
              <div className="flex justify-between items-center mb-4 shrink-0">
                <h3 className="font-bold text-stone-800 text-2xl">夜勤順番</h3>
                <button onClick={() => setShowNightShiftModal(false)} className="text-stone-400 hover:text-stone-600 transition-colors text-2xl">✕</button>
              </div>
              <p className="text-stone-600 text-sm mb-3 shrink-0">左のリストからドラッグして右の順番エリアにドロップ。右側でドラッグして並び替え可能。</p>
              <div className="flex gap-4 flex-1 min-h-0">
                <div className="w-48 shrink-0 flex flex-col">
                  <h4 className="font-semibold text-stone-700 text-sm mb-2">職員（ID順）</h4>
                  <div className="flex-1 overflow-y-auto border-2 border-slate-300 rounded-xl p-2 bg-slate-100/80 space-y-1">
                    {staffSortedById.map(s => (
                      <div
                        key={s.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'staff', staffId: s.id }))}
                        className="px-3 py-2 rounded-lg bg-white border border-slate-400 cursor-grab active:cursor-grabbing text-stone-800 text-sm font-medium shadow-sm hover:shadow"
                      >
                        {s.id} {s.name}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-1 flex flex-col min-w-0">
                  <h4 className="font-semibold text-stone-700 text-sm mb-2">順番（上から）</h4>
                  <div className="flex-1 overflow-y-auto border-2 border-dashed border-blue-400 rounded-xl p-2 bg-blue-50/50 space-y-1 min-h-[200px]">
                    {nightShiftOrder.length === 0 && (
                      <div
                        className="flex items-center justify-center h-20 text-stone-400 text-sm border-2 border-dashed border-slate-300 rounded-lg"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleNightOrderDrop(e, 0)}
                      >ここにドロップ</div>
                    )}
                    {nightShiftOrder.map((id, idx) => {
                      const staff = staffData.find(s => s.id === id);
                      return (
                        <div
                          key={`${id}-${idx}`}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'order', staffId: id, index: idx }))}
                          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-blue-400'); }}
                          onDragLeave={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-blue-400'); }}
                          onDrop={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-blue-400'); handleNightOrderDrop(e, idx); }}
                          className="flex justify-between items-center px-3 py-2 rounded-lg bg-white border border-blue-300 cursor-grab active:cursor-grabbing text-stone-800 text-sm"
                        >
                          <span>{idx + 1}. {staff?.name || id}</span>
                          <button type="button" onClick={() => setNightShiftOrder(nightShiftOrder.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-600 font-semibold text-xs shrink-0">削除</button>
                        </div>
                      );
                    })}
                    {nightShiftOrder.length > 0 && (
                      <div
                        className="h-8 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-stone-400 text-xs"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleNightOrderDrop(e, nightShiftOrder.length)}
                      >末尾にドロップ</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showDayShiftModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-5 z-50">
            <div className="bg-slate-50 border-2 border-slate-400 rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl">
              <div className="flex justify-between items-center mb-4 shrink-0">
                <h3 className="font-bold text-stone-800 text-2xl">日勤順番</h3>
                <button onClick={() => setShowDayShiftModal(false)} className="text-stone-400 hover:text-stone-600 transition-colors text-2xl">✕</button>
              </div>
              <p className="text-stone-600 text-sm mb-3 shrink-0">左のリストからドラッグして右の順番エリアにドロップ。右側でドラッグして並び替え可能。</p>
              <div className="flex gap-4 flex-1 min-h-0">
                <div className="w-48 shrink-0 flex flex-col">
                  <h4 className="font-semibold text-stone-700 text-sm mb-2">職員（ID順）</h4>
                  <div className="flex-1 overflow-y-auto border-2 border-slate-300 rounded-xl p-2 bg-slate-100/80 space-y-1">
                    {staffSortedById.map(s => (
                      <div
                        key={s.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'staff', staffId: s.id }))}
                        className="px-3 py-2 rounded-lg bg-white border border-slate-400 cursor-grab active:cursor-grabbing text-stone-800 text-sm font-medium shadow-sm hover:shadow"
                      >
                        {s.id} {s.name}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-1 flex flex-col min-w-0">
                  <h4 className="font-semibold text-stone-700 text-sm mb-2">順番（上から）</h4>
                  <div className="flex-1 overflow-y-auto border-2 border-dashed border-emerald-400 rounded-xl p-2 bg-emerald-50/50 space-y-1 min-h-[200px]">
                    {dayShiftOrder.length === 0 && (
                      <div
                        className="flex items-center justify-center h-20 text-stone-400 text-sm border-2 border-dashed border-slate-300 rounded-lg"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDayOrderDrop(e, 0)}
                      >ここにドロップ</div>
                    )}
                    {dayShiftOrder.map((id, idx) => {
                      const staff = staffData.find(s => s.id === id);
                      return (
                        <div
                          key={`${id}-${idx}`}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'order', staffId: id, index: idx }))}
                          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-emerald-400'); }}
                          onDragLeave={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-emerald-400'); }}
                          onDrop={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-emerald-400'); handleDayOrderDrop(e, idx); }}
                          className="flex justify-between items-center px-3 py-2 rounded-lg bg-white border border-emerald-300 cursor-grab active:cursor-grabbing text-stone-800 text-sm"
                        >
                          <span>{idx + 1}. {staff?.name || id}</span>
                          <button type="button" onClick={() => setDayShiftOrder(dayShiftOrder.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-600 font-semibold text-xs shrink-0">削除</button>
                        </div>
                      );
                    })}
                    {dayShiftOrder.length > 0 && (
                      <div
                        className="h-8 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-stone-400 text-xs"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDayOrderDrop(e, dayShiftOrder.length)}
                      >末尾にドロップ</div>
                    )}
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
                <button onClick={() => { setPairDraft({ person1: null, person2: null }); setShowPairModal(false); }} className="text-stone-400 hover:text-stone-600 transition-colors text-2xl">✕</button>
              </div>
              <p className="text-stone-600 text-sm mb-3 shrink-0">左のリストから職員をドラッグし、右の「ペアを追加」に2人ドロップするとペアになります。ドロップダウンからも追加できます。</p>
              <div className="flex gap-4 flex-1 min-h-0 mb-4">
                <div className="w-48 shrink-0 flex flex-col">
                  <h4 className="font-semibold text-stone-700 text-sm mb-2">職員（ID順）</h4>
                  <div className="flex-1 overflow-y-auto border-2 border-slate-300 rounded-xl p-2 bg-slate-100/80 space-y-1">
                    {staffSortedById.map(s => (
                      <div
                        key={s.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ staffId: s.id }))}
                        className="px-3 py-2 rounded-lg bg-white border border-slate-400 cursor-grab active:cursor-grabbing text-stone-800 text-sm font-medium shadow-sm hover:shadow"
                      >
                        {s.id} {s.name}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-1 flex flex-col min-w-0">
                  <h4 className="font-semibold text-stone-700 text-sm mb-2">ペアを追加（ドラッグ＆ドロップ）</h4>
                  <div
                    className="flex-1 min-h-[120px] border-2 border-dashed border-orange-400 rounded-xl p-4 bg-orange-50/50 flex flex-col items-center justify-center gap-2"
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; e.currentTarget.classList.add('ring-2', 'ring-orange-400'); }}
                    onDragLeave={(e) => e.currentTarget.classList.remove('ring-2', 'ring-orange-400')}
                    onDrop={handlePairDropZone}
                  >
                    {pairDraft.person1 ? (
                      <span className="text-stone-700 text-sm font-medium">{staffData.find(s => s.id === pairDraft.person1)?.name || pairDraft.person1} ↔ もう1人ドロップ</span>
                    ) : (
                      <span className="text-stone-500 text-sm">職員を2人ドロップしてペアに</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mb-3 shrink-0">
                <label className="block text-base mb-1.5 text-stone-600 font-semibold uppercase tracking-wider">ドロップダウンから追加</label>
                <div className="flex gap-2">
                  <select id="pair-person1" className="flex-1 p-3 bg-slate-50 border-2 border-slate-400 rounded-xl text-stone-800 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all">
                    <option value="">-- 職員1 --</option>
                    {staffData.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                  <select id="pair-person2" className="flex-1 p-3 bg-slate-50 border-2 border-slate-400 rounded-xl text-stone-800 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all">
                    <option value="">-- 職員2 --</option>
                    {staffData.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                </div>
                <button onClick={() => { const p1 = document.getElementById('pair-person1').value; const p2 = document.getElementById('pair-person2').value; addPair(p1, p2); document.getElementById('pair-person1').value = ''; document.getElementById('pair-person2').value = ''; }} className="w-full mt-3 bg-orange-500 hover:bg-orange-400 text-white py-3 rounded-xl transition-all font-semibold shadow-sm hover:-translate-y-0.5">追加</button>
              </div>
              <div className="space-y-2 shrink-0">
                <h4 className="font-bold text-sm text-stone-600 uppercase tracking-wider">現在のペア：</h4>
                <div className="max-h-32 overflow-y-auto space-y-2">
                  {pairs.map((pair, idx) => {
                    const staff1 = staffData.find(s => s.id === pair.person1);
                    const staff2 = staffData.find(s => s.id === pair.person2);
                    return (
                      <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-400">
                        <span className="text-stone-800">{staff1?.name || pair.person1} ↔ {staff2?.name || pair.person2}</span>
                        <button onClick={() => setPairs(pairs.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-600 font-semibold transition-colors">削除</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
