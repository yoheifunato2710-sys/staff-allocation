/**
 * localStorage のキーと読み書きを一箇所に集約。
 * データ構造の変更やバックアップはこのファイルを起点に行う。
 */

export const STORAGE_KEYS = {
  MODALITY: 'modalityData',
  STAFF: 'staffData',
  SCHEDULE: 'scheduleData',
  LEAVE: 'leaveData',
  ALLOCATION: 'allocationData',
  CALENDAR_COMMENTS: 'mainMenuCalendarComments',
  MONTHLY_COMMENTS: 'mainMenuMonthlyComments',
};

export const SCHEMA_VERSION = 1;

/** @template T */
export function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

export function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeKey(key) {
  localStorage.removeItem(key);
}

// --- 職員・モダリティ ---

export function getModalityData() {
  const parsed = readJson(STORAGE_KEYS.MODALITY, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function setModalityData(data) {
  writeJson(STORAGE_KEYS.MODALITY, data);
}

export function getStaffData() {
  const parsed = readJson(STORAGE_KEYS.STAFF, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function setStaffData(data) {
  writeJson(STORAGE_KEYS.STAFF, data);
}

// --- 当番表 ---

export function getScheduleData() {
  return readJson(STORAGE_KEYS.SCHEDULE, {}) || {};
}

export function setScheduleData(data) {
  writeJson(STORAGE_KEYS.SCHEDULE, data);
}

export function patchScheduleData(patch) {
  setScheduleData({ ...getScheduleData(), ...patch });
}

// --- 休暇 ---

export function getLeaveData() {
  const parsed = readJson(STORAGE_KEYS.LEAVE, {});
  return parsed?.leaveData && typeof parsed.leaveData === 'object' ? parsed.leaveData : {};
}

export function setLeaveData(leaveData) {
  writeJson(STORAGE_KEYS.LEAVE, { leaveData });
}

// --- 配置表 ---

export function getAllocationData() {
  return readJson(STORAGE_KEYS.ALLOCATION, null);
}

export function setAllocationData(data) {
  writeJson(STORAGE_KEYS.ALLOCATION, data);
}

// --- カレンダーコメント ---

export function getCalendarComments() {
  const parsed = readJson(STORAGE_KEYS.CALENDAR_COMMENTS, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

export function setCalendarComments(comments) {
  writeJson(STORAGE_KEYS.CALENDAR_COMMENTS, comments);
}

export function getMonthlyComments() {
  const parsed = readJson(STORAGE_KEYS.MONTHLY_COMMENTS, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

export function setMonthlyComments(comments) {
  writeJson(STORAGE_KEYS.MONTHLY_COMMENTS, comments);
}

// --- 一括操作 ---

export function getAllPersistedData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    modalityData: getModalityData(),
    staffData: getStaffData(),
    scheduleData: getScheduleData(),
    leaveData: { leaveData: getLeaveData() },
    allocationData: getAllocationData(),
    calendarComments: getCalendarComments(),
    monthlyComments: getMonthlyComments(),
    backupAt: new Date().toISOString(),
  };
}

export function clearAllData() {
  Object.values(STORAGE_KEYS).forEach(removeKey);
}
