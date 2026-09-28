/**
 * 配置表の自動作成ロジック（UI 非依存）
 */
import { getScheduleData, getLeaveData } from './storage';
import { getWeeklyOffIds, getWeeklyOffBySlot, normalizeWeeklyOffForSave } from './weeklyOff';
import { addDays, parseDate } from './date';

export const KYUKYU_NAME = '救命(日勤)';
export const HALVES = ['am', 'pm'];
export const UNASSIGNED_KEY = { am: '_unassignedAm', pm: '_unassignedPm' };

const NUM_TRIES = 5;
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** 当番は右（手動）を優先し、空なら左（自動）を参照する */
export const pickShift = (daySched, field) => daySched?.[`${field}Manual`] ?? daySched?.[field];

export const isSlot = (slot) => !!slot && !Array.isArray(slot);

/** 配置表に表示する名前（表示名が未入力なら氏名） */
export const allocationName = (staff) => staff?.displayName?.trim() || staff?.name;

export const getUnassigned = (day, half) => day?.[UNASSIGNED_KEY[half]] ?? day?._unassigned ?? [];

export const canWorkHalf = (staff, half) => !staff?.isPartTime || staff.partTimeSlot === 'am_pm' || staff.partTimeSlot === half;

const isCandidateScore = (score) => score >= 1 && score <= 5;

/** 必要人数 { am, pm } */
export function getRequired(mod, dateStr) {
  if (!mod || typeof mod !== 'object' || typeof dateStr !== 'string') return { am: 0, pm: 0 };
  if (mod.staffMode === 'uniform') {
    return { am: mod.uniformStaffAm ?? mod.uniformStaff ?? 0, pm: mod.uniformStaffPm ?? mod.uniformStaff ?? 0 };
  }
  const w = mod.weekdayStaff?.[WEEKDAY_KEYS[parseDate(dateStr).getDay()]];
  if (w && typeof w === 'object') return { am: w.am ?? 0, pm: w.pm ?? 0 };
  return { am: w ?? 0, pm: w ?? 0 };
}

/** スコア降順、同率の場合はランダム */
function sortByScoreRandom(a, b) {
  return (b.score ?? 0) - (a.score ?? 0) || Math.random() - 0.5;
}

/** 不足セル数（必要人数に満たないAM/PMの合計） */
function countShortage(allocation, weekdays, modalityData) {
  let total = 0;
  weekdays.forEach(({ date }) => {
    modalityData.forEach((mod) => {
      const slot = allocation[date]?.[mod.id];
      if (!isSlot(slot)) return;
      const required = getRequired(mod, date);
      HALVES.forEach((h) => { total += Math.max(0, required[h] - (slot[h] || []).length); });
    });
  });
  return total;
}

function isDayShort(day, dateStr, modalityData) {
  return modalityData.some((mod) => {
    const slot = day[mod.id];
    if (!isSlot(slot)) return false;
    const required = getRequired(mod, dateStr);
    return HALVES.some((h) => (slot[h] || []).length < required[h]);
  });
}

/** B担当者: 外科輪番の日は翌日（暦どおり）の夜勤者、それ以外はその日の B */
function getBPersonForDate(schedule, dateStr, surgeryDays) {
  return surgeryDays.includes(dateStr)
    ? pickShift(schedule[addDays(dateStr, 1)], 'nightShift')
    : pickShift(schedule[dateStr], 'b');
}

/** その日にモダリティへ配置できない職員（当番・非番・週休・休暇） */
function getUnavailableStaff({ schedule, surgeryDays, weeklyOff, leaves }, dateStr) {
  const daySched = schedule[dateStr];
  return new Set([
    pickShift(daySched, 'nightShift'),
    pickShift(daySched, 'dayShift'),
    pickShift(daySched, 'support'),
    getBPersonForDate(schedule, dateStr, surgeryDays),
    pickShift(daySched, 'dayOff'),
    ...getWeeklyOffIds(weeklyOff, dateStr),
    ...(leaves[dateStr] || []).map((l) => l?.staffId),
  ].filter(Boolean));
}

/** 救命(日勤)ルール: B担当者を救命PMに据え、もともとPMにいた人は救命の AM からも外す */
function applyKyukyuBRule(day, dateStr, ctx) {
  const bPerson = getBPersonForDate(ctx.schedule, dateStr, ctx.surgeryDays);
  const kyukyu = ctx.modalityData.find((m) => m.name === KYUKYU_NAME);
  const slot = kyukyu && day[kyukyu.id];
  if (!bPerson || !isSlot(slot)) return;
  const prevPm = slot.pm || [];
  slot.pm = [bPerson];
  if (slot.am) slot.am = slot.am.filter((id) => !prevPm.includes(id));
}

/** 救命ルールを適用し、スロット状況から AM/PM 未配置を再計算する */
function finalizeDay(day, dateStr, ctx, unavailable) {
  applyKyukyuBRule(day, dateStr, ctx);
  const available = ctx.staffData.map((s) => s.id).filter((id) => !unavailable.has(id));
  HALVES.forEach((h) => {
    const placed = new Set(ctx.modalityData.flatMap((m) => (isSlot(day[m.id]) ? day[m.id][h] || [] : [])));
    day[UNASSIGNED_KEY[h]] = available.filter((id) => !placed.has(id));
  });
}

/** 初回配置: 候補の少ないモダリティから順に、トレーニング → AM/PM 通し → AM のみ → PM のみ で埋める */
function allocateDay(dateStr, ctx) {
  const { modalityData, staffData } = ctx;
  const day = {};
  const unavailable = getUnavailableStaff(ctx, dateStr);
  const taken = new Set(unavailable);
  const ordered = modalityData
    .map((mod) => ({
      mod,
      required: getRequired(mod, dateStr),
      candidateCount: staffData.filter((s) => !unavailable.has(s.id) && isCandidateScore(s.scores?.[mod.id] ?? 0)).length,
    }))
    .sort((a, b) => a.candidateCount - b.candidateCount || (b.required.am + b.required.pm) - (a.required.am + a.required.pm));

  ordered.forEach(({ mod, required }) => {
    const available = staffData.filter((s) => !taken.has(s.id)).map((s) => ({ ...s, score: s.scores?.[mod.id] ?? 0 }));
    const slot = { am: [], pm: [] };
    const assign = (staff, halves) => {
      halves.forEach((h) => slot[h].push(staff.id));
      taken.add(staff.id);
    };
    available.filter((s) => s.score === 5).forEach((s) => assign(s, HALVES));
    const forRequired = available.filter((s) => s.score >= 1 && s.score <= 4).sort(sortByScoreRandom);
    forRequired
      .filter((s) => canWorkHalf(s, 'am') && canWorkHalf(s, 'pm'))
      .slice(0, Math.min(required.am, required.pm))
      .forEach((s) => assign(s, HALVES));
    HALVES.forEach((h) => {
      for (const staff of forRequired.filter((s) => canWorkHalf(s, h))) {
        if (slot[h].length >= required[h]) break;
        if (!taken.has(staff.id)) assign(staff, [h]);
      }
    });
    if (slot.am.length < required.am || slot.pm.length < required.pm) day._shortage = true;
    if (slot.am.length || slot.pm.length) day[mod.id] = slot;
  });

  finalizeDay(day, dateStr, ctx, unavailable);
  return day;
}

/**
 * 不足しているスロットを埋める。1件でも埋めたら true。
 * moveSurplus=true: 不足日のみ対象。未配置に加え、他モダリティの余剰人員も移動候補にする（救命PMは除く）。
 * moveSurplus=false: 全日対象。未配置の職員のみで、パートの勤務可能時間帯を考慮する。
 */
function fillShortages(allocation, weekdays, ctx, moveSurplus) {
  const { modalityData, staffData } = ctx;
  const findStaff = (id) => staffData.find((s) => s.id === id);
  let changed = false;
  for (let round = 0; round < (moveSurplus ? 100 : 50); round++) {
    let changedThisRound = false;
    for (const { date } of weekdays) {
      const day = allocation[date];
      if (moveSurplus && !day._shortage) continue;
      const unavailable = getUnavailableStaff(ctx, date);
      const unassigned = {
        am: new Set(getUnassigned(day, 'am').filter((id) => !unavailable.has(id))),
        pm: new Set(getUnassigned(day, 'pm').filter((id) => !unavailable.has(id))),
      };
      for (const mod of modalityData) {
        const slot = day[mod.id];
        if (!isSlot(slot)) continue;
        const required = getRequired(mod, date);
        const score = (id) => findStaff(id)?.scores?.[mod.id] ?? 0;
        for (const h of HALVES) {
          if (moveSurplus && h === 'pm' && mod.name === KYUKYU_NAME) continue;
          const list = (slot[h] ||= []);
          let need = required[h] - list.length;
          if (need <= 0) continue;
          const candidates = [...unassigned[h]].filter((id) => isCandidateScore(score(id))).map((id) => ({ id, score: score(id) }));
          if (moveSurplus) {
            modalityData.forEach((m2) => {
              const other = day[m2.id];
              if (m2.id === mod.id || !isSlot(other)) return;
              const ids = other[h] || [];
              if (ids.length > getRequired(m2, date)[h]) ids.forEach((id) => candidates.push({ id, score: score(id), from: other }));
            });
          }
          candidates.sort(sortByScoreRandom);
          for (const { id, from } of candidates) {
            if (need <= 0) break;
            if (list.includes(id)) continue;
            if (!moveSurplus && !canWorkHalf(findStaff(id), h)) continue;
            list.push(id);
            if (from) from[h] = from[h].filter((x) => x !== id);
            else unassigned[h].delete(id);
            need--;
            changedThisRound = true;
          }
        }
      }
      finalizeDay(day, date, ctx, unavailable);
      day._shortage = isDayShort(day, date, modalityData);
    }
    if (!changedThisRound) break;
    changed = true;
  }
  return changed;
}

function mergeScheduleWithOverrides(schedule, manualOverrides) {
  const out = { ...schedule };
  Object.entries(manualOverrides ?? {}).forEach(([dateStr, overrides]) => {
    out[dateStr] = { ...out[dateStr] };
    Object.entries(overrides).forEach(([field, staffId]) => {
      if (staffId != null && staffId !== '') out[dateStr][field] = staffId;
    });
  });
  return out;
}

/**
 * 当番表の期間について配置表を一括計算する（schedule / 休暇 / 週休は localStorage から読む）。
 * 同率ランダムのため複数回試行し、不足が最小の結果を採用する。
 * @returns {{ allocation: object | null, alertMessage: string }}
 */
export function runAllocationForCalendar(calendar, modalityData, staffData) {
  const weekdays = calendar.filter((d) => d && typeof d.date === 'string' && !d.isWeekend && !d.isHoliday);
  if (weekdays.length === 0) return { allocation: null, alertMessage: '⚠️ 対象期間に平日がありません。' };

  const scheduleData = getScheduleData();
  const ctx = {
    schedule: mergeScheduleWithOverrides(scheduleData.schedule || {}, scheduleData.manualOverrides),
    weeklyOff: scheduleData.weeklyOff || {},
    surgeryDays: Array.isArray(scheduleData.surgeryDays) ? scheduleData.surgeryDays : [],
    leaves: getLeaveData(),
    modalityData,
    staffData,
  };

  try {
    let best = null;
    let bestShortage = Infinity;
    for (let i = 0; i < NUM_TRIES && bestShortage > 0; i++) {
      const allocation = {};
      weekdays.forEach(({ date }) => { allocation[date] = allocateDay(date, ctx); });
      // ① 他モダリティから移動 → ② 空きに未配置を配置 を、進まなくなるか不足が解消するまで繰り返す
      for (;;) {
        const moved = fillShortages(allocation, weekdays, ctx, true);
        const filled = fillShortages(allocation, weekdays, ctx, false);
        if ((!moved && !filled) || !weekdays.some(({ date }) => allocation[date]._shortage)) break;
      }
      const shortage = countShortage(allocation, weekdays, modalityData);
      if (shortage < bestShortage) {
        bestShortage = shortage;
        best = allocation;
      }
    }
    let alertMessage = '✅ 自動配置が完了しました';
    if (bestShortage > 0) {
      alertMessage = weekdays.some(({ date }) => best[date]._shortage)
        ? '✅ 自動配置を実行しました。\n⚠️ 一部で必要人数を満たせませんでした。週休自動割り当ての見直しや、職員・モダリティ設定を確認してください。'
        : '✅ 自動配置が完了しました。他モダリティの移動と未配置の充てで必要人数を満たしました。';
    }
    return { allocation: best, alertMessage };
  } catch (err) {
    console.error('配置表作成エラー:', err);
    return { allocation: null, alertMessage: `⚠️ 配置表の作成中にエラーが発生しました。\n${err?.message || String(err)}` };
  }
}

/** 週休を別の平日（AM）へ移動した新しい weeklyOff を返す。移動先が勤務・休暇なら null。 */
export function computeWeeklyOffAfterMove(weeklyOff, staffId, fromDate, toDate, { schedule, calendar, surgeryDays, leaves }) {
  const idx = calendar.findIndex((d) => d.date === toDate);
  const day = calendar[idx];
  if (!day || day.isWeekend || day.isHoliday) return null;
  if ((leaves[toDate] || []).some((l) => l.staffId === staffId)) return null;

  const daySched = schedule[toDate] || {};
  const nextDay = calendar[idx + 1];
  const prevDay = calendar[idx - 1];
  const bPerson = surgeryDays.includes(toDate) && nextDay ? pickShift(schedule[nextDay.date], 'nightShift') : pickShift(daySched, 'b');
  const dayOffPerson = prevDay ? pickShift(schedule[prevDay.date], 'nightShift') : pickShift(daySched, 'dayOff');
  const isAssigned = ['nightShift', 'dayShift', 'support'].some((f) => daySched[f] === staffId || daySched[`${f}Manual`] === staffId)
    || (pickShift(daySched, 'b') ?? bPerson) === staffId
    || (pickShift(daySched, 'dayOff') ?? dayOffPerson) === staffId;
  if (isAssigned) return null;

  const next = normalizeWeeklyOffForSave(weeklyOff);
  const from = getWeeklyOffBySlot(weeklyOff, fromDate);
  next[fromDate] = { am: from.am.filter((id) => id !== staffId), pm: from.pm.filter((id) => id !== staffId) };
  const to = next[toDate] ?? { am: [], pm: [] };
  next[toDate] = { ...to, am: to.am.includes(staffId) ? to.am : [...to.am, staffId] };
  return normalizeWeeklyOffForSave(next);
}
