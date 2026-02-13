import React, { useState, useEffect, useRef, useMemo, Component } from 'react';
import { useData } from '../context/DataContext';
import { runAllocationForCalendar, AllocationTableView } from './AllocationScreen';

const MAX_UNDO = 50;

/** カレンダー表示部分だけを囲み、Edge 等で落ちても画面全体が消えないようにする */
class CalendarSectionBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-slate-50 rounded-2xl border-2 border-amber-300 p-6 shadow-sm">
          <p className="text-amber-800 font-medium mb-2">カレンダー表示で問題が発生しました。</p>
          <p className="text-stone-600 text-sm">Chrome で開くか、期間を設定し直して「カレンダーを生成」からやり直してください。</p>
        </div>
      );
    }
    return this.props.children;
  }
}

/** レンダーで使う安全なカレンダー（date が文字列の日付だけ。保存データの不整合で落ちないようにする） */
function useSafeCalendar(calendar) {
  return useMemo(
    () => (Array.isArray(calendar) ? calendar.filter((d) => d && typeof d.date === 'string') : []),
    [calendar]
  );
}
const NAV_GUARD_MS = 1200; // 表示直後の誤タップで戻るのを防ぐ（Edge 対策で App と揃えて 1.2 秒）

/** 週休を「その日の職員IDリスト」に正規化。{ am, pm } はマージせず保持（右・左を同時に扱わない） */
function normalizeWeeklyOff(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result = {};
  for (const [dateStr, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      result[dateStr] = value;
    } else if (value && typeof value === 'object' && !Array.isArray(value) && (value.am || value.pm)) {
      result[dateStr] = { am: value.am ? [...value.am] : [], pm: value.pm ? [...value.pm] : [] };
    }
  }
  return result;
}

/** その日の週休IDリスト（表示・判定用）。array ならそのまま、{ am, pm } ならマージして返す */
function getWeeklyOffIds(weeklyOff, dateStr) {
  const raw = weeklyOff?.[dateStr];
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return [...new Set([...(raw.am || []), ...(raw.pm || [])])];
}

/**
 * 週休のルール（1箇所で定義）
 * 【付与する週休の日数】土日祝の勤務に応じて加算（当番は「右（手動）優先、空なら左（自動）」で判定）
 *   金曜夜勤 +1、土曜夜勤 +2、土曜日勤/サポート +1、日曜日勤/サポート +1、日曜夜勤 +1、土日のB +1（土と日でそれぞれ）
 * 【割り当て先】平日のみ。土日祝は割り当てない。
 * 【割り当てない日】その日に「有効当番」で夜勤・日勤・サポート・B・非番のいずれかである日、または休暇入力がある日。
 */
function getEffectiveScheduleForDay(schedule, dateStr, calendar, calendarIdx, surgeryDays) {
  const daySchedule = schedule[dateStr] || {};
  const nextDay = calendarIdx >= 0 && calendar[calendarIdx + 1] ? calendar[calendarIdx + 1] : null;
  const prevDay = calendarIdx > 0 ? calendar[calendarIdx - 1] : null;
  const bPerson = surgeryDays.includes(dateStr) && nextDay
    ? (schedule[nextDay.date]?.nightShiftManual ?? schedule[nextDay.date]?.nightShift)
    : (daySchedule.bManual ?? daySchedule.b);
  const dayOffPerson = prevDay
    ? (schedule[prevDay.date]?.nightShiftManual ?? schedule[prevDay.date]?.nightShift)
    : (daySchedule.dayOffManual ?? daySchedule.dayOff);
  return {
    dayShift: daySchedule.dayShiftManual ?? daySchedule.dayShift,
    support: daySchedule.supportManual ?? daySchedule.support,
    nightShift: daySchedule.nightShiftManual ?? daySchedule.nightShift,
    b: bPerson,
    dayOff: dayOffPerson
  };
}

function isAssignedOnDay(staffId, eff) {
  return eff.nightShift === staffId || eff.dayShift === staffId || eff.support === staffId || eff.b === staffId || eff.dayOff === staffId;
}

/** 付与する週休の日数を計算（土日祝の勤務のみ。当番は有効当番で判定） */
function calcWeeklyOffDaysForStaff(staffId, calendar, schedule, surgeryDays) {
  let days = 0;
  calendar.forEach((day, idx) => {
    const dateStr = day.date;
    const eff = getEffectiveScheduleForDay(schedule, dateStr, calendar, idx, surgeryDays);
    const onNight = eff.nightShift === staffId;
    const onDay = eff.dayShift === staffId;
    const onSupport = eff.support === staffId;
    const onB = eff.b === staffId;
    const dow = day.dayOfWeekNum ?? new Date(dateStr + 'T12:00:00').getDay();
    if (dow === 5 && onNight) days += 1;
    if (dow === 6 && onNight) days += 2;
    if (dow === 6 && (onDay || onSupport)) days += 1;
    if (dow === 0 && (onDay || onSupport)) days += 1;
    if (dow === 0 && onNight) days += 1;
    if ((dow === 6 || dow === 0) && onB) days += 1;
  });
  return days;
}

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

export default function ShiftScheduleScreen({ onBack, onNavigate }) {
  const { staffData: rawStaffData, modalityData: rawModalityData } = useData();
  const staffData = Array.isArray(rawStaffData) ? rawStaffData : [];
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
  const [showAllOrderModal, setShowAllOrderModal] = useState(false);
  const [pairIncompleteFirst, setPairIncompleteFirst] = useState(null);
  const [manualPicker, setManualPicker] = useState(null); // { date, field } 手動変更用（右列）
  const [editPicker, setEditPicker] = useState(null); // { date, field } 左列（自動値）の変更用
  const [nightShiftStartId, setNightShiftStartId] = useState(null); // その月の夜勤開始の人
  const [dayShiftStartId, setDayShiftStartId] = useState(null); // その月の日勤開始の人
  const [allocationRunning, setAllocationRunning] = useState(false);
  /** 配置表データ（配置表作成で更新。初回は localStorage から読む） */
  const [allocation, setAllocation] = useState(() => {
    try {
      const raw = localStorage.getItem('allocationData');
      if (!raw) return {};
      const data = JSON.parse(raw);
      return (data.allocation && typeof data.allocation === 'object') ? data.allocation : {};
    } catch (_) {
      return {};
    }
  });
  const undoHistoryRef = useRef([]);
  const redoHistoryRef = useRef([]);
  const [backButtonReady, setBackButtonReady] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  const safeCalendar = useSafeCalendar(calendar);

  const runAllocation = async () => {
    const modalityData = Array.isArray(rawModalityData) ? rawModalityData : [];
    const staffDataArr = Array.isArray(rawStaffData) ? rawStaffData : [];
    if (calendar.length === 0) {
      alert('⚠️ まず「カレンダーを生成（職員も配置）」を押して当番表を作成してください');
      return;
    }
    if (modalityData.length === 0) {
      alert('⚠️ モダリティが登録されていません。');
      return;
    }
    if (staffDataArr.length === 0) {
      alert('⚠️ 職員が登録されていません。');
      return;
    }
    setAllocationRunning(true);
    try {
      const { allocation: newAllocation, alertMessage } = runAllocationForCalendar(calendar, modalityData, staffDataArr);
      if (newAllocation != null) {
        const startDateVal = /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : '';
        const endDateVal = /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : '';
        localStorage.setItem('allocationData', JSON.stringify({ allocation: newAllocation, startDate: startDateVal, endDate: endDateVal }));
        setAllocation(newAllocation);
      }
      alert(alertMessage);
    } finally {
      setAllocationRunning(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setBackButtonReady(true), NAV_GUARD_MS);
    return () => clearTimeout(t);
  }, []);

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

  const resetWeeklyOff = () => {
    if (!window.confirm('週休自動割り当てをリセットしますか？')) return;
    pushUndoState();
    setWeeklyOff({});
  };

  /** カレンダー配列から夜勤・日勤・非番・B のスケジュールを計算（自動割当・カレンダー生成の両方で使用） */
  const computeScheduleFromCalendar = (cal, existingSchedule, nightOrder, dayOrder, nightStart, dayStart, pairList, surgeryDayList) => {
    const newSchedule = {};
    let nightStartIdx = nightOrder.indexOf(nightStart);
    if (nightStartIdx < 0) nightStartIdx = 0;
    let dayStartIdx = dayOrder.indexOf(dayStart);
    if (dayStartIdx < 0) dayStartIdx = 0;
    let nightIndex = nightStartIdx;
    let dayIndex = dayStartIdx;
    cal.forEach((day, idx) => {
      const dateStr = day.date;
      const prevDaySchedule = existingSchedule[dateStr];
      newSchedule[dateStr] = {
        nightShift: null, dayShift: null, support: null, b: null, dayOff: null,
        dayShiftManual: prevDaySchedule?.dayShiftManual ?? null,
        supportManual: prevDaySchedule?.supportManual ?? null,
        nightShiftManual: prevDaySchedule?.nightShiftManual ?? null,
        bManual: prevDaySchedule?.bManual ?? null,
        dayOffManual: prevDaySchedule?.dayOffManual ?? null
      };
      if (nightOrder.length > 0) {
        newSchedule[dateStr].nightShift = nightOrder[nightIndex % nightOrder.length];
        nightIndex++;
      }
      if (idx > 0) {
        const prevDate = cal[idx - 1].date;
        if (newSchedule[prevDate]?.nightShift) {
          newSchedule[dateStr].dayOff = newSchedule[prevDate].nightShift;
        }
      } else {
        if (nightOrder.length > 0) {
          const startIdx = nightOrder.indexOf(nightStart) >= 0 ? nightOrder.indexOf(nightStart) : 0;
          const prevIdx = (startIdx - 1 + nightOrder.length) % nightOrder.length;
          newSchedule[dateStr].dayOff = nightOrder[prevIdx];
        }
      }
      if (day.isWeekend || day.isHoliday) {
        if (dayOrder.length > 0) {
          const dayShiftPerson = dayOrder[dayIndex % dayOrder.length];
          newSchedule[dateStr].dayShift = dayShiftPerson;
          const pair = pairList.find(p => p.person1 === dayShiftPerson || p.person2 === dayShiftPerson);
          if (pair) {
            newSchedule[dateStr].support = pair.person1 === dayShiftPerson ? pair.person2 : pair.person1;
          }
          dayIndex++;
        }
      }
      if (surgeryDayList.includes(dateStr) && idx < cal.length - 1) {
        const nextDate = cal[idx + 1].date;
        if (newSchedule[nextDate]?.nightShift) {
          newSchedule[dateStr].b = newSchedule[nextDate].nightShift;
        }
      }
    });
    return newSchedule;
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

    if (nightShiftOrder.length > 0) {
      const nightStart = nightShiftStartId ?? nightShiftOrder[0];
      const dayStart = dayShiftStartId ?? (dayShiftOrder.length > 0 ? dayShiftOrder[0] : null);
      const newSchedule = computeScheduleFromCalendar(days, schedule, nightShiftOrder, dayShiftOrder, nightStart, dayStart, pairs, surgeryDays);
      pushUndoState();
      setSchedule(newSchedule);
      alert('✅ カレンダーを生成し、職員を配置しました');
    } else {
      alert('✅ カレンダーを生成しました。夜勤順番を設定してから再度「カレンダーを生成」を押すと職員も自動で配置されます');
    }
  };

  const toggleSurgeryDay = (date) => {
    setSurgeryDays(prev => (prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]));
  };

  const toggleInternalMedicineDay = (date) => {
    setInternalMedicineDays(prev => (prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]));
  };

  const autoAssign = (overrideNightStartId, overrideDayStartId) => {
    const cal = calendar;
    if (cal.length === 0) {
      alert('⚠️ まず「カレンダーを生成」で期間のカレンダーを作成してください');
      return;
    }
    if (nightShiftOrder.length === 0) {
      alert('⚠️ 夜勤順番リストを設定してください');
      return;
    }
    const nightStart = overrideNightStartId !== undefined ? overrideNightStartId : (nightShiftStartId ?? nightShiftOrder[0]);
    const dayStart = overrideDayStartId !== undefined ? overrideDayStartId : (dayShiftStartId ?? (dayShiftOrder.length > 0 ? dayShiftOrder[0] : null));
    const newSchedule = computeScheduleFromCalendar(cal, schedule, nightShiftOrder, dayShiftOrder, nightStart, dayStart, pairs, surgeryDays);
    pushUndoState();
    setSchedule(newSchedule);
    if (overrideNightStartId === undefined && overrideDayStartId === undefined) {
      alert('✅ 自動配置が完了しました');
    }
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
      remaining[staff.id] = calcWeeklyOffDaysForStaff(staff.id, calendar, schedule, surgeryDays);
    });

    const newWeeklyOff = {};
    const staffOrder = [...staffData];
    weekdays.forEach((day, dayIndex) => {
      const dateStr = day.date;
      const calIdx = calendar.findIndex(d => d.date === dateStr);
      const eff = getEffectiveScheduleForDay(schedule, dateStr, calendar, calIdx, surgeryDays);
      const totalRemaining = Object.values(remaining).reduce((a, b) => a + b, 0);
      const daysLeft = weekdays.length - dayIndex;
      const quota = Math.min(daysLeft > 0 ? Math.ceil(totalRemaining / daysLeft) : 0, totalRemaining);
      let assigned = 0;
      for (const staff of staffOrder) {
        if (assigned >= quota) break;
        const staffId = staff.id;
        if (remaining[staffId] <= 0) continue;
        const hasOtherLeave = leaveData[dateStr]?.some(leave => leave.staffId === staffId);
        const isAssigned = isAssignedOnDay(staffId, eff);
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
      if (field === 'nightShiftManual') {
        const idx = calendar.findIndex(d => d && d.date === date);
        const nextDay = idx >= 0 ? calendar[idx + 1] : null;
        if (nextDay?.date) {
          next[nextDay.date] = { ...next[nextDay.date], dayOffManual: value };
        }
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
    const calIdx = calendar.findIndex(d => d.date === toDate);
    const eff = getEffectiveScheduleForDay(schedule, toDate, calendar, calIdx, surgeryDays);
    const isAssigned = isAssignedOnDay(staffId, eff);
    if (hasOtherLeave || isAssigned) return;
    setWeeklyOff(prev => {
      const next = { ...prev };
      const fromIds = getWeeklyOffIds(prev, fromDate).filter(id => id !== staffId);
      if (fromIds.length === 0) delete next[fromDate]; else next[fromDate] = fromIds;
      const toIds = getWeeklyOffIds(prev, toDate);
      if (!toIds.includes(staffId)) next[toDate] = [...toIds, staffId];
      return next;
    });
  };

  const toggleWeeklyOff = (date, staffId) => {
    setWeeklyOff(prev => {
      const newData = { ...prev };
      const ids = getWeeklyOffIds(prev, date);
      if (ids.includes(staffId)) {
        const next = ids.filter(id => id !== staffId);
        if (next.length === 0) delete newData[date]; else newData[date] = next;
      } else {
        newData[date] = [...ids, staffId];
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
    if (!startDate && !endDate && calendar.length === 0) return;
    try {
      const data = { startDate, endDate, calendar, surgeryDays, internalMedicineDays, nightShiftOrder, dayShiftOrder, nightShiftStartId, dayShiftStartId, pairs, schedule, weeklyOff };
      localStorage.setItem('scheduleData', JSON.stringify(data));
    } catch (_) {
      // 循環参照などで JSON 化に失敗しても画面は落とさない
    }
  }, [startDate, endDate, calendar, surgeryDays, internalMedicineDays, nightShiftOrder, dayShiftOrder, nightShiftStartId, dayShiftStartId, pairs, schedule, weeklyOff]);

  useEffect(() => {
    if (Object.keys(allocation).length === 0) return;
    try {
      const startDateVal = /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : '';
      const endDateVal = /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : '';
      localStorage.setItem('allocationData', JSON.stringify({ allocation, startDate: startDateVal, endDate: endDateVal }));
    } catch (_) {}
  }, [allocation, startDate, endDate]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('scheduleData');
      if (!saved) return;
      const data = JSON.parse(saved);
      setStartDate(typeof data.startDate === 'string' ? data.startDate : '');
      setEndDate(typeof data.endDate === 'string' ? data.endDate : '');
      const cal = Array.isArray(data.calendar) ? data.calendar : [];
      const migrated = cal
        .filter((day) => day && day.date && typeof day.date === 'string')
        .map((day) => ({
          ...day,
          isHoliday: getHolidays(parseInt(day.date.slice(0, 4), 10)).has(day.date)
        }));
      setCalendar(migrated);
      setSurgeryDays(Array.isArray(data.surgeryDays) ? data.surgeryDays : []);
      setInternalMedicineDays(Array.isArray(data.internalMedicineDays) ? data.internalMedicineDays : []);
      setNightShiftOrder(Array.isArray(data.nightShiftOrder) ? data.nightShiftOrder : []);
      setDayShiftOrder(Array.isArray(data.dayShiftOrder) ? data.dayShiftOrder : []);
      setNightShiftStartId(data.nightShiftStartId ?? null);
      setDayShiftStartId(data.dayShiftStartId ?? null);
      setPairs(Array.isArray(data.pairs) ? data.pairs : []);
      setSchedule(data.schedule && typeof data.schedule === 'object' && !Array.isArray(data.schedule) ? data.schedule : {});
      setWeeklyOff(normalizeWeeklyOff(data.weeklyOff));
    } catch (_) {
      // 壊れた scheduleData でも画面は表示する（初期状態のまま）
    }
  }, []);

  return (
    <div className="min-h-screen bg-violet-400 p-3 relative">
      <div className="absolute top-20 left-20 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-[95vw] w-full mx-auto relative min-h-0">
        <div className="flex justify-between items-center gap-4 mb-2">
          <h2 className="text-2xl font-bold text-stone-800">当番表作成</h2>
          <div className="relative shrink-0">
            {!backButtonReady && (
              <div
                className="absolute inset-0 z-10"
                aria-hidden
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              />
            )}
            <button
              type="button"
              onClick={onBack}
              disabled={!backButtonReady}
              className={`btn-header transition-opacity ${backButtonReady ? 'opacity-100 cursor-pointer' : 'opacity-50 cursor-default'}`}
            >
              ← メインメニュー
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-2">
          <div className="flex items-center gap-4 bg-slate-50 rounded-xl border-2 border-slate-400 px-4 py-2.5 shadow-sm">
            <h3 className="font-bold text-stone-800 text-base shrink-0">📅 期間設定</h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-stone-600 shrink-0">開始日</label>
                <input type="date" value={startDate ?? ''} onChange={(e) => setStartDate(e.target.value ?? '')} className="p-1.5 bg-slate-50 border-2 border-slate-400 rounded-lg text-stone-800 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none w-[10rem]" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-stone-600 shrink-0">終了日</label>
                <input
                  type="date"
                  value={endDate ?? ''}
                  onChange={(e) => {
                    try {
                      const v = e?.target?.value;
                      setEndDate(typeof v === 'string' ? v : '');
                    } catch (_) {
                      setEndDate('');
                    }
                  }}
                  className="p-1.5 bg-slate-50 border-2 border-slate-400 rounded-lg text-stone-800 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none w-[10rem]"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 rounded-xl border-2 border-slate-400 px-4 py-2.5 shadow-sm">
            <h3 className="font-bold text-stone-800 text-base shrink-0">👥 順番設定</h3>
            <button
              type="button"
              onClick={() => setShowAllOrderModal(true)}
              className="btn-panel bg-violet-600 hover:bg-violet-500 text-white shadow-md text-sm py-1.5 px-3"
            >
              一括設定
            </button>
          </div>
        </div>

        {safeCalendar.length > 0 && (
          <CalendarSectionBoundary>
          <div id="shift-calendar-print-area" className="bg-slate-50 rounded-2xl border-2 border-slate-400 p-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2 print:hidden">
              <h3 className="font-bold text-stone-800 text-2xl">📆 当番表カレンダー</h3>
              <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={generateCalendar} className="btn-section bg-amber-500 hover:bg-amber-400 text-stone-900 border-amber-600 shadow-sm">📅 カレンダーを生成（職員も配置）</button>
                  <button onClick={() => autoAssign()} className="btn-section bg-amber-400 hover:bg-amber-300 text-stone-800 border-amber-600">当番表を再配置</button>
                  <button type="button" onClick={() => window.history.back()} className="btn-section-nav">← 戻る</button>
                  <button type="button" onClick={() => window.history.forward()} className="btn-section-nav">進む →</button>
                </div>
                <button type="button" onClick={() => window.print()} className="btn-section-print shrink-0">🖨️ 印刷</button>
              </div>
            </div>
            <div className="overflow-x-auto shift-calendar-print-content">
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
                    <th className="pl-0.5 pr-0.5 py-0.5 text-center text-stone-600 font-semibold tracking-wider text-base border-r border-slate-400">日付</th>
                    <th className="pl-0 pr-0.5 py-0.5 text-center text-stone-600 font-semibold tracking-wider text-base border-r border-slate-400">曜日</th>
                    <th colSpan={2} className="px-0.5 py-0.5 text-center text-stone-600 font-semibold tracking-wider text-base bg-slate-50 border-r-2 border-slate-500">日勤</th>
                    <th colSpan={2} className="px-0.5 py-0.5 text-center text-stone-600 font-semibold tracking-wider text-base bg-slate-50 border-r-2 border-slate-500">サポート</th>
                    <th colSpan={2} className="px-0.5 py-0.5 text-center text-stone-600 font-semibold tracking-wider text-base bg-slate-50 border-r-2 border-slate-500">夜勤</th>
                    <th colSpan={2} className="px-0.5 py-0.5 text-center text-stone-600 font-semibold tracking-wider text-base bg-slate-50 border-r-2 border-slate-500">B</th>
                    <th colSpan={2} className="px-0.5 py-0.5 text-center text-stone-600 font-semibold tracking-wider text-base bg-slate-50 border-r-2 border-slate-500">非番</th>
                    <th className="px-0.5 py-0.5 text-center text-stone-600 font-semibold tracking-wider text-sm bg-white border-r border-slate-400 print:hidden">外科</th>
                    <th className="px-0.5 py-0.5 text-center text-stone-600 font-semibold tracking-wider text-sm bg-white print:hidden">内科</th>
                  </tr>
                </thead>
                <tbody>
                  {safeCalendar.map((day, idx) => {
                    const isSurgery = surgeryDays.includes(day.date);
                    const isInternalMedicine = internalMedicineDays.includes(day.date);
                    const daySchedule = schedule[day.date] || {};
                    const nextDay = safeCalendar[idx + 1];
                    const prevDay = safeCalendar[idx - 1];
                    const nextNight = nextDay ? (schedule[nextDay.date]?.nightShiftManual ?? schedule[nextDay.date]?.nightShift) : null;
                    const prevNight = prevDay ? (schedule[prevDay.date]?.nightShiftManual ?? schedule[prevDay.date]?.nightShift) : null;
                    const bPerson = isSurgery && nextDay ? nextNight : (daySchedule.bManual ?? daySchedule.b);
                    const dayOffPerson = prevNight ?? (daySchedule.dayOffManual ?? daySchedule.dayOff);
                    const name = (id) => (id ? (staffData.find(s => s.id === id)?.name || id) : '');
                    const yearNum = day.date && typeof day.date === 'string' && day.date.length >= 4 ? parseInt(day.date.slice(0, 4), 10) : NaN;
                    const isHoliday = day.isHoliday ?? (!isNaN(yearNum) && getHolidays(yearNum).has(day.date));
                    const isWeekendOrHoliday = day.isWeekend || isHoliday;
                    const rowBg = isSurgery ? 'bg-yellow-200' : (isInternalMedicine ? 'bg-pink-200' : (isWeekendOrHoliday ? 'bg-sky-50' : ''));
                    const cellBg = isWeekendOrHoliday && !isSurgery && !isInternalMedicine ? 'bg-sky-100/50' : '';
                    const rowBorder = isSurgery ? 'border-l-4 border-l-amber-500' : (isInternalMedicine ? 'border-l-4 border-l-pink-500' : (isWeekendOrHoliday ? 'border-l-4 border-l-sky-400' : ''));
                    const borderR = 'border-r border-slate-300';
                    const dayShiftDisp = daySchedule.dayShiftManual ?? daySchedule.dayShift;
                    const supportDisp = daySchedule.supportManual ?? daySchedule.support;
                    const nightShiftDisp = daySchedule.nightShiftManual ?? daySchedule.nightShift;
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
                      if (!hasAuto) return <td className={`px-0.5 py-0.5 text-center border-r-2 border-slate-500 ${cellBg} ${overlapBg}`} />;
                      return (
                        <td className={`px-0.5 py-0.5 text-center border-r-2 border-slate-500 ${cellBg} ${overlapBg}`}>
                          <button
                            type="button"
                            onClick={() => setManualPicker({ date: day.date, field })}
                            className={`w-full min-h-[1.25rem] rounded text-base font-medium bg-white/70 hover:bg-white/85 border border-slate-300/80 transition-all ${value ? 'text-red-600' : 'text-stone-500'}`}
                          >
                            {name(value) || ''}
                          </button>
                        </td>
                      );
                    };
                    const autoEditCell = (field, displayValue, isFromManual = false) => (
                      <td className={`px-0.5 py-0.5 text-center font-bold text-sm ${borderR} ${cellBg} ${overlapBg}`}>
                        <button
                          type="button"
                          onClick={() => { if (window.confirm('変えても良いですか？')) setEditPicker({ date: day.date, field }); }}
                          className={`w-full min-h-[1.25rem] rounded text-base hover:bg-slate-200/60 transition-all cursor-pointer ${isFromManual ? 'text-red-600' : 'text-stone-800'}`}
                        >
                          {name(displayValue) || ''}
                        </button>
                      </td>
                    );
                    return (
                      <tr key={day.date} className={`border-b border-slate-400 transition-all ${rowBg} ${rowBorder}`}>
                        <td className={`pl-0.5 pr-0.5 py-0.5 text-center text-stone-800 text-base border-r border-slate-400 ${cellBg}`}>{day.date}</td>
                        <td className={`pl-0 pr-0.5 py-0.5 text-center font-bold text-base border-r border-slate-400 ${cellBg} ${isHoliday ? 'text-red-600' : isWeekendOrHoliday ? 'text-red-600' : 'text-stone-800'}`}>{day.dayOfWeek}</td>
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
                        <td className={`px-0.5 py-0.5 text-center border-r border-slate-400 bg-white print:hidden`}>
                          <button onClick={() => toggleSurgeryDay(day.date)} className={`min-w-[1.25rem] min-h-[1.25rem] rounded text-base font-semibold transition-all ${isSurgery ? 'bg-red-500 hover:bg-red-400 text-white' : 'bg-stone-300/80 hover:bg-stone-400/80 text-stone-600'}`}>{isSurgery ? '✓' : '−'}</button>
                        </td>
                        <td className="px-0.5 py-0.5 text-center bg-white print:hidden">
                          <button onClick={() => toggleInternalMedicineDay(day.date)} className={`min-w-[1.25rem] min-h-[1.25rem] rounded text-base font-semibold transition-all ${isInternalMedicine ? 'bg-pink-500 hover:bg-pink-400 text-white' : 'bg-stone-300/80 hover:bg-stone-400/80 text-stone-600'}`}>{isInternalMedicine ? '✓' : '−'}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="print:hidden">
            <div className="mt-2 text-base text-stone-600">※日勤・サポート・夜勤・B・非番は1列目＝自動、2列目＝手動変更（自動で人が入っている隣のボックスをクリックで職員選択）。土日祝は曜日を赤表示し、祝日にも日勤・サポートを自動割当します。外科輪番・内科輪番はボタンで指定。Bは外科輪番の日に翌日夜勤、非番は前日夜勤の担当者を自動表示します。<br />当番表では<strong>2列目（右・手動）を最初に参照</strong>し、入力がなければ1列目（左・自動）を参照します。夜勤の右セルを変更すると、翌日の非番の右セルにも同じ職員が入ります。<br />配置表作成では当番表の参照順（右→左）に従って参照します。</div>

            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 mb-2">
              <h3 className="font-bold text-stone-800 text-2xl">📋 週休割り当て結果</h3>
              <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={autoAssignWeeklyOff} className="btn-section bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-700 shadow-sm">📅 週休自動割当</button>
                  <button onClick={resetWeeklyOff} className="btn-section bg-indigo-400 hover:bg-indigo-300 text-stone-800 border-indigo-600">週休割当リセット</button>
                  <button type="button" onClick={() => window.history.back()} className="btn-section-nav">← 戻る</button>
                  <button type="button" onClick={() => window.history.forward()} className="btn-section-nav">進む →</button>
                </div>
                <button type="button" onClick={() => window.print()} className="btn-section-print shrink-0">🖨️ 印刷</button>
              </div>
            </div>
            <p className="text-sm text-stone-600 mb-1">縦＝職員（夜勤順番リスト順）、横＝日付。A＝日勤、16＝夜勤（暗ピンク）、B＝青、非番＝オレンジ、黄色＝週休または土日祝で勤務なし。</p>
            <div className="overflow-x-auto border border-slate-400 rounded-xl">
              <table className="w-full border-collapse text-sm table-fixed" style={{ minWidth: `${safeCalendar.length * 2.5 + 9}rem` }}>
                <colgroup>
                  <col style={{ width: '9rem', minWidth: '9rem' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-400 bg-slate-100">
                    <th className="sticky left-0 z-10 w-[9rem] min-w-[9rem] px-2 py-1 text-left text-stone-600 font-semibold bg-slate-100 border-r border-slate-400">職員</th>
                    {safeCalendar.map((day) => {
                      const y = day.date && day.date.length >= 4 ? parseInt(day.date.slice(0, 4), 10) : NaN;
                      const isHoliday = !isNaN(y) && getHolidays(y).has(day.date);
                      const isWeekendOrHoliday = day.isWeekend || isHoliday;
                      return (
                        <th key={day.date} className="px-0.5 py-1 text-center text-stone-600 font-medium border-r border-slate-300 min-w-[2.5rem]">
                          <span className="block text-xs text-stone-500">{day.date.slice ? day.date.slice(5) : ''}</span>
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
                    const weeklyOffDays = calcWeeklyOffDaysForStaff(staffId, safeCalendar, schedule, surgeryDays);
                    return (
                      <tr key={staffId} className="border-b border-slate-300">
                        <td className="sticky left-0 z-10 w-[9rem] min-w-[9rem] px-2 py-1 text-stone-800 font-medium bg-slate-50 border-r border-slate-400 whitespace-nowrap overflow-visible">{staff.name} <span className="text-stone-500 font-normal">({weeklyOffDays})</span></td>
                        {safeCalendar.map((day, idx) => {
                          const dateStr = day.date;
                          const eff = getEffectiveScheduleForDay(schedule, dateStr, safeCalendar, idx, surgeryDays);
                          const y = dateStr && dateStr.length >= 4 ? parseInt(dateStr.slice(0, 4), 10) : NaN;
                          const isHoliday = !isNaN(y) && getHolidays(y).has(dateStr);
                          const isWeekendOrHoliday = day.isWeekend || isHoliday;
                          let label = '';
                          let cellClass = 'px-0.5 py-1 text-center border-r border-slate-200';
                          if (eff.dayShift === staffId) {
                            label = 'A';
                            cellClass += ' bg-emerald-100 text-stone-800';
                          } else if (eff.support === staffId) {
                            label = 'S';
                            cellClass += ' bg-emerald-50 text-stone-700';
                          } else if (eff.nightShift === staffId) {
                            label = '16';
                            cellClass += ' bg-rose-800 text-white';
                          } else if (eff.b === staffId) {
                            label = 'B';
                            cellClass += ' bg-blue-600 text-white';
                          } else if (eff.dayOff === staffId) {
                            label = '非番';
                            cellClass += ' bg-orange-400 text-white';
                          } else if (getWeeklyOffIds(weeklyOff, dateStr).includes(staffId)) {
                            label = '週休';
                            cellClass += ' bg-yellow-300 text-stone-800';
                          } else if (isWeekendOrHoliday) {
                            label = '';
                            cellClass += ' bg-yellow-300 text-stone-800';
                          }
                          const isWeeklyOffCell = getWeeklyOffIds(weeklyOff, dateStr).includes(staffId);
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
              <p className="text-stone-600 text-xs mt-0.5 mb-1">※当番の判定は「右（手動）を優先、空なら左（自動）」で統一しています。</p>
              <p className="font-semibold text-stone-700">【付与する週休の日数】</p>
              <p className="text-stone-600 text-xs mb-0.5">土日祝の勤務に応じて加算（勤務がない日は付与対象外）</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>金曜の夜勤 … +1日</li>
                <li>土曜の夜勤 … +2日</li>
                <li>土曜の日勤・サポート … +1日</li>
                <li>日曜の日勤・サポート … +1日</li>
                <li>日曜の夜勤 … +1日</li>
                <li>土日のB … 各+1日（土と日でそれぞれ）</li>
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

            {/* 配置表 */}
            <div id="allocation-section" className="mt-3 pt-3 border-t-2 border-stone-300">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
                <h3 className="font-bold text-stone-800 text-2xl">📊 配置表</h3>
                <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={allocationRunning || calendar.length === 0}
                      onClick={runAllocation}
                      className="btn-section bg-blue-600 hover:bg-blue-500 disabled:opacity-70 disabled:cursor-not-allowed text-white border-blue-700 shadow-sm"
                    >
                      {allocationRunning ? '配置中...' : '配置表作成'}
                    </button>
                    <button
                      type="button"
                      disabled={allocationRunning || calendar.length === 0}
                      onClick={runAllocation}
                      className="btn-section bg-blue-400 hover:bg-blue-300 text-stone-800 border-blue-600 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      再配置
                    </button>
                    <button type="button" onClick={() => window.history.back()} className="btn-section-nav">← 戻る</button>
                    <button type="button" onClick={() => window.history.forward()} className="btn-section-nav">進む →</button>
                  </div>
                  <button type="button" onClick={() => window.print()} className="btn-section-print shrink-0">🖨️ 印刷</button>
                </div>
              </div>
              <p className="text-sm text-stone-600 mb-1">
                「配置表作成」で自動作成・保存します。同じアルゴリズムで職員を割り振り、下に表を表示します。職員名をドラッグ＆ドロップで移動できます。週休も別の平日にD&amp;Dで移動できます。
              </p>
              {safeCalendar.length > 0 && (
                <AllocationTableView
                  allocation={allocation}
                  modalityData={Array.isArray(rawModalityData) ? rawModalityData : []}
                  staffData={staffData}
                  safeCalendar={safeCalendar}
                  schedule={schedule}
                  weeklyOff={weeklyOff}
                  surgeryDays={surgeryDays}
                  editable
                  setAllocation={setAllocation}
                  setWeeklyOff={setWeeklyOff}
                />
              )}
            </div>
            </div>
          </div>
          </CalendarSectionBoundary>
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

        {showAllOrderModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 z-50">
            <div className="bg-slate-50 border-2 border-slate-400 rounded-2xl p-4 w-[95vw] max-w-[1400px] h-[95vh] flex flex-col shadow-xl overflow-hidden">
              <div className="flex justify-between items-center mb-1 shrink-0">
                <h3 className="font-bold text-stone-800 text-2xl">順番一括設定</h3>
                <button onClick={() => { setShowAllOrderModal(false); setPairIncompleteFirst(null); }} className="text-slate-600 hover:text-slate-800 transition-colors text-2xl font-bold">✕</button>
              </div>
              <p className="text-sm text-stone-600 mb-2 shrink-0">左の職員を右へドラッグして順番を構成。右側でドラッグして並び替え可能。職員名の右の★をクリックで開始者を選べます。ペアは1人目を「新規ペア」にドロップ→2人目をその行にドロップ。</p>
              <div className="flex-1 min-h-0 flex flex-row gap-3">
                {/* 夜勤順番 */}
                <div className="flex flex-col flex-1 min-w-0 border border-slate-300 rounded-xl bg-slate-50/50 overflow-hidden">
                  <h4 className="font-bold text-stone-800 text-base mb-1 px-2 py-1.5 shrink-0 flex items-center gap-1 bg-blue-50">
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-sm">夜勤</span>
                    <span className="text-stone-500 font-normal text-sm">({nightShiftOrder.length}名)</span>
                  </h4>
                  <div className="flex gap-1.5 flex-1 min-h-0 overflow-hidden">
                      <div className="flex-1 min-w-0 flex flex-col border border-slate-300 rounded-lg bg-white overflow-hidden">
                        <h4 className="font-bold text-stone-700 px-1.5 py-1 bg-slate-100 border-b border-slate-300 shrink-0 text-sm">職員</h4>
                        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                          {staffData.filter(s => !nightShiftOrder.includes(s.id)).map(staff => (
                            <div key={staff.id} draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'left', staffId: staff.id })); e.dataTransfer.effectAllowed = 'copy'; }} className="px-2 py-1.5 rounded text-sm border border-slate-300 bg-white cursor-grab active:cursor-grabbing hover:border-blue-400 hover:bg-blue-50 transition-all truncate">{staff.name}</div>
                          ))}
                          {staffData.filter(s => !nightShiftOrder.includes(s.id)).length === 0 && <p className="text-stone-500 text-sm py-2 text-center">全員追加済</p>}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col border border-blue-300 rounded-lg bg-blue-50/30 overflow-hidden">
                        <h4 className="font-bold text-stone-700 px-1.5 py-1 bg-blue-100 border-b border-blue-300 shrink-0 text-sm">順番</h4>
                        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = e.dataTransfer.types.includes('text/plain') ? 'move' : 'copy'; e.currentTarget.classList.add('ring-1', 'ring-blue-400'); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('ring-1', 'ring-blue-400'); }} onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('ring-1', 'ring-blue-400'); const raw = e.dataTransfer.getData('text/plain'); if (!raw) return; try { const data = JSON.parse(raw); if (data.source === 'left' && data.staffId && !nightShiftOrder.includes(data.staffId)) setNightShiftOrder([...nightShiftOrder, data.staffId]); else if (data.source === 'right' && data.fromIndex !== undefined) setNightShiftOrder([...nightShiftOrder.filter((_, i) => i !== data.fromIndex), data.staffId]); } catch (_) {} }}>
                          {nightShiftOrder.map((id, idx) => {
                            const staff = staffData.find(s => s.id === id);
                            const isStart = nightShiftStartId === id;
                            return (
                              <div key={`${id}-${idx}`} draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'right', staffId: id, fromIndex: idx })); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.classList.add('ring-1', 'ring-inset', 'ring-blue-500'); }} onDragLeave={(e) => { e.currentTarget.classList.remove('ring-1', 'ring-inset', 'ring-blue-500'); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('ring-1', 'ring-inset', 'ring-blue-500'); const raw = e.dataTransfer.getData('text/plain'); if (!raw) return; try { const data = JSON.parse(raw); if (data.source === 'right' && data.fromIndex !== undefined) { if (data.fromIndex === idx) return; const newOrder = nightShiftOrder.filter((_, i) => i !== data.fromIndex); const insertIdx = data.fromIndex < idx ? idx - 1 : idx; newOrder.splice(insertIdx, 0, data.staffId); setNightShiftOrder(newOrder); } else if (data.source === 'left' && data.staffId && !nightShiftOrder.includes(data.staffId)) { const newOrder = [...nightShiftOrder]; newOrder.splice(idx, 0, data.staffId); setNightShiftOrder(newOrder); } } catch (_) {} }} className="flex items-center gap-1.5 px-2 py-1.5 rounded text-sm border border-blue-300 bg-white cursor-grab active:cursor-grabbing hover:border-blue-500 transition-all group">
                                <span className="text-slate-400 shrink-0 select-none" aria-hidden>⋮⋮</span>
                                <span className="text-stone-800 font-medium truncate min-w-0 flex-1">{idx + 1}. {staff?.name || id}</span>
                                <button type="button" onClick={(ev) => { ev.stopPropagation(); setNightShiftStartId(id); autoAssign(id, dayShiftStartId); }} title="開始者に設定" className={`shrink-0 w-6 h-6 flex items-center justify-center rounded text-sm font-bold transition-all ${isStart ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-500 hover:bg-blue-300 hover:text-white'}`}>★</button>
                                <button type="button" onClick={(ev) => { ev.stopPropagation(); setNightShiftOrder(nightShiftOrder.filter((_, i) => i !== idx)); }} className="text-red-500 hover:text-red-600 font-semibold text-sm opacity-0 group-hover:opacity-100 shrink-0">削除</button>
                              </div>
                            );
                          })}
                          {nightShiftOrder.length === 0 && <p className="text-stone-500 text-sm py-2 text-center border border-dashed border-slate-300 rounded">ドロップで追加</p>}
                        </div>
                      </div>
                    </div>
                </div>

                {/* 日勤順番 */}
                <div className="flex flex-col flex-1 min-w-0 border border-slate-300 rounded-xl bg-slate-50/50 overflow-hidden">
                  <h4 className="font-bold text-stone-800 text-base mb-1 px-2 py-1.5 shrink-0 flex items-center gap-1 bg-emerald-50">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-sm">日勤</span>
                    <span className="text-stone-500 font-normal text-sm">({dayShiftOrder.length}名)</span>
                  </h4>
                  <div className="flex gap-1.5 flex-1 min-h-0 overflow-hidden">
                      <div className="flex-1 min-w-0 flex flex-col border border-slate-300 rounded-lg bg-white overflow-hidden">
                        <h4 className="font-bold text-stone-700 px-1.5 py-1 bg-slate-100 border-b border-slate-300 shrink-0 text-sm">職員</h4>
                        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                          {staffData.filter(s => !dayShiftOrder.includes(s.id)).map(staff => (
                            <div key={staff.id} draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'left', staffId: staff.id })); e.dataTransfer.effectAllowed = 'copy'; }} className="px-2 py-1.5 rounded text-sm border border-slate-300 bg-white cursor-grab active:cursor-grabbing hover:border-emerald-400 hover:bg-emerald-50 transition-all truncate">{staff.name}</div>
                          ))}
                          {staffData.filter(s => !dayShiftOrder.includes(s.id)).length === 0 && <p className="text-stone-500 text-sm py-2 text-center">全員追加済</p>}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col border border-emerald-300 rounded-lg bg-emerald-50/30 overflow-hidden">
                        <h4 className="font-bold text-stone-700 px-1.5 py-1 bg-emerald-100 border-b border-emerald-300 shrink-0 text-sm">順番</h4>
                        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = e.dataTransfer.types.includes('text/plain') ? 'move' : 'copy'; e.currentTarget.classList.add('ring-1', 'ring-emerald-400'); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('ring-1', 'ring-emerald-400'); }} onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('ring-1', 'ring-emerald-400'); const raw = e.dataTransfer.getData('text/plain'); if (!raw) return; try { const data = JSON.parse(raw); if (data.source === 'left' && data.staffId && !dayShiftOrder.includes(data.staffId)) setDayShiftOrder([...dayShiftOrder, data.staffId]); else if (data.source === 'right' && data.fromIndex !== undefined) setDayShiftOrder([...dayShiftOrder.filter((_, i) => i !== data.fromIndex), data.staffId]); } catch (_) {} }}>
                          {dayShiftOrder.map((id, idx) => {
                            const staff = staffData.find(s => s.id === id);
                            const isStart = dayShiftStartId === id;
                            return (
                              <div key={`${id}-${idx}`} draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'right', staffId: id, fromIndex: idx })); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.classList.add('ring-1', 'ring-inset', 'ring-emerald-500'); }} onDragLeave={(e) => { e.currentTarget.classList.remove('ring-1', 'ring-inset', 'ring-emerald-500'); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('ring-1', 'ring-inset', 'ring-emerald-500'); const raw = e.dataTransfer.getData('text/plain'); if (!raw) return; try { const data = JSON.parse(raw); if (data.source === 'right' && data.fromIndex !== undefined) { if (data.fromIndex === idx) return; const newOrder = dayShiftOrder.filter((_, i) => i !== data.fromIndex); const insertIdx = data.fromIndex < idx ? idx - 1 : idx; newOrder.splice(insertIdx, 0, data.staffId); setDayShiftOrder(newOrder); } else if (data.source === 'left' && data.staffId && !dayShiftOrder.includes(data.staffId)) { const newOrder = [...dayShiftOrder]; newOrder.splice(idx, 0, data.staffId); setDayShiftOrder(newOrder); } } catch (_) {} }} className="flex items-center gap-1.5 px-2 py-1.5 rounded text-sm border border-emerald-300 bg-white cursor-grab active:cursor-grabbing hover:border-emerald-500 transition-all group">
                                <span className="text-slate-400 shrink-0 select-none" aria-hidden>⋮⋮</span>
                                <span className="text-stone-800 font-medium truncate min-w-0 flex-1">{idx + 1}. {staff?.name || id}</span>
                                <button type="button" onClick={(ev) => { ev.stopPropagation(); setDayShiftStartId(id); autoAssign(nightShiftStartId, id); }} title="開始者に設定" className={`shrink-0 w-6 h-6 flex items-center justify-center rounded text-sm font-bold transition-all ${isStart ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500 hover:bg-emerald-300 hover:text-white'}`}>★</button>
                                <button type="button" onClick={(ev) => { ev.stopPropagation(); setDayShiftOrder(dayShiftOrder.filter((_, i) => i !== idx)); }} className="text-red-500 hover:text-red-600 font-semibold text-sm opacity-0 group-hover:opacity-100 shrink-0">削除</button>
                              </div>
                            );
                          })}
                          {dayShiftOrder.length === 0 && <p className="text-stone-500 text-sm py-2 text-center border border-dashed border-slate-300 rounded">ドロップで追加</p>}
                        </div>
                      </div>
                    </div>
                </div>

                {/* ペア設定 */}
                <div className="flex flex-col flex-1 min-w-0 border border-slate-300 rounded-xl bg-slate-50/50 overflow-hidden">
                  <h4 className="font-bold text-stone-800 text-base mb-1 px-2 py-1.5 shrink-0 flex items-center gap-1 bg-orange-50">
                    <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 text-sm">ペア</span>
                    <span className="text-stone-500 font-normal text-sm">({pairs.length}組)</span>
                  </h4>
                  <div className="flex gap-1.5 flex-1 min-h-0 overflow-hidden">
                      <div className="flex-1 min-w-0 flex flex-col border border-slate-300 rounded-lg bg-white overflow-hidden">
                        <h4 className="font-bold text-stone-700 px-1.5 py-1 bg-slate-100 border-b border-slate-300 shrink-0 text-sm">職員</h4>
                        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                          {staffData.filter(s => !pairs.some(p => p.person1 === s.id || p.person2 === s.id) && s.id !== pairIncompleteFirst).map(staff => (
                            <div key={staff.id} draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'left', staffId: staff.id })); e.dataTransfer.effectAllowed = 'copy'; }} className="px-2 py-1.5 rounded text-sm border border-slate-300 bg-white cursor-grab active:cursor-grabbing hover:border-orange-400 hover:bg-orange-50 transition-all truncate">{staff.name}</div>
                          ))}
                          {staffData.filter(s => !pairs.some(p => p.person1 === s.id || p.person2 === s.id) && s.id !== pairIncompleteFirst).length === 0 && <p className="text-stone-500 text-sm py-2 text-center">全員ペア済</p>}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col border border-orange-300 rounded-lg bg-orange-50/30 overflow-hidden">
                        <h4 className="font-bold text-stone-700 px-1.5 py-1 bg-orange-100 border-b border-orange-300 shrink-0 text-sm">ペア一覧</h4>
                        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0">
                          {pairs.map((pair, idx) => (
                            <div key={idx} className="flex justify-between items-center px-2 py-1.5 rounded text-sm border border-orange-300 bg-white transition-all group">
                              <span className="text-stone-800 font-medium truncate min-w-0">{staffData.find(s => s.id === pair.person1)?.name || pair.person1} ↔ {staffData.find(s => s.id === pair.person2)?.name || pair.person2}</span>
                              <button type="button" onClick={() => setPairs(pairs.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-600 font-semibold text-sm opacity-0 group-hover:opacity-100 shrink-0">削除</button>
                            </div>
                          ))}
                          {pairIncompleteFirst && (
                            <div className="px-2 py-1.5 rounded border border-dashed border-orange-400 bg-orange-50 min-h-[40px] flex items-center justify-between gap-1 text-sm" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; e.currentTarget.classList.add('ring-1', 'ring-orange-400'); }} onDragLeave={(e) => { e.currentTarget.classList.remove('ring-1', 'ring-orange-400'); }} onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('ring-1', 'ring-orange-400'); const raw = e.dataTransfer.getData('text/plain'); if (!raw) return; try { const { source, staffId } = JSON.parse(raw); if (source === 'left' && staffId && staffId !== pairIncompleteFirst) { addPair(pairIncompleteFirst, staffId); setPairIncompleteFirst(null); } } catch (_) {} }}>
                              <span className="text-stone-700 truncate">{staffData.find(s => s.id === pairIncompleteFirst)?.name || pairIncompleteFirst} — </span>
                              <span className="text-orange-600 text-sm font-medium shrink-0">2人目ドロップ</span>
                              <button type="button" onClick={() => setPairIncompleteFirst(null)} className="text-slate-500 hover:text-slate-700 text-sm shrink-0">×</button>
                            </div>
                          )}
                          {!pairIncompleteFirst && (
                            <div className="text-stone-500 text-sm py-2 text-center border border-dashed border-slate-300 rounded min-h-[44px] flex items-center justify-center" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; e.currentTarget.classList.add('ring-1', 'ring-orange-400', 'bg-orange-50'); }} onDragLeave={(e) => { e.currentTarget.classList.remove('ring-1', 'ring-orange-400', 'bg-orange-50'); }} onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('ring-1', 'ring-orange-400', 'bg-orange-50'); const raw = e.dataTransfer.getData('text/plain'); if (!raw) return; try { const { source, staffId } = JSON.parse(raw); if (source === 'left' && staffId) setPairIncompleteFirst(staffId); } catch (_) {} }}>1人目をドロップ</div>
                          )}
                        </div>
                      </div>
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
