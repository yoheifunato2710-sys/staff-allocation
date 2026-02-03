import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { downloadCSV } from '../utils/csv';

export default function AllocationScreen({ onBack }) {
  const { modalityData, staffData } = useData();
  const [allocation, setAllocation] = useState({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [calendar, setCalendar] = useState([]);
  const [isAutoAllocating, setIsAutoAllocating] = useState(false);

  const mergeScheduleWithOverrides = (schedule, manualOverrides) => {
    const out = { ...schedule };
    if (!manualOverrides || typeof manualOverrides !== 'object') return out;
    for (const [dateStr, ov] of Object.entries(manualOverrides)) {
      if (!out[dateStr]) out[dateStr] = {};
      for (const [field, staffId] of Object.entries(ov)) {
        if (staffId != null && staffId !== '') out[dateStr][field] = staffId;
      }
    }
    return out;
  };

  const allocationLoaded = useRef(false);
  useEffect(() => {
    const scheduleData = localStorage.getItem('scheduleData');
    if (scheduleData) {
      const data = JSON.parse(scheduleData);
      setStartDate(data.startDate || '');
      setEndDate(data.endDate || '');
      setCalendar(data.calendar || []);
    }
    const allocationData = localStorage.getItem('allocationData');
    if (allocationData) {
      try {
        const data = JSON.parse(allocationData);
        if (data.allocation) setAllocation(data.allocation);
        if (data.startDate) setStartDate(data.startDate);
        if (data.endDate) setEndDate(data.endDate);
      } catch (_) {}
    }
    const t = setTimeout(() => { allocationLoaded.current = true; }, 300);
    return () => clearTimeout(t);
  }, []);

  const autoAllocate = () => {
    if (calendar.length === 0) {
      alert('⚠️ まず夜勤・日勤当番表でカレンダーを生成してください');
      return;
    }
    setIsAutoAllocating(true);
    const scheduleData = JSON.parse(localStorage.getItem('scheduleData') || '{}');
    const leaveData = JSON.parse(localStorage.getItem('leaveData') || '{}');
    const schedule = mergeScheduleWithOverrides(scheduleData.schedule || {}, scheduleData.manualOverrides);
    const weeklyOff = scheduleData.weeklyOff || {};
    const leaves = leaveData.leaveData || {};
    const newAllocation = {};

    calendar.forEach(day => {
      const dateStr = day.date;
      if (day.isWeekend || day.isHoliday) return;
      newAllocation[dateStr] = {};
      const unavailableStaff = new Set();
      const daySchedule = schedule[dateStr] || {};
      if (daySchedule.nightShift) unavailableStaff.add(daySchedule.nightShift);
      if (daySchedule.dayShift) unavailableStaff.add(daySchedule.dayShift);
      if (daySchedule.support) unavailableStaff.add(daySchedule.support);
      if (daySchedule.b) unavailableStaff.add(daySchedule.b);
      if (daySchedule.dayOff) unavailableStaff.add(daySchedule.dayOff);
      if (weeklyOff[dateStr]) weeklyOff[dateStr].forEach(id => unavailableStaff.add(id));
      if (leaves[dateStr]) leaves[dateStr].forEach(leave => unavailableStaff.add(leave.staffId));

      modalityData.forEach(modality => {
        const modalityId = modality.id;
        const dayOfWeek = new Date(dateStr).getDay();
        const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const dayKey = dayNames[dayOfWeek];
        const dayMap = { mon: 'mon', tue: 'tue', wed: 'wed', thu: 'thu', fri: 'fri' };

        let requiredAm = 0;
        let requiredPm = 0;
        if (modality.staffMode === 'uniform') {
          requiredAm = modality.uniformStaffAm ?? modality.uniformStaff ?? 0;
          requiredPm = modality.uniformStaffPm ?? modality.uniformStaff ?? 0;
        } else {
          const w = modality.weekdayStaff?.[dayMap[dayKey]];
          if (typeof w === 'object' && w !== null) {
            requiredAm = w.am ?? 0;
            requiredPm = w.pm ?? 0;
          } else {
            const n = w ?? 0;
            requiredAm = n;
            requiredPm = n;
          }
        }

        const assignSlot = (requiredCount) => {
          const withScore = staffData
            .filter(staff => !unavailableStaff.has(staff.id))
            .map(staff => ({ ...staff, score: staff.scores[modalityId] ?? 0 }));
          const forRequired = withScore.filter(s => s.score >= 1 && s.score <= 4).sort((a, b) => b.score - a.score);
          const forTraining = withScore.filter(s => s.score === 5);
          const assigned = [];
          forRequired.forEach(staff => {
            if (assigned.length < requiredCount) {
              assigned.push(staff.id);
              unavailableStaff.add(staff.id);
            }
          });
          forTraining.forEach(staff => {
            if (!unavailableStaff.has(staff.id)) {
              assigned.push(staff.id);
              unavailableStaff.add(staff.id);
            }
          });
          return assigned;
        };

        const amIds = assignSlot(requiredAm);
        const pmIds = assignSlot(requiredPm);
        if (amIds.length > 0 || pmIds.length > 0) {
          newAllocation[dateStr][modalityId] = { am: amIds, pm: pmIds };
        }
      });
    });

    setAllocation(newAllocation);
    setIsAutoAllocating(false);
    alert('✅ 自動配置が完了しました');
  };

  const getStaffAllocation = (staffId, date) => {
    const scheduleData = JSON.parse(localStorage.getItem('scheduleData') || '{}');
    const leaveData = JSON.parse(localStorage.getItem('leaveData') || '{}');
    const schedule = mergeScheduleWithOverrides(scheduleData.schedule || {}, scheduleData.manualOverrides);
    const weeklyOff = scheduleData.weeklyOff || {};
    const leaves = leaveData.leaveData || {};
    const leave = leaves[date]?.find(l => l.staffId === staffId);
    if (leave) return leave.leaveType;
    if (weeklyOff[date]?.includes(staffId)) return '週休';
    const daySchedule = schedule[date] || {};
    if (daySchedule.nightShift === staffId) return '16';
    if (daySchedule.dayShift === staffId) return '日勤';
    if (daySchedule.support === staffId) return 'サポート';
    if (daySchedule.b === staffId) return 'B';
    if (daySchedule.dayOff === staffId) return '非番';
    if (allocation[date]) {
      for (const [modalityId, slotData] of Object.entries(allocation[date])) {
        const modality = modalityData.find(m => m.id === parseInt(modalityId));
        const name = modality?.name || `M${modalityId}`;
        const am = Array.isArray(slotData) ? slotData : (slotData?.am || []);
        const pm = Array.isArray(slotData) ? [] : (slotData?.pm || []);
        const inAm = am.includes(staffId);
        const inPm = pm.includes(staffId);
        if (inAm && inPm) return `${name} AM/PM`;
        if (inAm) return `${name} AM`;
        if (inPm) return `${name} PM`;
      }
    }
    return '-';
  };

  useEffect(() => {
    if (!allocationLoaded.current) return;
    localStorage.setItem('allocationData', JSON.stringify({ allocation, startDate, endDate }));
  }, [allocation, startDate, endDate]);

  const exportAllocationCSV = () => {
    if (calendar.length === 0) {
      alert('⚠️ データがありません');
      return;
    }
    let csv = '職員ID,氏名';
    calendar.forEach(day => { csv += `,${day.date}(${day.dayOfWeek})`; });
    csv += '\n';
    staffData.forEach(staff => {
      csv += `"${staff.id}","${staff.name}"`;
      calendar.forEach(day => { csv += `,"${getStaffAllocation(staff.id, day.date)}"`; });
      csv += '\n';
    });
    downloadCSV(csv, '配置表_' + new Date().toISOString().split('T')[0] + '.csv');
  };

  const colorMap = {
    '16': 'bg-blue-100 text-blue-800 border-blue-200',
    '日勤': 'bg-green-100 text-green-800 border-green-200',
    'サポート': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'B': 'bg-orange-100 text-orange-800 border-orange-200',
    '非番': 'bg-red-100 text-red-800 border-red-200',
    '週休': 'bg-violet-100 text-violet-800 border-violet-200',
    '年休': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'リフ休': 'bg-purple-100 text-purple-800 border-purple-200',
    '特別休': 'bg-amber-100 text-amber-800 border-amber-200',
    '出張': 'bg-pink-100 text-pink-800 border-pink-200',
    '-': 'text-stone-600 bg-slate-50 border-slate-300'
  };

  return (
    <div className="min-h-screen bg-violet-400 p-5 relative overflow-hidden">
      <div className="absolute top-20 right-20 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-full mx-auto relative px-4">
        <div className="flex justify-between items-center gap-4 mb-4">
          <h2 className="text-3xl font-bold text-stone-800">配置表作成</h2>
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="px-5 py-2.5 bg-slate-50 hover:bg-stone-100 border-2 border-slate-400 rounded-xl text-stone-800 text-lg font-semibold transition-all shadow-sm">
              ← メインメニュー
            </button>
            <button onClick={exportAllocationCSV} className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-lg font-semibold transition-all">
              CSV
            </button>
          </div>
        </div>

        {/* ワークフロー: 当番表作成 → 週休割り当て → 配置表作成（中央・大きく） */}
        <div className="mb-6 flex flex-col items-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="px-6 py-3 bg-stone-100 border-2 border-stone-300 rounded-2xl text-stone-800 text-xl font-semibold">当番表作成</span>
            <span className="text-stone-500 text-2xl font-bold">→</span>
            <span className="px-6 py-3 bg-stone-100 border-2 border-stone-300 rounded-2xl text-stone-800 text-xl font-semibold">週休割り当て</span>
            <span className="text-stone-500 text-2xl font-bold">→</span>
            <button onClick={autoAllocate} disabled={isAutoAllocating || calendar.length === 0} className="px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed text-white rounded-2xl text-xl font-semibold transition-all shadow-md">
              {isAutoAllocating ? '配置中...' : '配置表作成'}
            </button>
          </div>
          {calendar.length === 0 && (
            <p className="mt-4 text-stone-700 text-xl font-medium text-center">※ 表示する期間がありません</p>
          )}
          {startDate && endDate && calendar.length > 0 && (
            <p className="mt-3 text-stone-600 text-base text-center">期間: {startDate} 〜 {endDate}</p>
          )}
        </div>

        {calendar.length > 0 ? (
          <div className="bg-slate-50 rounded-2xl border-2 border-slate-400 p-6 shadow-sm overflow-x-auto">
            <h3 className="font-bold mb-4 text-stone-800 text-xl">📊 配置表マトリックス</h3>
            <div className="overflow-x-auto">
              <table className="border-collapse text-xs min-w-full">
                <thead>
                  <tr className="bg-stone-100">
                    <th className="border border-slate-300 p-3 sticky left-0 bg-stone-100 z-20 min-w-[120px]"><div className="font-bold text-stone-800 uppercase tracking-wider">職員</div></th>
                    {calendar.map(day => (
                      <th key={day.date} className={`border border-slate-300 p-2 min-w-[80px] ${day.isWeekend ? 'bg-stone-100' : ''}`}>
                        <div className="text-stone-600">{day.date.split('-')[2]}</div>
                        <div className="text-xs text-stone-600">{day.dayOfWeek}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staffData.map(staff => (
                    <tr key={staff.id} className="hover:bg-slate-50 transition-all">
                      <td className="border border-slate-300 p-3 font-bold sticky left-0 bg-slate-50 z-10 text-stone-800">
                        <div>{staff.name}</div>
                        <div className="text-xs text-stone-600">{staff.id}</div>
                      </td>
                      {calendar.map(day => {
                        const assignment = getStaffAllocation(staff.id, day.date);
                        const isModality = !colorMap[assignment];
                        const cellClass = isModality ? 'bg-cyan-100 text-cyan-800 border-cyan-200' : colorMap[assignment];
                        return (
                          <td key={day.date} className={`border border-slate-300 p-1 text-center ${day.isWeekend ? 'bg-slate-50' : ''}`}>
                            <div className={`text-xs py-1 px-2 rounded border ${cellClass} font-semibold`}>{assignment}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-cyan-100 border border-cyan-200 rounded" /><span className="text-stone-600">モダリティ配置</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded" /><span className="text-stone-600">16(夜勤)</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-100 border border-green-200 rounded" /><span className="text-stone-600">日勤</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-violet-100 border border-violet-200 rounded" /><span className="text-stone-600">週休</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-emerald-100 border border-emerald-200 rounded" /><span className="text-stone-600">休暇</span></div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
