import {
  SCHEMA_VERSION,
  getAllPersistedData,
  getAllocationData,
  getModalityData,
  getScheduleData,
  getStaffData,
  clearAllData,
  setAllocationData,
  setCalendarComments,
  setLeaveData,
  setModalityData,
  setMonthlyComments,
  setScheduleData,
  setStaffData,
  readJson,
  writeJson,
  STORAGE_KEYS,
} from './storage';
import { normalizeWeeklyOff } from './weeklyOff';

function pad(n) {
  return String(n).padStart(2, '0');
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function getBackupFilename() {
  const d = new Date();
  const timeStr = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const allocation = getAllocationData();
  const dateStr = allocation?.startDate || allocation?.endDate;
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return `backup-${dateStr}-${timeStr}.json`;
  }
  return `backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${timeStr}.json`;
}

/** 全データを JSON ファイルでダウンロード */
export function downloadFullBackup() {
  downloadJson(getAllPersistedData(), getBackupFilename());
}

/** 職員・モダリティと当番順序のみバックアップ */
export function downloadStaffModalityBackup() {
  const scheduleData = getScheduleData();
  const backup = {
    schemaVersion: SCHEMA_VERSION,
    modalityData: getModalityData(),
    staffData: getStaffData(),
    nightShiftOrder: Array.isArray(scheduleData.nightShiftOrder) ? scheduleData.nightShiftOrder : [],
    dayShiftOrder: Array.isArray(scheduleData.dayShiftOrder) ? scheduleData.dayShiftOrder : [],
    nightShiftStartId: scheduleData.nightShiftStartId ?? null,
    dayShiftStartId: scheduleData.dayShiftStartId ?? null,
    pairs: Array.isArray(scheduleData.pairs) ? scheduleData.pairs : [],
    backupAt: new Date().toISOString(),
  };
  const now = new Date();
  const filename = `backup-staff-modality-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
  downloadJson(backup, filename);
}

function applyScheduleFromBackup(backup) {
  if (backup.scheduleData != null) {
    const scheduleData = { ...backup.scheduleData };
    if (scheduleData.weeklyOff) {
      scheduleData.weeklyOff = normalizeWeeklyOff(scheduleData.weeklyOff);
    }
    setScheduleData(scheduleData);
    return;
  }
  if (
    backup.nightShiftOrder != null ||
    backup.dayShiftOrder != null ||
    backup.nightShiftStartId != null ||
    backup.dayShiftStartId != null ||
    backup.pairs != null
  ) {
    const existing = getScheduleData();
    setScheduleData({
      ...existing,
      nightShiftOrder: Array.isArray(backup.nightShiftOrder) ? backup.nightShiftOrder : (existing.nightShiftOrder || []),
      dayShiftOrder: Array.isArray(backup.dayShiftOrder) ? backup.dayShiftOrder : (existing.dayShiftOrder || []),
      nightShiftStartId: backup.nightShiftStartId ?? existing.nightShiftStartId ?? null,
      dayShiftStartId: backup.dayShiftStartId ?? existing.dayShiftStartId ?? null,
      pairs: Array.isArray(backup.pairs) ? backup.pairs : (existing.pairs || []),
    });
  }
}

/** バックアップ JSON を復元（成功時は呼び出し側で reload すること） */
export function restoreFromBackupObject(backup) {
  clearAllData();

  if (backup.modalityData != null) setModalityData(backup.modalityData);
  if (backup.staffData != null) setStaffData(backup.staffData);
  applyScheduleFromBackup(backup);

  if (backup.leaveData != null) {
    const leave = backup.leaveData?.leaveData ?? backup.leaveData;
    if (leave && typeof leave === 'object') setLeaveData(leave);
    else writeJson(STORAGE_KEYS.LEAVE, backup.leaveData);
  }
  if (backup.allocationData != null) setAllocationData(backup.allocationData);
  if (backup.calendarComments != null) setCalendarComments(backup.calendarComments);
  if (backup.monthlyComments != null) setMonthlyComments(backup.monthlyComments);
}

export function restoreFromBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        let text = reader.result;
        if (typeof text !== 'string') text = String(text);
        if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
        const backup = JSON.parse(text);
        restoreFromBackupObject(backup);
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
    reader.readAsText(file, 'UTF-8');
  });
}

/** weeklyOff を正規化して修正版バックアップをダウンロード */
export function downloadFixedBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = JSON.parse(reader.result);
        if (backup.scheduleData?.weeklyOff) {
          backup.scheduleData.weeklyOff = normalizeWeeklyOff(backup.scheduleData.weeklyOff);
        }
        const base = file.name?.endsWith('.json') ? file.name.slice(0, -5) : 'backup-fixed';
        downloadJson(backup, `${base}-fixed.json`);
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
    reader.readAsText(file, 'UTF-8');
  });
}

export function resetAllPersistedData() {
  clearAllData();
}
