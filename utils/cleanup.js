/**
 * 職員・モダリティ削除時に、当番表・休暇・配置表に残る参照を取り除く
 */
import {
  getScheduleData,
  setScheduleData,
  getLeaveData,
  setLeaveData,
  getAllocationData,
  setAllocationData,
} from './storage';
import { getWeeklyOffBySlot } from './weeklyOff';
import { UNASSIGNED_KEY, HALVES } from './allocation';

const MANUAL_KEYS = ['_manualSlots', '_manualStaff'];

const mapValues = (obj, fn) => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, fn(v, k)]));

function updateAllocationDays(fn) {
  const data = getAllocationData();
  if (!data?.allocation) return;
  setAllocationData({ ...data, allocation: mapValues(data.allocation, (day) => fn({ ...day })) });
}

export function removeStaffReferences(staffId) {
  const without = (ids) => (Array.isArray(ids) ? ids.filter((id) => id !== staffId) : ids);

  const schedule = getScheduleData();
  if (Object.keys(schedule).length > 0) {
    const clearShifts = (days) => mapValues(days, (entry) => mapValues(entry, (v) => (v === staffId ? null : v)));
    const weeklyOff = {};
    Object.keys(schedule.weeklyOff || {}).forEach((date) => {
      const { am, pm } = getWeeklyOffBySlot(schedule.weeklyOff, date);
      const next = { am: without(am), pm: without(pm) };
      if (next.am.length || next.pm.length) weeklyOff[date] = next;
    });
    setScheduleData({
      ...schedule,
      schedule: clearShifts(schedule.schedule),
      ...(schedule.manualOverrides && { manualOverrides: clearShifts(schedule.manualOverrides) }),
      nightShiftOrder: without(schedule.nightShiftOrder || []),
      dayShiftOrder: without(schedule.dayShiftOrder || []),
      nightShiftStartId: schedule.nightShiftStartId === staffId ? null : schedule.nightShiftStartId ?? null,
      dayShiftStartId: schedule.dayShiftStartId === staffId ? null : schedule.dayShiftStartId ?? null,
      pairs: (schedule.pairs || []).filter((p) => p.person1 !== staffId && p.person2 !== staffId),
      weeklyOff,
    });
  }

  const leave = getLeaveData();
  const nextLeave = {};
  Object.entries(leave).forEach(([date, list]) => {
    const rest = (list || []).filter((l) => l?.staffId !== staffId);
    if (rest.length) nextLeave[date] = rest;
  });
  setLeaveData(nextLeave);

  updateAllocationDays((day) => mapValues(day, (v, key) => {
    if (MANUAL_KEYS.includes(key)) return (v || []).filter((m) => m?.staffId !== staffId);
    if (Array.isArray(v)) return without(v);
    if (v && typeof v === 'object') return { ...v, am: without(v.am || []), pm: without(v.pm || []) };
    return v;
  }));
}

/** モダリティに配置されていた職員は、その日の未配置に戻す */
export function removeModalityReferences(modId) {
  updateAllocationDays((day) => {
    const slot = day[modId];
    if (slot) {
      HALVES.forEach((h) => {
        const ids = Array.isArray(slot) ? (h === 'am' ? slot : []) : slot[h] || [];
        const key = UNASSIGNED_KEY[h];
        day[key] = [...new Set([...(day[key] || day._unassigned || []), ...ids])];
      });
      delete day[modId];
    }
    MANUAL_KEYS.forEach((key) => {
      if (day[key]) day[key] = day[key].filter((m) => m?.modId != modId);
    });
    return day;
  });
}
