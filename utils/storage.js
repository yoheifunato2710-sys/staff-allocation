/**
 * localStorage のキーと読み書きを一箇所に集約。
 * データ構造の変更やバックアップはこのファイルを起点に行う。
 * Electron 環境では変更のたび userData へも自動同期する。
 */
import { scheduleLocalAutosave } from './localPersist';

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

/** 最後にデータを変更した日時（ISO）。起動時にどの保存が最新かを比べるのに使う */
const UPDATED_AT_KEY = 'dataUpdatedAt';
export const getDataUpdatedAt = () => localStorage.getItem(UPDATED_AT_KEY);
export const setDataUpdatedAt = (iso) => localStorage.setItem(UPDATED_AT_KEY, iso);

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function writeJson(key, value) {
  const json = JSON.stringify(value);
  if (localStorage.getItem(key) === json) return;
  localStorage.setItem(key, json);
  setDataUpdatedAt(new Date().toISOString());
  scheduleLocalAutosave();
}

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function readArray(key) {
  const v = readJson(key, []);
  return Array.isArray(v) ? v : [];
}

function readObject(key) {
  const v = readJson(key, {});
  return isPlainObject(v) ? v : {};
}

export const getModalityData = () => readArray(STORAGE_KEYS.MODALITY);
export const setModalityData = (data) => writeJson(STORAGE_KEYS.MODALITY, data);

export const getStaffData = () => readArray(STORAGE_KEYS.STAFF);
export const setStaffData = (data) => writeJson(STORAGE_KEYS.STAFF, data);

export const getScheduleData = () => readObject(STORAGE_KEYS.SCHEDULE);
export const setScheduleData = (data) => writeJson(STORAGE_KEYS.SCHEDULE, data);

export function getLeaveData() {
  const leaveData = readJson(STORAGE_KEYS.LEAVE, {})?.leaveData;
  return leaveData && typeof leaveData === 'object' ? leaveData : {};
}
export const setLeaveData = (leaveData) => writeJson(STORAGE_KEYS.LEAVE, { leaveData });

export const getAllocationData = () => readJson(STORAGE_KEYS.ALLOCATION, null);
export const setAllocationData = (data) => writeJson(STORAGE_KEYS.ALLOCATION, data);

export const getCalendarComments = () => readObject(STORAGE_KEYS.CALENDAR_COMMENTS);
export const setCalendarComments = (comments) => writeJson(STORAGE_KEYS.CALENDAR_COMMENTS, comments);

export const getMonthlyComments = () => readObject(STORAGE_KEYS.MONTHLY_COMMENTS);
export const setMonthlyComments = (comments) => writeJson(STORAGE_KEYS.MONTHLY_COMMENTS, comments);

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
    updatedAt: getDataUpdatedAt(),
    backupAt: new Date().toISOString(),
  };
}

export function clearAllData() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  setDataUpdatedAt(new Date().toISOString());
  scheduleLocalAutosave();
}
