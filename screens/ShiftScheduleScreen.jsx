import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';

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
  const [showMatrix, setShowMatrix] = useState(false);

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
      days.push({
        date: dateStr,
        dayOfWeek: ['日', '月', '火', '水', '木', '金', '土'][dayOfWeek],
        dayOfWeekNum: dayOfWeek,
        isWeekend,
        isHoliday: false
      });
      current.setDate(current.getDate() + 1);
    }
    setCalendar(days);
    alert('✅ カレンダーを生成しました');
  };

  const toggleSurgeryDay = (date) => {
    setSurgeryDays(prev => (prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]));
  };

  const autoAssign = () => {
    if (calendar.length === 0) {
      alert('⚠️ まずカレンダーを生成してください');
      return;
    }
    if (nightShiftOrder.length === 0) {
      alert('⚠️ 夜勤順番リストを設定してください');
      return;
    }
    const newSchedule = {};
    let nightIndex = 0;
    let dayIndex = 0;
    calendar.forEach((day, idx) => {
      const dateStr = day.date;
      newSchedule[dateStr] = { nightShift: null, dayShift: null, support: null, b: null, dayOff: null };
      if (nightShiftOrder.length > 0) {
        newSchedule[dateStr].nightShift = nightShiftOrder[nightIndex % nightShiftOrder.length];
        nightIndex++;
      }
      if (idx > 0) {
        const prevDate = calendar[idx - 1].date;
        if (newSchedule[prevDate]?.nightShift) {
          newSchedule[dateStr].dayOff = newSchedule[prevDate].nightShift;
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

  const getStaffAssignment = (staffId, date) => {
    const daySchedule = schedule[date];
    const savedLeaveData = localStorage.getItem('leaveData');
    const leaveData = savedLeaveData ? JSON.parse(savedLeaveData).leaveData || {} : {};
    const leave = leaveData[date]?.find(l => l.staffId === staffId);
    if (leave) return leave.leaveType;
    if (weeklyOff[date]?.includes(staffId)) return '週休';
    if (daySchedule?.nightShift === staffId) return '16';
    if (daySchedule?.dayShift === staffId) return '日勤';
    if (daySchedule?.support === staffId) return 'サポート';
    if (daySchedule?.b === staffId) return 'B';
    if (daySchedule?.dayOff === staffId) return '非番';
    return '-';
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
    const data = { startDate, endDate, calendar, surgeryDays, nightShiftOrder, dayShiftOrder, pairs, schedule, weeklyOff };
    if (!startDate && !endDate && calendar.length === 0) return;
    localStorage.setItem('scheduleData', JSON.stringify(data));
  }, [startDate, endDate, calendar, surgeryDays, nightShiftOrder, dayShiftOrder, pairs, schedule, weeklyOff]);

  useEffect(() => {
    const saved = localStorage.getItem('scheduleData');
    if (saved) {
      const data = JSON.parse(saved);
      setStartDate(data.startDate || '');
      setEndDate(data.endDate || '');
      setCalendar(data.calendar || []);
      setSurgeryDays(data.surgeryDays || []);
      setNightShiftOrder(data.nightShiftOrder || []);
      setDayShiftOrder(data.dayShiftOrder || []);
      setPairs(data.pairs || []);
      setSchedule(data.schedule || {});
      setWeeklyOff(data.weeklyOff || {});
    }
  }, []);

  const colorMap = { '16': 'bg-blue-100 text-blue-800 border-blue-200', '日勤': 'bg-green-100 text-green-800 border-green-200', 'サポート': 'bg-yellow-100 text-yellow-800 border-yellow-200', 'B': 'bg-orange-100 text-orange-800 border-orange-200', '非番': 'bg-red-100 text-red-800 border-red-200', '週休': 'bg-violet-100 text-violet-800 border-violet-200', '年休': 'bg-emerald-100 text-emerald-800 border-emerald-200', 'リフ休': 'bg-purple-100 text-purple-800 border-purple-200', '特別休': 'bg-amber-100 text-amber-800 border-amber-200', '出張': 'bg-pink-100 text-pink-800 border-pink-200' };

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
              <button onClick={generateCalendar} className="w-full px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-lg font-semibold shadow-md transition-all hover:-translate-y-0.5">カレンダー生成</button>
            </div>
          </div>
          <div className="min-w-0 bg-slate-50 rounded-2xl border-2 border-slate-400 p-6 shadow-sm hover:border-slate-400 transition-all">
            <h3 className="font-bold mb-3 text-stone-800 text-2xl">👥 順番設定</h3>
            <div className="space-y-2">
              <button onClick={() => setShowNightShiftModal(true)} className="w-full px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-base font-semibold shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5">夜勤順番リスト ({nightShiftOrder.length}名)</button>
              <button onClick={() => setShowDayShiftModal(true)} className="w-full px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-base font-semibold shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5">日勤順番リスト ({dayShiftOrder.length}名)</button>
              <button onClick={() => setShowPairModal(true)} className="w-full px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-base font-semibold shadow-lg shadow-orange-500/20 transition-all hover:-translate-y-0.5">ペア設定 ({pairs.length}組)</button>
            </div>
          </div>
          <div className="min-w-0 bg-slate-50 rounded-2xl border-2 border-slate-400 p-6 shadow-sm hover:border-slate-400 transition-all">
            <h3 className="font-bold mb-3 text-stone-800 text-lg">⚙️ 実行</h3>
            <div className="space-y-2">
              <button onClick={autoAssign} className="w-full px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-base font-semibold shadow-lg shadow-amber-500/20 transition-all hover:-translate-y-0.5">🎯 当番自動配置</button>
              <button onClick={autoAssignWeeklyOff} className="w-full px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-base font-semibold shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5">📅 週休自動割り当て</button>
              <button onClick={() => setShowMatrix(!showMatrix)} className="w-full px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-base font-semibold shadow-lg shadow-cyan-500/20 transition-all hover:-translate-y-0.5">{showMatrix ? '📋 基本表示' : '📊 マトリックス表示'}</button>
            </div>
          </div>
        </div>

        {/* 当番表プレビュー（自動配置・週休割り当て後の一覧） */}
        {calendar.length > 0 && Object.keys(schedule).length > 0 && (
          <div className="bg-slate-50 rounded-2xl border-2 border-slate-400 p-6 shadow-sm mb-3">
            <h3 className="font-bold mb-3 text-stone-800 text-2xl">📋 当番表プレビュー</h3>
            <p className="text-sm text-stone-600 mb-3">縦：日付 / 横：日勤・サポート・16 の担当者</p>
            <div className="overflow-x-auto">
              <table className="border-collapse text-base min-w-full">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-400 p-2 sticky left-0 bg-slate-100 z-10 min-w-[120px] text-left text-stone-800 font-semibold uppercase tracking-wider">日付</th>
                    <th className="border border-slate-400 p-3 min-w-[140px] text-left text-green-700 font-semibold uppercase tracking-wider bg-green-50">日勤</th>
                    <th className="border border-slate-400 p-3 min-w-[140px] text-left text-yellow-700 font-semibold uppercase tracking-wider bg-yellow-50">サポート</th>
                    <th className="border border-slate-400 p-3 min-w-[140px] text-left text-blue-700 font-semibold uppercase tracking-wider bg-blue-50">16</th>
                  </tr>
                </thead>
                <tbody>
                  {calendar.map(day => {
                    const daySchedule = schedule[day.date] || {};
                    return (
                      <tr key={day.date} className={`border-b border-slate-400 hover:bg-slate-50 transition-all ${day.isWeekend ? 'bg-slate-50' : ''}`}>
                        <td className="border border-slate-400 p-2 sticky left-0 bg-slate-50 z-10 text-stone-800 font-medium">
                          {day.date} <span className="text-stone-600">({day.dayOfWeek})</span>
                        </td>
                        <td className="border border-slate-400 p-3 bg-green-50/50 text-green-800">{getStaffName(daySchedule.dayShift) || '-'}</td>
                        <td className="border border-slate-400 p-3 bg-yellow-50/50 text-yellow-800">{getStaffName(daySchedule.support) || '-'}</td>
                        <td className="border border-slate-400 p-3 bg-blue-50/50 text-blue-800">{getStaffName(daySchedule.nightShift) || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showMatrix && calendar.length > 0 && (
          <div className="bg-slate-50 rounded-2xl border-2 border-slate-400 p-6 shadow-sm mb-3">
            <h3 className="font-bold mb-3 text-stone-800 text-2xl">📊 職員×日付マトリックス（16、日勤、サポート、B、非番、週休、休暇）</h3>
            <div className="overflow-x-auto">
              <table className="border-collapse text-xs min-w-full">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-400 p-2 sticky left-0 bg-slate-100 z-10 min-w-[100px]">
                      <div className="font-bold text-stone-800 uppercase tracking-wider">職員</div>
                    </th>
                    {calendar.map(day => (
                      <th key={day.date} className={`border border-slate-400 p-2 min-w-[80px] ${day.isWeekend ? 'bg-slate-100' : ''}`}>
                        <div className="text-stone-600">{day.date.split('-')[2]}</div>
                        <div className="text-sm text-stone-600">{day.dayOfWeek}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staffData.map(staff => (
                    <tr key={staff.id} className="hover:bg-slate-50 transition-all">
                      <td className="border border-slate-400 p-3 font-bold sticky left-0 bg-slate-50 z-10 text-stone-800">{staff.name}</td>
                      {calendar.map(day => {
                        const assignment = getStaffAssignment(staff.id, day.date);
                        const cellClass = colorMap[assignment] || 'text-stone-600 border-slate-400 bg-slate-50';
                        return (
                          <td key={day.date} className={`border border-slate-400 p-1 text-center cursor-pointer hover:bg-slate-100 transition-all ${day.isWeekend ? 'bg-slate-50' : ''}`} onClick={() => { if (assignment === '週休') toggleWeeklyOff(day.date, staff.id); }}>
                            <div className={`text-xs py-1 px-2 rounded border font-semibold ${cellClass}`}>{assignment}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-sm text-stone-600">※週休のセルをクリックで手動追加/削除が可能です</div>
          </div>
        )}

        {!showMatrix && calendar.length > 0 && (
          <div className="bg-slate-50 rounded-2xl border-2 border-slate-400 p-6 shadow-sm">
            <h3 className="font-bold mb-3 text-stone-800 text-2xl">📆 当番表カレンダー</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-400 bg-slate-50">
                    <th className="p-3 text-left text-stone-600 font-semibold uppercase tracking-wider">日付</th>
                    <th className="p-3 text-center text-stone-600 font-semibold uppercase tracking-wider">曜日</th>
                    <th className="p-3 text-left text-blue-700 font-semibold uppercase tracking-wider bg-blue-50">夜勤(16)</th>
                    <th className="p-3 text-left text-green-700 font-semibold uppercase tracking-wider bg-green-50">日勤</th>
                    <th className="p-3 text-left text-yellow-700 font-semibold uppercase tracking-wider bg-yellow-50">サポート</th>
                    <th className="p-3 text-left text-orange-700 font-semibold uppercase tracking-wider bg-orange-50">B</th>
                    <th className="p-3 text-left text-red-700 font-semibold uppercase tracking-wider bg-red-50">非番</th>
                    <th className="p-3 text-center text-stone-600 font-semibold uppercase tracking-wider">外科輪番</th>
                  </tr>
                </thead>
                <tbody>
                  {calendar.map(day => {
                    const isSurgery = surgeryDays.includes(day.date);
                    const daySchedule = schedule[day.date] || {};
                    return (
                      <tr key={day.date} className={`border-b border-slate-400 hover:bg-slate-50 transition-all ${day.isWeekend ? 'bg-slate-50' : ''}`}>
                        <td className="p-3 text-stone-800">{day.date}</td>
                        <td className="p-3 text-center text-stone-800 font-bold">{day.dayOfWeek}</td>
                        <td className="p-3 bg-blue-50 text-blue-800">{daySchedule.nightShift || '-'}</td>
                        <td className="p-3 bg-green-50 text-green-800">{daySchedule.dayShift || '-'}</td>
                        <td className="p-3 bg-yellow-50 text-yellow-800">{daySchedule.support || '-'}</td>
                        <td className="p-3 bg-orange-50 text-orange-800">{daySchedule.b || '-'}</td>
                        <td className="p-3 bg-red-50 text-red-800">{daySchedule.dayOff || '-'}</td>
                        <td className="p-3 text-center">
                          <button onClick={() => toggleSurgeryDay(day.date)} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${isSurgery ? 'bg-red-500 hover:bg-red-400 text-white shadow-sm' : 'bg-stone-200 hover:bg-stone-300 text-stone-600'}`}>{isSurgery ? '✓' : '−'}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-sm text-stone-600">※外科輪番日はボタンをクリックして指定してください</div>
          </div>
        )}

        {showNightShiftModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-5 z-50">
            <div className="bg-slate-50 border-2 border-slate-400 rounded-2xl p-6 max-w-md w-full max-h-96 overflow-y-auto shadow-xl">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-stone-800 text-2xl">夜勤順番リスト設定</h3>
                <button onClick={() => setShowNightShiftModal(false)} className="text-stone-400 hover:text-stone-600 transition-colors text-2xl">✕</button>
              </div>
              <div className="mb-3">
                <label className="block text-base mb-1.5 text-stone-600 font-semibold uppercase tracking-wider">職員を選択して追加</label>
                <select onChange={(e) => { addToNightShiftOrder(e.target.value); e.target.value = ''; }} className="w-full p-3 bg-slate-50 border-2 border-slate-400 rounded-xl text-stone-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all">
                  <option value="">-- 職員を選択 --</option>
                  {staffData.map(s => (<option key={s.id} value={s.id}>{s.name} ({s.id})</option>))}
                </select>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-stone-600 uppercase tracking-wider">現在の順番：</h4>
                {nightShiftOrder.map((id, idx) => {
                  const staff = staffData.find(s => s.id === id);
                  return (
                    <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-400">
                      <span className="text-stone-800">{idx + 1}. {staff?.name || id}</span>
                      <button onClick={() => setNightShiftOrder(nightShiftOrder.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-600 font-semibold transition-colors">削除</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {showDayShiftModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-5 z-50">
            <div className="bg-slate-50 border-2 border-slate-400 rounded-2xl p-6 max-w-md w-full max-h-96 overflow-y-auto shadow-xl">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-stone-800 text-2xl">日勤順番リスト設定</h3>
                <button onClick={() => setShowDayShiftModal(false)} className="text-stone-400 hover:text-stone-600 transition-colors text-2xl">✕</button>
              </div>
              <div className="mb-3">
                <label className="block text-base mb-1.5 text-stone-600 font-semibold uppercase tracking-wider">職員を選択して追加</label>
                <select onChange={(e) => { addToDayShiftOrder(e.target.value); e.target.value = ''; }} className="w-full p-3 bg-slate-50 border-2 border-slate-400 rounded-xl text-stone-800 focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none transition-all">
                  <option value="">-- 職員を選択 --</option>
                  {staffData.map(s => (<option key={s.id} value={s.id}>{s.name} ({s.id})</option>))}
                </select>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-stone-600 uppercase tracking-wider">現在の順番：</h4>
                {dayShiftOrder.map((id, idx) => {
                  const staff = staffData.find(s => s.id === id);
                  return (
                    <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-400">
                      <span className="text-stone-800">{idx + 1}. {staff?.name || id}</span>
                      <button onClick={() => setDayShiftOrder(dayShiftOrder.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-600 font-semibold transition-colors">削除</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {showPairModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-5 z-50">
            <div className="bg-slate-50 border-2 border-slate-400 rounded-2xl p-6 max-w-md w-full max-h-96 overflow-y-auto shadow-xl">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-stone-800 text-2xl">ペア設定</h3>
                <button onClick={() => setShowPairModal(false)} className="text-stone-400 hover:text-stone-600 transition-colors text-2xl">✕</button>
              </div>
              <div className="mb-3">
                <label className="block text-base mb-1.5 text-stone-600 font-semibold uppercase tracking-wider">新しいペアを追加</label>
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
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-stone-600 uppercase tracking-wider">現在のペア：</h4>
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
        )}
      </div>
    </div>
  );
}
