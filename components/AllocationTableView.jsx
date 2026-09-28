import React, { useState, useMemo } from 'react';
import { getLeaveData } from '../utils/storage';
import { getWeeklyOffBySlot, getWeeklyOffIds } from '../utils/weeklyOff';
import {
  HALVES,
  KYUKYU_NAME,
  UNASSIGNED_KEY,
  computeWeeklyOffAfterMove,
  getRequired,
  getUnassigned,
  isSlot,
  pickShift,
} from '../utils/allocation';

const OTHER_LEAVE_TYPES = ['出張', 'リフ休', '年休', '特別休'];
const SCHEDULE_ROWS = [
  { key: 'dayShift', label: '日勤者' },
  { key: 'support', label: 'サポート' },
  { key: 'nightShift', label: '夜勤者' },
  { key: 'b', label: 'B' },
];
const HALF_STYLE = {
  am: { border: 'border-l-2 border-l-slate-600', header: 'bg-amber-50/80', cell: 'bg-amber-50/30' },
  pm: { border: '', header: 'bg-sky-50/80', cell: 'bg-sky-50/30' },
};

const sortIds = (ids) => [...ids].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));

function setDragData(e, data) {
  e.dataTransfer.setData('text/plain', JSON.stringify(data));
  e.dataTransfer.effectAllowed = 'move';
}

function readDragData(e) {
  e.preventDefault();
  try {
    return JSON.parse(e.dataTransfer.getData('text/plain') || 'null');
  } catch (_) {
    return null;
  }
}

function allowDrop(e) {
  e.preventDefault();
  if (e.dataTransfer.types.includes('text/plain')) e.dataTransfer.dropEffect = 'move';
}

const findDuplicates = (ids) => {
  const seen = new Set();
  const dup = new Set();
  ids.forEach((id) => (seen.has(id) ? dup.add(id) : seen.add(id)));
  return dup;
};

/** 配置表の表示と D&D 編集（モダリティ間・未配置の移動、週休の日付移動） */
export default function AllocationTableView({ allocation, modalityData, staffData, calendar, schedule, weeklyOff, surgeryDays, setAllocation, setWeeklyOff }) {
  const [assignPicker, setAssignPicker] = useState(null);
  const leaves = useMemo(getLeaveData, []);
  const name = (id) => (id ? staffData.find((s) => s.id === id)?.name || id : '');

  /** 日付ごとの B 担当者・当番等で埋まっている職員・重複職員 */
  const dayInfo = useMemo(() => {
    const info = {};
    calendar.forEach((day, idx) => {
      const daySched = schedule[day.date];
      const nextDay = calendar[idx + 1];
      const b = surgeryDays.includes(day.date) && nextDay ? pickShift(schedule[nextDay.date], 'nightShift') : pickShift(daySched, 'b');
      const onDuty = [pickShift(daySched, 'dayShift'), pickShift(daySched, 'support'), pickShift(daySched, 'nightShift'), b, pickShift(daySched, 'dayOff')];
      const weeklyOffIds = getWeeklyOffIds(weeklyOff, day.date);
      const dayLeaves = Array.isArray(leaves[day.date]) ? leaves[day.date] : [];
      const busy = new Set([...onDuty, ...weeklyOffIds, ...dayLeaves.map((l) => l.staffId)].filter(Boolean));
      const off = [...onDuty, ...weeklyOffIds, ...dayLeaves.filter((l) => l?.leaveType === '週休').map((l) => l.staffId)].filter(Boolean);
      const dayAlloc = allocation[day.date] || {};
      const dup = {};
      HALVES.forEach((h) => {
        const placed = modalityData.flatMap((m) => (isSlot(dayAlloc[m.id]) ? dayAlloc[m.id][h] || [] : []));
        dup[h] = findDuplicates([...off, ...getUnassigned(dayAlloc, h), ...placed]);
      });
      const hasDup = HALVES.some((h) => [...dup[h]].some((id) => id !== b));
      info[day.date] = { b, busy, dup, hasDup };
    });
    return info;
  }, [allocation, calendar, modalityData, schedule, weeklyOff, surgeryDays, leaves]);

  if (calendar.length === 0) return null;

  const dupBg = (dateStr) => (dayInfo[dateStr]?.hasDup ? 'bg-stone-400/70' : '');
  const isDup = (dateStr, id, halves) => {
    const { b, dup } = dayInfo[dateStr] || {};
    return !!id && b !== id && halves.some((h) => dup?.[h]?.has(id));
  };
  const isManualSlot = (dateStr, staffId, modId, slot) => {
    const list = allocation[dateStr]?._manualSlots || allocation[dateStr]?._manualStaff || [];
    return list.some((m) => m?.staffId === staffId && m.modId == modId && m.slot === slot);
  };
  const assignableUnassigned = (dateStr, half) => getUnassigned(allocation[dateStr], half).filter((id) => !dayInfo[dateStr].busy.has(id));

  const moveStaff = (dateStr, staffId, from, to) => {
    setAllocation((prev) => {
      if (!prev[dateStr]) return prev;
      const next = JSON.parse(JSON.stringify(prev));
      const day = next[dateStr];
      day._manualSlots ||= [];

      if (from.type === 'unassigned') {
        const key = UNASSIGNED_KEY[from.slot === 'pm' ? 'pm' : 'am'];
        if (day[key]) day[key] = day[key].filter((id) => id !== staffId);
        else if (day._unassigned) day._unassigned = day._unassigned.filter((id) => id !== staffId);
      } else if (isSlot(day[from.modId]) && day[from.modId][from.slot]) {
        day[from.modId][from.slot] = day[from.modId][from.slot].filter((id) => id !== staffId);
      }

      if (to.type === 'unassigned') {
        const key = UNASSIGNED_KEY[to.slot === 'pm' ? 'pm' : 'am'];
        day[key] ||= [];
        if (!day[key].includes(staffId)) day[key].push(staffId);
      } else {
        const slot = (day[to.modId] ||= { am: [], pm: [] });
        if (isSlot(slot)) {
          const mod = modalityData.find((m) => String(m.id) === String(to.modId));
          if (to.slot === 'pm' && mod?.name === KYUKYU_NAME && dayInfo[dateStr]?.b === staffId) {
            // 救命PMに B 担当者を入れたら、元の PM 担当者は未配置へ戻す
            (slot.pm || []).filter((id) => id !== staffId).forEach((id) => {
              day._unassignedPm ||= [];
              if (!day._unassignedPm.includes(id)) day._unassignedPm.push(id);
              if (slot.am) slot.am = slot.am.filter((x) => x !== id);
            });
            slot.pm = [staffId];
          } else if (!(slot[to.slot] || []).includes(staffId)) {
            slot[to.slot] = [...(slot[to.slot] || []), staffId];
          }
        }
      }

      const modId = to.type === 'unassigned' ? '_unassigned' : to.modId;
      if (!day._manualSlots.some((m) => m.staffId === staffId && m.modId == modId && m.slot === to.slot)) {
        day._manualSlots.push({ staffId, modId, slot: to.slot });
      }
      return next;
    });
  };

  const moveWeeklyOff = (staffId, fromDate, toDate) => {
    const next = computeWeeklyOffAfterMove(weeklyOff, staffId, fromDate, toDate, { schedule, calendar, surgeryDays, leaves });
    if (next) setWeeklyOff(next);
  };

  const staffNames = (dateStr, ids, source, className) => sortIds(ids).map((id) => (
    <span
      key={id}
      draggable
      title={name(id)}
      className={`font-medium whitespace-nowrap truncate block min-w-0 cursor-grab active:cursor-grabbing ${className(id)}`}
      onDragStart={(e) => setDragData(e, { type: 'allocation-staff', dateStr, staffId: id, fromSource: source })}
    >
      {name(id)}
    </span>
  ));

  const renderSlotCell = (mod, day, h) => {
    const dateStr = day.date;
    const slot = allocation[dateStr]?.[mod.id];
    const ids = Array.isArray(slot) ? (h === 'am' ? slot : []) : slot?.[h] || [];
    const isWeekend = day.isWeekend || day.isHoliday;
    const isShort = !isWeekend && ids.length < getRequired(mod, dateStr)[h];
    const bg = isShort ? 'bg-stone-300' : isWeekend ? 'bg-slate-50' : HALF_STYLE[h].cell;
    const source = { type: 'modality', modId: mod.id, slot: h };
    const openPicker = () => setAssignPicker({ dateStr, modId: mod.id, slot: h });
    const pickerProps = {
      role: 'button',
      tabIndex: 0,
      onDoubleClick: openPicker,
      onKeyDown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPicker();
        }
      },
    };
    const onDrop = (e) => {
      const data = readDragData(e);
      if (data?.type !== 'allocation-staff' || data.dateStr !== dateStr) return;
      const from = data.fromSource;
      if (from.type === source.type && from.modId === source.modId && from.slot === source.slot) return;
      moveStaff(dateStr, data.staffId, from, source);
    };
    return (
      <td
        key={h}
        className={`border border-slate-300 ${HALF_STYLE[h].border} p-0.5 min-w-[6rem] align-top text-sm ${bg} ${dupBg(dateStr)}`}
        onDragOver={allowDrop}
        onDrop={onDrop}
      >
        <div className="flex flex-col gap-0.5 min-h-[1.25rem]">
          {ids.length ? (
            <>
              {staffNames(dateStr, ids, source, (id) => `text-base ${
                isDup(dateStr, id, [h]) ? 'bg-red-100 text-red-700 px-0.5 rounded' : isManualSlot(dateStr, id, mod.id, h) ? 'text-red-600' : 'text-stone-800'
              }`)}
              <span className="block min-h-[1.25rem]" aria-hidden="true" />
              <span className="block min-h-[1.25rem] flex-1 cursor-pointer" aria-label="未配置から割り当て" {...pickerProps} />
            </>
          ) : (
            <span className="text-stone-400 hover:text-stone-600 cursor-pointer select-none" {...pickerProps}>－</span>
          )}
        </div>
      </td>
    );
  };

  const renderLeaveCell = (day) => {
    const dateStr = day.date;
    const wo = getWeeklyOffBySlot(weeklyOff, dateStr);
    const dayLeaves = leaves[dateStr] || [];
    const entries = [];
    const dayOff = pickShift(schedule[dateStr], 'dayOff');
    if (dayOff) entries.push({ text: `非番：${name(dayOff)}` });
    const leave週休 = dayLeaves.filter((l) => l.leaveType === '週休').map((l) => l.staffId);
    [...new Set([...wo.am, ...wo.pm, ...leave週休])].forEach((id) => {
      const inAm = wo.am.includes(id);
      const draggable = inAm || wo.pm.includes(id);
      entries.push({ text: `週休：${name(id)}`, drag: draggable && { type: 'weeklyOff', staffId: id, dateStr, slot: inAm ? 'am' : 'pm' } });
    });
    OTHER_LEAVE_TYPES.forEach((type) => {
      dayLeaves.filter((l) => l.leaveType === type).forEach((l) => entries.push({ text: `${type}：${name(l.staffId)}` }));
    });
    const onDrop = (e) => {
      const data = readDragData(e);
      if (data?.type === 'weeklyOff' && data.dateStr !== dateStr && data.slot != null) moveWeeklyOff(data.staffId, data.dateStr, dateStr);
    };
    return (
      <td
        key={dateStr}
        colSpan={2}
        className={`border border-slate-300 border-l-2 border-l-slate-600 p-0.5 min-w-[8rem] text-left align-top text-base whitespace-pre-line font-medium text-stone-800 ${day.isWeekend || day.isHoliday ? 'bg-slate-50' : 'bg-white'} ${dupBg(dateStr)}`}
        onDragOver={allowDrop}
        onDrop={onDrop}
      >
        {entries.length ? entries.map((entry, i) => (
          <span
            key={i}
            className={`block font-medium ${entry.drag ? 'cursor-grab active:cursor-grabbing' : ''}`}
            draggable={!!entry.drag}
            onDragStart={entry.drag ? (e) => setDragData(e, entry.drag) : undefined}
          >
            {entry.text}
          </span>
        )) : '－'}
      </td>
    );
  };

  const renderUnassignedCell = (day, h) => {
    const dateStr = day.date;
    const isWeekend = day.isWeekend || day.isHoliday;
    const ids = assignableUnassigned(dateStr, h);
    const onDrop = (e) => {
      const data = readDragData(e);
      if (data?.type !== 'allocation-staff' || data.dateStr !== dateStr) return;
      if (dayInfo[dateStr].busy.has(data.staffId) || data.fromSource.type === 'unassigned') return;
      moveStaff(dateStr, data.staffId, data.fromSource, { type: 'unassigned', slot: h });
    };
    return (
      <td
        key={h}
        className={`border border-slate-300 ${HALF_STYLE[h].border} p-0.5 min-w-[6rem] text-left align-top text-base ${isWeekend ? 'bg-slate-50' : HALF_STYLE[h].cell} ${dupBg(dateStr)}`}
        onDragOver={allowDrop}
        onDrop={onDrop}
      >
        <div className="flex flex-col gap-0.5 min-h-[1.25rem]">
          {ids.length ? staffNames(dateStr, ids, { type: 'unassigned', slot: h }, (id) => (
            isDup(dateStr, id, HALVES) ? 'bg-red-100 text-red-700 px-0.5 rounded' : isManualSlot(dateStr, id, '_unassigned', h) ? 'text-red-600' : 'text-stone-800'
          )) : <span className="text-stone-400">－</span>}
        </div>
      </td>
    );
  };

  const rowHeader = (label, bg, align = 'align-top') => (
    <td className={`border border-slate-300 p-0.5 sticky left-0 ${bg} z-10 font-semibold text-stone-700 ${align}`}>{label}</td>
  );

  return (
    <>
      <div className="overflow-x-auto border border-slate-400 rounded-xl bg-white">
        <table className="border-collapse text-sm min-w-full">
          <thead>
            <tr className="bg-stone-100 border-b-2 border-slate-400">
              <th className="border border-slate-300 p-0.5 sticky left-0 bg-stone-100 z-20 min-w-[110px] text-stone-800 font-bold">モダリティ</th>
              {calendar.map((day) => {
                const color = day.dayOfWeekNum === 0 || day.isHoliday ? 'text-red-600' : day.dayOfWeekNum === 6 ? 'text-blue-600' : null;
                return (
                  <th key={day.date} colSpan={2} className={`border border-slate-300 border-l-2 border-l-slate-600 p-0.5 min-w-[80px] text-center ${dupBg(day.date)} ${day.isWeekend || day.isHoliday ? 'bg-slate-100' : ''}`}>
                    <div className={`font-semibold ${color || 'text-stone-800'}`}>{day.date.slice(5).replace('-', '/')}</div>
                    <div className={`text-xs ${color || 'text-stone-600'}`}>{day.dayOfWeek}</div>
                  </th>
                );
              })}
            </tr>
            <tr className="bg-stone-50 border-b border-slate-300">
              <th className="border border-slate-300 p-0.5 sticky left-0 bg-stone-50 z-20" />
              {calendar.map((day) => HALVES.map((h) => (
                <th key={`${day.date}-${h}`} className={`border border-slate-300 ${HALF_STYLE[h].border} p-0.5 min-w-[6rem] text-sm font-semibold text-stone-600 ${HALF_STYLE[h].header} ${dupBg(day.date)}`}>
                  {h.toUpperCase()}
                </th>
              )))}
            </tr>
          </thead>
          <tbody>
            {modalityData.map((mod) => (
              <tr key={mod.id} className="hover:bg-slate-50/50">
                <td className="border border-slate-300 p-0.5 sticky left-0 bg-slate-50 z-10 font-semibold text-stone-800 align-top">{mod.name}</td>
                {calendar.map((day) => (
                  <React.Fragment key={day.date}>{HALVES.map((h) => renderSlotCell(mod, day, h))}</React.Fragment>
                ))}
              </tr>
            ))}
            {SCHEDULE_ROWS.map(({ key, label }) => (
              <tr key={key} className="bg-slate-100/50">
                {rowHeader(label, 'bg-slate-100', 'align-middle')}
                {calendar.map((day) => {
                  const staffId = (key === 'b' ? dayInfo[day.date].b : pickShift(schedule[day.date], key)) || null;
                  return (
                    <td key={day.date} colSpan={2} className={`border border-slate-300 border-l-2 border-l-slate-600 p-0.5 min-w-[8rem] text-left align-middle text-base ${day.isWeekend || day.isHoliday ? 'bg-slate-50' : 'bg-white'}`}>
                      {staffId
                        ? <span className="font-medium whitespace-nowrap truncate block min-w-0 text-stone-800" title={name(staffId)}>{name(staffId)}</span>
                        : <span className="text-stone-400">－</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="bg-amber-50/50">
              {rowHeader('休暇等', 'bg-amber-100/80')}
              {calendar.map(renderLeaveCell)}
            </tr>
            <tr className="bg-rose-50/50">
              {rowHeader('未配置', 'bg-rose-100/80')}
              {calendar.map((day) => (
                <React.Fragment key={day.date}>{HALVES.map((h) => renderUnassignedCell(day, h))}</React.Fragment>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {assignPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAssignPicker(null)} role="presentation">
          <div
            className="bg-white rounded-xl shadow-xl border border-slate-200 max-h-[80vh] w-full max-w-sm flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="p-3 border-b border-slate-200 font-semibold text-stone-800">
              未配置から割り当て（{assignPicker.dateStr} {assignPicker.slot.toUpperCase()}）
            </div>
            <div className="overflow-y-auto p-2 flex-1">
              {(() => {
                const { dateStr, modId, slot } = assignPicker;
                const ids = assignableUnassigned(dateStr, slot);
                if (ids.length === 0) return <p className="text-stone-500 text-sm py-2">割り当て可能な未配置職員がいません。</p>;
                return (
                  <ul className="space-y-0.5">
                    {[...ids].sort((a, b) => String(name(a)).localeCompare(String(name(b)), undefined, { numeric: true })).map((id) => (
                      <li key={id}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 rounded-lg text-base font-medium text-stone-800 hover:bg-amber-100 focus:bg-amber-100 focus:outline-none"
                          onClick={() => {
                            moveStaff(dateStr, id, { type: 'unassigned', slot }, { type: 'modality', modId, slot });
                            setAssignPicker(null);
                          }}
                        >
                          {name(id)}
                        </button>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
            <div className="p-2 border-t border-slate-200">
              <button type="button" className="w-full py-2 text-stone-600 hover:text-stone-800 text-sm" onClick={() => setAssignPicker(null)}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
