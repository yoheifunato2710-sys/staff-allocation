import React, { useState, useRef, useMemo } from 'react';
import { useData } from '../context/DataContext';
import ScreenHeader from '../components/ScreenHeader';
import MonthCalendar from '../components/MonthCalendar';
import Modal from '../components/Modal';
import StaffBadges from '../components/StaffBadges';
import { getLeaveData, setLeaveData as persistLeaveData } from '../utils/storage';
import { LEAVE_TYPES, addLeaves, removeLeave, updateLeaveType } from '../utils/leave';
import { getMonthCells } from '../utils/date';

const LEAVE_COLORS = {
  週休: 'bg-violet-100 text-violet-800',
  年休: 'bg-emerald-100 text-emerald-800',
  リフ休: 'bg-purple-100 text-purple-800',
  特別休: 'bg-amber-100 text-amber-800',
  出張: 'bg-pink-100 text-pink-800',
};
const selectClass = 'w-full p-3 bg-stone-50 border-2 border-slate-400 rounded-xl text-stone-800 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all';
const labelClass = 'block text-base mb-2 font-semibold text-stone-700 uppercase tracking-wider';

export default function LeaveInputScreen({ onBack }) {
  const { staffData } = useData();
  const [monthDate, setMonthDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [leaveData, setLeaveData] = useState(getLeaveData);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedLeaveType, setSelectedLeaveType] = useState('');
  const [detailDate, setDetailDate] = useState(null);
  const selectionExtendedRef = useRef(false);

  const year = monthDate.getFullYear();
  const staffName = (id) => staffData.find((s) => s.id === id)?.name || id;

  const commit = (next) => {
    setLeaveData(next);
    persistLeaveData(next);
  };

  const handleDateMouseDown = (date) => {
    selectionExtendedRef.current = false;
    setIsSelecting(true);
    setSelectedDates([date]);
  };

  const handleDateMouseEnter = (date) => {
    if (!isSelecting || selectedDates.length === 0) return;
    const allDates = getMonthCells(year, monthDate.getMonth()).filter(Boolean).map((c) => c.dateStr);
    const startIdx = allDates.indexOf(selectedDates[0]);
    const endIdx = allDates.indexOf(date);
    if (startIdx === -1 || endIdx === -1) return;
    const next = allDates.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);
    if (next.length > 1) selectionExtendedRef.current = true;
    setSelectedDates(next);
  };

  const handleDateMouseUp = () => {
    if (selectedDates.length === 0) return;
    setIsSelecting(false);
    const isSingleClick = selectedDates.length === 1 && !selectionExtendedRef.current;
    setDetailDate(isSingleClick ? selectedDates[0] : null);
    setShowLeaveModal(!isSingleClick);
  };

  const closeLeaveModal = () => {
    setShowLeaveModal(false);
    setSelectedDates([]);
  };

  const addLeave = () => {
    if (!selectedStaff || !selectedLeaveType) {
      alert('⚠️ 職員と種類を選択してください');
      return;
    }
    commit(addLeaves(leaveData, selectedDates, selectedStaff, selectedLeaveType));
    closeLeaveModal();
    setSelectedStaff('');
    setSelectedLeaveType('');
    alert('✅ 登録しました');
  };

  const handleRemove = (date, staffId) => {
    if (!confirm('削除しますか？')) return;
    commit(removeLeave(leaveData, date, staffId));
    alert('✅ 削除しました');
  };

  /** 年間（1/1〜12/31）の年休・リフ休の職員別日数 */
  const staffLeaveCounts = useMemo(() => {
    const counts = {};
    Object.entries(leaveData).forEach(([dateStr, leaves]) => {
      if (!dateStr.startsWith(`${year}-`)) return;
      leaves.forEach(({ staffId, leaveType }) => {
        if (leaveType !== '年休' && leaveType !== 'リフ休') return;
        counts[staffId] ??= { 年休: 0, リフ休: 0 };
        counts[staffId][leaveType]++;
      });
    });
    return counts;
  }, [leaveData, year]);

  const detailLeaves = leaveData[detailDate] || [];

  return (
    <div className="min-h-screen bg-violet-400 p-5 relative overflow-hidden flex flex-col">
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-rose-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col flex-1 min-h-0 w-full max-w-full">
        <ScreenHeader title="休暇・出張管理" onBack={onBack} />

        <div className="flex gap-6 flex-1 min-h-0 items-stretch">
          <div className="w-[520px] shrink-0 flex flex-col">
            <div className="bg-slate-50 rounded-xl border-2 border-slate-400 p-4 shadow-md">
              <h3 className="text-xl font-bold text-stone-800 mb-1">職員一覧</h3>
              <p className="text-stone-600 text-sm mb-4">{year}年（1/1〜12/31）年休・リフ休</p>
              {staffData.length === 0 ? (
                <p className="text-stone-600 text-base">職員が登録されていません（職員情報入力で登録）</p>
              ) : (
                <div className="space-y-1 overflow-y-auto max-h-[70vh] pr-1">
                  {staffData.map((staff, index) => (
                    <div key={staff.id} className="rounded-lg border-2 border-slate-400 bg-slate-50 hover:bg-slate-100/80 hover:border-slate-500 overflow-hidden shadow-sm">
                      <div className="flex items-center gap-1.5 px-2 py-1.5 flex-wrap">
                        <span className="text-stone-700 text-sm font-semibold w-5 shrink-0">{index + 1}</span>
                        <span className="flex-1 min-w-0 font-semibold text-stone-900 text-base truncate">{staff.name}</span>
                        <StaffBadges staff={staff} />
                        <div className="flex gap-4 shrink-0 text-stone-700 font-medium ml-auto">
                          {['年休', 'リフ休'].map((type) => (
                            <span key={type}>{type} <strong className="text-stone-900">{staffLeaveCounts[staff.id]?.[type] ?? 0}</strong>日</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            <MonthCalendar
              monthDate={monthDate}
              onChangeMonth={setMonthDate}
              gridProps={{ onMouseUp: handleDateMouseUp, onMouseLeave: () => setIsSelecting(false) }}
              hint="日付をクリックでその日の登録を表示・編集。ドラッグで範囲選択して新規追加"
              renderCell={({ dateStr, day, isWeekend, dateColor }) => {
                const cellBg = selectedDates.includes(dateStr)
                  ? 'bg-rose-100 border-rose-400 hover:border-rose-500'
                  : isWeekend ? 'bg-slate-100 border-slate-400 hover:border-slate-500' : 'bg-slate-50/50 border-slate-400 hover:border-rose-400 hover:bg-rose-50/50';
                return (
                  <div
                    key={dateStr}
                    role="button"
                    tabIndex={0}
                    onMouseDown={() => handleDateMouseDown(dateStr)}
                    onMouseEnter={() => handleDateMouseEnter(dateStr)}
                    className={`min-h-[88px] p-2 rounded-lg border-2 cursor-pointer transition-all select-none flex flex-col text-left ${cellBg}`}
                  >
                    <span className={`text-lg font-bold ${dateColor} shrink-0`}>{day}</span>
                    <div className="mt-0.5 space-y-0.5 flex-1 min-h-0 overflow-hidden">
                      {(leaveData[dateStr] || []).map((leave) => (
                        <div
                          key={leave.staffId}
                          className={`text-xs px-1.5 py-0.5 rounded leading-tight truncate max-w-full ${LEAVE_COLORS[leave.leaveType] || 'bg-stone-200 text-stone-800'}`}
                          title={`${staffName(leave.staffId)} (${leave.leaveType}) — 日付をクリックで編集`}
                        >
                          {staffName(leave.staffId)} ({leave.leaveType})
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }}
            />
          </div>
        </div>

        {showLeaveModal && (
          <Modal
            title={<>休暇・出張登録{selectedDates.length > 1 && <span className="text-rose-500 ml-2">({selectedDates.length}日間)</span>}</>}
            onClose={closeLeaveModal}
            className="max-w-md"
          >
            <div className="p-3 rounded-lg mb-4 text-base text-stone-700">期間: {selectedDates[0]} 〜 {selectedDates[selectedDates.length - 1]}</div>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>職員を選択 *</label>
                <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} className={selectClass}>
                  <option value="">-- 職員を選択 --</option>
                  {staffData.map((s, i) => <option key={s.id} value={s.id}>{i + 1}. {s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>種類を選択 *</label>
                <select value={selectedLeaveType} onChange={(e) => setSelectedLeaveType(e.target.value)} className={selectClass}>
                  <option value="">-- 種類を選択 --</option>
                  {LEAVE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={addLeave} className="btn-add flex-1">✓ 登録</button>
                <button type="button" onClick={closeLeaveModal} className="btn-panel flex-1 bg-white hover:bg-slate-100 border-2 border-slate-600 text-stone-800">キャンセル</button>
              </div>
            </div>
          </Modal>
        )}

        {detailDate && (
          <Modal title={`休暇・出張 — ${detailDate}`} onClose={() => setDetailDate(null)} className="max-w-lg max-h-[85vh]">
            <div className="flex-1 min-h-0 overflow-y-auto space-y-3 mb-4">
              {detailLeaves.length === 0 ? (
                <p className="text-stone-600">この日は登録がありません</p>
              ) : detailLeaves.map((leave) => (
                <div key={leave.staffId} className="flex items-center gap-3 p-3 bg-white rounded-xl border-2 border-slate-200">
                  <span className="font-semibold text-stone-800 min-w-[120px] truncate">{staffName(leave.staffId)}</span>
                  <select
                    value={leave.leaveType}
                    onChange={(e) => commit(updateLeaveType(leaveData, detailDate, leave.staffId, e.target.value))}
                    className="flex-1 p-2 bg-stone-50 border-2 border-slate-400 rounded-lg text-stone-800 focus:border-rose-400 outline-none"
                  >
                    {LEAVE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <button type="button" onClick={() => handleRemove(detailDate, leave.staffId)} className="shrink-0 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-medium">削除</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 shrink-0 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setSelectedDates([detailDate]);
                  setDetailDate(null);
                  setShowLeaveModal(true);
                }}
                className="btn-add flex-1"
              >
                ＋ この日に追加
              </button>
              <button type="button" onClick={() => setDetailDate(null)} className="btn-panel bg-white hover:bg-slate-100 border-2 border-slate-600 text-stone-800">閉じる</button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}
