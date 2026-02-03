import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useData } from '../context/DataContext';

/** 日本の祝日（指定年の祝日日付を YYYY-MM-DD の Set で返す） */
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
  if (year >= 2020) set.add(`${year}-07-22`);
  const nthMonday = (m, n) => {
    const first = new Date(year, m - 1, 1);
    const day = first.getDay();
    const d = 1 + (n - 1) * 7 + (8 - day) % 7;
    return `${year}-${pad(m)}-${pad(d)}`;
  };
  set.add(nthMonday(1, 2));
  if (year < 2020) set.add(nthMonday(7, 3));
  set.add(nthMonday(9, 3));
  set.add(nthMonday(10, 2));
  const vernal = year <= 2099 ? Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)) : 20;
  const autumnal = year <= 2099 ? Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)) : 23;
  set.add(`${year}-03-${pad(vernal)}`);
  set.add(`${year}-09-${pad(autumnal)}`);
  return set;
}

/** 週休を AM/PM 別に正規化。legacy の配列の場合は両方に同じリストを返す */
function getWeeklyOffBySlot(weeklyOff, dateStr) {
  const raw = weeklyOff?.[dateStr];
  if (!raw) return { am: [], pm: [] };
  if (Array.isArray(raw)) return { am: [...raw], pm: [...raw] };
  return {
    am: Array.isArray(raw.am) ? raw.am : [],
    pm: Array.isArray(raw.pm) ? raw.pm : []
  };
}

/** その日の週休（AM+PM マージ、重複除く）— 配置ロジックの「利用不可」判定用 */
function getWeeklyOffMerged(weeklyOff, dateStr) {
  const { am, pm } = getWeeklyOffBySlot(weeklyOff, dateStr);
  return [...new Set([...am, ...pm])];
}

/** 週休を保存用に正規化。{ am: [], pm: [] } 形式で返す（空の日は省略可） */
function normalizeWeeklyOffForSave(weeklyOff) {
  const next = {};
  Object.keys(weeklyOff || {}).forEach(dateStr => {
    const { am, pm } = getWeeklyOffBySlot(weeklyOff, dateStr);
    if (am.length > 0 || pm.length > 0) next[dateStr] = { am: [...am], pm: [...pm] };
  });
  return next;
}

function getRequiredForModality(modality, dateStr) {
  const dayOfWeek = new Date(dateStr).getDay();
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayKey = dayNames[dayOfWeek];
  const dayMap = { mon: 'mon', tue: 'tue', wed: 'wed', thu: 'thu', fri: 'fri' };
  if (modality.staffMode === 'uniform') {
    return { requiredAm: modality.uniformStaffAm ?? modality.uniformStaff ?? 0, requiredPm: modality.uniformStaffPm ?? modality.uniformStaff ?? 0 };
  }
  const w = modality.weekdayStaff?.[dayMap[dayKey]];
  if (typeof w === 'object' && w !== null) {
    return { requiredAm: w.am ?? 0, requiredPm: w.pm ?? 0 };
  }
  const n = w ?? 0;
  return { requiredAm: n, requiredPm: n };
}

/** スコア降順、同率の場合はランダム */
function sortByScoreRandom(a, b) {
  const d = (b.score ?? 0) - (a.score ?? 0);
  if (d !== 0) return d;
  return Math.random() - 0.5;
}

/** 不足セル数（必要人数に満たないAM/PMの合計）を返す */
function countShortage(allocation, weekdays, modalityData) {
  let total = 0;
  for (const day of weekdays) {
    const dateStr = day.date;
    for (const mod of modalityData) {
      const slot = allocation[dateStr]?.[mod.id];
      if (!slot || Array.isArray(slot)) continue;
      const { requiredAm, requiredPm } = getRequiredForModality(mod, dateStr);
      const am = slot.am || [];
      const pm = slot.pm || [];
      total += Math.max(0, requiredAm - am.length) + Math.max(0, requiredPm - pm.length);
    }
  }
  return total;
}

/** ① 他モダリティの職員を移動して不足を埋める。1件でも移動できたら true。 */
function tryFillShortageByMoving(newAllocation, weekdays, modalityData, staffData, schedule, weeklyOff, leaves, surgeryDays = []) {
  let moved = false;
  const maxRounds = 100;
  for (let round = 0; round < maxRounds; round++) {
    let anyMove = false;
    for (const day of weekdays) {
      const dateStr = day.date;
      if (!newAllocation[dateStr]?._shortage) continue;
      const unavailableAtStart = new Set();
      const daySched = schedule[dateStr] || {};
      const nextDay = weekdays[weekdays.findIndex(d => d.date === dateStr) + 1];
      const bPerson = surgeryDays.includes(dateStr) && nextDay
        ? (schedule[nextDay.date]?.nightShift ?? schedule[nextDay.date]?.nightShiftManual)
        : (daySched.b ?? daySched.bManual);
      if (daySched.nightShift) unavailableAtStart.add(daySched.nightShift);
      if (daySched.dayShift) unavailableAtStart.add(daySched.dayShift);
      if (daySched.support) unavailableAtStart.add(daySched.support);
      if (bPerson) unavailableAtStart.add(bPerson);
      if (daySched.dayOff) unavailableAtStart.add(daySched.dayOff);
      getWeeklyOffMerged(weeklyOff, dateStr).forEach(id => unavailableAtStart.add(id));
      if (leaves[dateStr]) leaves[dateStr].forEach(l => unavailableAtStart.add(l.staffId));
      const unassigned = new Set((newAllocation[dateStr]._unassigned || []).filter(id => !unavailableAtStart.has(id)));
      for (const mod of modalityData) {
        const modId = mod.id;
        const slot = newAllocation[dateStr][modId];
        if (!slot || Array.isArray(slot)) continue;
        const { requiredAm, requiredPm } = getRequiredForModality(mod, dateStr);
        const amIds = slot.am || [];
        const pmIds = slot.pm || [];
        let needAmLeft = Math.max(0, requiredAm - amIds.length);
        let needPmLeft = Math.max(0, requiredPm - pmIds.length);
        if (needAmLeft === 0 && needPmLeft === 0) continue;

        const score = (id) => staffData.find(s => s.id === id)?.scores?.[modId] ?? 0;
        const candidatesAm = [];
        unassigned.forEach(id => { if (score(id) >= 1 && score(id) <= 5) candidatesAm.push({ id, score: score(id), source: 'unassigned' }); });
        modalityData.forEach(m2 => {
          if (m2.id === modId) return;
          const s2 = newAllocation[dateStr][m2.id];
          if (!s2 || Array.isArray(s2)) return;
          const r2 = getRequiredForModality(m2, dateStr);
          const surplusAm = (s2.am || []).length - r2.requiredAm;
          if (surplusAm > 0) (s2.am || []).forEach(id => candidatesAm.push({ id, score: score(id), source: m2.id, slot: 'am' }));
        });
        candidatesAm.sort(sortByScoreRandom);
        for (const { id, source } of candidatesAm) {
          if (needAmLeft <= 0) break;
          if (amIds.includes(id)) continue;
          amIds.push(id);
          if (source === 'unassigned') unassigned.delete(id);
          else {
            const s2 = newAllocation[dateStr][source];
            if (s2?.am) s2.am = s2.am.filter(x => x !== id);
          }
          anyMove = true;
          needAmLeft--;
        }

        const candidatesPm = [];
        unassigned.forEach(id => { if (score(id) >= 1 && score(id) <= 5) candidatesPm.push({ id, score: score(id), source: 'unassigned' }); });
        modalityData.forEach(m2 => {
          if (m2.id === modId) return;
          const s2 = newAllocation[dateStr][m2.id];
          if (!s2 || Array.isArray(s2)) return;
          const r2 = getRequiredForModality(m2, dateStr);
          const surplusPm = (s2.pm || []).length - r2.requiredPm;
          if (surplusPm > 0) (s2.pm || []).forEach(id => candidatesPm.push({ id, score: score(id), source: m2.id, slot: 'pm' }));
        });
        candidatesPm.sort(sortByScoreRandom);
        needPmLeft = Math.max(0, requiredPm - (slot.pm || []).length);
        for (const { id, source } of candidatesPm) {
          if (needPmLeft <= 0) break;
          if ((slot.pm || []).includes(id)) continue;
          if (!slot.pm) slot.pm = [];
          slot.pm.push(id);
          if (source === 'unassigned') unassigned.delete(id);
          else {
            const s2 = newAllocation[dateStr][source];
            if (s2?.pm) s2.pm = s2.pm.filter(x => x !== id);
          }
          anyMove = true;
          needPmLeft--;
        }
      }

      const assignedThisDate = new Set();
      modalityData.forEach(mod => {
        const s = newAllocation[dateStr][mod.id];
        if (s && !Array.isArray(s)) { (s.am || []).forEach(id => assignedThisDate.add(id)); (s.pm || []).forEach(id => assignedThisDate.add(id)); }
      });
      newAllocation[dateStr]._unassigned = staffData.filter(s => !unavailableAtStart.has(s.id) && !assignedThisDate.has(s.id)).map(s => s.id);
      const stillShort = modalityData.some(mod => {
        const s = newAllocation[dateStr][mod.id];
        if (!s || Array.isArray(s)) return false;
        const { requiredAm, requiredPm } = getRequiredForModality(mod, dateStr);
        return (s.am || []).length < requiredAm || (s.pm || []).length < requiredPm;
      });
      newAllocation[dateStr]._shortage = stillShort;
      if (anyMove) moved = true;
    }
    if (!anyMove) break;
  }
  return moved;
}

/** ② 空いたところ（他モダリティから人を移した穴）に未配置職員を配置。1件でも埋めたら true。 */
function fillVacatedWithUnassigned(newAllocation, weekdays, modalityData, staffData, schedule, weeklyOff, leaves, surgeryDays = []) {
  let filled = false;
  const maxRounds = 50;
  for (let round = 0; round < maxRounds; round++) {
    let anyFill = false;
    for (const day of weekdays) {
      const dateStr = day.date;
      const unavailableAtStart = new Set();
      const daySched = schedule[dateStr] || {};
      const nextDay = weekdays[weekdays.findIndex(d => d.date === dateStr) + 1];
      const bPerson = surgeryDays.includes(dateStr) && nextDay
        ? (schedule[nextDay.date]?.nightShift ?? schedule[nextDay.date]?.nightShiftManual)
        : (daySched.b ?? daySched.bManual);
      if (daySched.nightShift) unavailableAtStart.add(daySched.nightShift);
      if (daySched.dayShift) unavailableAtStart.add(daySched.dayShift);
      if (daySched.support) unavailableAtStart.add(daySched.support);
      if (bPerson) unavailableAtStart.add(bPerson);
      if (daySched.dayOff) unavailableAtStart.add(daySched.dayOff);
      getWeeklyOffMerged(weeklyOff, dateStr).forEach(id => unavailableAtStart.add(id));
      if (leaves[dateStr]) leaves[dateStr].forEach(l => unavailableAtStart.add(l.staffId));
      let unassigned = new Set((newAllocation[dateStr]._unassigned || []).filter(id => !unavailableAtStart.has(id)));

      for (const mod of modalityData) {
        const modId = mod.id;
        const slot = newAllocation[dateStr][modId];
        if (!slot || Array.isArray(slot)) continue;
        const { requiredAm, requiredPm } = getRequiredForModality(mod, dateStr);
        const amIds = slot.am || [];
        const pmIds = slot.pm || [];
        let needAm = Math.max(0, requiredAm - amIds.length);
        let needPm = Math.max(0, requiredPm - pmIds.length);
        if (needAm === 0 && needPm === 0) continue;

        const score = (id) => staffData.find(s => s.id === id)?.scores?.[modId] ?? 0;
        const candidates = [...unassigned].filter(id => {
          const s = score(id);
          return s >= 1 && s <= 5;
        }).map(id => ({ id, score: score(id) })).sort(sortByScoreRandom);

        for (const { id } of candidates) {
          if (needAm <= 0 && needPm <= 0) break;
          if (amIds.includes(id) || pmIds.includes(id)) continue;
          const staff = staffData.find(s => s.id === id);
          const canBoth = !staff?.isPartTime || staff?.partTimeSlot === 'am_pm';
          const canAm = canBoth || staff?.partTimeSlot === 'am';
          const canPm = canBoth || staff?.partTimeSlot === 'pm';
          if (needAm > 0 && canAm) {
            amIds.push(id);
            unassigned.delete(id);
            needAm--;
            anyFill = true;
          }
          if (needPm > 0 && canPm && !pmIds.includes(id)) {
            pmIds.push(id);
            unassigned.delete(id);
            needPm--;
            anyFill = true;
          }
        }
        if (!slot.am) slot.am = [];
        if (!slot.pm) slot.pm = [];
        slot.am = amIds;
        slot.pm = pmIds;
      }

      const assignedThisDate = new Set();
      modalityData.forEach(mod => {
        const s = newAllocation[dateStr][mod.id];
        if (s && !Array.isArray(s)) { (s.am || []).forEach(id => assignedThisDate.add(id)); (s.pm || []).forEach(id => assignedThisDate.add(id)); }
      });
      newAllocation[dateStr]._unassigned = staffData.filter(s => !unavailableAtStart.has(s.id) && !assignedThisDate.has(s.id)).map(s => s.id);
      const stillShort = modalityData.some(mod => {
        const s = newAllocation[dateStr][mod.id];
        if (!s || Array.isArray(s)) return false;
        const { requiredAm, requiredPm } = getRequiredForModality(mod, dateStr);
        return (s.am || []).length < requiredAm || (s.pm || []).length < requiredPm;
      });
      newAllocation[dateStr]._shortage = stillShort;
      if (anyFill) filled = true;
    }
    if (!anyFill) break;
  }
  return filled;
}

export default function AllocationScreen({ onBack }) {
  const { modalityData, staffData } = useData();
  const [allocation, setAllocation] = useState({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [calendar, setCalendar] = useState([]);
  const [isAutoAllocating, setIsAutoAllocating] = useState(false);
  const [scheduleDataVersion, setScheduleDataVersion] = useState(0);
  /** 空セルクリックで未配置から割り当てるピッカー { dateStr, modId, slot } */
  const [assignPicker, setAssignPicker] = useState(null);
  /** マニュアル（機能一覧）モーダルを開いているか */
  const [manualOpen, setManualOpen] = useState(false);

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
    const surgeryDays = scheduleData.surgeryDays || [];
    const leaves = leaveData.leaveData || {};
    const weekdays = calendar.filter(d => !d.isWeekend && !d.isHoliday);

    // 複数回試行して不足が最小の結果を採用（同率ランダムのため試行で結果が変わる）
    const NUM_TRIES = 5;
    let bestAllocation = null;
    let bestShortageCount = Infinity;

    for (let tryIndex = 0; tryIndex < NUM_TRIES; tryIndex++) {
      const newAllocation = {};
      let requiredNotMet = false;

      calendar.forEach((day, idx) => {
      const dateStr = day.date;
      if (day.isWeekend || day.isHoliday) return;
      newAllocation[dateStr] = {};
      const unavailableAtStart = new Set();
      const daySchedule = schedule[dateStr] || {};
      const nextDay = calendar[idx + 1];
      const bPerson = surgeryDays.includes(dateStr) && nextDay
        ? (schedule[nextDay.date]?.nightShift ?? schedule[nextDay.date]?.nightShiftManual)
        : (daySchedule.b ?? daySchedule.bManual);
      if (daySchedule.nightShift) unavailableAtStart.add(daySchedule.nightShift);
      if (daySchedule.dayShift) unavailableAtStart.add(daySchedule.dayShift);
      if (daySchedule.support) unavailableAtStart.add(daySchedule.support);
      if (bPerson) unavailableAtStart.add(bPerson);
      if (daySchedule.dayOff) unavailableAtStart.add(daySchedule.dayOff);
      getWeeklyOffMerged(weeklyOff, dateStr).forEach(id => unavailableAtStart.add(id));
      if (leaves[dateStr]) leaves[dateStr].forEach(leave => unavailableAtStart.add(leave.staffId));

      const unavailableStaff = new Set(unavailableAtStart);
      const assignedThisDate = new Set();

      // 候補者（スコア1-5で配置可能な人数）が少ないモダリティから先に割り当て（厳しいモダリティを優先）
      const dayOfWeek = new Date(dateStr).getDay();
      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const dayKey = dayNames[dayOfWeek];
      const dayMap = { mon: 'mon', tue: 'tue', wed: 'wed', thu: 'thu', fri: 'fri' };
      const modalitiesOrdered = [...modalityData]
        .map(mod => {
          const r = getRequiredForModality(mod, dateStr);
          const candidateCount = staffData.filter(
            s => !unavailableAtStart.has(s.id) && ((s.scores?.[mod.id] ?? 0) >= 1 && (s.scores?.[mod.id] ?? 0) <= 5)
          ).length;
          return { modality: mod, requiredAm: r.requiredAm, requiredPm: r.requiredPm, candidateCount };
        })
        .sort((a, b) => {
          if (a.candidateCount !== b.candidateCount) return a.candidateCount - b.candidateCount;
          return (b.requiredAm + b.requiredPm) - (a.requiredAm + a.requiredPm);
        });

      modalitiesOrdered.forEach(({ modality, requiredAm, requiredPm }) => {
        const modalityId = modality.id;

        const available = staffData
          .filter(s => !unavailableStaff.has(s.id))
          .map(s => ({ ...s, score: s.scores[modalityId] ?? 0 }));
        const training = available.filter(s => s.score === 5);
        const forRequired = available.filter(s => s.score >= 1 && s.score <= 4).sort(sortByScoreRandom);
        const canDoBoth = (s) => !s.isPartTime || s.partTimeSlot === 'am_pm';
        const canDoAm = (s) => canDoBoth(s) || s.partTimeSlot === 'am';
        const canDoPm = (s) => canDoBoth(s) || s.partTimeSlot === 'pm';

        const amIds = [];
        const pmIds = [];

        // ① トレーニングを先に配置（必要人数に含めない）
        training.forEach(staff => {
          if (!unavailableStaff.has(staff.id)) {
            amIds.push(staff.id);
            pmIds.push(staff.id);
            unavailableStaff.add(staff.id);
            assignedThisDate.add(staff.id);
          }
        });

        // ② 必要人数をスコア1-4で埋める。基本的にAMとPMに同じ職員を配置（パートでAM/PM未選択は両方可能）
        const nBoth = Math.min(requiredAm, requiredPm);
        const canBoth = forRequired.filter(canDoBoth);
        const used = new Set();
        for (let i = 0; i < nBoth && i < canBoth.length; i++) {
          const staff = canBoth[i];
          if (used.has(staff.id)) continue;
          amIds.push(staff.id);
          pmIds.push(staff.id);
          used.add(staff.id);
          unavailableStaff.add(staff.id);
          assignedThisDate.add(staff.id);
        }
        const remainingAm = Math.max(0, requiredAm - amIds.length);
        const remainingPm = Math.max(0, requiredPm - pmIds.length);
        const canAm = forRequired.filter(s => canDoAm(s) && !used.has(s.id));
        const canPm = forRequired.filter(s => canDoPm(s) && !used.has(s.id));
        for (const staff of canAm) {
          if (amIds.length >= requiredAm) break;
          if (unavailableStaff.has(staff.id)) continue;
          amIds.push(staff.id);
          unavailableStaff.add(staff.id);
          assignedThisDate.add(staff.id);
        }
        for (const staff of canPm) {
          if (pmIds.length >= requiredPm) break;
          if (unavailableStaff.has(staff.id)) continue;
          pmIds.push(staff.id);
          unavailableStaff.add(staff.id);
          assignedThisDate.add(staff.id);
        }

        if (amIds.length < requiredAm || pmIds.length < requiredPm) {
          requiredNotMet = true;
          newAllocation[dateStr]._shortage = true;
        }
        if (amIds.length > 0 || pmIds.length > 0) {
          newAllocation[dateStr][modalityId] = { am: amIds, pm: pmIds };
        }
      });

      // 未配置：その日どこにも配置されていない職員（当番・週休・休暇以外で利用可能だったが割り当てられなかった人）
      const unassigned = staffData
        .filter(s => !unavailableAtStart.has(s.id) && !assignedThisDate.has(s.id))
        .map(s => s.id);
      newAllocation[dateStr]._unassigned = unassigned;
    });

      // ①→② ループで不足を埋める
      for (;;) {
        const moved = tryFillShortageByMoving(newAllocation, weekdays, modalityData, staffData, schedule, weeklyOff, leaves, surgeryDays);
        const filled = fillVacatedWithUnassigned(newAllocation, weekdays, modalityData, staffData, schedule, weeklyOff, leaves, surgeryDays);
        if (!moved && !filled) break;
        if (!weekdays.some(d => newAllocation[d.date]?._shortage)) break;
      }

      const shortageCount = countShortage(newAllocation, weekdays, modalityData);
      if (shortageCount < bestShortageCount) {
        bestShortageCount = shortageCount;
        bestAllocation = JSON.parse(JSON.stringify(newAllocation));
      }
      if (bestShortageCount === 0) break;
    }

    let newAllocation = bestAllocation;
    const requiredNotMet = bestShortageCount > 0;

    // 必要人数を満たせない日がある場合：週休の割り当てをやり直し、同じ ①→② サイクルを再実行
    if (requiredNotMet) {
      if (!weekdays.some(d => newAllocation[d.date]?._shortage)) {
        setAllocation(newAllocation);
        setIsAutoAllocating(false);
        alert('✅ 自動配置が完了しました。他モダリティの移動と未配置の充てで必要人数を満たしました。');
        return;
      }
      // それでも足りない場合：週休の割り当てをやり直し、同じ ①→② サイクルを再実行（AM/PM 同一で移動）
      let currentWeeklyOff = {};
      Object.keys(weeklyOff || {}).forEach(k => {
        const { am, pm } = getWeeklyOffBySlot(weeklyOff, k);
        if (am.length > 0 || pm.length > 0) currentWeeklyOff[k] = { am: [...am], pm: [...pm] };
      });
      let moved = false;
      const maxAttempts = 200;
      for (let attempt = 0; attempt < maxAttempts && weekdays.some(d => newAllocation[d.date]?._shortage); attempt++) {
        const stillShortage = weekdays.filter(d => newAllocation[d.date]?._shortage);
        if (stillShortage.length === 0) break;
        const dateStr = stillShortage[0].date;
        const onThisDay = getWeeklyOffMerged(currentWeeklyOff, dateStr);
        let found = false;
        for (const staffId of onThisDay) {
          const otherWeekdays = weekdays.filter(d => d.date !== dateStr);
          for (const other of otherWeekdays) {
            const otherDate = other.date;
            const daySched = schedule[otherDate] || {};
            const nextDayOther = weekdays[weekdays.findIndex(d => d.date === otherDate) + 1];
            const bPersonOther = surgeryDays.includes(otherDate) && nextDayOther
              ? (schedule[nextDayOther.date]?.nightShift ?? schedule[nextDayOther.date]?.nightShiftManual)
              : (daySched.b ?? daySched.bManual);
            const unavailable = new Set();
            if (daySched.nightShift) unavailable.add(daySched.nightShift);
            if (daySched.dayShift) unavailable.add(daySched.dayShift);
            if (daySched.support) unavailable.add(daySched.support);
            if (bPersonOther) unavailable.add(bPersonOther);
            if (daySched.dayOff) unavailable.add(daySched.dayOff);
            if (leaves[otherDate]) leaves[otherDate].forEach(l => unavailable.add(l.staffId));
            if (getWeeklyOffMerged(currentWeeklyOff, otherDate).includes(staffId)) continue;
            if (unavailable.has(staffId)) continue;
            const nextWeeklyOff = {};
            for (const k of Object.keys(currentWeeklyOff)) {
              const slot = getWeeklyOffBySlot(currentWeeklyOff, k);
              if (k === dateStr) {
                const am = slot.am.filter(id => id !== staffId);
                const pm = slot.pm.filter(id => id !== staffId);
                if (am.length > 0 || pm.length > 0) nextWeeklyOff[k] = { am, pm };
              } else if (k === otherDate) {
                nextWeeklyOff[k] = { am: [...slot.am, staffId], pm: [...slot.pm, staffId] };
              } else {
                nextWeeklyOff[k] = { am: [...slot.am], pm: [...slot.pm] };
              }
            }
            if (!nextWeeklyOff[otherDate]) nextWeeklyOff[otherDate] = { am: [staffId], pm: [staffId] };

            const res = runAllocationWithWeeklyOff(schedule, leaves, nextWeeklyOff, weekdays, modalityData, staffData);
            Object.keys(res.allocation).forEach(d => { newAllocation[d] = res.allocation[d]; });
            // 週休変更後に同じ ①→② ループを実行
            for (;;) {
              const movedInner = tryFillShortageByMoving(newAllocation, weekdays, modalityData, staffData, schedule, nextWeeklyOff, leaves, surgeryDays);
              const filledInner = fillVacatedWithUnassigned(newAllocation, weekdays, modalityData, staffData, schedule, nextWeeklyOff, leaves, surgeryDays);
              if (!movedInner && !filledInner) break;
              if (!weekdays.some(d => newAllocation[d.date]?._shortage)) break;
            }
            if (!newAllocation[dateStr]?._shortage) {
              currentWeeklyOff = nextWeeklyOff;
              moved = true;
              found = true;
              break;
            }
          }
          if (found) break;
        }
        if (!found) break;
      }

      if (moved) {
        const saved = JSON.parse(localStorage.getItem('scheduleData') || '{}');
        saved.weeklyOff = normalizeWeeklyOffForSave(currentWeeklyOff);
        localStorage.setItem('scheduleData', JSON.stringify(saved));
      }
    }

    setAllocation(newAllocation);
    setIsAutoAllocating(false);
    if (requiredNotMet && Object.keys(newAllocation).some(d => newAllocation[d]._shortage)) {
      alert('✅ 自動配置を実行しました。\n⚠️ 一部で必要人数を満たせませんでした（灰色列）。週休自動割り当ての見直しや、職員・モダリティ設定を確認してください。');
    } else if (requiredNotMet) {
      alert('✅ 自動配置が完了しました。週休を自動でずらして必要人数を満たしました。週休割り当てのカレンダーも更新済みです。');
    } else {
      alert('✅ 自動配置が完了しました');
    }
  };

  function runAllocationWithWeeklyOff(schedule, leaves, weeklyOff, weekdays, modalityData, staffData) {
    const newAllocation = {};
    const shortageDates = [];
    weekdays.forEach(day => {
      const dateStr = day.date;
      newAllocation[dateStr] = {};
      const unavailableAtStart = new Set();
      const daySchedule = schedule[dateStr] || {};
      const nextDay = weekdays[weekdays.findIndex(d => d.date === dateStr) + 1];
      const bPerson = (surgeryDays => {
        const cal = JSON.parse(localStorage.getItem('scheduleData') || '{}').calendar || [];
        const i = cal.findIndex(d => d.date === dateStr);
        const next = cal[i + 1];
        return surgeryDays.includes(dateStr) && next
          ? (schedule[next.date]?.nightShift ?? schedule[next.date]?.nightShiftManual)
          : (daySchedule.b ?? daySchedule.bManual);
      })(scheduleData.surgeryDays || []);
      if (daySchedule.nightShift) unavailableAtStart.add(daySchedule.nightShift);
      if (daySchedule.dayShift) unavailableAtStart.add(daySchedule.dayShift);
      if (daySchedule.support) unavailableAtStart.add(daySchedule.support);
      if (bPerson) unavailableAtStart.add(bPerson);
      if (daySchedule.dayOff) unavailableAtStart.add(daySchedule.dayOff);
      getWeeklyOffMerged(weeklyOff, dateStr).forEach(id => unavailableAtStart.add(id));
      if (leaves[dateStr]) leaves[dateStr].forEach(leave => unavailableAtStart.add(leave.staffId));
      const unavailableStaff = new Set(unavailableAtStart);
      const assignedThisDate = new Set();

      const dayOfWeek = new Date(dateStr).getDay();
      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const dayKey = dayNames[dayOfWeek];
      const dayMap = { mon: 'mon', tue: 'tue', wed: 'wed', thu: 'thu', fri: 'fri' };
      const modalitiesOrdered = [...modalityData]
        .map(mod => {
          const r = getRequiredForModality(mod, dateStr);
          const candidateCount = staffData.filter(
            s => !unavailableAtStart.has(s.id) && ((s.scores?.[mod.id] ?? 0) >= 1 && (s.scores?.[mod.id] ?? 0) <= 5)
          ).length;
          return { modality: mod, requiredAm: r.requiredAm, requiredPm: r.requiredPm, candidateCount };
        })
        .sort((a, b) => {
          if (a.candidateCount !== b.candidateCount) return a.candidateCount - b.candidateCount;
          return (b.requiredAm + b.requiredPm) - (a.requiredAm + a.requiredPm);
        });

      modalitiesOrdered.forEach(({ modality, requiredAm, requiredPm }) => {
        const modalityId = modality.id;
        const available = staffData.filter(s => !unavailableStaff.has(s.id)).map(s => ({ ...s, score: s.scores[modalityId] ?? 0 }));
        const training = available.filter(s => s.score === 5);
        const forRequired = available.filter(s => s.score >= 1 && s.score <= 4).sort(sortByScoreRandom);
        const canDoBoth = (s) => !s.isPartTime || s.partTimeSlot === 'am_pm';
        const canDoAm = (s) => canDoBoth(s) || s.partTimeSlot === 'am';
        const canDoPm = (s) => canDoBoth(s) || s.partTimeSlot === 'pm';
        const amIds = [];
        const pmIds = [];
        training.forEach(staff => {
          if (!unavailableStaff.has(staff.id)) {
            amIds.push(staff.id);
            pmIds.push(staff.id);
            unavailableStaff.add(staff.id);
            assignedThisDate.add(staff.id);
          }
        });
        const nBoth = Math.min(requiredAm, requiredPm);
        const canBoth = forRequired.filter(canDoBoth);
        const used = new Set();
        for (let i = 0; i < nBoth && i < canBoth.length; i++) {
          const staff = canBoth[i];
          if (used.has(staff.id)) continue;
          amIds.push(staff.id);
          pmIds.push(staff.id);
          used.add(staff.id);
          unavailableStaff.add(staff.id);
          assignedThisDate.add(staff.id);
        }
        const remainingAm = Math.max(0, requiredAm - amIds.length);
        const remainingPm = Math.max(0, requiredPm - pmIds.length);
        const canAm = forRequired.filter(s => canDoAm(s) && !used.has(s.id));
        const canPm = forRequired.filter(s => canDoPm(s) && !used.has(s.id));
        for (const staff of canAm) {
          if (amIds.length >= requiredAm) break;
          if (unavailableStaff.has(staff.id)) continue;
          amIds.push(staff.id);
          unavailableStaff.add(staff.id);
          assignedThisDate.add(staff.id);
        }
        for (const staff of canPm) {
          if (pmIds.length >= requiredPm) break;
          if (unavailableStaff.has(staff.id)) continue;
          pmIds.push(staff.id);
          unavailableStaff.add(staff.id);
          assignedThisDate.add(staff.id);
        }
        if (amIds.length < requiredAm || pmIds.length < requiredPm) shortageDates.push(dateStr);
        if (amIds.length > 0 || pmIds.length > 0) newAllocation[dateStr][modalityId] = { am: amIds, pm: pmIds };
      });
      const unassigned = staffData.filter(s => !unavailableAtStart.has(s.id) && !assignedThisDate.has(s.id)).map(s => s.id);
      newAllocation[dateStr]._unassigned = unassigned;
      if (shortageDates.includes(dateStr)) newAllocation[dateStr]._shortage = true;
    });
    return { allocation: newAllocation, shortageDates };
  }

  const getStaffAllocation = (staffId, date) => {
    const scheduleData = JSON.parse(localStorage.getItem('scheduleData') || '{}');
    const leaveData = JSON.parse(localStorage.getItem('leaveData') || '{}');
    const schedule = mergeScheduleWithOverrides(scheduleData.schedule || {}, scheduleData.manualOverrides);
    const weeklyOff = scheduleData.weeklyOff || {};
    const surgeryDays = scheduleData.surgeryDays || [];
    const leaves = leaveData.leaveData || {};
    const leave = leaves[date]?.find(l => l.staffId === staffId);
    if (leave) return leave.leaveType;
    if (getWeeklyOffMerged(weeklyOff, date).includes(staffId)) return '週休';
    const daySchedule = schedule[date] || {};
    if (daySchedule.nightShift === staffId) return '16';
    if (daySchedule.dayShift === staffId) return '日勤';
    if (daySchedule.support === staffId) return 'サポート';
    const cal = scheduleData.calendar || [];
    const idx = cal.findIndex(d => d.date === date);
    const nextDay = cal[idx + 1];
    const bPerson = surgeryDays.includes(date) && nextDay
      ? (schedule[nextDay.date]?.nightShift ?? schedule[nextDay.date]?.nightShiftManual)
      : (daySchedule.b ?? daySchedule.bManual);
    if (bPerson === staffId) return 'B';
    if (daySchedule.dayOff === staffId) return '非番';
    if (allocation[date]) {
      for (const [modalityId, slotData] of Object.entries(allocation[date])) {
        if (modalityId === '_unassigned') continue;
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

  /** 配置表内で職員を同一日の中で移動（D&D）。変えた職員は _manualStaff で赤字表示 */
  const moveAllocationStaff = (dateStr, staffId, fromSource, toTarget) => {
    setAllocation(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[dateStr]) return prev;
      const day = next[dateStr];
      if (!day._manualStaff) day._manualStaff = [];

      const removeFrom = (src) => {
        if (src.type === 'unassigned') {
          if (day._unassigned) day._unassigned = day._unassigned.filter(id => id !== staffId);
        } else {
          const slot = day[src.modId];
          if (slot && !Array.isArray(slot)) {
            if (src.slot === 'am' && slot.am) slot.am = slot.am.filter(id => id !== staffId);
            if (src.slot === 'pm' && slot.pm) slot.pm = slot.pm.filter(id => id !== staffId);
          }
        }
      };
      const addTo = (tgt) => {
        if (tgt.type === 'unassigned') {
          if (!day._unassigned) day._unassigned = [];
          if (!day._unassigned.includes(staffId)) day._unassigned.push(staffId);
        } else {
          if (!day[tgt.modId]) day[tgt.modId] = { am: [], pm: [] };
          const slot = day[tgt.modId];
          if (Array.isArray(slot)) return;
          if (tgt.slot === 'am' && !slot.am.includes(staffId)) slot.am = [...(slot.am || []), staffId];
          if (tgt.slot === 'pm' && !slot.pm.includes(staffId)) slot.pm = [...(slot.pm || []), staffId];
        }
      };

      removeFrom(fromSource);
      addTo(toTarget);
      if (!day._manualStaff.includes(staffId)) day._manualStaff.push(staffId);
      return next;
    });
  };

  /** その日の「未配置」に表示している職員IDリスト（当番表に載っている人は除外） */
  const getAssignableUnassigned = (dateStr) => {
    const scheduleData = JSON.parse(localStorage.getItem('scheduleData') || '{}');
    const leaveDataRaw = JSON.parse(localStorage.getItem('leaveData') || '{}');
    const schedule = mergeScheduleWithOverrides(scheduleData.schedule || {}, scheduleData.manualOverrides);
    const weeklyOff = scheduleData.weeklyOff || {};
    const leaves = leaveDataRaw.leaveData || {};
    const surgeryDays = scheduleData.surgeryDays || [];
    const idx = calendar.findIndex(d => d.date === dateStr);
    const nextDay = calendar[idx + 1];
    const daySched = schedule[dateStr] || {};
    const bPerson = surgeryDays.includes(dateStr) && nextDay ? (schedule[nextDay?.date]?.nightShift ?? schedule[nextDay?.date]?.nightShiftManual) : (daySched.b ?? daySched.bManual);
    const scheduleStaffThisDay = new Set([
      daySched.dayShift ?? daySched.dayShiftManual,
      daySched.support ?? daySched.supportManual,
      daySched.nightShift ?? daySched.nightShiftManual,
      bPerson,
      daySched.dayOff ?? daySched.dayOffManual,
      ...getWeeklyOffMerged(weeklyOff, dateStr),
      ...(leaves[dateStr] || []).map(l => l.staffId)
    ].filter(Boolean));
    const rawIds = allocation[dateStr]?._unassigned || [];
    return rawIds.filter(id => !scheduleStaffThisDay.has(id));
  };

  useEffect(() => {
    if (!allocationLoaded.current) return;
    localStorage.setItem('allocationData', JSON.stringify({ allocation, startDate, endDate }));
  }, [allocation, startDate, endDate]);

  /** 週休割り当てで週休を別日に移動。fromSlot/toSlot で AM/PM を個別に移動（リンクを切る） */
  const moveWeeklyOffAllocation = (staffId, fromDate, toDate, fromSlot, toSlot) => {
    const scheduleData = JSON.parse(localStorage.getItem('scheduleData') || '{}');
    const schedule = mergeScheduleWithOverrides(scheduleData.schedule || {}, scheduleData.manualOverrides);
    const cal = scheduleData.calendar || [];
    const surgeryDays = scheduleData.surgeryDays || [];
    const day = cal.find(d => d.date === toDate);
    if (!day || day.isWeekend || day.isHoliday) return;
    const leaveData = JSON.parse(localStorage.getItem('leaveData') || '{}').leaveData || {};
    const hasOtherLeave = leaveData[toDate]?.some(leave => leave.staffId === staffId);
    const daySchedule = schedule[toDate] || {};
    const calIdx = cal.findIndex(d => d.date === toDate);
    const nextDay = calIdx >= 0 ? cal[calIdx + 1] : null;
    const prevDay = calIdx >= 0 ? cal[calIdx - 1] : null;
    const bPerson = surgeryDays.includes(toDate) && nextDay ? (schedule[nextDay?.date]?.nightShift ?? schedule[nextDay?.date]?.nightShiftManual) : (daySchedule.b ?? daySchedule.bManual);
    const dayOffPerson = prevDay ? (schedule[prevDay.date]?.nightShift ?? schedule[prevDay.date]?.nightShiftManual) : (daySchedule.dayOff ?? daySchedule.dayOffManual);
    const isAssigned =
      daySchedule.nightShift === staffId || daySchedule.nightShiftManual === staffId ||
      daySchedule.dayShift === staffId || daySchedule.dayShiftManual === staffId ||
      daySchedule.support === staffId || daySchedule.supportManual === staffId ||
      (daySchedule.b ?? bPerson) === staffId || daySchedule.bManual === staffId ||
      (daySchedule.dayOff ?? dayOffPerson) === staffId || daySchedule.dayOffManual === staffId;
    if (hasOtherLeave || isAssigned) return;
    const fromKey = fromSlot === 'pm' ? 'pm' : 'am';
    const toKey = toSlot === 'pm' ? 'pm' : 'am';
    const weeklyOff = scheduleData.weeklyOff || {};
    const next = {};
    Object.keys(weeklyOff || {}).forEach(k => {
      const { am, pm } = getWeeklyOffBySlot(weeklyOff, k);
      next[k] = { am: [...am], pm: [...pm] };
    });
    const fromSlotData = getWeeklyOffBySlot(weeklyOff, fromDate);
    next[fromDate] = {
      am: fromSlotData.am.filter(id => id !== staffId),
      pm: fromSlotData.pm.filter(id => id !== staffId)
    };
    if (next[fromDate].am.length === 0 && next[fromDate].pm.length === 0) delete next[fromDate];
    const toSlotData = getWeeklyOffBySlot(weeklyOff, toDate);
    if (!next[toDate]) next[toDate] = { am: [...toSlotData.am], pm: [...toSlotData.pm] };
    const arr = next[toDate][toKey];
    if (!arr.includes(staffId)) next[toDate][toKey] = [...arr, staffId];
    scheduleData.weeklyOff = normalizeWeeklyOffForSave(next);
    localStorage.setItem('scheduleData', JSON.stringify(scheduleData));
    setScheduleDataVersion(v => v + 1);
  };

  /** AM列・PM列それぞれで重複している職員のみグレー表示。結合セル（日勤・サポート・夜勤・B・休暇等・未配置）はAM/PM両方にカウント */
  const { duplicateInAMByDate, duplicateInPMByDate } = useMemo(() => {
    const scheduleData = JSON.parse(localStorage.getItem('scheduleData') || '{}');
    const leaveDataRaw = JSON.parse(localStorage.getItem('leaveData') || '{}');
    const schedule = mergeScheduleWithOverrides(scheduleData.schedule || {}, scheduleData.manualOverrides);
    const weeklyOff = scheduleData.weeklyOff || {};
    const leaves = leaveDataRaw.leaveData || {};
    const surgeryDays = scheduleData.surgeryDays || [];
    const amByDate = {};
    const pmByDate = {};
    calendar.forEach((day, idx) => {
      const dateStr = day.date;
      const daySched = schedule[dateStr] || {};
      const nextDay = calendar[idx + 1];
      const bPerson = surgeryDays.includes(dateStr) && nextDay ? (schedule[nextDay?.date]?.nightShift ?? schedule[nextDay?.date]?.nightShiftManual) : (daySched.b ?? daySched.bManual);
      const mergedIds = [
        daySched.dayShift ?? daySched.dayShiftManual,
        daySched.support ?? daySched.supportManual,
        daySched.nightShift ?? daySched.nightShiftManual,
        bPerson,
        daySched.dayOff ?? daySched.dayOffManual,
        ...getWeeklyOffMerged(weeklyOff, dateStr),
        ...(leaves[dateStr] || []).filter(l => l.leaveType === '週休').map(l => l.staffId)
      ].filter(Boolean);
      const dayAlloc = allocation[dateStr] || {};
      const unassigned = dayAlloc._unassigned || [];
      const amList = [...mergedIds, ...unassigned];
      const pmList = [...mergedIds, ...unassigned];
      modalityData.forEach(mod => {
        const slot = dayAlloc[mod.id];
        if (slot && !Array.isArray(slot)) {
          (slot.am || []).forEach(id => amList.push(id));
          (slot.pm || []).forEach(id => pmList.push(id));
        }
      });
      const countAm = {};
      amList.forEach(id => { countAm[id] = (countAm[id] || 0) + 1; });
      const countPm = {};
      pmList.forEach(id => { countPm[id] = (countPm[id] || 0) + 1; });
      amByDate[dateStr] = new Set(Object.keys(countAm).filter(id => countAm[id] > 1));
      pmByDate[dateStr] = new Set(Object.keys(countPm).filter(id => countPm[id] > 1));
    });
    return { duplicateInAMByDate: amByDate, duplicateInPMByDate: pmByDate };
  }, [allocation, calendar, modalityData, scheduleDataVersion]);

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

      {/* 未配置から割り当てるピッカーモーダル */}
      {assignPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setAssignPicker(null)}
          role="presentation"
        >
          <div
            className="bg-white rounded-xl shadow-xl border border-slate-200 max-h-[70vh] w-full max-w-sm flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="未配置の職員を選択"
          >
            <div className="p-3 border-b border-slate-200 bg-stone-50 font-semibold text-stone-800">
              未配置から割り当て（{assignPicker.dateStr} {assignPicker.slot === 'am' ? 'AM' : 'PM'}）
            </div>
            <div className="overflow-y-auto p-2 flex-1">
              {(() => {
                const ids = getAssignableUnassigned(assignPicker.dateStr);
                const name = (id) => staffData.find(s => s.id === id)?.name || id;
                if (ids.length === 0) {
                  return <p className="text-stone-500 text-sm py-2">割り当て可能な未配置職員がいません。</p>;
                }
                return (
                  <ul className="space-y-0.5">
                    {[...ids].sort((a, b) => String(name(a)).localeCompare(String(name(b)), undefined, { numeric: true })).map(id => (
                      <li key={id}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 rounded-lg text-base font-medium text-stone-800 hover:bg-amber-100 focus:bg-amber-100 focus:outline-none"
                          onClick={() => {
                            moveAllocationStaff(assignPicker.dateStr, id, { type: 'unassigned' }, { type: 'modality', modId: assignPicker.modId, slot: assignPicker.slot });
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
              <button
                type="button"
                className="w-full py-2 text-stone-600 hover:text-stone-800 text-sm"
                onClick={() => setAssignPicker(null)}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* マニュアル（配置表作成の機能一覧）モーダル */}
      {manualOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setManualOpen(false)}
          role="presentation"
        >
          <div
            className="bg-white rounded-xl shadow-xl border border-slate-200 max-h-[90vh] w-full max-w-4xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="配置表作成の機能一覧"
          >
            <div className="p-6 border-b border-slate-200 bg-stone-50">
              <h3 className="text-2xl font-bold text-stone-800">配置表作成 — 機能一覧</h3>
            </div>
            <div className="overflow-y-auto p-6 text-stone-700 text-base space-y-5">
              <section>
                <h4 className="font-bold text-stone-800 mb-3 text-lg">基本</h4>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li>「配置表作成」ボタンで、当番表・週休割り当てを元に自動で配置します。</li>
                  <li>表はモダリティ（行）× 日付（列）、各日は AM / PM のセルに分かれています。</li>
                  <li>ヘッダーの「← 戻る」「進む →」でブラウザの履歴を移動できます。</li>
                </ul>
              </section>
              <section>
                <h4 className="font-bold text-stone-800 mb-3 text-lg">ドラッグ＆ドロップ</h4>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li>モダリティのセル内の名前をドラッグして、別のセルや未配置にドロップすると移動できます。</li>
                  <li>AM と PM は独立しており、AM だけ・PM だけを移動できます。</li>
                  <li>休暇等行の「週休」のみ、別の平日にドラッグして週休を移動できます（週休割り当て結果に反映）。</li>
                </ul>
              </section>
              <section>
                <h4 className="font-bold text-stone-800 mb-3 text-lg">未配置から割り当て</h4>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li>モダリティのセル内の<strong>空白部分</strong>をクリックすると、未配置の職員リストからそのセル（AM または PM）に割り当てられます。</li>
                  <li>当番表に載っている職員は未配置には表示されず、未配置セルへドロップしても移動しません。</li>
                </ul>
              </section>
              <section>
                <h4 className="font-bold text-stone-800 mb-3 text-lg">表示の補足</h4>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li>手動で変更した職員は<strong>赤字</strong>で表示されます。</li>
                  <li>同一日の中で同じ職員が 2 回以上登場する場合は<strong>グレー背景</strong>で表示されます。</li>
                  <li>休暇等は種類ごとに 1 行 1 名で「種類：名前」の形式で表示されます。</li>
                </ul>
              </section>
              <section>
                <h4 className="font-bold text-stone-800 mb-3 text-lg">週休割り当て結果</h4>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li>表の下に、当番表ベースの週休割り当て結果（職員 × 日付）が表示されます。</li>
                  <li>週休セルをドラッグして別の平日にドロップすると、週休の移動が反映されます。</li>
                </ul>
              </section>
            </div>
            <div className="p-4 border-t border-slate-200">
              <button
                type="button"
                className="w-full py-3 rounded-lg text-lg font-semibold bg-stone-200 hover:bg-stone-300 text-stone-800"
                onClick={() => setManualOpen(false)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-full mx-auto relative px-4">
        <div className="flex justify-between items-center gap-4 mb-4">
          <h2 className="text-3xl font-bold text-stone-800">配置表作成</h2>
          <div className="flex flex-col gap-2 items-end">
            <button onClick={onBack} className="btn-header">
              ← メインメニュー
            </button>
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="btn-header"
            >
              マニュアル
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
            <button onClick={autoAllocate} disabled={isAutoAllocating || calendar.length === 0} className="min-h-[56px] px-10 py-4 rounded-2xl text-xl font-bold bg-blue-600 hover:bg-blue-500 disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed text-white shadow-lg transition-all">
              {isAutoAllocating ? '配置中...' : '配置表作成'}
            </button>
            <div className="flex flex-col gap-2 shrink-0 ml-8">
              <button type="button" onClick={() => window.history.back()} className="px-4 py-2.5 rounded-xl text-base font-semibold bg-stone-100 hover:bg-stone-200 border-2 border-stone-400 text-stone-800 transition-all whitespace-nowrap" title="ひとつ前に戻る">
                ← 戻る
              </button>
              <button type="button" onClick={() => window.history.forward()} className="px-4 py-2.5 rounded-xl text-base font-semibold bg-stone-100 hover:bg-stone-200 border-2 border-stone-400 text-stone-800 transition-all whitespace-nowrap" title="進む">
                進む →
              </button>
            </div>
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
            <h3 className="font-bold mb-4 text-stone-800 text-xl">📊 配置表</h3>
            <div className="overflow-x-auto">
              <table className="border-collapse text-sm min-w-full">
                <thead>
                  <tr className="bg-stone-100 border-b-2 border-slate-400">
                    <th className="border border-slate-300 p-2 sticky left-0 bg-stone-100 z-20 min-w-[150px] text-stone-800 font-bold">モダリティ</th>
                    {calendar.map(day => {
                      const dow = day.dayOfWeekNum ?? new Date(day.date + 'T12:00:00').getDay();
                      const isSunOrHoliday = dow === 0 || day.isHoliday;
                      const isSat = dow === 6;
                      const dateColor = isSunOrHoliday ? 'text-red-600' : isSat ? 'text-blue-600' : 'text-stone-800';
                      const weekdayColor = isSunOrHoliday ? 'text-red-600' : isSat ? 'text-blue-600' : 'text-stone-600';
                      return (
                      <th key={day.date} colSpan={2} className={`border border-slate-300 border-l-2 border-l-slate-600 p-1 min-w-[120px] text-center ${day.isWeekend || day.isHoliday ? 'bg-slate-100' : ''}`}>
                        <div className={`font-semibold ${dateColor}`}>{day.date.slice(5).replace('-', '/')}</div>
                        <div className={`text-xs ${weekdayColor}`}>{day.dayOfWeek}</div>
                      </th>
                    ); })}
                  </tr>
                    <tr className="bg-stone-50 border-b border-slate-300">
                    <th className="border border-slate-300 p-1 sticky left-0 bg-stone-50 z-20" />
                    {calendar.map(day => (
                      <React.Fragment key={day.date}>
                        <th className="border border-slate-300 border-l-2 border-l-slate-600 p-1.5 min-w-[6.5rem] text-sm font-semibold text-stone-600 bg-amber-50/80">AM</th>
                        <th className="border border-slate-300 p-1.5 min-w-[6.5rem] text-sm font-semibold text-stone-600 bg-sky-50/80">PM</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modalityData.map(mod => {
                    const slotDataByDate = calendar.map(day => {
                      const slot = allocation[day.date]?.[mod.id];
                      const am = Array.isArray(slot) ? slot : (slot?.am || []);
                      const pm = Array.isArray(slot) ? [] : (slot?.pm || []);
                      return { am, pm };
                    });
                    const maxLines = Math.max(1, ...slotDataByDate.flatMap(s => Math.max(s.am.length, s.pm.length)));
                    const rowMinHeight = `${Math.max(2, maxLines) * 1.75}rem`;
                    return (
                      <React.Fragment key={mod.id}>
                        <tr className="hover:bg-slate-50/50 transition-all" style={{ minHeight: rowMinHeight }}>
                          <td className="border border-slate-300 p-2 sticky left-0 bg-slate-50 z-10 font-semibold text-stone-800 align-top">
                            {mod.name}
                          </td>
                          {calendar.map(day => {
                            const dateStr = day.date;
                            const slot = allocation[dateStr]?.[mod.id];
                            const am = Array.isArray(slot) ? slot : (slot?.am || []);
                            const pm = Array.isArray(slot) ? [] : (slot?.pm || []);
                            const name = (id) => staffData.find(s => s.id === id)?.name || id;
                            const isWeekend = day.isWeekend || day.isHoliday;
                            const manualStaff = allocation[dateStr]?._manualStaff || [];
                            const { requiredAm, requiredPm } = getRequiredForModality(mod, dateStr);
                            const isShortAm = !isWeekend && am.length < requiredAm;
                            const isShortPm = !isWeekend && pm.length < requiredPm;
                            const cellBgAm = isShortAm ? 'bg-stone-300' : isWeekend ? 'bg-slate-50' : 'bg-amber-50/30';
                            const cellBgPm = isShortPm ? 'bg-stone-300' : isWeekend ? 'bg-slate-50' : 'bg-sky-50/30';
                            const handleDropAm = (e) => {
                              e.preventDefault();
                              const raw = e.dataTransfer.getData('text/plain');
                              if (!raw) return;
                              try {
                                const data = JSON.parse(raw);
                                if (data.type !== 'allocation-staff' || data.dateStr !== dateStr) return;
                                const to = { type: 'modality', modId: mod.id, slot: 'am' };
                                if (data.fromSource.type === to.type && data.fromSource.modId === to.modId && data.fromSource.slot === to.slot) return;
                                moveAllocationStaff(dateStr, data.staffId, data.fromSource, to);
                              } catch (_) {}
                            };
                            const handleDropPm = (e) => {
                              e.preventDefault();
                              const raw = e.dataTransfer.getData('text/plain');
                              if (!raw) return;
                              try {
                                const data = JSON.parse(raw);
                                if (data.type !== 'allocation-staff' || data.dateStr !== dateStr) return;
                                const to = { type: 'modality', modId: mod.id, slot: 'pm' };
                                if (data.fromSource.type === to.type && data.fromSource.modId === to.modId && data.fromSource.slot === to.slot) return;
                                moveAllocationStaff(dateStr, data.staffId, data.fromSource, to);
                              } catch (_) {}
                            };
                            return (
                              <React.Fragment key={day.date}>
                                <td
                                  className={`border border-slate-300 border-l-2 border-l-slate-600 p-2 min-w-[6.5rem] align-top text-sm ${cellBgAm}`}
                                  onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes('text/plain')) e.dataTransfer.dropEffect = 'move'; }}
                                  onDrop={handleDropAm}
                                >
                                  <div className="flex flex-col gap-1 min-h-[2.5rem]">
                                    {am.length ? [...am].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })).map(id => (
                                      <span
                                        key={id}
                                        draggable
                                        className={`text-base font-medium cursor-grab active:cursor-grabbing ${duplicateInAMByDate[dateStr]?.has(id) ? 'bg-stone-300 text-stone-900 px-0.5 rounded' : manualStaff.includes(id) ? 'text-red-600' : 'text-stone-800'}`}
                                        onDragStart={(e) => {
                                          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'allocation-staff', dateStr, staffId: id, fromSource: { type: 'modality', modId: mod.id, slot: 'am' } }));
                                          e.dataTransfer.effectAllowed = 'move';
                                        }}
                                      >
                                        {name(id)}
                                      </span>
                                    )) : (
                                      <span
                                        role="button"
                                        tabIndex={0}
                                        className="text-stone-400 hover:text-stone-600 cursor-pointer select-none"
                                        onClick={() => setAssignPicker({ dateStr, modId: mod.id, slot: 'am' })}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAssignPicker({ dateStr, modId: mod.id, slot: 'am' }); } }}
                                      >
                                        －
                                      </span>
                                    )}
                                    <span
                                      className="block min-h-[2rem] flex-1 cursor-pointer"
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => setAssignPicker({ dateStr, modId: mod.id, slot: 'am' })}
                                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAssignPicker({ dateStr, modId: mod.id, slot: 'am' }); } }}
                                      aria-label="未配置から割り当て"
                                    />
                                  </div>
                                </td>
                                <td
                                  className={`border border-slate-300 p-2 min-w-[6.5rem] align-top text-sm ${cellBgPm}`}
                                  onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes('text/plain')) e.dataTransfer.dropEffect = 'move'; }}
                                  onDrop={handleDropPm}
                                >
                                  <div className="flex flex-col gap-1 min-h-[2.5rem]">
                                    {pm.length ? [...pm].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })).map(id => (
                                      <span
                                        key={id}
                                        draggable
                                        className={`text-base font-medium cursor-grab active:cursor-grabbing ${duplicateInPMByDate[dateStr]?.has(id) ? 'bg-stone-300 text-stone-900 px-0.5 rounded' : manualStaff.includes(id) ? 'text-red-600' : 'text-stone-800'}`}
                                        onDragStart={(e) => {
                                          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'allocation-staff', dateStr, staffId: id, fromSource: { type: 'modality', modId: mod.id, slot: 'pm' } }));
                                          e.dataTransfer.effectAllowed = 'move';
                                        }}
                                      >
                                        {name(id)}
                                      </span>
                                    )) : (
                                      <span
                                        role="button"
                                        tabIndex={0}
                                        className="text-stone-400 hover:text-stone-600 cursor-pointer select-none"
                                        onClick={() => setAssignPicker({ dateStr, modId: mod.id, slot: 'pm' })}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAssignPicker({ dateStr, modId: mod.id, slot: 'pm' }); } }}
                                      >
                                        －
                                      </span>
                                    )}
                                    <span
                                      className="block min-h-[2rem] flex-1 cursor-pointer"
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => setAssignPicker({ dateStr, modId: mod.id, slot: 'pm' })}
                                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAssignPicker({ dateStr, modId: mod.id, slot: 'pm' }); } }}
                                      aria-label="未配置から割り当て"
                                    />
                                  </div>
                                </td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      </React.Fragment>
                    );
                  })}
                  {(() => {
                    const scheduleData = JSON.parse(localStorage.getItem('scheduleData') || '{}');
                    const leaveDataRaw = JSON.parse(localStorage.getItem('leaveData') || '{}');
                    const schedule = mergeScheduleWithOverrides(scheduleData.schedule || {}, scheduleData.manualOverrides);
                    const weeklyOff = scheduleData.weeklyOff || {};
                    const surgeryDays = scheduleData.surgeryDays || [];
                    const leaves = leaveDataRaw.leaveData || {};
                    const name = (id) => (id ? (staffData.find(s => s.id === id)?.name || id) : '');
                    const scheduleRows = [
                      { key: 'dayShift', label: '日勤者', getVal: (d) => (schedule[d.date]?.dayShift ?? schedule[d.date]?.dayShiftManual) || null },
                      { key: 'support', label: 'サポート', getVal: (d) => (schedule[d.date]?.support ?? schedule[d.date]?.supportManual) || null },
                      { key: 'nightShift', label: '夜勤者', getVal: (d) => (schedule[d.date]?.nightShift ?? schedule[d.date]?.nightShiftManual) || null },
                      { key: 'b', label: 'B', getVal: (d) => {
                        const idx = calendar.findIndex(x => x.date === d.date);
                        const nextDay = calendar[idx + 1];
                        const bPerson = surgeryDays.includes(d.date) && nextDay
                          ? (schedule[nextDay.date]?.nightShift ?? schedule[nextDay.date]?.nightShiftManual)
                          : (schedule[d.date]?.b ?? schedule[d.date]?.bManual);
                        return bPerson || null;
                      } },
                    ];
                    const leaveLabels = ['非番', '出張', '週休', 'リフ休', '年休', '特別休'];
                    const getLeaveLine = (day, type) => {
                      if (type === '非番') {
                        const id = schedule[day.date]?.dayOff ?? schedule[day.date]?.dayOffManual;
                        return id ? name(id) : null;
                      }
                      if (type === '週休') {
                        const woIds = getWeeklyOffMerged(weeklyOff, day.date);
                        const fromLeave = (leaves[day.date] || []).filter(l => l.leaveType === '週休').map(l => l.staffId);
                        const ids = [...new Set([...woIds, ...fromLeave])];
                        return ids.length ? ids.map(name).join('、') : null;
                      }
                      const dayLeaves = leaves[day.date] || [];
                      const byType = dayLeaves.filter(l => l.leaveType === type).map(l => name(l.staffId));
                      return byType.length ? byType.join('、') : null;
                    };
                    const handleDropWeeklyOff = (toDate, toSlot, e) => {
                      e.preventDefault();
                      const raw = e.dataTransfer.getData('text/plain');
                      if (!raw) return;
                      try {
                        const data = JSON.parse(raw);
                        if (data.type === 'weeklyOff' && data.dateStr !== toDate && data.slot != null) moveWeeklyOffAllocation(data.staffId, data.dateStr, toDate, data.slot, toSlot);
                      } catch (_) {}
                    };
                    return (
                      <>
                        {scheduleRows.map(({ key, label, getVal }) => (
                          <tr key={key} className="bg-slate-100/50 hover:bg-slate-100 transition-all">
                            <td className="border border-slate-300 p-2 sticky left-0 bg-slate-100 z-10 font-semibold text-stone-700 align-middle">
                              {label}
                            </td>
                            {calendar.map(day => {
                              const staffId = getVal(day);
                              const isWeekend = day.isWeekend || day.isHoliday;
                              const isDup = staffId && (duplicateInAMByDate[day.date]?.has(staffId) || duplicateInPMByDate[day.date]?.has(staffId));
                              return (
                                <td
                                  key={day.date}
                                  colSpan={2}
                                  className={`border border-slate-300 border-l-2 border-l-slate-600 p-2 min-w-[11rem] text-left align-middle text-base ${isWeekend ? 'bg-slate-50' : 'bg-white'}`}
                                >
                                  {staffId ? <span className={`font-medium ${isDup ? 'bg-stone-300 text-stone-900 px-1 rounded' : 'text-stone-800'}`}>{name(staffId)}</span> : <span className="text-stone-400">－</span>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        <tr className="bg-amber-50/50 hover:bg-amber-50 transition-all">
                          <td className="border border-slate-300 p-2 sticky left-0 bg-amber-100/80 z-10 font-semibold text-stone-700 align-top">
                            休暇等
                          </td>
                          {calendar.map(day => {
                            const dateStr = day.date;
                            const isWeekend = day.isWeekend || day.isHoliday;
                            const woAm = getWeeklyOffBySlot(weeklyOff, dateStr).am;
                            const woPm = getWeeklyOffBySlot(weeklyOff, dateStr).pm;
                            const leave週休Ids = (leaves[dateStr] || []).filter(l => l.leaveType === '週休').map(l => l.staffId);
                            const baseClass = `border border-slate-300 border-l-2 border-l-slate-600 p-2 min-w-[8rem] text-left align-top text-base whitespace-pre-line ${isWeekend ? 'bg-slate-50' : 'bg-white'}`;
                            const dropProps = {
                              onDragOver: (e) => { e.preventDefault(); if (e.dataTransfer.types.includes('text/plain')) e.dataTransfer.dropEffect = 'move'; },
                              onDrop: (e) => handleDropWeeklyOff(dateStr, 'am', e)
                            };
                            const leaveEntries = [];
                            leaveLabels.forEach(type => {
                              if (type === '非番') {
                                const id = schedule[dateStr]?.dayOff ?? schedule[dateStr]?.dayOffManual;
                                if (id) leaveEntries.push({ type, name: name(id) });
                              } else if (type === '週休') {
                                [...new Set([...woAm, ...woPm, ...leave週休Ids])].forEach(id => {
                                  const inAm = woAm.includes(id);
                                  const inPm = woPm.includes(id);
                                  const isFromWeeklyOff = inAm || inPm;
                                  leaveEntries.push({ type: '週休', name: name(id), id, isFromWeeklyOff, slot: inAm ? 'am' : 'pm' });
                                });
                              } else {
                                (leaves[dateStr] || []).filter(l => l.leaveType === type).forEach(l => leaveEntries.push({ type, name: name(l.staffId) }));
                              }
                            });
                            const content = leaveEntries.length > 0 ? (
                              leaveEntries.map((entry, i) => {
                                if (entry.type === '週休' && entry.id != null) {
                                  const isDup = (duplicateInAMByDate[dateStr]?.has(entry.id) || duplicateInPMByDate[dateStr]?.has(entry.id));
                                  return (
                                    <span key={i} className="block font-medium">
                                      <span
                                        draggable={entry.isFromWeeklyOff}
                                        className={`${entry.isFromWeeklyOff ? 'cursor-grab active:cursor-grabbing' : ''} ${isDup ? 'bg-stone-300 text-stone-900 px-1 rounded' : 'text-stone-800'}`}
                                        onDragStart={entry.isFromWeeklyOff ? (e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'weeklyOff', staffId: entry.id, dateStr, slot: entry.slot })); e.dataTransfer.effectAllowed = 'move'; } : undefined}
                                      >
                                        {entry.type}：{entry.name}
                                      </span>
                                    </span>
                                  );
                                }
                                return (<span key={i} className="block font-medium text-stone-800">{entry.type}：{entry.name}</span>);
                              })
                            ) : <span className="text-stone-400">－</span>;
                            return (
                              <td key={day.date} colSpan={2} className={baseClass} {...dropProps}>{content}</td>
                            );
                          })}
                        </tr>
                        <tr className="bg-rose-50/50 hover:bg-rose-50 transition-all">
                          <td className="border border-slate-300 p-2 sticky left-0 bg-rose-100/80 z-10 font-semibold text-stone-700 align-top">
                            未配置
                          </td>
                          {calendar.map(day => {
                            const dateStr = day.date;
                            const isWeekend = day.isWeekend || day.isHoliday;
                            const rawIds = allocation[dateStr]?._unassigned || [];
                            const idx = calendar.findIndex(d => d.date === dateStr);
                            const nextDay = calendar[idx + 1];
                            const daySched = schedule[dateStr] || {};
                            const bPerson = surgeryDays.includes(dateStr) && nextDay ? (schedule[nextDay?.date]?.nightShift ?? schedule[nextDay?.date]?.nightShiftManual) : (daySched.b ?? daySched.bManual);
                            /** 当番表に記載した職員は未配置に載せない */
                            const scheduleStaffThisDay = new Set([
                              daySched.dayShift ?? daySched.dayShiftManual,
                              daySched.support ?? daySched.supportManual,
                              daySched.nightShift ?? daySched.nightShiftManual,
                              bPerson,
                              daySched.dayOff ?? daySched.dayOffManual,
                              ...getWeeklyOffMerged(weeklyOff, dateStr),
                              ...(leaves[dateStr] || []).map(l => l.staffId)
                            ].filter(Boolean));
                            const ids = rawIds.filter(id => !scheduleStaffThisDay.has(id));
                            const manualStaff = allocation[dateStr]?._manualStaff || [];
                            const name = (id) => (id ? (staffData.find(s => s.id === id)?.name || id) : '');
                            const handleDropUnassigned = (e) => {
                              e.preventDefault();
                              const raw = e.dataTransfer.getData('text/plain');
                              if (!raw) return;
                              try {
                                const data = JSON.parse(raw);
                                if (data.type !== 'allocation-staff' || data.dateStr !== dateStr) return;
                                if (scheduleStaffThisDay.has(data.staffId)) return;
                                const to = { type: 'unassigned' };
                                if (data.fromSource.type === 'unassigned') return;
                                moveAllocationStaff(dateStr, data.staffId, data.fromSource, to);
                              } catch (_) {}
                            };
                            const cellClassBase = `border border-slate-300 p-2 min-w-[6.5rem] text-left align-top text-base ${isWeekend ? 'bg-slate-50' : ''}`;
                            const renderUnassignedList = () => (
                              ids.length ? [...ids].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })).map(id => (
                                <span
                                  key={id}
                                  draggable
                                  className={`block text-base font-medium cursor-grab active:cursor-grabbing ${(duplicateInAMByDate[dateStr]?.has(id) || duplicateInPMByDate[dateStr]?.has(id)) ? 'bg-stone-300 text-stone-900 px-0.5 rounded' : manualStaff.includes(id) ? 'text-red-600' : 'text-stone-800'}`}
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'allocation-staff', dateStr, staffId: id, fromSource: { type: 'unassigned' } }));
                                    e.dataTransfer.effectAllowed = 'move';
                                  }}
                                >
                                  {name(id)}
                                </span>
                              )) : <span className="text-stone-400">－</span>
                            );
                            return (
                              <React.Fragment key={day.date}>
                                <td
                                  className={`${cellClassBase} border-l-2 border-l-slate-600 ${!isWeekend ? 'bg-amber-50/30' : ''}`}
                                  onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes('text/plain')) e.dataTransfer.dropEffect = 'move'; }}
                                  onDrop={handleDropUnassigned}
                                >
                                  <div className="flex flex-col gap-1 min-h-[2.5rem]">{renderUnassignedList()}</div>
                                </td>
                                <td
                                  className={`${cellClassBase} ${!isWeekend ? 'bg-sky-50/30' : ''}`}
                                  onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes('text/plain')) e.dataTransfer.dropEffect = 'move'; }}
                                  onDrop={handleDropUnassigned}
                                >
                                  <div className="flex flex-col gap-1 min-h-[2.5rem]">{renderUnassignedList()}</div>
                                </td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            {/* 週休割り当て結果（当番表のデータを参照。週休セルはD&Dで移動可能） */}
            <h3 className="font-bold mb-3 text-stone-800 text-xl mt-8">📋 週休割り当て結果</h3>
            <p className="text-sm text-stone-600 mb-2">縦＝職員（夜勤順番リスト順）、横＝日付。A＝日勤、S＝サポート、16＝夜勤、B＝青、非番＝オレンジ、黄色＝週休または土日祝で勤務なし。週休のセルをドラッグして別の平日にドロップすると週休を移動できます。</p>
            <div className="overflow-x-auto border border-slate-400 rounded-xl" key={scheduleDataVersion}>
              {(() => {
                const scheduleData = JSON.parse(localStorage.getItem('scheduleData') || '{}');
                const sched = mergeScheduleWithOverrides(scheduleData.schedule || {}, scheduleData.manualOverrides);
                const weeklyOffDisplay = scheduleData.weeklyOff || {};
                const nightShiftOrder = scheduleData.nightShiftOrder || [];
                const surgeryDays = scheduleData.surgeryDays || [];
                /** 週休割り当て結果用：日付ごとにその日の中で2回以上登場する職員（当番表の日勤・夜勤・週休等のみで判定） */
                const duplicateInDayForSchedule = (() => {
                  const byDate = {};
                  calendar.forEach((day, idx) => {
                    const dateStr = day.date;
                    const count = {};
                    const add = (id) => { if (id) count[id] = (count[id] || 0) + 1; };
                    const daySched = sched[dateStr] || {};
                    const nextDay = calendar[idx + 1];
                    const prevDay = calendar[idx - 1];
                    const bPerson = surgeryDays.includes(dateStr) && nextDay ? (sched[nextDay?.date]?.nightShift ?? sched[nextDay?.date]?.nightShiftManual) : (daySched.b ?? daySched.bManual);
                    const dayOffPerson = prevDay ? (sched[prevDay.date]?.nightShift ?? sched[prevDay.date]?.nightShiftManual) : (daySched.dayOff ?? daySched.dayOffManual);
                    add(daySched.dayShift ?? daySched.dayShiftManual);
                    add(daySched.support ?? daySched.supportManual);
                    add(daySched.nightShift ?? daySched.nightShiftManual);
                    add(bPerson);
                    add(dayOffPerson);
                    getWeeklyOffMerged(weeklyOffDisplay, dateStr).forEach(add);
                    byDate[dateStr] = new Set(Object.keys(count).filter(id => count[id] > 1));
                  });
                  return byDate;
                })();
                return (
                  <table className="w-full border-collapse text-sm table-fixed" style={{ minWidth: `${calendar.length * 2.5 + 9}rem` }}>
                    <colgroup><col style={{ width: '9rem', minWidth: '9rem' }} /></colgroup>
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
                          const daySchedule = sched[dateStr] || {};
                          const nextDay = calendar[idx + 1];
                          const bPerson = surgeryDays.includes(dateStr) && nextDay ? (sched[nextDay.date]?.nightShift ?? sched[nextDay.date]?.nightShiftManual) : (daySchedule.b ?? daySchedule.bManual);
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
                            <td className="sticky left-0 z-10 w-[9rem] min-w-[9rem] px-2 py-1 text-stone-800 font-medium bg-slate-50 border-r border-slate-400 whitespace-nowrap">{staff.name} <span className="text-stone-500 font-normal">({weeklyOffDays})</span></td>
                            {calendar.map((day, idx) => {
                              const dateStr = day.date;
                              const daySchedule = sched[dateStr] || {};
                              const nextDay = calendar[idx + 1];
                              const prevDay = calendar[idx - 1];
                              const bPerson = surgeryDays.includes(dateStr) && nextDay ? (sched[nextDay.date]?.nightShift) : (daySchedule.b);
                              const dayOffPerson = prevDay ? (sched[prevDay.date]?.nightShift) : null;
                              const isHoliday = getHolidays(parseInt(day.date.slice(0, 4), 10)).has(day.date);
                              const isWeekendOrHoliday = day.isWeekend || isHoliday;
                              const woSlot = getWeeklyOffBySlot(weeklyOffDisplay, dateStr);
                              const isWeeklyOff = woSlot.am.includes(staffId) || woSlot.pm.includes(staffId);
                              const fromSlot = woSlot.am.includes(staffId) ? 'am' : 'pm';
                              let label = '';
                              let cellClass = 'px-0.5 py-1 text-center border-r border-slate-200';
                              const isDupThisDay = duplicateInDayForSchedule[dateStr]?.has(staffId);
                              if (daySchedule.dayShift === staffId) { label = 'A'; cellClass += isDupThisDay ? ' bg-stone-300 text-stone-900' : ' bg-emerald-100 text-stone-800'; }
                              else if (daySchedule.support === staffId) { label = 'S'; cellClass += isDupThisDay ? ' bg-stone-300 text-stone-900' : ' bg-emerald-50 text-stone-700'; }
                              else if (daySchedule.nightShift === staffId) { label = '16'; cellClass += isDupThisDay ? ' bg-stone-300 text-stone-900' : ' bg-rose-800 text-white'; }
                              else if (bPerson === staffId) { label = 'B'; cellClass += isDupThisDay ? ' bg-stone-300 text-stone-900' : ' bg-blue-600 text-white'; }
                              else if (dayOffPerson === staffId) { label = '非番'; cellClass += isDupThisDay ? ' bg-stone-300 text-stone-900' : ' bg-orange-400 text-white'; }
                              else if (isWeeklyOff) { label = '週休'; cellClass += isDupThisDay ? ' bg-stone-300 text-stone-900' : ' bg-yellow-300 text-stone-800'; }
                              else if (isWeekendOrHoliday) { cellClass += ' bg-yellow-300 text-stone-800'; }
                              const handleDrop = (e) => {
                                e.preventDefault();
                                const raw = e.dataTransfer.getData('text/plain');
                                if (!raw) return;
                                try {
                                  const data = JSON.parse(raw);
                                  if (data.type === 'weeklyOff' && data.dateStr !== dateStr && data.slot != null) moveWeeklyOffAllocation(data.staffId, data.dateStr, dateStr, data.slot, 'am');
                                } catch (_) {}
                              };
                              return (
                                <td
                                  key={dateStr}
                                  className={cellClass + (isWeeklyOff ? ' cursor-grab active:cursor-grabbing' : '')}
                                  draggable={isWeeklyOff}
                                  onDragStart={isWeeklyOff ? (e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'weeklyOff', staffId, dateStr, slot: fromSlot })); e.dataTransfer.effectAllowed = 'move'; } : undefined}
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
                );
              })()}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
