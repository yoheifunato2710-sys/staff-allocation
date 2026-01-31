import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { downloadCSV } from '../utils/csv';

export default function AllocationScreen({ onBack }) {
  const { modalityData, staffData } = useData();
  const [allocation, setAllocation] = useState({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [calendar, setCalendar] = useState([]);
  const [isAutoAllocating, setIsAutoAllocating] = useState(false);

  useEffect(() => {
    const scheduleData = localStorage.getItem('scheduleData');
    if (scheduleData) {
      const data = JSON.parse(scheduleData);
      setStartDate(data.startDate || '');
      setEndDate(data.endDate || '');
      setCalendar(data.calendar || []);
    }
  }, []);

  const autoAllocate = () => {
    if (calendar.length === 0) {
      alert('⚠️ まず夜勤・日勤当番表でカレンダーを生成してください');
      return;
    }
    setIsAutoAllocating(true);
    const scheduleData = JSON.parse(localStorage.getItem('scheduleData') || '{}');
    const leaveData = JSON.parse(localStorage.getItem('leaveData') || '{}');
    const schedule = scheduleData.schedule || {};
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
          const availableStaff = staffData
            .filter(staff => !unavailableStaff.has(staff.id))
            .map(staff => ({ ...staff, score: staff.scores[modalityId] || 0 }))
            .filter(staff => staff.score > 0)
            .sort((a, b) => b.score - a.score);
          const assigned = [];
          availableStaff.forEach(staff => {
            if (staff.score === 4 && assigned.length < requiredCount) {
              assigned.push(staff.id);
              unavailableStaff.add(staff.id);
            }
          });
          availableStaff.forEach(staff => {
            if (staff.score < 4 && assigned.length < requiredCount && !unavailableStaff.has(staff.id)) {
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
    const schedule = scheduleData.schedule || {};
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

  const saveAllocation = () => {
    localStorage.setItem('allocationData', JSON.stringify({ allocation, startDate, endDate }));
    alert('✅ 配置表を保存しました');
  };

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
    '16': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    '日勤': 'bg-green-500/20 text-green-300 border-green-500/30',
    'サポート': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    'B': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    '非番': 'bg-red-500/20 text-red-300 border-red-500/30',
    '週休': 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    '年休': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    'リフ休': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    '特別休': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    '出張': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    '-': 'text-slate-600'
  };

  return (
    <div className="min-h-screen bg-slate-950 p-5 relative overflow-hidden">
      <div className="absolute top-20 right-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />

      <div className="max-w-full mx-auto relative px-4">
        <div className="flex justify-between items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">配置表作成</h2>
            {startDate && endDate && <p className="text-slate-500 text-xs mt-0.5">期間: {startDate} 〜 {endDate}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={autoAllocate} disabled={isAutoAllocating} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-xl text-sm font-medium transition-all">
              {isAutoAllocating ? '配置中...' : '自動配置'}
            </button>
            <button onClick={saveAllocation} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all">
              保存
            </button>
            <button onClick={exportAllocationCSV} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-sm font-medium transition-all">
              CSV
            </button>
            <button onClick={onBack} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 text-sm font-medium transition-all">
              ← メインメニュー
            </button>
          </div>
        </div>

        <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl mb-6 text-sm text-indigo-200 backdrop-blur-sm">
          <strong>📌 注意：</strong> まず「夜勤・日勤当番表」で期間を設定してください。その後、自動配置を実行すると、スコアに基づいて職員を各モダリティに配置します。
        </div>

        {calendar.length > 0 ? (
          <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-800 overflow-x-auto">
            <h3 className="font-bold mb-4 text-white text-lg">📊 配置表マトリックス</h3>
            <div className="overflow-x-auto">
              <table className="border-collapse text-xs min-w-full">
                <thead>
                  <tr className="bg-slate-800/50">
                    <th className="border border-slate-700 p-3 sticky left-0 bg-slate-800 z-20 min-w-[120px]"><div className="font-bold text-slate-200 uppercase tracking-wider">職員</div></th>
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
                      <td className="border border-slate-700 p-3 font-bold sticky left-0 bg-slate-900/90 z-10 text-white">
                        <div>{staff.name}</div>
                        <div className="text-xs text-slate-500">{staff.id}</div>
                      </td>
                      {calendar.map(day => {
                        const assignment = getStaffAllocation(staff.id, day.date);
                        const isModality = !colorMap[assignment];
                        const cellClass = isModality ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : colorMap[assignment];
                        return (
                          <td key={day.date} className={`border border-slate-700 p-1 text-center ${day.isWeekend ? 'bg-slate-800/30' : ''}`}>
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
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-cyan-500/20 border border-cyan-500/30 rounded" /><span className="text-slate-300">モダリティ配置</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-500/20 border border-blue-500/30 rounded" /><span className="text-slate-300">16(夜勤)</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-500/20 border border-green-500/30 rounded" /><span className="text-slate-300">日勤</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-violet-500/20 border border-violet-500/30 rounded" /><span className="text-slate-300">週休</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-emerald-500/20 border border-emerald-500/30 rounded" /><span className="text-slate-300">休暇</span></div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-20 text-center border border-slate-800">
            <div className="text-6xl mb-4">📅</div>
            <div className="text-slate-400 text-xl mb-2">カレンダーがありません</div>
            <div className="text-slate-500 text-sm">「夜勤・日勤当番表」で期間を設定してください</div>
          </div>
        )}
      </div>
    </div>
  );
}
