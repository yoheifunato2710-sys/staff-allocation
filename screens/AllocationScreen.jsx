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

const MAX_WEEKLY_OFF_UNDO = 50;
const MAX_ALLOCATION_UNDO = 50;
/** 週休自動割当：同じ日にこの人数を超えて週休を入れない（3人以上入らない＝最大2人） */
const MAX_WEEKLY_OFF_PER_DAY = 2;

/** 救命(日勤)モダリティの id。なければ undefined */
function getKyukouModId(modalityData) {
  const mod = modalityData?.find(m => m.name === '救命(日勤)' || (m.name && m.name.includes('救命')));
  return mod?.id;
}

/** パートのAM/PM指定に対応。その時間帯に配置可能な職員か（未配置リストに載せるかどうかの判定用） */
function canWorkAm(staff) {
  if (!staff) return false;
  return !staff.isPartTime || staff.partTimeSlot === 'am_pm' || staff.partTimeSlot === 'am';
}
function canWorkPm(staff) {
  if (!staff) return false;
  return !staff.isPartTime || staff.partTimeSlot === 'am_pm' || staff.partTimeSlot === 'pm';
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

const sortById = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });

/** AM/PMのリストを「同じ職員は左右同じ行」に揃えた行リストに変換。ID順で並べる。空白行あり可。 */
function getAlignedAmPmRows(amIds, pmIds) {
  const am = amIds || [];
  const pm = pmIds || [];
  const pmSet = new Set(pm);
  const amSet = new Set(am);
  const both = am.filter(id => pmSet.has(id)).sort(sortById);
  const amOnly = am.filter(id => !pmSet.has(id)).sort(sortById);
  const pmOnly = pm.filter(id => !amSet.has(id)).sort(sortById);
  const rows = [];
  both.forEach(id => rows.push({ am: id, pm: id }));
  amOnly.forEach(id => rows.push({ am: id, pm: null }));
  pmOnly.forEach(id => rows.push({ am: null, pm: id }));
  return rows;
}

/** スコア降順、同率の場合はランダム */
function sortByScoreRandom(a, b) {
  const d = (b.score ?? 0) - (a.score ?? 0);
  if (d !== 0) return d;
  return Math.random() - 0.5;
}

/** 不足セル数（必要人数に満たないAM/PMの合計）を返す。トレーニング（スコア5）は必要人数に含めない */
function countShortage(allocation, weekdays, modalityData, staffData) {
  let total = 0;
  for (const day of weekdays) {
    const dateStr = day.date;
    for (const mod of modalityData) {
      const slot = allocation[dateStr]?.[mod.id];
      if (!slot || Array.isArray(slot)) continue;
      const { requiredAm, requiredPm } = getRequiredForModality(mod, dateStr);
      const am = slot.am || [];
      const pm = slot.pm || [];
      const nonTrainingAm = am.filter(id => (staffData?.find(s => s.id === id)?.scores?.[mod.id] ?? 0) !== 5).length;
      const nonTrainingPm = pm.filter(id => (staffData?.find(s => s.id === id)?.scores?.[mod.id] ?? 0) !== 5).length;
      total += Math.max(0, requiredAm - nonTrainingAm) + Math.max(0, requiredPm - nonTrainingPm);
    }
  }
  return total;
}

/** その日の利用不可・未配置・不足を再計算する共通ブロック */
function syncDayUnassignedAndShortage(newAllocation, dateStr, unavailableAtStart, modalityData, staffData) {
  const assignedAm = new Set();
  const assignedPm = new Set();
  modalityData.forEach(mod => {
    const s = newAllocation[dateStr][mod.id];
    if (s && !Array.isArray(s)) { (s.am || []).forEach(id => assignedAm.add(id)); (s.pm || []).forEach(id => assignedPm.add(id)); }
  });
  const computedUnassignedAm = staffData.filter(s => !unavailableAtStart.has(s.id) && !assignedAm.has(s.id) && canWorkAm(s)).map(s => s.id);
  const computedUnassignedPm = staffData.filter(s => !unavailableAtStart.has(s.id) && !assignedPm.has(s.id) && canWorkPm(s)).map(s => s.id);
  const prevAm = new Set(newAllocation[dateStr]._unassignedAm || []);
  const prevPm = new Set(newAllocation[dateStr]._unassignedPm || []);
  const getStaff = (id) => staffData.find(s => s.id === id);
  const wasAm = [...prevAm].filter(id => !assignedAm.has(id) && !unavailableAtStart.has(id) && canWorkAm(getStaff(id)));
  const wasPm = [...prevPm].filter(id => !assignedPm.has(id) && !unavailableAtStart.has(id) && canWorkPm(getStaff(id)));
  const displacedPreserved = (newAllocation[dateStr]._displacedFromKyukou || []).filter(id => !assignedPm.has(id) && !unavailableAtStart.has(id));
  newAllocation[dateStr]._unassignedAm = [...new Set([...computedUnassignedAm, ...wasAm])];
  newAllocation[dateStr]._unassignedPm = [...new Set([...computedUnassignedPm, ...wasPm, ...displacedPreserved])];
  newAllocation[dateStr]._unassigned = [...new Set([...newAllocation[dateStr]._unassignedAm, ...newAllocation[dateStr]._unassignedPm])];
  const stillShort = modalityData.some(mod => {
    const s = newAllocation[dateStr][mod.id];
    if (!s || Array.isArray(s)) return false;
    const { requiredAm, requiredPm } = getRequiredForModality(mod, dateStr);
    const ntAm = (s.am || []).filter(id => (staffData.find(x => x.id === id)?.scores?.[mod.id] ?? 0) !== 5).length;
    const ntPm = (s.pm || []).filter(id => (staffData.find(x => x.id === id)?.scores?.[mod.id] ?? 0) !== 5).length;
    return ntAm < requiredAm || ntPm < requiredPm;
  });
  newAllocation[dateStr]._shortage = stillShort;
}

function buildUnavailableForDay(dateStr, weekdays, schedule, weeklyOff, leaves, surgeryDays) {
  const unavailableAtStart = new Set();
  const daySched = schedule[dateStr] || {};
  const nextDay = weekdays[weekdays.findIndex(d => d.date === dateStr) + 1];
  const bPerson = surgeryDays.includes(dateStr) && nextDay
    ? (schedule[nextDay.date]?.nightShift ?? schedule[nextDay.date]?.nightShiftManual)
    : (daySched.b ?? daySched.bManual);
  const nightShiftPerson = daySched.nightShift ?? daySched.nightShiftManual;
  const dayShiftPerson = daySched.dayShift ?? daySched.dayShiftManual;
  const supportPerson = daySched.support ?? daySched.supportManual;
  const dayOffPerson = daySched.dayOff ?? daySched.dayOffManual;
  if (nightShiftPerson) unavailableAtStart.add(nightShiftPerson);
  if (dayShiftPerson) unavailableAtStart.add(dayShiftPerson);
  if (supportPerson) unavailableAtStart.add(supportPerson);
  if (bPerson) unavailableAtStart.add(bPerson);
  if (dayOffPerson) unavailableAtStart.add(dayOffPerson);
  getWeeklyOffMerged(weeklyOff, dateStr).forEach(id => unavailableAtStart.add(id));
  if (leaves[dateStr]) leaves[dateStr].forEach(l => unavailableAtStart.add(l.staffId));
  return unavailableAtStart;
}

/** ① 未配置から不足箇所へ（スコア参照）。1件でも埋めたら true。 */
function step1FillFromUnassigned(newAllocation, weekdays, modalityData, staffData, schedule, weeklyOff, leaves, surgeryDays = []) {
  let filled = false;
  const maxRounds = 100;
  for (let round = 0; round < maxRounds; round++) {
    let anyFill = false;
    for (const day of weekdays) {
      const dateStr = day.date;
      if (!newAllocation[dateStr]?._shortage) continue;
      const unavailableAtStart = buildUnavailableForDay(dateStr, weekdays, schedule, weeklyOff, leaves, surgeryDays);
      const unassignedAm = new Set((newAllocation[dateStr]._unassignedAm || []).filter(id => !unavailableAtStart.has(id)));
      const unassignedPm = new Set((newAllocation[dateStr]._unassignedPm || []).filter(id => !unavailableAtStart.has(id)));
      for (const mod of modalityData) {
        const modId = mod.id;
        const slot = newAllocation[dateStr][modId];
        if (!slot || Array.isArray(slot)) continue;
        const { requiredAm, requiredPm } = getRequiredForModality(mod, dateStr);
        const amIds = slot.am || [];
        const pmIds = slot.pm || [];
        const score = (id) => staffData.find(s => s.id === id)?.scores?.[modId] ?? 0;
        const nonTrainingAm = amIds.filter(id => score(id) !== 5).length;
        const nonTrainingPm = pmIds.filter(id => score(id) !== 5).length;
        let needAm = Math.max(0, requiredAm - nonTrainingAm);
        let needPm = Math.max(0, requiredPm - nonTrainingPm);
        if (needAm === 0 && needPm === 0) continue;
        const candidatesAm = [...unassignedAm].filter(id => { const s = score(id); return s >= 1 && s <= 4; }).map(id => ({ id, score: score(id) })).sort(sortByScoreRandom);
        for (const { id } of candidatesAm) {
          if (needAm <= 0) break;
          if (amIds.includes(id)) continue;
          amIds.push(id);
          unassignedAm.delete(id);
          needAm--;
          anyFill = true;
        }
        const candidatesPm = [...unassignedPm].filter(id => { const s = score(id); return s >= 1 && s <= 4; }).map(id => ({ id, score: score(id) })).sort(sortByScoreRandom);
        for (const { id } of candidatesPm) {
          if (needPm <= 0) break;
          if (pmIds.includes(id)) continue;
          if (!slot.pm) slot.pm = [];
          slot.pm.push(id);
          unassignedPm.delete(id);
          needPm--;
          anyFill = true;
        }
        if (!slot.am) slot.am = [];
        slot.am = amIds;
      }
      syncDayUnassignedAndShortage(newAllocation, dateStr, unavailableAtStart, modalityData, staffData);
      if (anyFill) filled = true;
    }
    if (!anyFill) break;
  }
  return filled;
}

/** ② 未配置にいない場合のみ、他モダリティから移動（スコア参照）。1件でも移動したら true。 */
function step2MoveFromOtherModality(newAllocation, weekdays, modalityData, staffData, schedule, weeklyOff, leaves, surgeryDays = []) {
  let moved = false;
  for (const day of weekdays) {
    const dateStr = day.date;
    if (!newAllocation[dateStr]?._shortage) continue;
    const unavailableAtStart = buildUnavailableForDay(dateStr, weekdays, schedule, weeklyOff, leaves, surgeryDays);
    for (const mod of modalityData) {
      const modId = mod.id;
      const slot = newAllocation[dateStr][modId];
      if (!slot || Array.isArray(slot)) continue;
      const { requiredAm, requiredPm } = getRequiredForModality(mod, dateStr);
      const amIds = slot.am || [];
      const pmIds = slot.pm || [];
      const score = (id) => staffData.find(s => s.id === id)?.scores?.[modId] ?? 0;
      const nonTrainingAm = amIds.filter(id => score(id) !== 5).length;
      const nonTrainingPm = pmIds.filter(id => score(id) !== 5).length;
      let needAmLeft = Math.max(0, requiredAm - nonTrainingAm);
      let needPmLeft = Math.max(0, requiredPm - nonTrainingPm);
      if (needAmLeft === 0 && needPmLeft === 0) continue;

      const candidatesAm = [];
      modalityData.forEach(m2 => {
        if (m2.id === modId) return;
        const s2 = newAllocation[dateStr][m2.id];
        if (!s2 || Array.isArray(s2)) return;
        const r2 = getRequiredForModality(m2, dateStr);
        const s2NonTrainingAm = (s2.am || []).filter(id => staffData.find(s => s.id === id)?.scores?.[m2.id] !== 5).length;
        const surplusAm = s2NonTrainingAm - r2.requiredAm;
        if (surplusAm > 0) (s2.am || []).filter(id => staffData.find(s => s.id === id)?.scores?.[m2.id] !== 5).forEach(id => {
          const sc = score(id);
          if (sc >= 1 && sc <= 4) candidatesAm.push({ id, score: sc, source: m2.id, slot: 'am' });
        });
      });
      candidatesAm.sort(sortByScoreRandom);
      for (const { id, source } of candidatesAm) {
        if (needAmLeft <= 0) break;
        if (amIds.includes(id)) continue;
        amIds.push(id);
        const s2 = newAllocation[dateStr][source];
        if (s2?.am) s2.am = s2.am.filter(x => x !== id);
        moved = true;
        if (score(id) !== 5) needAmLeft--;
      }

      const candidatesPm = [];
      modalityData.forEach(m2 => {
        if (m2.id === modId) return;
        const s2 = newAllocation[dateStr][m2.id];
        if (!s2 || Array.isArray(s2)) return;
        const r2 = getRequiredForModality(m2, dateStr);
        const s2NonTrainingPm = (s2.pm || []).filter(id => staffData.find(s => s.id === id)?.scores?.[m2.id] !== 5).length;
        const surplusPm = s2NonTrainingPm - r2.requiredPm;
        if (surplusPm > 0) (s2.pm || []).filter(id => staffData.find(s => s.id === id)?.scores?.[m2.id] !== 5).forEach(id => {
          const sc = score(id);
          if (sc >= 1 && sc <= 4) candidatesPm.push({ id, score: sc, source: m2.id, slot: 'pm' });
        });
      });
      candidatesPm.sort(sortByScoreRandom);
      needPmLeft = Math.max(0, requiredPm - (slot.pm || []).filter(id => score(id) !== 5).length);
      for (const { id, source } of candidatesPm) {
        if (needPmLeft <= 0) break;
        if ((slot.pm || []).includes(id)) continue;
        if (!slot.pm) slot.pm = [];
        slot.pm.push(id);
        const s2 = newAllocation[dateStr][source];
        if (s2?.pm) s2.pm = s2.pm.filter(x => x !== id);
        moved = true;
        if (score(id) !== 5) needPmLeft--;
      }
    }
    syncDayUnassignedAndShortage(newAllocation, dateStr, unavailableAtStart, modalityData, staffData);
  }
  return moved;
}

/** ③ ②の空きに未配置を移動。1件でも埋めたら true。 */
function step3FillVacatedWithUnassigned(newAllocation, weekdays, modalityData, staffData, schedule, weeklyOff, leaves, surgeryDays = []) {
  let filled = false;
  const maxRounds = 50;
  for (let round = 0; round < maxRounds; round++) {
    let anyFill = false;
    for (const day of weekdays) {
      const dateStr = day.date;
      const unavailableAtStart = buildUnavailableForDay(dateStr, weekdays, schedule, weeklyOff, leaves, surgeryDays);
      let unassigned = new Set([
        ...(newAllocation[dateStr]._unassignedAm || []),
        ...(newAllocation[dateStr]._unassignedPm || []),
        ...(newAllocation[dateStr]._unassigned || [])
      ].filter(id => !unavailableAtStart.has(id)));

      for (const mod of modalityData) {
        const modId = mod.id;
        const slot = newAllocation[dateStr][modId];
        if (!slot || Array.isArray(slot)) continue;
        const { requiredAm, requiredPm } = getRequiredForModality(mod, dateStr);
        const amIds = slot.am || [];
        const pmIds = slot.pm || [];
        const score = (id) => staffData.find(s => s.id === id)?.scores?.[modId] ?? 0;
        const nonTrainingAm = amIds.filter(id => score(id) !== 5).length;
        const nonTrainingPm = pmIds.filter(id => score(id) !== 5).length;
        let needAm = Math.max(0, requiredAm - nonTrainingAm);
        let needPm = Math.max(0, requiredPm - nonTrainingPm);
        if (needAm === 0 && needPm === 0) continue;

        const candidates = [...unassigned].filter(id => {
          const s = score(id);
          return s >= 1 && s <= 4;
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
            if (score(id) !== 5) needAm--;
            anyFill = true;
          }
          if (needPm > 0 && canPm && !pmIds.includes(id)) {
            pmIds.push(id);
            unassigned.delete(id);
            if (score(id) !== 5) needPm--;
            anyFill = true;
          }
        }
        if (!slot.am) slot.am = [];
        if (!slot.pm) slot.pm = [];
        slot.am = amIds;
        slot.pm = pmIds;
      }

      syncDayUnassignedAndShortage(newAllocation, dateStr, unavailableAtStart, modalityData, staffData);
      if (anyFill) filled = true;
    }
    if (!anyFill) break;
  }
  return filled;
}

/** ⑤ トレーニング者を不足箇所へ移動（スコア5があれば）。1件でも埋めたら true。同一人物が複数モダリティに入らないよう、配属済みは候補から除外。 */
function step5FillWithTraining(newAllocation, weekdays, modalityData, staffData, schedule, weeklyOff, leaves, surgeryDays = []) {
  let filled = false;
  for (const day of weekdays) {
    const dateStr = day.date;
    if (!newAllocation[dateStr]?._shortage) continue;
    const unavailableAtStart = buildUnavailableForDay(dateStr, weekdays, schedule, weeklyOff, leaves, surgeryDays);
    const unassignedAm = new Set((newAllocation[dateStr]._unassignedAm || []).filter(id => !unavailableAtStart.has(id)));
    const unassignedPm = new Set((newAllocation[dateStr]._unassignedPm || []).filter(id => !unavailableAtStart.has(id)));
    for (const mod of modalityData) {
      const modId = mod.id;
      const slot = newAllocation[dateStr][modId];
      if (!slot || Array.isArray(slot)) continue;
      const { requiredAm, requiredPm } = getRequiredForModality(mod, dateStr);
      const amIds = slot.am || [];
      const pmIds = slot.pm || [];
      const score = (id) => staffData.find(s => s.id === id)?.scores?.[modId] ?? 0;
      const nonTrainingAm = amIds.filter(id => score(id) !== 5).length;
      const nonTrainingPm = pmIds.filter(id => score(id) !== 5).length;
      let needAm = Math.max(0, requiredAm - nonTrainingAm);
      let needPm = Math.max(0, requiredPm - nonTrainingPm);
      if (needAm === 0 && needPm === 0) continue;

      // この日付ですでにいずれかのモダリティに配属されている人は候補に含めない（二重配属防止）
      const assignedThisDate = new Set();
      modalityData.forEach(m => {
        const s = newAllocation[dateStr][m.id];
        if (s && !Array.isArray(s)) {
          (s.am || []).forEach(id => assignedThisDate.add(id));
          (s.pm || []).forEach(id => assignedThisDate.add(id));
        }
      });

      const candidatesAm = [];
      unassignedAm.forEach(id => { if (!assignedThisDate.has(id) && score(id) === 5) candidatesAm.push({ id, score: 5 }); });
      modalityData.forEach(m2 => {
        if (m2.id === modId) return;
        const s2 = newAllocation[dateStr][m2.id];
        if (!s2 || Array.isArray(s2)) return;
        const r2 = getRequiredForModality(m2, dateStr);
        const s2Am = (s2.am || []).filter(id => staffData.find(s => s.id === id)?.scores?.[m2.id] !== 5).length;
        if (s2Am > r2.requiredAm) (s2.am || []).forEach(id => {
          if (!assignedThisDate.has(id) && score(id) === 5) candidatesAm.push({ id, score: 5, source: m2.id, slot: 'am' });
        });
      });
      candidatesAm.sort(sortByScoreRandom);
      for (const c of candidatesAm) {
        if (needAm <= 0) break;
        if (amIds.includes(c.id)) continue;
        amIds.push(c.id);
        if (c.source) {
          const s2 = newAllocation[dateStr][c.source];
          if (s2?.am) s2.am = s2.am.filter(x => x !== c.id);
        } else unassignedAm.delete(c.id);
        needAm--;
        filled = true;
      }

      const candidatesPm = [];
      unassignedPm.forEach(id => { if (!assignedThisDate.has(id) && score(id) === 5) candidatesPm.push({ id, score: 5 }); });
      modalityData.forEach(m2 => {
        if (m2.id === modId) return;
        const s2 = newAllocation[dateStr][m2.id];
        if (!s2 || Array.isArray(s2)) return;
        const r2 = getRequiredForModality(m2, dateStr);
        const s2Pm = (s2.pm || []).filter(id => staffData.find(s => s.id === id)?.scores?.[m2.id] !== 5).length;
        if (s2Pm > r2.requiredPm) (s2.pm || []).forEach(id => {
          if (!assignedThisDate.has(id) && score(id) === 5) candidatesPm.push({ id, score: 5, source: m2.id, slot: 'pm' });
        });
      });
      candidatesPm.sort(sortByScoreRandom);
      for (const c of candidatesPm) {
        if (needPm <= 0) break;
        if ((slot.pm || []).includes(c.id)) continue;
        if (!slot.pm) slot.pm = [];
        slot.pm.push(c.id);
        if (c.source) {
          const s2 = newAllocation[dateStr][c.source];
          if (s2?.pm) s2.pm = s2.pm.filter(x => x !== c.id);
        } else unassignedPm.delete(c.id);
        needPm--;
        filled = true;
      }
      if (!slot.am) slot.am = [];
      slot.am = amIds;
    }
    syncDayUnassignedAndShortage(newAllocation, dateStr, unavailableAtStart, modalityData, staffData);
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
  const weeklyOffUndoHistoryRef = useRef([]);
  const weeklyOffRedoHistoryRef = useRef([]);
  const [weeklyOffUndoCount, setWeeklyOffUndoCount] = useState(0);
  const [weeklyOffRedoCount, setWeeklyOffRedoCount] = useState(0);
  const allocationUndoHistoryRef = useRef([]);
  const allocationRedoHistoryRef = useRef([]);
  const [allocationUndoCount, setAllocationUndoCount] = useState(0);
  const [allocationRedoCount, setAllocationRedoCount] = useState(0);
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
    pushAllocationUndoState();
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

    const buildOneAllocation = (skipTraining) => {
      const newAllocation = {};
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
      const nightShiftPerson = daySchedule.nightShift ?? daySchedule.nightShiftManual;
      const dayShiftPerson = daySchedule.dayShift ?? daySchedule.dayShiftManual;
      const supportPerson = daySchedule.support ?? daySchedule.supportManual;
      const dayOffPerson = daySchedule.dayOff ?? daySchedule.dayOffManual;
      if (nightShiftPerson) unavailableAtStart.add(nightShiftPerson);
      if (dayShiftPerson) unavailableAtStart.add(dayShiftPerson);
      if (supportPerson) unavailableAtStart.add(supportPerson);
      if (bPerson) unavailableAtStart.add(bPerson); // Bの職員はその日は配置しない
      if (dayOffPerson) unavailableAtStart.add(dayOffPerson);
      getWeeklyOffMerged(weeklyOff, dateStr).forEach(id => unavailableAtStart.add(id));
      if (leaves[dateStr]) leaves[dateStr].forEach(leave => unavailableAtStart.add(leave.staffId));

      const unavailableStaff = new Set(unavailableAtStart);
      const assignedThisDate = new Set();

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
        // その日付ですでにいずれかのモダリティに配属された人を除外（二重配属防止）
        const assignedSoFarThisDate = new Set();
        Object.keys(newAllocation[dateStr]).forEach(modId => {
          const s = newAllocation[dateStr][modId];
          if (s && !Array.isArray(s)) {
            (s.am || []).forEach(id => assignedSoFarThisDate.add(id));
            (s.pm || []).forEach(id => assignedSoFarThisDate.add(id));
          }
        });
        const available = staffData
          .filter(s => !unavailableAtStart.has(s.id) && !assignedSoFarThisDate.has(s.id))
          .map(s => ({ ...s, score: s.scores[modalityId] ?? 0 }));
        const canDoBoth = (s) => !s.isPartTime || s.partTimeSlot === 'am_pm';
        const canDoAm = (s) => canDoBoth(s) || s.partTimeSlot === 'am';
        const canDoPm = (s) => canDoBoth(s) || s.partTimeSlot === 'pm';

        const amIds = [];
        const pmIds = [];

        const score4Only = available.filter(s => s.score === 4).sort(sortByScoreRandom);
        const nBoth4 = Math.min(requiredAm, requiredPm);
        const canBoth4 = score4Only.filter(canDoBoth);
        const used4 = new Set();
        for (let i = 0; i < nBoth4 && i < canBoth4.length; i++) {
          const staff = canBoth4[i];
          if (used4.has(staff.id)) continue;
          amIds.push(staff.id);
          pmIds.push(staff.id);
          used4.add(staff.id);
          unavailableStaff.add(staff.id);
          assignedThisDate.add(staff.id);
        }
        let remainingAm = Math.max(0, requiredAm - amIds.length);
        let remainingPm = Math.max(0, requiredPm - pmIds.length);
        const canAm4 = score4Only.filter(s => canDoAm(s) && !used4.has(s.id));
        const canPm4 = score4Only.filter(s => canDoPm(s) && !used4.has(s.id));
        for (const staff of canAm4) {
          if (amIds.length >= requiredAm) break;
          if (unavailableStaff.has(staff.id)) continue;
          amIds.push(staff.id);
          unavailableStaff.add(staff.id);
          assignedThisDate.add(staff.id);
        }
        for (const staff of canPm4) {
          if (pmIds.length >= requiredPm) break;
          if (unavailableStaff.has(staff.id)) continue;
          pmIds.push(staff.id);
          unavailableStaff.add(staff.id);
          assignedThisDate.add(staff.id);
        }
        remainingAm = Math.max(0, requiredAm - amIds.length);
        remainingPm = Math.max(0, requiredPm - pmIds.length);

        // 必要人数はスコア1〜4のみで確保（トレーニングは含めない）。その後でトレーニングを追加する
        const forRequired = available.filter(s => s.score >= 1 && s.score <= 4 && !assignedThisDate.has(s.id)).sort(sortByScoreRandom);
        const nBoth = Math.min(remainingAm, remainingPm);
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
        remainingAm = Math.max(0, requiredAm - amIds.length);
        remainingPm = Math.max(0, requiredPm - pmIds.length);
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

        // 必要人数を確保した後にトレーニング（スコア5）を追加。トレーニングは必要人数に含めない
        if (!skipTraining) {
          const training = available.filter(s => s.score === 5);
          training.forEach(staff => {
            if (!unavailableStaff.has(staff.id)) {
              amIds.push(staff.id);
              pmIds.push(staff.id);
              unavailableStaff.add(staff.id);
              assignedThisDate.add(staff.id);
            }
          });
        }

        const nonTrainingAm = amIds.filter(id => (staffData.find(s => s.id === id)?.scores?.[modalityId] ?? 0) !== 5).length;
        const nonTrainingPm = pmIds.filter(id => (staffData.find(s => s.id === id)?.scores?.[modalityId] ?? 0) !== 5).length;
        if (nonTrainingAm < requiredAm || nonTrainingPm < requiredPm) {
          newAllocation[dateStr]._shortage = true;
        }
        if (amIds.length > 0 || pmIds.length > 0) {
          newAllocation[dateStr][modalityId] = { am: amIds, pm: pmIds };
        }
      });

      // ルール: Bの職員はその日のPMの救命(日勤)に充てる。トレーニングはそのまま残し、それ以外のみ未配置へ
      let displacedToUnassigned = [];
      const kyukouModId = getKyukouModId(modalityData);
      if (kyukouModId != null && bPerson) {
        if (!newAllocation[dateStr][kyukouModId]) newAllocation[dateStr][kyukouModId] = { am: [], pm: [] };
        const pm = newAllocation[dateStr][kyukouModId].pm || [];
        const isTraining = (id) => (staffData.find(s => s.id === id)?.scores?.[kyukouModId] ?? 0) === 5;
        const trainingInPm = pm.filter(id => isTraining(id));
        displacedToUnassigned = pm.filter(id => id !== bPerson && !isTraining(id));
        displacedToUnassigned.forEach(id => assignedThisDate.delete(id));
        newAllocation[dateStr][kyukouModId].pm = [bPerson, ...trainingInPm];
      }
      if (displacedToUnassigned.length > 0) {
        newAllocation[dateStr]._displacedFromKyukou = displacedToUnassigned;
      }

      const assignedAm = new Set();
      const assignedPm = new Set();
      modalityData.forEach(mod => {
        const s = newAllocation[dateStr][mod.id];
        if (s && !Array.isArray(s)) { (s.am || []).forEach(id => assignedAm.add(id)); (s.pm || []).forEach(id => assignedPm.add(id)); }
      });
      const unassignedAm = staffData.filter(s => !unavailableAtStart.has(s.id) && !assignedAm.has(s.id) && canWorkAm(s)).map(s => s.id);
      const unassignedPm = staffData.filter(s => !unavailableAtStart.has(s.id) && !assignedPm.has(s.id) && canWorkPm(s)).map(s => s.id);
      newAllocation[dateStr]._unassignedAm = unassignedAm;
      newAllocation[dateStr]._unassignedPm = [...new Set([...unassignedPm, ...displacedToUnassigned])];
      newAllocation[dateStr]._unassigned = [...new Set([...unassignedAm, ...newAllocation[dateStr]._unassignedPm])];
    });
      return newAllocation;
    };

    for (let tryIndex = 0; tryIndex < NUM_TRIES; tryIndex++) {
      const newAllocation = buildOneAllocation(false);

      // ① 未配置から不足箇所へ（スコア参照）
      for (;;) {
        const filled1 = step1FillFromUnassigned(newAllocation, weekdays, modalityData, staffData, schedule, weeklyOff, leaves, surgeryDays);
        if (!filled1) break;
        if (!weekdays.some(d => newAllocation[d.date]?._shortage)) break;
      }
      // ②→③ 未配置にいない場合は他モダリティから移動→空きに未配置。③ができないときは②からやり直す（10回）
      for (let retry = 0; retry < 10 && weekdays.some(d => newAllocation[d.date]?._shortage); retry++) {
        const moved2 = step2MoveFromOtherModality(newAllocation, weekdays, modalityData, staffData, schedule, weeklyOff, leaves, surgeryDays);
        const filled3 = step3FillVacatedWithUnassigned(newAllocation, weekdays, modalityData, staffData, schedule, weeklyOff, leaves, surgeryDays);
        if (!moved2 && !filled3) break;
        if (!weekdays.some(d => newAllocation[d.date]?._shortage)) break;
      }
      // ⑤ トレーニング者を不足箇所へ移動（スコアがあれば）
      for (;;) {
        const filled5 = step5FillWithTraining(newAllocation, weekdays, modalityData, staffData, schedule, weeklyOff, leaves, surgeryDays);
        if (!filled5) break;
        if (!weekdays.some(d => newAllocation[d.date]?._shortage)) break;
      }

      const shortageCount = countShortage(newAllocation, weekdays, modalityData, staffData);
      if (shortageCount < bestShortageCount) {
        bestShortageCount = shortageCount;
        bestAllocation = JSON.parse(JSON.stringify(newAllocation));
      }
      if (bestShortageCount === 0) break;
    }

    let newAllocation = bestAllocation;
    const requiredNotMet = bestShortageCount > 0;

    // ⑥ ⑤でも埋められない場合はその列の背景を赤く
    weekdays.forEach(d => {
      if (newAllocation[d.date]?._shortage) newAllocation[d.date]._redBackground = true;
      else if (newAllocation[d.date]) delete newAllocation[d.date]._redBackground;
    });

    // 必要人数を満たせない日がある場合：週休の割り当てをやり直し、同じ ①→②→③ サイクルを再実行
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
            for (;;) {
              const filled1 = step1FillFromUnassigned(newAllocation, weekdays, modalityData, staffData, schedule, nextWeeklyOff, leaves, surgeryDays);
              if (!filled1) break;
              if (!weekdays.some(d => newAllocation[d.date]?._shortage)) break;
            }
            for (let retry = 0; retry < 10 && weekdays.some(d => newAllocation[d.date]?._shortage); retry++) {
              const moved2 = step2MoveFromOtherModality(newAllocation, weekdays, modalityData, staffData, schedule, nextWeeklyOff, leaves, surgeryDays);
              const filled3 = step3FillVacatedWithUnassigned(newAllocation, weekdays, modalityData, staffData, schedule, nextWeeklyOff, leaves, surgeryDays);
              if (!moved2 && !filled3) break;
              if (!weekdays.some(d => newAllocation[d.date]?._shortage)) break;
            }
            for (;;) {
              const filled5 = step5FillWithTraining(newAllocation, weekdays, modalityData, staffData, schedule, nextWeeklyOff, leaves, surgeryDays);
              if (!filled5) break;
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
      weekdays.forEach(d => {
        if (newAllocation[d.date]?._shortage) newAllocation[d.date]._redBackground = true;
        else if (newAllocation[d.date]) delete newAllocation[d.date]._redBackground;
      });
    }

    setAllocation(newAllocation);
    setIsAutoAllocating(false);
    if (requiredNotMet && Object.keys(newAllocation).some(d => newAllocation[d]._shortage)) {
      alert('✅ 自動配置を実行しました。\n⚠️ 一部で必要人数を満たせませんでした（赤色列）。週休自動割り当ての見直しや、職員・モダリティ設定を確認してください。');
    } else if (requiredNotMet) {
      alert('✅ 自動配置が完了しました。週休を自動でずらして必要人数を満たしました。週休割り当てのカレンダーも更新済みです。');
    } else {
      alert('✅ 自動配置が完了しました');
    }
  };

  function runAllocationWithWeeklyOff(schedule, leaves, weeklyOff, weekdays, modalityData, staffData) {
    const scheduleData = JSON.parse(localStorage.getItem('scheduleData') || '{}');
    const surgeryDays = scheduleData.surgeryDays || [];
    const newAllocation = {};
    const shortageDates = [];
    weekdays.forEach(day => {
      const dateStr = day.date;
      newAllocation[dateStr] = {};
      const unavailableAtStart = new Set();
      const daySchedule = schedule[dateStr] || {};
      const nextDay = weekdays[weekdays.findIndex(d => d.date === dateStr) + 1];
      const bPerson = surgeryDays.includes(dateStr) && nextDay
        ? (schedule[nextDay.date]?.nightShift ?? schedule[nextDay.date]?.nightShiftManual)
        : (daySchedule.b ?? daySchedule.bManual);
      const nightShiftPerson = daySchedule.nightShift ?? daySchedule.nightShiftManual;
      const dayShiftPerson = daySchedule.dayShift ?? daySchedule.dayShiftManual;
      const supportPerson = daySchedule.support ?? daySchedule.supportManual;
      const dayOffPerson = daySchedule.dayOff ?? daySchedule.dayOffManual;
      if (nightShiftPerson) unavailableAtStart.add(nightShiftPerson);
      if (dayShiftPerson) unavailableAtStart.add(dayShiftPerson);
      if (supportPerson) unavailableAtStart.add(supportPerson);
      if (bPerson) unavailableAtStart.add(bPerson);
      if (dayOffPerson) unavailableAtStart.add(dayOffPerson);
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
        // その日付ですでにいずれかのモダリティに配属された人を除外（二重配属防止）
        const assignedSoFarThisDate = new Set();
        Object.keys(newAllocation[dateStr]).forEach(modId => {
          const s = newAllocation[dateStr][modId];
          if (s && !Array.isArray(s)) {
            (s.am || []).forEach(id => assignedSoFarThisDate.add(id));
            (s.pm || []).forEach(id => assignedSoFarThisDate.add(id));
          }
        });
        const available = staffData
          .filter(s => !unavailableAtStart.has(s.id) && !assignedSoFarThisDate.has(s.id))
          .map(s => ({ ...s, score: s.scores[modalityId] ?? 0 }));
        const canDoBoth = (s) => !s.isPartTime || s.partTimeSlot === 'am_pm';
        const canDoAm = (s) => canDoBoth(s) || s.partTimeSlot === 'am';
        const canDoPm = (s) => canDoBoth(s) || s.partTimeSlot === 'pm';
        const amIds = [];
        const pmIds = [];
        const score4Only = available.filter(s => s.score === 4).sort(sortByScoreRandom);
        const nBoth4 = Math.min(requiredAm, requiredPm);
        const canBoth4 = score4Only.filter(canDoBoth);
        const used4 = new Set();
        for (let i = 0; i < nBoth4 && i < canBoth4.length; i++) {
          const staff = canBoth4[i];
          if (used4.has(staff.id)) continue;
          amIds.push(staff.id);
          pmIds.push(staff.id);
          used4.add(staff.id);
          unavailableStaff.add(staff.id);
          assignedThisDate.add(staff.id);
        }
        let remainingAm = Math.max(0, requiredAm - amIds.length);
        let remainingPm = Math.max(0, requiredPm - pmIds.length);
        const canAm4 = score4Only.filter(s => canDoAm(s) && !used4.has(s.id));
        const canPm4 = score4Only.filter(s => canDoPm(s) && !used4.has(s.id));
        for (const staff of canAm4) {
          if (amIds.length >= requiredAm) break;
          if (unavailableStaff.has(staff.id)) continue;
          amIds.push(staff.id);
          unavailableStaff.add(staff.id);
          assignedThisDate.add(staff.id);
        }
        for (const staff of canPm4) {
          if (pmIds.length >= requiredPm) break;
          if (unavailableStaff.has(staff.id)) continue;
          pmIds.push(staff.id);
          unavailableStaff.add(staff.id);
          assignedThisDate.add(staff.id);
        }
        remainingAm = Math.max(0, requiredAm - amIds.length);
        remainingPm = Math.max(0, requiredPm - pmIds.length);
        // 必要人数はスコア1〜4のみで確保（トレーニングは含めない）。その後でトレーニングを追加する
        const forRequired = available.filter(s => s.score >= 1 && s.score <= 4 && !assignedThisDate.has(s.id)).sort(sortByScoreRandom);
        const nBoth = Math.min(remainingAm, remainingPm);
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
        remainingAm = Math.max(0, requiredAm - amIds.length);
        remainingPm = Math.max(0, requiredPm - pmIds.length);
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
        // 必要人数を確保した後にトレーニング（スコア5）を追加。トレーニングは必要人数に含めない
        const training = available.filter(s => s.score === 5);
        training.forEach(staff => {
          if (!unavailableStaff.has(staff.id)) {
            amIds.push(staff.id);
            pmIds.push(staff.id);
            unavailableStaff.add(staff.id);
            assignedThisDate.add(staff.id);
          }
        });
        const nonTrainingAm = amIds.filter(id => (staffData.find(s => s.id === id)?.scores?.[modalityId] ?? 0) !== 5).length;
        const nonTrainingPm = pmIds.filter(id => (staffData.find(s => s.id === id)?.scores?.[modalityId] ?? 0) !== 5).length;
        if (nonTrainingAm < requiredAm || nonTrainingPm < requiredPm) shortageDates.push(dateStr);
        if (amIds.length > 0 || pmIds.length > 0) newAllocation[dateStr][modalityId] = { am: amIds, pm: pmIds };
      });
      // 退けた人を未配置に含める。トレーニングは救命PMに残す
      let displacedToUnassigned = [];
      const kyukouModId = getKyukouModId(modalityData);
      if (kyukouModId != null && bPerson) {
        if (!newAllocation[dateStr][kyukouModId]) newAllocation[dateStr][kyukouModId] = { am: [], pm: [] };
        const pm = newAllocation[dateStr][kyukouModId].pm || [];
        const isTraining = (id) => (staffData.find(s => s.id === id)?.scores?.[kyukouModId] ?? 0) === 5;
        const trainingInPm = pm.filter(id => isTraining(id));
        displacedToUnassigned = pm.filter(id => id !== bPerson && !isTraining(id));
        displacedToUnassigned.forEach(id => assignedThisDate.delete(id));
        newAllocation[dateStr][kyukouModId].pm = [bPerson, ...trainingInPm];
      }
      if (displacedToUnassigned.length > 0) {
        newAllocation[dateStr]._displacedFromKyukou = displacedToUnassigned;
      }
      const assignedAm = new Set();
      const assignedPm = new Set();
      modalityData.forEach(mod => {
        const s = newAllocation[dateStr][mod.id];
        if (s && !Array.isArray(s)) { (s.am || []).forEach(id => assignedAm.add(id)); (s.pm || []).forEach(id => assignedPm.add(id)); }
      });
      const unassignedAm = staffData.filter(s => !unavailableAtStart.has(s.id) && !assignedAm.has(s.id) && canWorkAm(s)).map(s => s.id);
      const unassignedPm = staffData.filter(s => !unavailableAtStart.has(s.id) && !assignedPm.has(s.id) && canWorkPm(s)).map(s => s.id);
      newAllocation[dateStr]._unassignedAm = unassignedAm;
      newAllocation[dateStr]._unassignedPm = [...new Set([...unassignedPm, ...displacedToUnassigned])];
      newAllocation[dateStr]._unassigned = [...new Set([...unassignedAm, ...newAllocation[dateStr]._unassignedPm])];
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
    pushAllocationUndoState();
    setAllocation(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[dateStr]) return prev;
      const day = next[dateStr];
      if (!day._manualStaff) day._manualStaff = [];

      const removeFrom = (src) => {
        if (src.type === 'unassigned') {
          if (day._unassignedAm) day._unassignedAm = day._unassignedAm.filter(id => id !== staffId);
          if (day._unassignedPm) day._unassignedPm = day._unassignedPm.filter(id => id !== staffId);
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
          if (!day._unassignedAm) day._unassignedAm = [];
          if (!day._unassignedAm.includes(staffId)) day._unassignedAm.push(staffId);
          if (!day._unassignedPm) day._unassignedPm = [];
          if (!day._unassignedPm.includes(staffId)) day._unassignedPm.push(staffId);
          day._unassigned = [...new Set([...(day._unassignedAm || []), ...(day._unassignedPm || [])])];
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

  /** その日の「未配置」に表示している職員IDリスト（当番表に載っている人は除外）。slot は 'am' | 'pm' でPM未配置には救命から退けた人も含む */
  const getAssignableUnassigned = (dateStr, slot) => {
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
    const day = allocation[dateStr] || {};
    const rawIds = slot === 'pm' ? (day._unassignedPm ?? day._unassigned ?? []) : (day._unassignedAm ?? day._unassigned ?? []);
    return rawIds.filter(id => {
      if (scheduleStaffThisDay.has(id)) return false;
      const s = staffData.find(x => x.id === id);
      return slot === 'pm' ? canWorkPm(s) : canWorkAm(s);
    });
  };

  useEffect(() => {
    if (!allocationLoaded.current) return;
    localStorage.setItem('allocationData', JSON.stringify({ allocation, startDate, endDate }));
  }, [allocation, startDate, endDate]);

  const pushWeeklyOffUndoState = () => {
    const scheduleData = JSON.parse(localStorage.getItem('scheduleData') || '{}');
    const current = scheduleData.weeklyOff != null ? JSON.parse(JSON.stringify(scheduleData.weeklyOff)) : {};
    weeklyOffRedoHistoryRef.current = [];
    setWeeklyOffRedoCount(0);
    weeklyOffUndoHistoryRef.current.push(current);
    if (weeklyOffUndoHistoryRef.current.length > MAX_WEEKLY_OFF_UNDO) weeklyOffUndoHistoryRef.current.shift();
    setWeeklyOffUndoCount(weeklyOffUndoHistoryRef.current.length);
  };

  const undoWeeklyOff = () => {
    if (weeklyOffUndoHistoryRef.current.length === 0) return;
    const scheduleData = JSON.parse(localStorage.getItem('scheduleData') || '{}');
    const current = scheduleData.weeklyOff != null ? JSON.parse(JSON.stringify(scheduleData.weeklyOff)) : {};
    weeklyOffRedoHistoryRef.current.push(current);
    setWeeklyOffRedoCount(weeklyOffRedoHistoryRef.current.length);
    const prev = weeklyOffUndoHistoryRef.current.pop();
    scheduleData.weeklyOff = prev;
    localStorage.setItem('scheduleData', JSON.stringify(scheduleData));
    setScheduleDataVersion(v => v + 1);
    setWeeklyOffUndoCount(weeklyOffUndoHistoryRef.current.length);
  };

  const redoWeeklyOff = () => {
    if (weeklyOffRedoHistoryRef.current.length === 0) return;
    const scheduleData = JSON.parse(localStorage.getItem('scheduleData') || '{}');
    const current = scheduleData.weeklyOff != null ? JSON.parse(JSON.stringify(scheduleData.weeklyOff)) : {};
    weeklyOffUndoHistoryRef.current.push(current);
    setWeeklyOffUndoCount(weeklyOffUndoHistoryRef.current.length);
    const next = weeklyOffRedoHistoryRef.current.pop();
    scheduleData.weeklyOff = next;
    localStorage.setItem('scheduleData', JSON.stringify(scheduleData));
    setScheduleDataVersion(v => v + 1);
    setWeeklyOffRedoCount(weeklyOffRedoHistoryRef.current.length);
  };

  const pushAllocationUndoState = () => {
    allocationRedoHistoryRef.current = [];
    setAllocationRedoCount(0);
    allocationUndoHistoryRef.current.push(JSON.parse(JSON.stringify(allocation)));
    if (allocationUndoHistoryRef.current.length > MAX_ALLOCATION_UNDO) allocationUndoHistoryRef.current.shift();
    setAllocationUndoCount(allocationUndoHistoryRef.current.length);
  };

  const undoAllocation = () => {
    if (allocationUndoHistoryRef.current.length === 0) return;
    allocationRedoHistoryRef.current.push(JSON.parse(JSON.stringify(allocation)));
    setAllocationRedoCount(allocationRedoHistoryRef.current.length);
    const prev = allocationUndoHistoryRef.current.pop();
    setAllocation(prev);
    setAllocationUndoCount(allocationUndoHistoryRef.current.length);
  };

  const redoAllocation = () => {
    if (allocationRedoHistoryRef.current.length === 0) return;
    allocationUndoHistoryRef.current.push(JSON.parse(JSON.stringify(allocation)));
    setAllocationUndoCount(allocationUndoHistoryRef.current.length);
    const next = allocationRedoHistoryRef.current.pop();
    setAllocation(next);
    setAllocationRedoCount(allocationRedoHistoryRef.current.length);
  };

  const autoAssignWeeklyOffAllocation = () => {
    const scheduleData = JSON.parse(localStorage.getItem('scheduleData') || '{}');
    const schedule = mergeScheduleWithOverrides(scheduleData.schedule || {}, scheduleData.manualOverrides);
    const cal = scheduleData.calendar || [];
    if (cal.length === 0 || !scheduleData.schedule || Object.keys(scheduleData.schedule).length === 0) {
      alert('⚠️ まず当番表を作成してください');
      return;
    }
    const leaveData = JSON.parse(localStorage.getItem('leaveData') || '{}').leaveData || {};
    const surgeryDays = scheduleData.surgeryDays || [];
    const weekdays = cal.filter(d => !d.isWeekend && !d.isHoliday);
    const remaining = {};
    staffData.forEach(staff => {
      const staffId = staff.id;
      let weeklyOffDays = 0;
      cal.forEach((day, idx) => {
        const dateStr = day.date;
        const daySchedule = schedule[dateStr] || {};
        const nextDay = cal[idx + 1];
        const bPerson = surgeryDays.includes(dateStr) && nextDay ? (schedule[nextDay.date]?.nightShift ?? schedule[nextDay.date]?.nightShiftManual) : (daySchedule.b ?? daySchedule.bManual);
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
      remaining[staff.id] = weeklyOffDays;
    });
    const newWeeklyOff = {};
    const staffOrder = [...staffData];
    const countByDate = {};
    weekdays.forEach(d => { countByDate[d.date] = 0; });

    const canAssignOnDay = (staffId, dateStr) => {
      const daySchedule = schedule[dateStr] || {};
      const calIdx = cal.findIndex(d => d.date === dateStr);
      const nextDay = calIdx >= 0 ? cal[calIdx + 1] : null;
      const prevDay = calIdx >= 0 ? cal[calIdx - 1] : null;
      const bPerson = surgeryDays.includes(dateStr) && nextDay ? (schedule[nextDay?.date]?.nightShift ?? schedule[nextDay?.date]?.nightShiftManual) : (daySchedule.b ?? daySchedule.bManual);
      const dayOffPerson = prevDay ? (schedule[prevDay.date]?.nightShift ?? schedule[prevDay.date]?.nightShiftManual) : (daySchedule.dayOff ?? daySchedule.dayOffManual);
      const hasOtherLeave = leaveData[dateStr]?.some(leave => leave.staffId === staffId);
      const isAssigned =
        daySchedule.nightShift === staffId || daySchedule.nightShiftManual === staffId ||
        daySchedule.dayShift === staffId || daySchedule.dayShiftManual === staffId ||
        daySchedule.support === staffId || daySchedule.supportManual === staffId ||
        (daySchedule.b ?? bPerson) === staffId || daySchedule.bManual === staffId ||
        (daySchedule.dayOff ?? dayOffPerson) === staffId || daySchedule.dayOffManual === staffId;
      return !hasOtherLeave && !isAssigned;
    };

    let totalRemaining = Object.values(remaining).reduce((a, b) => a + b, 0);
    while (totalRemaining > 0) {
      const staffWithRemaining = staffOrder.filter(s => remaining[s.id] > 0);
      if (staffWithRemaining.length === 0) break;
      const staff = staffWithRemaining.reduce((a, b) => remaining[a.id] >= remaining[b.id] ? a : b);
      const staffId = staff.id;
      const candidateDays = weekdays.filter(d => {
        const dateStr = d.date;
        if (countByDate[dateStr] >= MAX_WEEKLY_OFF_PER_DAY) return false;
        return canAssignOnDay(staffId, dateStr);
      });
      if (candidateDays.length === 0) break;
      candidateDays.sort((a, b) => countByDate[a.date] - countByDate[b.date]);
      const day = candidateDays[0];
      const dateStr = day.date;
      if (!newWeeklyOff[dateStr]) newWeeklyOff[dateStr] = [];
      newWeeklyOff[dateStr].push(staffId);
      countByDate[dateStr]++;
      remaining[staffId]--;
      totalRemaining--;
    }
    pushWeeklyOffUndoState();
    scheduleData.weeklyOff = newWeeklyOff;
    localStorage.setItem('scheduleData', JSON.stringify(scheduleData));
    setScheduleDataVersion(v => v + 1);
    alert('✅ 週休を自動割り当てしました');
  };

  const resetWeeklyOffAllocation = () => {
    if (!window.confirm('週休自動割り当てをリセットしますか？')) return;
    pushWeeklyOffUndoState();
    const scheduleData = JSON.parse(localStorage.getItem('scheduleData') || '{}');
    scheduleData.weeklyOff = {};
    localStorage.setItem('scheduleData', JSON.stringify(scheduleData));
    setScheduleDataVersion(v => v + 1);
  };

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
    pushWeeklyOffUndoState();
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

  /** AM列・PM列それぞれで、配置表のモダリティ・未配置のうち重複している職員のみグレー表示。Bの職員がその日の救命(日勤)PMにいる場合は重複扱いにしない（かぶっていてもグレーにしない） */
  const { duplicateInAMByDate, duplicateInPMByDate, datesWithDuplicates } = useMemo(() => {
    const scheduleData = JSON.parse(localStorage.getItem('scheduleData') || '{}');
    const schedule = mergeScheduleWithOverrides(scheduleData.schedule || {}, scheduleData.manualOverrides);
    const surgeryDays = scheduleData.surgeryDays || [];
    const kyukouModId = getKyukouModId(modalityData);
    const amByDate = {};
    const pmByDate = {};
    calendar.forEach((day, idx) => {
      const dateStr = day.date;
      const dayAlloc = allocation[dateStr] || {};
      const unassignedAm = dayAlloc._unassignedAm ?? dayAlloc._unassigned ?? [];
      const unassignedPm = dayAlloc._unassignedPm ?? dayAlloc._unassigned ?? [];
      const amList = [...unassignedAm];
      const pmList = [...unassignedPm];
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
      // Bの職員がその日の救命PMに充てられている場合は重複グレーにしない
      const nextDay = calendar[idx + 1];
      const daySched = schedule[dateStr] || {};
      const bPerson = surgeryDays.includes(dateStr) && nextDay ? (schedule[nextDay?.date]?.nightShift ?? schedule[nextDay?.date]?.nightShiftManual) : (daySched.b ?? daySched.bManual);
      if (kyukouModId != null && bPerson && dayAlloc[kyukouModId]?.pm?.includes(bPerson)) {
        amByDate[dateStr] = new Set([...amByDate[dateStr]].filter(id => id !== bPerson));
        pmByDate[dateStr] = new Set([...pmByDate[dateStr]].filter(id => id !== bPerson));
      }
    });
    const datesWithDuplicates = new Set(calendar.map(d => d.date).filter(dateStr => (amByDate[dateStr]?.size > 0 || pmByDate[dateStr]?.size > 0)));
    return { duplicateInAMByDate: amByDate, duplicateInPMByDate: pmByDate, datesWithDuplicates };
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
                const ids = getAssignableUnassigned(assignPicker.dateStr, assignPicker.slot);
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
                  <li>「← 戻る」「進む →」で配置表の編集履歴を元に戻す・やり直しできます。</li>
                </ul>
              </section>
              <section>
                <h4 className="font-bold text-stone-800 mb-3 text-lg">配置表作成のロジック（概要）</h4>
                <ol className="list-decimal list-inside space-y-1 ml-1">
                  <li><strong>初回配置</strong> … 日付・モダリティごとに ①スコア4 → ②トレーニング → ③スコア1〜4で不足分を埋める。不足が残ればトレーニングなしで再試行。</li>
                  <li><strong>B と救命(日勤)PM</strong> … B の職員はその日の PM「救命(日勤)」に充てる。もともと救命PMにいた人は PM 未配置へ。</li>
                  <li><strong>未配置</strong> … AM 未配置・PM 未配置を別管理。パートで AM のみ・PM のみの職員は、勤務可能な時間帯の未配置にのみ表示。</li>
                  <li><strong>不足を埋める</strong> … ①他モダリティから移動 → ②空いた枠に未配置を配置、を繰り返す。それでも不足なら週休割り当てを変更して再配置。</li>
                </ol>
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
                  <li>未配置は<strong>AM 用・PM 用で別セル</strong>です。AM の未配置にはその日 AM に配置可能な職員、PM の未配置には PM に配置可能な職員のみ表示されます。</li>
                  <li>モダリティのセル内の<strong>空白部分</strong>をクリックすると、その時間帯（AM または PM）の未配置リストから割り当てられます。</li>
                  <li>当番表に載っている職員は未配置には表示されず、未配置セルへドロップしても移動しません。</li>
                </ul>
              </section>
              <section>
                <h4 className="font-bold text-stone-800 mb-3 text-lg">表示の補足</h4>
                <ul className="list-disc list-inside space-y-2 ml-1">
                  <li>手動で変更した職員は<strong>赤字</strong>で表示されます。</li>
                  <li>同一日の中で同じ職員が 2 回以上登場する場合は<strong>グレー背景</strong>で表示されます（B が救命PMにいる場合は除く）。</li>
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

        {calendar.length === 0 && (
          <p className="mb-4 text-stone-700 text-xl font-medium">※ 表示する期間がありません</p>
        )}

        {calendar.length > 0 ? (
          <div className="bg-slate-50 rounded-2xl border-2 border-slate-400 p-6 shadow-sm overflow-x-auto">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h3 className="font-bold text-stone-800 text-2xl">📊 配置表</h3>
              <button type="button" onClick={autoAllocate} disabled={isAutoAllocating} className="btn-panel min-h-[52px] px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed text-white shadow-md text-base">
                {isAutoAllocating ? '配置中...' : '配置表作成'}
              </button>
              <button type="button" onClick={redoAllocation} disabled={allocationRedoCount === 0} className="btn-panel min-h-[52px] px-4 bg-slate-500 hover:bg-slate-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-500 text-white border-2 border-slate-600 text-base">進む →</button>
              <button type="button" onClick={undoAllocation} disabled={allocationUndoCount === 0} className="btn-panel min-h-[52px] px-4 bg-slate-500 hover:bg-slate-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-500 text-white border-2 border-slate-600 text-base">← 戻る</button>
            </div>
            {startDate && endDate && (
              <p className="text-stone-600 text-base mb-4">期間: {startDate} 〜 {endDate}</p>
            )}
            <div className="overflow-x-auto">
              <table className="border-collapse text-sm min-w-full">
                <thead>
                  <tr className="bg-stone-100 border-b-2 border-slate-400">
                    <th className="border border-slate-300 py-1 px-2 sticky left-0 bg-stone-100 z-20 min-w-[150px] text-stone-800 font-bold">モダリティ</th>
                    {calendar.map(day => {
                      const dow = day.dayOfWeekNum ?? new Date(day.date + 'T12:00:00').getDay();
                      const isSunOrHoliday = dow === 0 || day.isHoliday;
                      const isSat = dow === 6;
                      const dateColor = isSunOrHoliday ? 'text-red-600' : isSat ? 'text-blue-600' : 'text-stone-800';
                      const weekdayColor = isSunOrHoliday ? 'text-red-600' : isSat ? 'text-blue-600' : 'text-stone-600';
                      const redCol = allocation[day.date]?._redBackground;
                      const dupCol = datesWithDuplicates?.has(day.date);
                      return (
                      <th key={day.date} colSpan={2} className={`border border-slate-300 border-l-[3px] border-l-slate-800 py-0.5 px-1 min-w-[120px] text-center ${dupCol ? 'bg-stone-500 text-stone-100' : redCol ? 'bg-red-200' : day.isWeekend || day.isHoliday ? 'bg-slate-100' : ''}`}>
                        <div className={`font-semibold ${dateColor}`}>{day.date.slice(5).replace('-', '/')}</div>
                        <div className={`text-xs ${weekdayColor}`}>{day.dayOfWeek}</div>
                      </th>
                    ); })}
                  </tr>
                    <tr className="bg-stone-50 border-b border-slate-300">
                    <th className="border border-slate-300 py-0.5 px-1 sticky left-0 bg-stone-50 z-20" />
                    {calendar.map(day => {
                      const redCol = allocation[day.date]?._redBackground;
                      const dupCol = datesWithDuplicates?.has(day.date);
                      return (
                      <React.Fragment key={day.date}>
                        <th className={`border border-slate-300 border-l-[3px] border-l-slate-800 py-1 px-1.5 min-w-[6.5rem] text-xs font-semibold ${dupCol ? 'bg-stone-500 text-stone-100' : redCol ? 'bg-red-200 text-stone-600' : 'text-stone-600 bg-amber-50/80'}`}>AM</th>
                        <th className={`border border-slate-300 py-1 px-1.5 min-w-[6.5rem] text-xs font-semibold ${dupCol ? 'bg-stone-500 text-stone-100' : redCol ? 'bg-red-200 text-stone-600' : 'text-stone-600 bg-sky-50/80'}`}>PM</th>
                      </React.Fragment>
                    ); })}
                  </tr>
                </thead>
                <tbody>
                  {modalityData.map(mod => {
                    const kyukouModIdForDisplay = getKyukouModId(modalityData);
                    const isKyukou = kyukouModIdForDisplay != null && mod.id === kyukouModIdForDisplay;
                    const slotDataByDate = calendar.map(day => {
                      const slot = allocation[day.date]?.[mod.id];
                      const am = Array.isArray(slot) ? slot : (slot?.am || []);
                      const pm = Array.isArray(slot) ? [] : (slot?.pm || []);
                      const rows = getAlignedAmPmRows(am, pm);
                      const lineCount = isKyukou ? Math.max(am.length, pm.length, 1) : rows.length;
                      return { am, pm, rows, lineCount };
                    });
                    const maxLines = Math.max(1, ...slotDataByDate.flatMap(s => s.lineCount));
                    const rowMinHeight = `${Math.max(2, maxLines) * 1.35}rem`;
                    return (
                      <React.Fragment key={mod.id}>
                        <tr className="hover:bg-slate-50/50 transition-all" style={{ minHeight: rowMinHeight }}>
                          <td className="border border-slate-300 py-1 px-2 sticky left-0 bg-slate-50 z-10 font-semibold text-stone-800 align-top text-sm">
                            {mod.name}
                          </td>
                          {calendar.map(day => {
                            const dateStr = day.date;
                            const slot = allocation[dateStr]?.[mod.id];
                            const am = Array.isArray(slot) ? slot : (slot?.am || []);
                            const pm = Array.isArray(slot) ? [] : (slot?.pm || []);
                            const alignedRows = isKyukou ? null : getAlignedAmPmRows(am, pm);
                            const name = (id) => staffData.find(s => s.id === id)?.name || id;
                            const isWeekend = day.isWeekend || day.isHoliday;
                            const manualStaff = allocation[dateStr]?._manualStaff || [];
                            const { requiredAm, requiredPm } = getRequiredForModality(mod, dateStr);
                            const nonTrainingAm = am.filter(id => (staffData.find(s => s.id === id)?.scores?.[mod.id] ?? 0) !== 5).length;
                            const nonTrainingPm = pm.filter(id => (staffData.find(s => s.id === id)?.scores?.[mod.id] ?? 0) !== 5).length;
                            const isShortAm = !isWeekend && nonTrainingAm < requiredAm;
                            const isShortPm = !isWeekend && nonTrainingPm < requiredPm;
                            const redCol = allocation[dateStr]?._redBackground;
                            const dupCol = datesWithDuplicates?.has(dateStr);
                            const cellBgAm = dupCol ? 'bg-stone-500/80' : redCol ? 'bg-red-100' : isShortAm ? 'bg-stone-300' : isWeekend ? 'bg-slate-50' : 'bg-amber-50/30';
                            const cellBgPm = dupCol ? 'bg-stone-500/80' : redCol ? 'bg-red-100' : isShortPm ? 'bg-stone-300' : isWeekend ? 'bg-slate-50' : 'bg-sky-50/30';
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
                                  className={`border border-slate-300 border-l-[3px] border-l-slate-800 py-1 px-2 min-w-[6.5rem] align-top text-sm ${cellBgAm}`}
                                  onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes('text/plain')) e.dataTransfer.dropEffect = 'move'; }}
                                  onDrop={handleDropAm}
                                >
                                  <div className="flex flex-col gap-0.5 min-h-[1.75rem]">
                                    {isKyukou ? (
                                      am.length ? [...am].sort(sortById).map(id => (
                                        <span
                                          key={id}
                                          draggable
                                          className={`text-sm leading-tight font-medium cursor-grab active:cursor-grabbing ${duplicateInAMByDate[dateStr]?.has(id) ? 'bg-stone-300 text-stone-900 px-0.5 rounded' : manualStaff.includes(id) ? 'text-red-600' : 'text-stone-800'}`}
                                          onDragStart={(e) => {
                                            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'allocation-staff', dateStr, staffId: id, fromSource: { type: 'modality', modId: mod.id, slot: 'am' } }));
                                            e.dataTransfer.effectAllowed = 'move';
                                          }}
                                        >
                                          {name(id)}
                                        </span>
                                      )) : (
                                        <span role="button" tabIndex={0} className="text-stone-400 hover:text-stone-600 cursor-pointer select-none" onClick={() => setAssignPicker({ dateStr, modId: mod.id, slot: 'am' })} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAssignPicker({ dateStr, modId: mod.id, slot: 'am' }); } }}>－</span>
                                      )
                                    ) : alignedRows?.length ? alignedRows.map((row, i) => (
                                      row.am ? (
                                        <span
                                          key={`am-${i}-${row.am}`}
                                          draggable
                                          className={`text-sm leading-tight font-medium cursor-grab active:cursor-grabbing ${duplicateInAMByDate[dateStr]?.has(row.am) ? 'bg-stone-300 text-stone-900 px-0.5 rounded' : manualStaff.includes(row.am) ? 'text-red-600' : 'text-stone-800'}`}
                                          onDragStart={(e) => {
                                            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'allocation-staff', dateStr, staffId: row.am, fromSource: { type: 'modality', modId: mod.id, slot: 'am' } }));
                                            e.dataTransfer.effectAllowed = 'move';
                                          }}
                                        >
                                          {name(row.am)}
                                        </span>
                                      ) : (
                                        <span key={`am-empty-${i}`} className="text-stone-300 select-none min-h-[1.25rem]">－</span>
                                      )
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
                                      className="block min-h-[1rem] flex-1 cursor-pointer"
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => setAssignPicker({ dateStr, modId: mod.id, slot: 'am' })}
                                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAssignPicker({ dateStr, modId: mod.id, slot: 'am' }); } }}
                                      aria-label="未配置から割り当て"
                                    />
                                  </div>
                                </td>
                                <td
                                  className={`border border-slate-300 py-1 px-2 min-w-[6.5rem] align-top text-sm ${cellBgPm}`}
                                  onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes('text/plain')) e.dataTransfer.dropEffect = 'move'; }}
                                  onDrop={handleDropPm}
                                >
                                  <div className="flex flex-col gap-0.5 min-h-[1.75rem]">
                                    {isKyukou ? (
                                      pm.length ? [...pm].sort(sortById).map(id => (
                                        <span
                                          key={id}
                                          draggable
                                          className={`text-sm leading-tight font-medium cursor-grab active:cursor-grabbing ${duplicateInPMByDate[dateStr]?.has(id) ? 'bg-stone-300 text-stone-900 px-0.5 rounded' : manualStaff.includes(id) ? 'text-red-600' : 'text-stone-800'}`}
                                          onDragStart={(e) => {
                                            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'allocation-staff', dateStr, staffId: id, fromSource: { type: 'modality', modId: mod.id, slot: 'pm' } }));
                                            e.dataTransfer.effectAllowed = 'move';
                                          }}
                                        >
                                          {name(id)}
                                        </span>
                                      )) : (
                                        <span role="button" tabIndex={0} className="text-stone-400 hover:text-stone-600 cursor-pointer select-none" onClick={() => setAssignPicker({ dateStr, modId: mod.id, slot: 'pm' })} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAssignPicker({ dateStr, modId: mod.id, slot: 'pm' }); } }}>－</span>
                                      )
                                    ) : alignedRows?.length ? alignedRows.map((row, i) => (
                                      row.pm ? (
                                        <span
                                          key={`pm-${i}-${row.pm}`}
                                          draggable
                                          className={`text-sm leading-tight font-medium cursor-grab active:cursor-grabbing ${duplicateInPMByDate[dateStr]?.has(row.pm) ? 'bg-stone-300 text-stone-900 px-0.5 rounded' : manualStaff.includes(row.pm) ? 'text-red-600' : 'text-stone-800'}`}
                                          onDragStart={(e) => {
                                            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'allocation-staff', dateStr, staffId: row.pm, fromSource: { type: 'modality', modId: mod.id, slot: 'pm' } }));
                                            e.dataTransfer.effectAllowed = 'move';
                                          }}
                                        >
                                          {name(row.pm)}
                                        </span>
                                      ) : (
                                        <span key={`pm-empty-${i}`} className="text-stone-300 select-none min-h-[1.25rem]">－</span>
                                      )
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
                                      className="block min-h-[1rem] flex-1 cursor-pointer"
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
                            <td className="border border-slate-300 py-1 px-2 sticky left-0 bg-slate-100 z-10 font-semibold text-stone-700 align-middle text-sm">
                              {label}
                            </td>
                            {calendar.map(day => {
                              const staffId = getVal(day);
                              const isWeekend = day.isWeekend || day.isHoliday;
                              const isDup = staffId && (duplicateInAMByDate[day.date]?.has(staffId) || duplicateInPMByDate[day.date]?.has(staffId));
                              const redCol = allocation[day.date]?._redBackground;
                              const dupCol = datesWithDuplicates?.has(day.date);
                              return (
                                <td
                                  key={day.date}
                                  colSpan={2}
                                  className={`border border-slate-300 border-l-[3px] border-l-slate-800 py-1 px-2 min-w-[11rem] text-left align-middle text-sm leading-tight ${dupCol ? 'bg-stone-500/80' : redCol ? 'bg-red-100' : isWeekend ? 'bg-slate-50' : 'bg-white'}`}
                                >
                                  {staffId ? <span className={`font-medium ${isDup ? 'bg-stone-300 text-stone-900 px-1 rounded' : 'text-stone-800'}`}>{name(staffId)}</span> : <span className="text-stone-400">－</span>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        <tr className="bg-amber-50/50 hover:bg-amber-50 transition-all">
                          <td className="border border-slate-300 py-1 px-2 sticky left-0 bg-amber-100/80 z-10 font-semibold text-stone-700 align-top min-h-[5rem] text-sm">
                            休暇等
                          </td>
                          {calendar.map(day => {
                            const dateStr = day.date;
                            const isWeekend = day.isWeekend || day.isHoliday;
                            const redCol = allocation[dateStr]?._redBackground;
                            const dupCol = datesWithDuplicates?.has(dateStr);
                            const woAm = getWeeklyOffBySlot(weeklyOff, dateStr).am;
                            const woPm = getWeeklyOffBySlot(weeklyOff, dateStr).pm;
                            const leave週休Ids = (leaves[dateStr] || []).filter(l => l.leaveType === '週休').map(l => l.staffId);
                            const baseClass = `border border-slate-300 border-l-[3px] border-l-slate-800 py-1 px-2 min-w-[6.5rem] min-h-[10rem] text-left align-top text-sm leading-tight whitespace-pre-line ${dupCol ? 'bg-stone-500/80' : redCol ? 'bg-red-100' : isWeekend ? 'bg-slate-50' : 'bg-white'}`;
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
                                    <span key={i} className="block font-medium text-sm leading-tight">
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
                                return (<span key={i} className="block font-medium text-stone-800 text-sm leading-tight">{entry.type}：{entry.name}</span>);
                              })
                            ) : <span className="text-stone-400">－</span>;
                            return (
                              <td key={day.date} colSpan={2} className={baseClass} {...dropProps}>{content}</td>
                            );
                          })}
                        </tr>
                        <tr className="bg-rose-50/50 hover:bg-rose-50 transition-all">
                          <td className="border border-slate-300 py-1 px-2 sticky left-0 bg-rose-100/80 z-10 font-semibold text-stone-700 align-top text-sm">
                            未配置
                          </td>
                          {calendar.map(day => {
                            const dateStr = day.date;
                            const isWeekend = day.isWeekend || day.isHoliday;
                            const redCol = allocation[dateStr]?._redBackground;
                            const dupCol = datesWithDuplicates?.has(dateStr);
                            const idsAm = getAssignableUnassigned(dateStr, 'am');
                            const idsPm = getAssignableUnassigned(dateStr, 'pm');
                            const manualStaff = allocation[dateStr]?._manualStaff || [];
                            const name = (id) => (id ? (staffData.find(s => s.id === id)?.name || id) : '');
                            const handleDropUnassigned = (slot) => (e) => {
                              e.preventDefault();
                              const raw = e.dataTransfer.getData('text/plain');
                              if (!raw) return;
                              try {
                                const data = JSON.parse(raw);
                                if (data.type !== 'allocation-staff' || data.dateStr !== dateStr) return;
                                const daySched = schedule[dateStr] || {};
                                const idx = calendar.findIndex(d => d.date === dateStr);
                                const nextDay = calendar[idx + 1];
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
                                if (scheduleStaffThisDay.has(data.staffId)) return;
                                const to = { type: 'unassigned' };
                                if (data.fromSource.type === 'unassigned') return;
                                moveAllocationStaff(dateStr, data.staffId, data.fromSource, to);
                              } catch (_) {}
                            };
                            const cellClassBase = `border border-slate-300 py-1 px-2 min-w-[6.5rem] text-left align-top text-sm ${dupCol ? 'bg-stone-500/80' : redCol ? 'bg-red-100' : isWeekend ? 'bg-slate-50' : ''}`;
                            const renderUnassignedList = (ids) => (
                              ids.length ? [...ids].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })).map(id => (
                                <span
                                  key={id}
                                  draggable
                                  className={`block text-sm leading-tight font-medium cursor-grab active:cursor-grabbing ${(duplicateInAMByDate[dateStr]?.has(id) || duplicateInPMByDate[dateStr]?.has(id)) ? 'bg-stone-300 text-stone-900 px-0.5 rounded' : manualStaff.includes(id) ? 'text-red-600' : 'text-stone-800'}`}
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
                                  className={`${cellClassBase} border-l-[3px] border-l-slate-800 ${!redCol && !isWeekend ? 'bg-amber-50/30' : ''}`}
                                  onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes('text/plain')) e.dataTransfer.dropEffect = 'move'; }}
                                  onDrop={handleDropUnassigned('am')}
                                >
                                  <div className="flex flex-col gap-0.5 min-h-[1.75rem]">{renderUnassignedList(idsAm)}</div>
                                </td>
                                <td
                                  className={`${cellClassBase} ${!redCol && !isWeekend ? 'bg-sky-50/30' : ''}`}
                                  onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes('text/plain')) e.dataTransfer.dropEffect = 'move'; }}
                                  onDrop={handleDropUnassigned('pm')}
                                >
                                  <div className="flex flex-col gap-0.5 min-h-[1.75rem]">{renderUnassignedList(idsPm)}</div>
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
            <div className="mt-8">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <h3 className="font-bold text-stone-800 text-2xl">📋 週休割り当て結果</h3>
              <button type="button" onClick={autoAssignWeeklyOffAllocation} className="btn-panel min-h-[52px] px-4 bg-indigo-600 hover:bg-indigo-500 text-white shadow-md text-base">📅 週休自動割当</button>
              <button type="button" onClick={redoWeeklyOff} disabled={weeklyOffRedoCount === 0} className="btn-panel min-h-[52px] px-4 bg-slate-500 hover:bg-slate-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-500 text-white border-2 border-slate-600 text-base">進む →</button>
              <button type="button" onClick={undoWeeklyOff} disabled={weeklyOffUndoCount === 0} className="btn-panel min-h-[52px] px-4 bg-slate-500 hover:bg-slate-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-500 text-white border-2 border-slate-600 text-base">← 戻る</button>
            </div>
            <div className="overflow-x-auto border border-slate-400 rounded-xl" key={scheduleDataVersion}>
              {(() => {
                const scheduleData = JSON.parse(localStorage.getItem('scheduleData') || '{}');
                const sched = mergeScheduleWithOverrides(scheduleData.schedule || {}, scheduleData.manualOverrides);
                const weeklyOffDisplay = scheduleData.weeklyOff || {};
                const nightShiftOrder = scheduleData.nightShiftOrder || [];
                const surgeryDays = scheduleData.surgeryDays || [];
                const leaveDataForTable = (() => {
                  try {
                    return JSON.parse(localStorage.getItem('leaveData') || '{}').leaveData || {};
                  } catch { return {}; }
                })();
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
                              const bPerson = surgeryDays.includes(dateStr) && nextDay ? (sched[nextDay.date]?.nightShift ?? sched[nextDay.date]?.nightShiftManual) : (daySchedule.b ?? daySchedule.bManual);
                              const dayOffPerson = prevDay ? (sched[prevDay.date]?.nightShift ?? sched[prevDay.date]?.nightShiftManual) : (daySchedule.dayOff ?? daySchedule.dayOffManual);
                              const isHoliday = getHolidays(parseInt(day.date.slice(0, 4), 10)).has(day.date);
                              const isWeekendOrHoliday = day.isWeekend || isHoliday;
                              const woSlot = getWeeklyOffBySlot(weeklyOffDisplay, dateStr);
                              const isWeeklyOff = woSlot.am.includes(staffId) || woSlot.pm.includes(staffId);
                              const fromSlot = woSlot.am.includes(staffId) ? 'am' : 'pm';
                              let label = '';
                              let cellClass = 'px-0.5 py-1 text-center border-r border-slate-200';
                              const isDupThisDay = duplicateInDayForSchedule[dateStr]?.has(staffId);
                              const dayShiftDisp = daySchedule.dayShift ?? daySchedule.dayShiftManual;
                              const supportDisp = daySchedule.support ?? daySchedule.supportManual;
                              const nightShiftDisp = daySchedule.nightShift ?? daySchedule.nightShiftManual;
                              if (dayShiftDisp === staffId) { label = 'A'; cellClass += isDupThisDay ? ' bg-stone-300 text-stone-900' : ' bg-emerald-100 text-stone-800'; }
                              else if (supportDisp === staffId) { label = 'S'; cellClass += isDupThisDay ? ' bg-stone-300 text-stone-900' : ' bg-emerald-50 text-stone-700'; }
                              else if (nightShiftDisp === staffId) { label = '16'; cellClass += isDupThisDay ? ' bg-stone-300 text-stone-900' : ' bg-rose-800 text-white'; }
                              else if (bPerson === staffId) { label = 'B'; cellClass += isDupThisDay ? ' bg-stone-300 text-stone-900' : ' bg-blue-600 text-white'; }
                              else if (dayOffPerson === staffId) { label = '非番'; cellClass += isDupThisDay ? ' bg-stone-300 text-stone-900' : ' bg-orange-400 text-white'; }
                              else if (isWeeklyOff) { label = '週休'; cellClass += isDupThisDay ? ' bg-stone-300 text-stone-900' : ' bg-yellow-300 text-stone-800'; }
                              else if (isWeekendOrHoliday) { cellClass += ' bg-yellow-300 text-stone-800'; }
                              else {
                                const dayLeaves = (leaveDataForTable[dateStr] || []).filter(l => l.staffId === staffId);
                                const leaveEntry = dayLeaves.find(l => ['年休', 'リフ休', '特別休', '出張'].includes(l.leaveType)) || dayLeaves.find(l => l.leaveType === '週休') || dayLeaves[0];
                                if (leaveEntry) {
                                  label = leaveEntry.leaveType;
                                  if (leaveEntry.leaveType === '年休' || leaveEntry.leaveType === 'リフ休') cellClass += ' bg-stone-300 text-stone-800';
                                  else if (leaveEntry.leaveType === '特別休') cellClass += ' bg-amber-100 text-stone-800';
                                  else if (leaveEntry.leaveType === '出張') cellClass += ' bg-pink-100 text-stone-800';
                                  else if (leaveEntry.leaveType === '週休') cellClass += ' bg-violet-100 text-stone-800';
                                  else cellClass += ' bg-stone-200 text-stone-800';
                                }
                              }
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
          </div>
        ) : null}
      </div>
    </div>
  );
}
