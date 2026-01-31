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

  const saveScheduleData = () => {
    const data = { startDate, endDate, calendar, surgeryDays, nightShiftOrder, dayShiftOrder, pairs, schedule, weeklyOff };
    localStorage.setItem('scheduleData', JSON.stringify(data));
    alert('✅ 当番表データを保存しました');
  };

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

  const colorMap = { '16': 'bg-blue-500/20 text-blue-300 border-blue-500/30', '日勤': 'bg-green-500/20 text-green-300 border-green-500/30', 'サポート': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', 'B': 'bg-orange-500/20 text-orange-300 border-orange-500/30', '非番': 'bg-red-500/20 text-red-300 border-red-500/30', '週休': 'bg-violet-500/20 text-violet-300 border-violet-500/30', '年休': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', 'リフ休': 'bg-purple-500/20 text-purple-300 border-purple-500/30', '特別休': 'bg-amber-500/20 text-amber-300 border-amber-500/30', '出張': 'bg-pink-500/20 text-pink-300 border-pink-500/30' };

  return (
    <div className="min-h-screen bg-slate-950 p-5 relative overflow-hidden">
      <div className="absolute top-20 left-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto relative">
        <div className="flex justify-between items-center gap-4 mb-6">
          <h2 className="text-2xl font-bold text-white">当番表作成</h2>
          <button onClick={onBack} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 text-sm font-medium transition-all">
            ← メインメニュー
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="min-w-0 bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-800 hover:border-slate-700 transition-all">
            <h3 className="font-bold mb-4 text-white text-lg">📅 期間設定</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-2 font-semibold text-slate-300 uppercase tracking-wider">開始日</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-3 bg-slate-800/50 border-2 border-slate-700 rounded-xl text-white focus:border-amber-500/50 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm mb-2 font-semibold text-slate-300 uppercase tracking-wider">終了日</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-3 bg-slate-800/50 border-2 border-slate-700 rounded-xl text-white focus:border-amber-500/50 outline-none transition-all" />
              </div>
              <button onClick={generateCalendar} className="w-full px-5 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-500/20 transition-all font-semibold hover:-translate-y-0.5">カレンダー生成</button>
            </div>
          </div>
          <div className="min-w-0 bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-800 hover:border-slate-700 transition-all">
            <h3 className="font-bold mb-4 text-white text-lg">👥 順番設定</h3>
            <div className="space-y-2">
              <button onClick={() => setShowNightShiftModal(true)} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all font-semibold hover:-translate-y-0.5 text-sm">夜勤順番リスト ({nightShiftOrder.length}名)</button>
              <button onClick={() => setShowDayShiftModal(true)} className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 transition-all font-semibold hover:-translate-y-0.5 text-sm">日勤順番リスト ({dayShiftOrder.length}名)</button>
              <button onClick={() => setShowPairModal(true)} className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl shadow-lg shadow-orange-500/20 transition-all font-semibold hover:-translate-y-0.5 text-sm">ペア設定 ({pairs.length}組)</button>
            </div>
          </div>
          <div className="min-w-0 bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-800 hover:border-slate-700 transition-all">
            <h3 className="font-bold mb-4 text-white text-lg">⚙️ 実行・保存</h3>
            <div className="space-y-2">
              <button onClick={autoAssign} className="w-full px-4 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-500/20 transition-all font-semibold hover:-translate-y-0.5 text-sm">🎯 当番自動配置</button>
              <button onClick={autoAssignWeeklyOff} className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-semibold hover:-translate-y-0.5 text-sm">📅 週休自動割り当て</button>
              <button onClick={() => setShowMatrix(!showMatrix)} className="w-full px-4 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl shadow-lg shadow-cyan-500/20 transition-all font-semibold hover:-translate-y-0.5 text-sm">{showMatrix ? '📋 基本表示' : '📊 マトリックス表示'}</button>
              <button onClick={saveScheduleData} className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all">保存</button>
            </div>
          </div>
        </div>

        {showMatrix && calendar.length > 0 && (
          <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-800 mb-6">
            <h3 className="font-bold mb-4 text-white text-lg">📊 職員×日付マトリックス（16、日勤、サポート、B、非番、週休、休暇）</h3>
            <div className="overflow-x-auto">
              <table className="border-collapse text-xs min-w-full">
                <thead>
                  <tr className="bg-slate-800/50">
                    <th className="border border-slate-700 p-3 sticky left-0 bg-slate-800 z-10 min-w-[100px]">
                      <div className="font-bold text-slate-200 uppercase tracking-wider">職員</div>
                    </th>
                    {calendar.map(day => (
                      <th key={day.date} className={`border border-slate-700 p-2 min-w-[80px] ${day.isWeekend ? 'bg-slate-700/50' : ''}`}>
                        <div className="text-slate-300">{day.date.split('-')[2]}</div>
                        <div className="text-xs text-slate-500">{day.dayOfWeek}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staffData.map(staff => (
                    <tr key={staff.id} className="hover:bg-slate-800/30 transition-all">
                      <td className="border border-slate-700 p-3 font-bold sticky left-0 bg-slate-900/90 z-10 text-white">{staff.name}</td>
                      {calendar.map(day => {
                        const assignment = getStaffAssignment(staff.id, day.date);
                        const cellClass = colorMap[assignment] || 'text-slate-500 border-slate-700';
                        return (
                          <td key={day.date} className={`border border-slate-700 p-1 text-center cursor-pointer hover:bg-slate-800/50 transition-all ${day.isWeekend ? 'bg-slate-800/30' : ''}`} onClick={() => { if (assignment === '週休') toggleWeeklyOff(day.date, staff.id); }}>
                            <div className={`text-xs py-1 px-2 rounded border font-semibold ${cellClass}`}>{assignment}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-xs text-slate-500">※週休のセルをクリックで手動追加/削除が可能です</div>
          </div>
        )}

        {!showMatrix && calendar.length > 0 && (
          <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-800">
            <h3 className="font-bold mb-4 text-white text-lg">📆 当番表カレンダー</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="p-3 text-left text-slate-400 font-semibold uppercase tracking-wider">日付</th>
                    <th className="p-3 text-center text-slate-400 font-semibold uppercase tracking-wider">曜日</th>
                    <th className="p-3 text-left text-slate-400 font-semibold uppercase tracking-wider bg-blue-500/10">夜勤(16)</th>
                    <th className="p-3 text-left text-slate-400 font-semibold uppercase tracking-wider bg-green-500/10">日勤</th>
                    <th className="p-3 text-left text-slate-400 font-semibold uppercase tracking-wider bg-yellow-500/10">サポート</th>
                    <th className="p-3 text-left text-slate-400 font-semibold uppercase tracking-wider bg-orange-500/10">B</th>
                    <th className="p-3 text-left text-slate-400 font-semibold uppercase tracking-wider bg-red-500/10">非番</th>
                    <th className="p-3 text-center text-slate-400 font-semibold uppercase tracking-wider">外科輪番</th>
                  </tr>
                </thead>
                <tbody>
                  {calendar.map(day => {
                    const isSurgery = surgeryDays.includes(day.date);
                    const daySchedule = schedule[day.date] || {};
                    return (
                      <tr key={day.date} className={`border-b border-slate-800 hover:bg-slate-800/30 transition-all ${day.isWeekend ? 'bg-slate-800/20' : ''}`}>
                        <td className="p-3 text-slate-300">{day.date}</td>
                        <td className="p-3 text-center text-white font-bold">{day.dayOfWeek}</td>
                        <td className="p-3 bg-blue-500/10 text-blue-300">{daySchedule.nightShift || '-'}</td>
                        <td className="p-3 bg-green-500/10 text-green-300">{daySchedule.dayShift || '-'}</td>
                        <td className="p-3 bg-yellow-500/10 text-yellow-300">{daySchedule.support || '-'}</td>
                        <td className="p-3 bg-orange-500/10 text-orange-300">{daySchedule.b || '-'}</td>
                        <td className="p-3 bg-red-500/10 text-red-300">{daySchedule.dayOff || '-'}</td>
                        <td className="p-3 text-center">
                          <button onClick={() => toggleSurgeryDay(day.date)} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${isSurgery ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>{isSurgery ? '✓' : '−'}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-slate-500">※外科輪番日はボタンをクリックして指定してください</div>
          </div>
        )}

        {showNightShiftModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5 z-50">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full max-h-96 overflow-y-auto shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white text-xl">夜勤順番リスト設定</h3>
                <button onClick={() => setShowNightShiftModal(false)} className="text-slate-400 hover:text-white transition-colors text-2xl">✕</button>
              </div>
              <div className="mb-4">
                <label className="block text-sm mb-2 text-slate-300 font-semibold uppercase tracking-wider">職員を選択して追加</label>
                <select onChange={(e) => { addToNightShiftOrder(e.target.value); e.target.value = ''; }} className="w-full p-3 bg-slate-800 border-2 border-slate-700 rounded-xl text-white focus:border-blue-500 outline-none transition-all">
                  <option value="">-- 職員を選択 --</option>
                  {staffData.map(s => (<option key={s.id} value={s.id}>{s.name} ({s.id})</option>))}
                </select>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-slate-300 uppercase tracking-wider">現在の順番：</h4>
                {nightShiftOrder.map((id, idx) => {
                  const staff = staffData.find(s => s.id === id);
                  return (
                    <div key={idx} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                      <span className="text-white">{idx + 1}. {staff?.name || id}</span>
                      <button onClick={() => setNightShiftOrder(nightShiftOrder.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-300 font-semibold transition-colors">削除</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {showDayShiftModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5 z-50">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full max-h-96 overflow-y-auto shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white text-xl">日勤順番リスト設定</h3>
                <button onClick={() => setShowDayShiftModal(false)} className="text-slate-400 hover:text-white transition-colors text-2xl">✕</button>
              </div>
              <div className="mb-4">
                <label className="block text-sm mb-2 text-slate-300 font-semibold uppercase tracking-wider">職員を選択して追加</label>
                <select onChange={(e) => { addToDayShiftOrder(e.target.value); e.target.value = ''; }} className="w-full p-3 bg-slate-800 border-2 border-slate-700 rounded-xl text-white focus:border-green-500 outline-none transition-all">
                  <option value="">-- 職員を選択 --</option>
                  {staffData.map(s => (<option key={s.id} value={s.id}>{s.name} ({s.id})</option>))}
                </select>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-slate-300 uppercase tracking-wider">現在の順番：</h4>
                {dayShiftOrder.map((id, idx) => {
                  const staff = staffData.find(s => s.id === id);
                  return (
                    <div key={idx} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                      <span className="text-white">{idx + 1}. {staff?.name || id}</span>
                      <button onClick={() => setDayShiftOrder(dayShiftOrder.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-300 font-semibold transition-colors">削除</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {showPairModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5 z-50">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full max-h-96 overflow-y-auto shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white text-xl">ペア設定</h3>
                <button onClick={() => setShowPairModal(false)} className="text-slate-400 hover:text-white transition-colors text-2xl">✕</button>
              </div>
              <div className="mb-4">
                <label className="block text-sm mb-2 text-slate-300 font-semibold uppercase tracking-wider">新しいペアを追加</label>
                <div className="flex gap-2">
                  <select id="pair-person1" className="flex-1 p-3 bg-slate-800 border-2 border-slate-700 rounded-xl text-white text-sm focus:border-orange-500 outline-none transition-all">
                    <option value="">-- 職員1 --</option>
                    {staffData.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                  <select id="pair-person2" className="flex-1 p-3 bg-slate-800 border-2 border-slate-700 rounded-xl text-white text-sm focus:border-orange-500 outline-none transition-all">
                    <option value="">-- 職員2 --</option>
                    {staffData.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                </div>
                <button onClick={() => { const p1 = document.getElementById('pair-person1').value; const p2 = document.getElementById('pair-person2').value; addPair(p1, p2); document.getElementById('pair-person1').value = ''; document.getElementById('pair-person2').value = ''; }} className="w-full mt-3 bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl transition-all font-semibold shadow-lg shadow-orange-500/20 hover:-translate-y-0.5">追加</button>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-slate-300 uppercase tracking-wider">現在のペア：</h4>
                {pairs.map((pair, idx) => {
                  const staff1 = staffData.find(s => s.id === pair.person1);
                  const staff2 = staffData.find(s => s.id === pair.person2);
                  return (
                    <div key={idx} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                      <span className="text-white">{staff1?.name || pair.person1} ↔ {staff2?.name || pair.person2}</span>
                      <button onClick={() => setPairs(pairs.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-300 font-semibold transition-colors">削除</button>
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
