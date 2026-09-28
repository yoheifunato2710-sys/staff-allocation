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
} from './storage';
import { normalizeWeeklyOff } from './weeklyOff';
import { downloadFile } from './download';
import { isDateStr, timestamp } from './date';

const ORDER_KEYS = ['nightShiftOrder', 'dayShiftOrder', 'pairs'];
const START_ID_KEYS = ['nightShiftStartId', 'dayShiftStartId'];

const downloadJson = (data, filename) => downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
const asArray = (v) => (Array.isArray(v) ? v : []);

/** 全データを JSON ファイルでダウンロード（配置表の開始日があればファイル名に使う） */
export function downloadFullBackup() {
  const now = timestamp();
  const allocation = getAllocationData();
  const dateStr = allocation?.startDate || allocation?.endDate;
  const name = isDateStr(dateStr) ? `${dateStr}-${now.slice(-6)}` : now;
  downloadJson(getAllPersistedData(), `backup-${name}.json`);
}

/** 職員・モダリティと当番順序のみバックアップ */
export function downloadStaffModalityBackup() {
  const schedule = getScheduleData();
  const backup = { schemaVersion: SCHEMA_VERSION, modalityData: getModalityData(), staffData: getStaffData() };
  ORDER_KEYS.forEach((k) => { backup[k] = asArray(schedule[k]); });
  START_ID_KEYS.forEach((k) => { backup[k] = schedule[k] ?? null; });
  backup.backupAt = new Date().toISOString();
  downloadJson(backup, `backup-staff-modality-${timestamp()}.json`);
}

/** バックアップ JSON を復元（成功時は呼び出し側で reload すること） */
export function restoreFromBackupObject(backup) {
  clearAllData();
  const { modalityData, staffData, scheduleData, leaveData, allocationData, calendarComments, monthlyComments } = backup;

  if (modalityData != null) setModalityData(modalityData);
  if (staffData != null) setStaffData(staffData);

  if (scheduleData != null) {
    setScheduleData(scheduleData.weeklyOff
      ? { ...scheduleData, weeklyOff: normalizeWeeklyOff(scheduleData.weeklyOff) }
      : scheduleData);
  } else if ([...ORDER_KEYS, ...START_ID_KEYS].some((k) => backup[k] != null)) {
    // 職員・モダリティのみのバックアップ形式
    const schedule = {};
    ORDER_KEYS.forEach((k) => { schedule[k] = asArray(backup[k]); });
    START_ID_KEYS.forEach((k) => { schedule[k] = backup[k] ?? null; });
    setScheduleData(schedule);
  }

  if (leaveData != null) {
    const leave = leaveData.leaveData ?? leaveData;
    if (typeof leave === 'object') setLeaveData(leave);
  }
  if (allocationData != null) setAllocationData(allocationData);
  if (calendarComments != null) setCalendarComments(calendarComments);
  if (monthlyComments != null) setMonthlyComments(monthlyComments);
}

export async function restoreFromBackupFile(file) {
  const text = (await file.text()).replace(/^\uFEFF/, '');
  restoreFromBackupObject(JSON.parse(text));
}
