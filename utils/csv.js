import { downloadFile } from './download';

const WEEKDAYS = [['mon', '月'], ['tue', '火'], ['wed', '水'], ['thu', '木'], ['fri', '金']];

/** 人数設定（数値 or { am, pm }）を [AM, PM] に */
const toAmPm = (v, am, pm) => (v && typeof v === 'object' ? [v.am ?? '', v.pm ?? ''] : [am ?? v ?? '', pm ?? v ?? '']);

function saveCsv(lines, name) {
  const date = new Date().toISOString().split('T')[0];
  downloadFile(`${lines.join('\n')}\n`, `${name}_${date}.csv`, 'text/csv;charset=utf-8;');
}

export function exportModalityCSV(modalityData) {
  const header = ['ID,モダリティ名,設定モード,一律AM,一律PM', ...WEEKDAYS.map(([, l]) => `${l}AM,${l}PM`), '備考'].join(',');
  const rows = modalityData.map((m) => [
    m.id,
    `"${m.name}"`,
    m.staffMode,
    ...toAmPm(m.uniformStaff, m.uniformStaffAm, m.uniformStaffPm),
    ...WEEKDAYS.flatMap(([d]) => toAmPm(m.weekdayStaff?.[d])),
    `"${m.note ?? ''}"`,
  ].join(','));
  saveCsv([header, ...rows], 'モダリティDB');
}

export function exportStaffCSV(modalityData, staffData) {
  const header = ['ID,氏名,入職年数,役職', ...modalityData.map((m) => m.name)].join(',');
  const rows = staffData.map((s) => [
    `"${s.id}","${s.name}",${s.years},"${s.position || ''}"`, ...modalityData.map((m) => s.scores[m.id]),
  ].join(','));
  saveCsv([header, ...rows], '職員DB');
}
