import React, { useState, useEffect, useRef, useMemo, useReducer } from 'react';
import { useData } from '../context/DataContext';
import ErrorBoundary from '../components/ErrorBoundary';
import ScreenHeader from '../components/ScreenHeader';
import Modal from '../components/Modal';
import AllocationTableView from '../components/AllocationTableView';
import { runAllocationForCalendar, pickShift } from '../utils/allocation';
import { getHolidays } from '../utils/holidays';
import { normalizeWeeklyOff, getWeeklyOffIds } from '../utils/weeklyOff';
import { getAllocationData, setAllocationData, getScheduleData, setScheduleData, getLeaveData } from '../utils/storage';
import { WEEK_LABELS, addDays, isDateStr, parseDate } from '../utils/date';

const MAX_UNDO = 50;
const SHIFT_FIELDS = ['dayShift', 'support', 'nightShift', 'b', 'dayOff'];
const SHIFT_LABELS = ['日勤', 'サポート', '夜勤', 'B', '非番'];
const COL_WIDTHS = ['3.5rem', '1.25rem', '8%', '8%', '8%', '8%', '8%', '8%', '7%', '7%', '7%', '7%', '1.75rem', '1.75rem'];
const WEEKLY_TABLE_CELLS = [
  ['dayShift', 'A', 'bg-emerald-100 text-stone-800'],
  ['support', 'S', 'bg-emerald-50 text-stone-700'],
  ['nightShift', '16', 'bg-rose-800 text-white'],
  ['b', 'B', 'bg-blue-600 text-white'],
  ['dayOff', '非番', 'bg-orange-400 text-white'],
];
const ORDER_COLORS = {
  blue: {
    header: 'bg-blue-50', badge: 'bg-blue-100 text-blue-800', staffHover: 'hover:border-blue-400 hover:bg-blue-50',
    box: 'border-blue-300 bg-blue-50/30', boxHeader: 'bg-blue-100 border-blue-300', item: 'border-blue-300 hover:border-blue-500',
    listRing: ['ring-1', 'ring-blue-400'], itemRing: ['ring-1', 'ring-inset', 'ring-blue-500'],
    starOn: 'bg-blue-500 text-white', starOff: 'hover:bg-blue-300',
  },
  emerald: {
    header: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-800', staffHover: 'hover:border-emerald-400 hover:bg-emerald-50',
    box: 'border-emerald-300 bg-emerald-50/30', boxHeader: 'bg-emerald-100 border-emerald-300', item: 'border-emerald-300 hover:border-emerald-500',
    listRing: ['ring-1', 'ring-emerald-400'], itemRing: ['ring-1', 'ring-inset', 'ring-emerald-500'],
    starOn: 'bg-emerald-500 text-white', starOff: 'hover:bg-emerald-300',
  },
};
const PAIR_RING = ['ring-1', 'ring-orange-400'];

const setHighlight = (e, classes, on) => e.currentTarget.classList[on ? 'add' : 'remove'](...classes);
const readDragData = (e) => {
  e.preventDefault();
  try {
    return JSON.parse(e.dataTransfer.getData('text/plain') || 'null');
  } catch (_) {
    return null;
  }
};
const setDragData = (e, data, effect = 'move') => {
  e.dataTransfer.setData('text/plain', JSON.stringify(data));
  e.dataTransfer.effectAllowed = effect;
};

/**
 * 週休のルール（1箇所で定義）
 * 【付与する週休の日数】土日祝の勤務に応じて加算（当番は「右（手動）優先、空なら左（自動）」で判定）
 *   金曜夜勤 +1、土曜夜勤 +2、土曜日勤/サポート +1、日曜日勤/サポート +1、日曜夜勤 +1、土日のB +1（土と日でそれぞれ）
 * 【割り当て先】平日のみ。土日祝は割り当てない。
 * 【割り当てない日】その日に「有効当番」で夜勤・日勤・サポート・B・非番のいずれかである日、または休暇入力がある日。
 */
function getEffectiveScheduleForDay(schedule, calendar, idx, surgeryDays) {
  const dateStr = calendar[idx].date;
  const daySchedule = schedule[dateStr];
  const nextDay = calendar[idx + 1];
  const prevDay = calendar[idx - 1];
  return {
    dayShift: pickShift(daySchedule, 'dayShift'),
    support: pickShift(daySchedule, 'support'),
    nightShift: pickShift(daySchedule, 'nightShift'),
    b: surgeryDays.includes(dateStr) && nextDay ? pickShift(schedule[nextDay.date], 'nightShift') : pickShift(daySchedule, 'b'),
    dayOff: prevDay ? pickShift(schedule[prevDay.date], 'nightShift') : pickShift(daySchedule, 'dayOff'),
  };
}

const isAssignedOnDay = (staffId, eff) => SHIFT_FIELDS.some((f) => eff[f] === staffId);

/** 付与する週休の日数（土日祝の勤務のみ。当番は有効当番で判定） */
function calcWeeklyOffDaysForStaff(staffId, calendar, schedule, surgeryDays) {
  let days = 0;
  calendar.forEach((day, idx) => {
    const eff = getEffectiveScheduleForDay(schedule, calendar, idx, surgeryDays);
    const dow = day.dayOfWeekNum ?? parseDate(day.date).getDay();
    const onNight = eff.nightShift === staffId;
    const onDayOrSupport = eff.dayShift === staffId || eff.support === staffId;
    if (dow === 5 && onNight) days += 1;
    if (dow === 6 && onNight) days += 2;
    if ((dow === 6 || dow === 0) && onDayOrSupport) days += 1;
    if (dow === 0 && onNight) days += 1;
    if ((dow === 6 || dow === 0) && eff.b === staffId) days += 1;
  });
  return days;
}

/** 順番リストから夜勤・日勤・サポート・非番を自動計算（手動入力は引き継ぐ） */
function buildSchedule(calendar, existing, { nightOrder, dayOrder, nightStart, dayStart, pairs }) {
  const schedule = {};
  const nightStartIdx = Math.max(0, nightOrder.indexOf(nightStart));
  let dayIndex = Math.max(0, dayOrder.indexOf(dayStart));
  calendar.forEach((day, idx) => {
    const prev = existing[day.date];
    const entry = { nightShift: null, dayShift: null, support: null, b: null, dayOff: null };
    SHIFT_FIELDS.forEach((f) => { entry[`${f}Manual`] = prev?.[`${f}Manual`] ?? null; });
    if (nightOrder.length > 0) {
      entry.nightShift = nightOrder[(nightStartIdx + idx) % nightOrder.length];
      entry.dayOff = idx > 0
        ? schedule[calendar[idx - 1].date].nightShift
        : nightOrder[(nightStartIdx - 1 + nightOrder.length) % nightOrder.length];
    }
    if ((day.isWeekend || day.isHoliday) && dayOrder.length > 0) {
      const person = dayOrder[dayIndex++ % dayOrder.length];
      const pair = pairs.find((p) => p.person1 === person || p.person2 === person);
      entry.dayShift = person;
      if (pair) entry.support = pair.person1 === person ? pair.person2 : pair.person1;
    }
    schedule[day.date] = entry;
  });
  return schedule;
}

function buildCalendar(startDate, endDate) {
  const days = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    const dow = parseDate(date).getDay();
    days.push({
      date,
      dayOfWeek: WEEK_LABELS[dow],
      dayOfWeekNum: dow,
      isWeekend: dow === 0 || dow === 6,
      isHoliday: getHolidays(Number(date.slice(0, 4))).has(date),
    });
  }
  return days;
}

/** 保存済みの当番表を読み込む（壊れたデータでも画面は初期状態で表示する） */
function loadSchedule() {
  const data = getScheduleData();
  const arr = (v) => (Array.isArray(v) ? v : []);
  const calendar = arr(data.calendar)
    .filter((day) => typeof day?.date === 'string')
    .map((day) => ({ ...day, isHoliday: getHolidays(parseInt(day.date.slice(0, 4), 10)).has(day.date) }));
  return {
    startDate: typeof data.startDate === 'string' ? data.startDate : '',
    endDate: typeof data.endDate === 'string' ? data.endDate : '',
    calendar,
    surgeryDays: arr(data.surgeryDays),
    internalMedicineDays: arr(data.internalMedicineDays),
    nightShiftOrder: arr(data.nightShiftOrder),
    dayShiftOrder: arr(data.dayShiftOrder),
    nightShiftStartId: data.nightShiftStartId ?? null,
    dayShiftStartId: data.dayShiftStartId ?? null,
    pairs: arr(data.pairs),
    schedule: data.schedule && typeof data.schedule === 'object' && !Array.isArray(data.schedule) ? data.schedule : {},
    weeklyOff: normalizeWeeklyOff(data.weeklyOff),
  };
}

function SectionToolbar({ title, children, onUndo, onRedo, canUndo, canRedo }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
      <h3 className="font-bold text-stone-800 text-2xl">{title}</h3>
      <div className="flex flex-wrap items-center justify-between gap-3 w-full">
        <div className="flex flex-wrap items-center gap-2">
          {children}
          <button type="button" onClick={onUndo} disabled={!canUndo} className="btn-section-nav disabled:opacity-40 disabled:cursor-not-allowed">← 戻る</button>
          <button type="button" onClick={onRedo} disabled={!canRedo} className="btn-section-nav disabled:opacity-40 disabled:cursor-not-allowed">進む →</button>
        </div>
        <button type="button" onClick={() => window.print()} className="btn-section-print shrink-0">🖨️ 印刷</button>
      </div>
    </div>
  );
}

function StaffPickerModal({ title, staff, onPick, onClose }) {
  const itemClass = 'w-full px-3 py-2 rounded-lg font-medium text-lg transition-all';
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-5 z-50" onClick={onClose}>
      <div className="bg-slate-50 border-2 border-slate-400 rounded-2xl p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-stone-800 text-xl mb-3">{title}</h3>
        <div className="max-h-64 overflow-y-auto space-y-1 mb-3">
          {staff.map((s) => (
            <button key={s.id} type="button" onClick={() => onPick(s.id)} className={`${itemClass} text-left bg-white border border-slate-300 hover:bg-slate-100 text-stone-800`}>{s.name}</button>
          ))}
          {staff.length === 0 && <p className="text-stone-500 text-sm py-2">該当リストに職員がいません</p>}
        </div>
        <button type="button" onClick={() => onPick(null)} className={`${itemClass} bg-stone-200 hover:bg-stone-300 text-stone-700`}>クリア</button>
      </div>
    </div>
  );
}

const panelClass = 'flex flex-col flex-1 min-w-0 border border-slate-300 rounded-xl bg-slate-50/50 overflow-hidden';
const boxClass = 'flex-1 min-w-0 flex flex-col border rounded-lg overflow-hidden';
const boxHeaderClass = 'font-bold text-stone-700 px-1.5 py-1 border-b shrink-0 text-sm';
const emptyClass = 'text-stone-500 text-sm py-2 text-center';

function PanelHeader({ label, count, header, badge }) {
  return (
    <h4 className={`font-bold text-stone-800 text-base mb-1 px-2 py-1.5 shrink-0 flex items-center gap-1 ${header}`}>
      <span className={`px-1.5 py-0.5 rounded text-sm ${badge}`}>{label}</span>
      <span className="text-stone-500 font-normal text-sm">({count})</span>
    </h4>
  );
}

/** 左の職員一覧（ドラッグ元） */
function StaffSource({ staff, hoverClass, emptyText }) {
  return (
    <div className={`${boxClass} border-slate-300 bg-white`}>
      <h4 className={`${boxHeaderClass} bg-slate-100 border-slate-300`}>職員</h4>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {staff.map((s) => (
          <div
            key={s.id}
            draggable
            onDragStart={(e) => setDragData(e, { source: 'left', staffId: s.id }, 'copy')}
            className={`px-2 py-1.5 rounded text-sm border border-slate-300 bg-white cursor-grab active:cursor-grabbing transition-all truncate ${hoverClass}`}
          >
            {s.name}
          </div>
        ))}
        {staff.length === 0 && <p className={emptyClass}>{emptyText}</p>}
      </div>
    </div>
  );
}

/** 夜勤・日勤の順番リスト。左からドロップで追加、右内でドラッグして並べ替え、★で開始者を指定 */
function OrderPanel({ label, color, staffData, order, setOrder, startId, onSetStart }) {
  const c = ORDER_COLORS[color];
  const nameOf = (id) => staffData.find((s) => s.id === id)?.name || id;

  const dropOnList = (e) => {
    setHighlight(e, c.listRing, false);
    const data = readDragData(e);
    if (data?.source === 'left' && data.staffId && !order.includes(data.staffId)) setOrder([...order, data.staffId]);
    else if (data?.source === 'right' && data.fromIndex !== undefined) setOrder([...order.filter((_, i) => i !== data.fromIndex), data.staffId]);
  };

  const dropOnItem = (e, idx) => {
    e.stopPropagation();
    setHighlight(e, c.itemRing, false);
    const data = readDragData(e);
    const next = [...order];
    if (data?.source === 'right' && data.fromIndex !== undefined) {
      if (data.fromIndex === idx) return;
      next.splice(data.fromIndex, 1);
      next.splice(data.fromIndex < idx ? idx - 1 : idx, 0, data.staffId);
    } else if (data?.source === 'left' && data.staffId && !order.includes(data.staffId)) {
      next.splice(idx, 0, data.staffId);
    } else {
      return;
    }
    setOrder(next);
  };

  return (
    <div className={panelClass}>
      <PanelHeader label={label} count={`${order.length}名`} header={c.header} badge={c.badge} />
      <div className="flex gap-1.5 flex-1 min-h-0 overflow-hidden">
        <StaffSource staff={staffData.filter((s) => !order.includes(s.id))} hoverClass={c.staffHover} emptyText="全員追加済" />
        <div className={`${boxClass} ${c.box}`}>
          <h4 className={`${boxHeaderClass} ${c.boxHeader}`}>順番</h4>
          <div
            className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = e.dataTransfer.types.includes('text/plain') ? 'move' : 'copy';
              setHighlight(e, c.listRing, true);
            }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHighlight(e, c.listRing, false); }}
            onDrop={dropOnList}
          >
            {order.map((id, idx) => (
              <div
                key={`${id}-${idx}`}
                draggable
                onDragStart={(e) => setDragData(e, { source: 'right', staffId: id, fromIndex: idx })}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setHighlight(e, c.itemRing, true);
                }}
                onDragLeave={(e) => setHighlight(e, c.itemRing, false)}
                onDrop={(e) => dropOnItem(e, idx)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-sm border bg-white cursor-grab active:cursor-grabbing transition-all group ${c.item}`}
              >
                <span className="text-slate-400 shrink-0 select-none" aria-hidden>⋮⋮</span>
                <span className="text-stone-800 font-medium truncate min-w-0 flex-1">{idx + 1}. {nameOf(id)}</span>
                <button
                  type="button"
                  onClick={(ev) => { ev.stopPropagation(); onSetStart(id); }}
                  title="開始者に設定"
                  className={`shrink-0 w-6 h-6 flex items-center justify-center rounded text-sm font-bold transition-all ${startId === id ? c.starOn : `bg-slate-200 text-slate-500 hover:text-white ${c.starOff}`}`}
                >
                  ★
                </button>
                <button type="button" onClick={(ev) => { ev.stopPropagation(); setOrder(order.filter((_, i) => i !== idx)); }} className="text-red-500 hover:text-red-600 font-semibold text-sm opacity-0 group-hover:opacity-100 shrink-0">削除</button>
              </div>
            ))}
            {order.length === 0 && <p className={`${emptyClass} border border-dashed border-slate-300 rounded`}>ドロップで追加</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** ペア設定。1人目を「新規ペア」にドロップ → 2人目をその行にドロップ */
function PairPanel({ staffData, pairs, setPairs }) {
  const [first, setFirst] = useState(null);
  const nameOf = (id) => staffData.find((s) => s.id === id)?.name || id;
  const dropZone = (onStaff, extraRing = []) => ({
    onDragOver: (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setHighlight(e, [...PAIR_RING, ...extraRing], true);
    },
    onDragLeave: (e) => setHighlight(e, [...PAIR_RING, ...extraRing], false),
    onDrop: (e) => {
      setHighlight(e, [...PAIR_RING, ...extraRing], false);
      const data = readDragData(e);
      if (data?.source === 'left' && data.staffId) onStaff(data.staffId);
    },
  });

  return (
    <div className={panelClass}>
      <PanelHeader label="ペア" count={`${pairs.length}組`} header="bg-orange-50" badge="bg-orange-100 text-orange-800" />
      <div className="flex gap-1.5 flex-1 min-h-0 overflow-hidden">
        <StaffSource
          staff={staffData.filter((s) => s.id !== first && !pairs.some((p) => p.person1 === s.id || p.person2 === s.id))}
          hoverClass="hover:border-orange-400 hover:bg-orange-50"
          emptyText="全員ペア済"
        />
        <div className={`${boxClass} border-orange-300 bg-orange-50/30`}>
          <h4 className={`${boxHeaderClass} bg-orange-100 border-orange-300`}>ペア一覧</h4>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0">
            {pairs.map((pair, idx) => (
              <div key={idx} className="flex justify-between items-center px-2 py-1.5 rounded text-sm border border-orange-300 bg-white transition-all group">
                <span className="text-stone-800 font-medium truncate min-w-0">{nameOf(pair.person1)} ↔ {nameOf(pair.person2)}</span>
                <button type="button" onClick={() => setPairs(pairs.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-600 font-semibold text-sm opacity-0 group-hover:opacity-100 shrink-0">削除</button>
              </div>
            ))}
            {first ? (
              <div
                className="px-2 py-1.5 rounded border border-dashed border-orange-400 bg-orange-50 min-h-[40px] flex items-center justify-between gap-1 text-sm"
                {...dropZone((staffId) => {
                  if (staffId === first) return;
                  setPairs([...pairs, { person1: first, person2: staffId }]);
                  setFirst(null);
                })}
              >
                <span className="text-stone-700 truncate">{nameOf(first)} — </span>
                <span className="text-orange-600 text-sm font-medium shrink-0">2人目ドロップ</span>
                <button type="button" onClick={() => setFirst(null)} className="text-slate-500 hover:text-slate-700 text-sm shrink-0">×</button>
              </div>
            ) : (
              <div className="text-stone-500 text-sm py-2 text-center border border-dashed border-slate-300 rounded min-h-[44px] flex items-center justify-center" {...dropZone(setFirst, ['bg-orange-50'])}>
                1人目をドロップ
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ShiftScheduleScreen({ onBack }) {
  const { staffData, modalityData } = useData();
  const [initial] = useState(loadSchedule);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [calendar, setCalendar] = useState(initial.calendar);
  const [surgeryDays, setSurgeryDays] = useState(initial.surgeryDays);
  const [internalMedicineDays, setInternalMedicineDays] = useState(initial.internalMedicineDays);
  const [nightShiftOrder, setNightShiftOrder] = useState(initial.nightShiftOrder);
  const [dayShiftOrder, setDayShiftOrder] = useState(initial.dayShiftOrder);
  const [nightShiftStartId, setNightShiftStartId] = useState(initial.nightShiftStartId);
  const [dayShiftStartId, setDayShiftStartId] = useState(initial.dayShiftStartId);
  const [pairs, setPairs] = useState(initial.pairs);
  const [schedule, setSchedule] = useState(initial.schedule);
  const [weeklyOff, setWeeklyOff] = useState(initial.weeklyOff);
  const [allocation, setAllocation] = useState(() => {
    const data = getAllocationData();
    return data?.allocation && typeof data.allocation === 'object' ? data.allocation : {};
  });
  const [showAllOrderModal, setShowAllOrderModal] = useState(false);
  const [picker, setPicker] = useState(null); // { date, field } 当番セルの職員選択（field が *Manual なら右列）
  const [allocationRunning, setAllocationRunning] = useState(false);
  const historyRef = useRef({ undo: [], redo: [] });
  const [, bumpHistory] = useReducer((n) => n + 1, 0);

  const safeCalendar = useMemo(() => calendar.filter((d) => typeof d?.date === 'string'), [calendar]);
  const nameOf = (id) => (id ? staffData.find((s) => s.id === id)?.name || id : '');

  useEffect(() => {
    if (!startDate && !endDate && calendar.length === 0) return;
    setScheduleData({ startDate, endDate, calendar, surgeryDays, internalMedicineDays, nightShiftOrder, dayShiftOrder, nightShiftStartId, dayShiftStartId, pairs, schedule, weeklyOff });
  }, [startDate, endDate, calendar, surgeryDays, internalMedicineDays, nightShiftOrder, dayShiftOrder, nightShiftStartId, dayShiftStartId, pairs, schedule, weeklyOff]);

  useEffect(() => {
    if (Object.keys(allocation).length === 0) return;
    setAllocationData({ allocation, startDate: isDateStr(startDate) ? startDate : '', endDate: isDateStr(endDate) ? endDate : '' });
  }, [allocation, startDate, endDate]);

  // --- 戻る / 進む（当番・輪番・週休） ---
  const snapshot = () => JSON.parse(JSON.stringify({ schedule, surgeryDays, internalMedicineDays, weeklyOff }));
  const pushUndoState = () => {
    const history = historyRef.current;
    history.redo = [];
    history.undo.push(snapshot());
    if (history.undo.length > MAX_UNDO) history.undo.shift();
    bumpHistory();
  };
  const stepHistory = (from, to) => {
    const history = historyRef.current;
    if (history[from].length === 0) return;
    history[to].push(snapshot());
    const state = history[from].pop();
    setSchedule(state.schedule);
    setSurgeryDays(state.surgeryDays);
    setInternalMedicineDays(state.internalMedicineDays);
    setWeeklyOff(state.weeklyOff);
    bumpHistory();
  };
  const historyProps = {
    onUndo: () => stepHistory('undo', 'redo'),
    onRedo: () => stepHistory('redo', 'undo'),
    canUndo: historyRef.current.undo.length > 0,
    canRedo: historyRef.current.redo.length > 0,
  };

  const assignSchedule = (days, nightStart = nightShiftStartId ?? nightShiftOrder[0], dayStart = dayShiftStartId ?? dayShiftOrder[0] ?? null) => {
    pushUndoState();
    setSchedule(buildSchedule(days, schedule, { nightOrder: nightShiftOrder, dayOrder: dayShiftOrder, nightStart, dayStart, pairs }));
  };

  const generateCalendar = () => {
    if (!startDate || !endDate) {
      alert('⚠️ 開始日と終了日を入力してください');
      return;
    }
    if (startDate > endDate) {
      alert('⚠️ 開始日は終了日より前にしてください');
      return;
    }
    const days = buildCalendar(startDate, endDate);
    setCalendar(days);
    if (nightShiftOrder.length > 0) {
      assignSchedule(days);
      alert('✅ カレンダーを生成し、職員を配置しました');
    } else {
      alert('✅ カレンダーを生成しました。夜勤順番を設定してから再度「カレンダーを生成」を押すと職員も自動で配置されます');
    }
  };

  /** 当番表を再配置。開始者（★）変更時は引数で開始者を渡し、完了メッセージは出さない */
  const autoAssign = (nightStart, dayStart) => {
    if (calendar.length === 0) {
      alert('⚠️ まず「カレンダーを生成」で期間のカレンダーを作成してください');
      return;
    }
    if (nightShiftOrder.length === 0) {
      alert('⚠️ 夜勤順番リストを設定してください');
      return;
    }
    if (nightStart === undefined) {
      assignSchedule(calendar);
      alert('✅ 自動配置が完了しました');
    } else {
      assignSchedule(calendar, nightStart, dayStart);
    }
  };

  const autoAssignWeeklyOff = () => {
    if (calendar.length === 0 || Object.keys(schedule).length === 0) {
      alert('⚠️ まず当番表を作成してください');
      return;
    }
    const leaveData = getLeaveData();
    const remaining = Object.fromEntries(staffData.map((s) => [s.id, calcWeeklyOffDaysForStaff(s.id, calendar, schedule, surgeryDays)]));
    const weekdays = calendar.filter((d) => !d.isWeekend && !d.isHoliday);
    const next = {};
    weekdays.forEach((day, dayIndex) => {
      const eff = getEffectiveScheduleForDay(schedule, calendar, calendar.indexOf(day), surgeryDays);
      const totalRemaining = Object.values(remaining).reduce((a, b) => a + b, 0);
      // 残り日数で均等になるよう、その日の割り当て人数を決める
      const quota = Math.min(Math.ceil(totalRemaining / (weekdays.length - dayIndex)), totalRemaining);
      let assigned = 0;
      for (const { id } of staffData) {
        if (assigned >= quota) break;
        if (remaining[id] <= 0 || leaveData[day.date]?.some((l) => l.staffId === id) || isAssignedOnDay(id, eff)) continue;
        (next[day.date] ||= []).push(id);
        remaining[id]--;
        assigned++;
      }
    });
    pushUndoState();
    setWeeklyOff(next);
    alert('✅ 週休を自動割り当てしました');
  };

  const resetWeeklyOff = () => {
    if (!window.confirm('週休自動割り当てをリセットしますか？')) return;
    pushUndoState();
    setWeeklyOff({});
  };

  const updateSchedule = (date, field, value) => {
    setSchedule((prev) => {
      const next = { ...prev, [date]: { ...prev[date], [field]: value } };
      if (['dayShift', 'support', 'nightShift'].includes(field)) next[date][`${field}Edited`] = true;
      if (field === 'nightShiftManual') {
        // 夜勤の右セルを変えたら翌日の非番の右セルも同じ職員にする
        const idx = calendar.findIndex((d) => d.date === date);
        const nextDay = idx >= 0 ? calendar[idx + 1] : undefined;
        if (nextDay) next[nextDay.date] = { ...next[nextDay.date], dayOffManual: value };
      }
      return next;
    });
  };

  const moveWeeklyOff = (staffId, fromDate, toDate) => {
    const idx = calendar.findIndex((d) => d.date === toDate);
    const day = calendar[idx];
    if (!day || day.isWeekend || day.isHoliday) return;
    if (getLeaveData()[toDate]?.some((l) => l.staffId === staffId)) return;
    if (isAssignedOnDay(staffId, getEffectiveScheduleForDay(schedule, calendar, idx, surgeryDays))) return;
    setWeeklyOff((prev) => {
      const next = { ...prev };
      const fromIds = getWeeklyOffIds(prev, fromDate).filter((id) => id !== staffId);
      if (fromIds.length === 0) delete next[fromDate];
      else next[fromDate] = fromIds;
      const toIds = getWeeklyOffIds(prev, toDate);
      if (!toIds.includes(staffId)) next[toDate] = [...toIds, staffId];
      return next;
    });
  };

  const toggleDay = (setDays) => (date) => setDays((prev) => (prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]));
  const toggleSurgeryDay = toggleDay(setSurgeryDays);
  const toggleInternalMedicineDay = toggleDay(setInternalMedicineDays);

  const runAllocation = () => {
    if (calendar.length === 0) {
      alert('⚠️ まず「カレンダーを生成（職員も配置）」を押して当番表を作成してください');
      return;
    }
    if (modalityData.length === 0) {
      alert('⚠️ モダリティが登録されていません。');
      return;
    }
    if (staffData.length === 0) {
      alert('⚠️ 職員が登録されていません。');
      return;
    }
    setAllocationRunning(true);
    try {
      const { allocation: result, alertMessage } = runAllocationForCalendar(calendar, modalityData, staffData);
      if (result != null) setAllocation(result);
      alert(alertMessage);
    } finally {
      setAllocationRunning(false);
    }
  };

  const renderScheduleRow = (day, idx) => {
    const daySchedule = schedule[day.date] || {};
    const nextDay = safeCalendar[idx + 1];
    const prevDay = safeCalendar[idx - 1];
    const nextSched = nextDay && schedule[nextDay.date];
    const prevSched = prevDay && schedule[prevDay.date];
    const isSurgery = surgeryDays.includes(day.date);
    const isInternalMedicine = internalMedicineDays.includes(day.date);
    const isWeekendOrHoliday = day.isWeekend || day.isHoliday;
    const bPerson = isSurgery && nextDay ? pickShift(nextSched, 'nightShift') : pickShift(daySchedule, 'b');
    const dayOffPerson = (prevDay ? pickShift(prevSched, 'nightShift') : null) ?? pickShift(daySchedule, 'dayOff');
    const onDuty = [pickShift(daySchedule, 'dayShift'), pickShift(daySchedule, 'support'), pickShift(daySchedule, 'nightShift'), bPerson].filter(Boolean);
    const overlapBg = onDuty.length !== new Set(onDuty).size ? 'bg-slate-500' : '';
    const rowStyle = isSurgery ? 'bg-yellow-200 border-l-4 border-l-amber-500'
      : isInternalMedicine ? 'bg-pink-200 border-l-4 border-l-pink-500'
        : isWeekendOrHoliday ? 'bg-sky-50 border-l-4 border-l-sky-400' : '';
    const cellBg = isWeekendOrHoliday && !isSurgery && !isInternalMedicine ? 'bg-sky-100/50' : '';

    // [field, 左列（自動）の表示値, 左列を赤字にするか, 右列（手動）を表示するか]
    const columns = [
      ['dayShift', daySchedule.dayShift, daySchedule.dayShiftEdited, !!daySchedule.dayShift],
      ['support', daySchedule.support, daySchedule.supportEdited, !!daySchedule.support],
      ['nightShift', daySchedule.nightShift, daySchedule.nightShiftEdited, !!daySchedule.nightShift],
      ['b', bPerson ?? daySchedule.b, isSurgery && nextDay && (nextSched?.nightShiftManual != null || nextSched?.nightShiftEdited), !!bPerson],
      ['dayOff', dayOffPerson ?? daySchedule.dayOff, prevDay && (prevSched?.nightShiftManual != null || prevSched?.nightShiftEdited), !!dayOffPerson],
    ];
    const toggleButton = (active, activeClass, onClick) => (
      <button type="button" onClick={onClick} className={`min-w-[1.25rem] min-h-[1.25rem] rounded text-base font-semibold transition-all ${active ? activeClass : 'bg-stone-300/80 hover:bg-stone-400/80 text-stone-600'}`}>
        {active ? '✓' : '−'}
      </button>
    );

    return (
      <tr key={day.date} className={`border-b border-slate-400 transition-all ${rowStyle}`}>
        <td className={`pl-0.5 pr-0.5 py-0.5 text-center text-stone-800 text-base border-r border-slate-400 ${cellBg}`}>{day.date}</td>
        <td className={`pl-0 pr-0.5 py-0.5 text-center font-bold text-base border-r border-slate-400 ${cellBg} ${isWeekendOrHoliday ? 'text-red-600' : 'text-stone-800'}`}>{day.dayOfWeek}</td>
        {columns.map(([field, autoValue, autoIsRed, hasAuto]) => {
          const manualField = `${field}Manual`;
          const manualValue = daySchedule[manualField];
          return (
            <React.Fragment key={field}>
              <td className={`px-0.5 py-0.5 text-center font-bold text-sm border-r border-slate-300 ${cellBg} ${overlapBg}`}>
                <button
                  type="button"
                  onClick={() => { if (window.confirm('変えても良いですか？')) setPicker({ date: day.date, field }); }}
                  className={`w-full min-h-[1.25rem] rounded text-base hover:bg-slate-200/60 transition-all cursor-pointer ${autoIsRed ? 'text-red-600' : 'text-stone-800'}`}
                >
                  {nameOf(autoValue)}
                </button>
              </td>
              <td className={`px-0.5 py-0.5 text-center border-r-2 border-slate-500 ${cellBg} ${overlapBg}`}>
                {hasAuto && (
                  <button
                    type="button"
                    onClick={() => setPicker({ date: day.date, field: manualField })}
                    className={`w-full min-h-[1.25rem] rounded text-base font-medium bg-white/70 hover:bg-white/85 border border-slate-300/80 transition-all ${manualValue ? 'text-red-600' : 'text-stone-500'}`}
                  >
                    {nameOf(manualValue)}
                  </button>
                )}
              </td>
            </React.Fragment>
          );
        })}
        <td className="px-0.5 py-0.5 text-center border-r border-slate-400 bg-white print:hidden">
          {toggleButton(isSurgery, 'bg-red-500 hover:bg-red-400 text-white', () => toggleSurgeryDay(day.date))}
        </td>
        <td className="px-0.5 py-0.5 text-center bg-white print:hidden">
          {toggleButton(isInternalMedicine, 'bg-pink-500 hover:bg-pink-400 text-white', () => toggleInternalMedicineDay(day.date))}
        </td>
      </tr>
    );
  };

  const renderWeeklyOffCell = (staffId, day, idx) => {
    const eff = getEffectiveScheduleForDay(schedule, safeCalendar, idx, surgeryDays);
    const isWeeklyOff = getWeeklyOffIds(weeklyOff, day.date).includes(staffId);
    const duty = WEEKLY_TABLE_CELLS.find(([field]) => eff[field] === staffId);
    let [label, cellClass] = ['', ''];
    if (duty) [, label, cellClass] = duty;
    else if (isWeeklyOff) [label, cellClass] = ['週休', 'bg-yellow-300 text-stone-800'];
    else if (day.isWeekend || day.isHoliday) cellClass = 'bg-yellow-300 text-stone-800';
    return (
      <td
        key={day.date}
        className={`px-0.5 py-1 text-center border-r border-slate-200 ${cellClass} ${isWeeklyOff ? 'cursor-grab active:cursor-grabbing' : ''}`}
        draggable={isWeeklyOff}
        onDragStart={isWeeklyOff ? (e) => setDragData(e, { type: 'weeklyOff', staffId, dateStr: day.date }) : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          if (e.dataTransfer.types.includes('text/plain')) e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          const data = readDragData(e);
          if (data?.type === 'weeklyOff' && data.staffId === staffId && data.dateStr !== day.date) moveWeeklyOff(staffId, data.dateStr, day.date);
        }}
      >
        {label}
      </td>
    );
  };

  const pickerIsDayList = picker && /^(dayShift|support)/.test(picker.field);
  const thClass = 'px-0.5 py-0.5 text-center text-stone-600 font-semibold tracking-wider';

  return (
    <div className="min-h-screen bg-violet-400 p-3 relative">
      <div className="absolute top-20 left-20 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-[95vw] w-full mx-auto relative min-h-0">
        <ScreenHeader title="当番表作成" onBack={onBack} className="mb-2" titleClassName="text-2xl" />

        <div className="flex flex-wrap gap-3 mb-2">
          <div className="flex items-center gap-4 bg-slate-50 rounded-xl border-2 border-slate-400 px-4 py-2.5 shadow-sm">
            <h3 className="font-bold text-stone-800 text-base shrink-0">📅 期間設定</h3>
            <div className="flex items-center gap-3">
              {[['開始日', startDate, setStartDate], ['終了日', endDate, setEndDate]].map(([label, value, setValue]) => (
                <div key={label} className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-stone-600 shrink-0">{label}</label>
                  <input
                    type="date"
                    value={value}
                    onChange={(e) => setValue(e.target.value || '')}
                    className="p-1.5 bg-slate-50 border-2 border-slate-400 rounded-lg text-stone-800 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none w-[10rem]"
                  />
                </div>
              ))}
            </div>
            {safeCalendar.length === 0 && (
              <button type="button" onClick={generateCalendar} className="btn-panel bg-amber-500 hover:bg-amber-400 text-stone-900 shadow-sm text-sm py-1.5 px-3">📅 カレンダーを生成</button>
            )}
          </div>
          <div className="flex items-center gap-3 bg-slate-50 rounded-xl border-2 border-slate-400 px-4 py-2.5 shadow-sm">
            <h3 className="font-bold text-stone-800 text-base shrink-0">👥 順番設定</h3>
            <button type="button" onClick={() => setShowAllOrderModal(true)} className="btn-panel bg-violet-600 hover:bg-violet-500 text-white shadow-md text-sm py-1.5 px-3">一括設定</button>
          </div>
        </div>

        {safeCalendar.length > 0 && (
          <ErrorBoundary
            fallback={(
              <div className="bg-slate-50 rounded-2xl border-2 border-amber-300 p-6 shadow-sm">
                <p className="text-amber-800 font-medium mb-2">カレンダー表示で問題が発生しました。</p>
                <p className="text-stone-600 text-sm">Chrome で開くか、期間を設定し直して「カレンダーを生成」からやり直してください。</p>
              </div>
            )}
          >
            <div id="shift-calendar-print-area" className="bg-slate-50 rounded-2xl border-2 border-slate-400 p-3 shadow-sm">
              <div className="print:hidden">
                <SectionToolbar title="📆 当番表カレンダー" {...historyProps}>
                  <button type="button" onClick={generateCalendar} className="btn-section bg-amber-500 hover:bg-amber-400 text-stone-900 border-amber-600 shadow-sm">📅 カレンダーを生成（職員も配置）</button>
                  <button type="button" onClick={() => autoAssign()} className="btn-section bg-amber-400 hover:bg-amber-300 text-stone-800 border-amber-600">当番表を再配置</button>
                </SectionToolbar>
              </div>
              <div className="overflow-x-auto shift-calendar-print-content">
                <table className="w-full border-collapse table-fixed text-lg">
                  <colgroup>
                    {COL_WIDTHS.map((width, i) => <col key={i} style={{ width }} />)}
                  </colgroup>
                  <thead>
                    <tr className="border-b border-slate-400 bg-slate-50">
                      <th className={`${thClass} text-base border-r border-slate-400`}>日付</th>
                      <th className={`${thClass} text-base border-r border-slate-400`}>曜日</th>
                      {SHIFT_LABELS.map((label) => (
                        <th key={label} colSpan={2} className={`${thClass} text-base bg-slate-50 border-r-2 border-slate-500`}>{label}</th>
                      ))}
                      <th className={`${thClass} text-sm bg-white border-r border-slate-400 print:hidden`}>外科</th>
                      <th className={`${thClass} text-sm bg-white print:hidden`}>内科</th>
                    </tr>
                  </thead>
                  <tbody>{safeCalendar.map(renderScheduleRow)}</tbody>
                </table>
              </div>

              <div className="print:hidden">
                <div className="mt-2 mb-4 text-base text-stone-600">
                  ※日勤・サポート・夜勤・B・非番は1列目＝自動、2列目＝手動変更（自動で人が入っている隣のボックスをクリックで職員選択）。土日祝は曜日を赤表示し、祝日にも日勤・サポートを自動割当します。外科輪番・内科輪番はボタンで指定。Bは外科輪番の日に翌日夜勤、非番は前日夜勤の担当者を自動表示します。<br />
                  当番表では<strong>2列目（右・手動）を最初に参照</strong>し、入力がなければ1列目（左・自動）を参照します。夜勤の右セルを変更すると、翌日の非番の右セルにも同じ職員が入ります。<br />
                  配置表作成では当番表の参照順（右→左）に従って参照します。
                </div>

                <SectionToolbar title="📋 週休割り当て結果" {...historyProps}>
                  <button type="button" onClick={autoAssignWeeklyOff} className="btn-section bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-700 shadow-sm">📅 週休自動割当</button>
                  <button type="button" onClick={resetWeeklyOff} className="btn-section bg-indigo-400 hover:bg-indigo-300 text-stone-800 border-indigo-600">週休割当リセット</button>
                </SectionToolbar>
                <p className="text-sm text-stone-600 mb-1">縦＝職員（夜勤順番リスト順）、横＝日付。A＝日勤、16＝夜勤（暗ピンク）、B＝青、非番＝オレンジ、黄色＝週休または土日祝で勤務なし。</p>
                <div className="overflow-x-auto border border-slate-400 rounded-xl">
                  <table className="w-full border-collapse text-sm table-fixed" style={{ minWidth: `${safeCalendar.length * 2.5 + 9}rem` }}>
                    <colgroup>
                      <col style={{ width: '9rem', minWidth: '9rem' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-slate-400 bg-slate-100">
                        <th className="sticky left-0 z-10 w-[9rem] min-w-[9rem] px-2 py-1 text-left text-stone-600 font-semibold bg-slate-100 border-r border-slate-400">職員</th>
                        {safeCalendar.map((day) => (
                          <th key={day.date} className="px-0.5 py-1 text-center text-stone-600 font-medium border-r border-slate-300 min-w-[2.5rem]">
                            <span className="block text-xs text-stone-500">{day.date.slice(5)}</span>
                            <span className={`font-bold ${day.isWeekend || day.isHoliday ? 'text-red-600' : 'text-stone-800'}`}>{day.dayOfWeek}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {nightShiftOrder.map((staffId) => {
                        const staff = staffData.find((s) => s.id === staffId);
                        if (!staff) return null;
                        return (
                          <tr key={staffId} className="border-b border-slate-300">
                            <td className="sticky left-0 z-10 w-[9rem] min-w-[9rem] px-2 py-1 text-stone-800 font-medium bg-slate-50 border-r border-slate-400 whitespace-nowrap overflow-visible">
                              {staff.name} <span className="text-stone-500 font-normal">({calcWeeklyOffDaysForStaff(staffId, safeCalendar, schedule, surgeryDays)})</span>
                            </td>
                            {safeCalendar.map((day, idx) => renderWeeklyOffCell(staffId, day, idx))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 p-4 bg-slate-100/80 rounded-xl border border-slate-300 text-stone-700 text-sm space-y-2">
                  <h4 className="font-bold text-stone-800 text-base">週休を割り当てるルール</h4>
                  <p className="text-stone-600 text-xs mt-0.5 mb-1">※当番の判定は「右（手動）を優先、空なら左（自動）」で統一しています。</p>
                  <p className="font-semibold text-stone-700">【付与する週休の日数】</p>
                  <p className="text-stone-600 text-xs mb-0.5">土日祝の勤務に応じて加算（勤務がない日は付与対象外）</p>
                  <ul className="list-disc list-inside ml-2 space-y-0.5">
                    {['金曜の夜勤 … +1日', '土曜の夜勤 … +2日', '土曜の日勤・サポート … +1日', '日曜の日勤・サポート … +1日', '日曜の夜勤 … +1日', '土日のB … 各+1日（土と日でそれぞれ）'].map((t) => <li key={t}>{t}</li>)}
                  </ul>
                  <p className="font-semibold text-stone-700 mt-2">【割り当て先】</p>
                  <ul className="list-disc list-inside ml-2 space-y-0.5">
                    <li>平日のみ（土日祝は割り当て先にしない）</li>
                    <li>期間全体でバランスをとり、1日あたりの週休人数が偏らないように割り当てる</li>
                  </ul>
                  <p className="font-semibold text-stone-700 mt-2">【週休を割り当てない日】</p>
                  <ul className="list-disc list-inside ml-2 space-y-0.5">
                    <li>その日に休暇入力がある日</li>
                    <li>その日に当番表で勤務が入っている日（有効当番で夜勤・日勤・サポート・B・非番のいずれか）</li>
                  </ul>
                  <p className="text-stone-600 mt-2">※土日祝で勤務が当たっていない日は黄色で表示しますが、付与する週休の日数には含めません。</p>
                </div>

                <div id="allocation-section" className="mt-3 pt-3 border-t-2 border-stone-300">
                  <SectionToolbar title="📊 配置表" {...historyProps}>
                    {[['配置表作成', 'bg-blue-600 hover:bg-blue-500 text-white border-blue-700 shadow-sm'], ['再配置', 'bg-blue-400 hover:bg-blue-300 text-stone-800 border-blue-600']].map(([label, colorClass]) => (
                      <button
                        key={label}
                        type="button"
                        disabled={allocationRunning}
                        onClick={runAllocation}
                        className={`btn-section disabled:opacity-70 disabled:cursor-not-allowed ${colorClass}`}
                      >
                        {allocationRunning && label === '配置表作成' ? '配置中...' : label}
                      </button>
                    ))}
                  </SectionToolbar>
                  <p className="text-sm text-stone-600 mb-1">
                    「配置表作成」で自動作成・保存します。同じアルゴリズムで職員を割り振り、下に表を表示します。職員名をドラッグ＆ドロップで移動できます。週休も別の平日にD&amp;Dで移動できます。
                  </p>
                  <AllocationTableView
                    allocation={allocation}
                    modalityData={modalityData}
                    staffData={staffData}
                    calendar={safeCalendar}
                    schedule={schedule}
                    weeklyOff={weeklyOff}
                    surgeryDays={surgeryDays}
                    setAllocation={setAllocation}
                    setWeeklyOff={setWeeklyOff}
                  />
                </div>
              </div>
            </div>
          </ErrorBoundary>
        )}

        {picker && (
          <StaffPickerModal
            title={`職員を選択（${pickerIsDayList ? '日勤' : '夜勤'}リスト）`}
            staff={staffData.filter((s) => (pickerIsDayList ? dayShiftOrder : nightShiftOrder).includes(s.id))}
            onPick={(staffId) => {
              updateSchedule(picker.date, picker.field, staffId);
              setPicker(null);
            }}
            onClose={() => setPicker(null)}
          />
        )}

        {showAllOrderModal && (
          <Modal title="順番一括設定" onClose={() => setShowAllOrderModal(false)} padding="p-4" className="max-w-[1400px] h-[95vh] overflow-hidden">
            <p className="text-sm text-stone-600 mb-2 shrink-0">左の職員を右へドラッグして順番を構成。右側でドラッグして並び替え可能。職員名の右の★をクリックで開始者を選べます。ペアは1人目を「新規ペア」にドロップ→2人目をその行にドロップ。</p>
            <div className="flex-1 min-h-0 flex flex-row gap-3">
              <OrderPanel
                label="夜勤"
                color="blue"
                staffData={staffData}
                order={nightShiftOrder}
                setOrder={setNightShiftOrder}
                startId={nightShiftStartId}
                onSetStart={(id) => {
                  setNightShiftStartId(id);
                  autoAssign(id, dayShiftStartId);
                }}
              />
              <OrderPanel
                label="日勤"
                color="emerald"
                staffData={staffData}
                order={dayShiftOrder}
                setOrder={setDayShiftOrder}
                startId={dayShiftStartId}
                onSetStart={(id) => {
                  setDayShiftStartId(id);
                  autoAssign(nightShiftStartId, id);
                }}
              />
              <PairPanel staffData={staffData} pairs={pairs} setPairs={setPairs} />
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}
