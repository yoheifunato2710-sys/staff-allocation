export function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

export function exportModalityCSV(modalityData) {
  let csv = 'ID,モダリティ名,設定モード,平日一律,月,火,水,木,金,備考\n';
  modalityData.forEach(mod => {
    csv += `${mod.id},"${mod.name}",${mod.staffMode},${mod.uniformStaff},${mod.weekdayStaff.mon},${mod.weekdayStaff.tue},${mod.weekdayStaff.wed},${mod.weekdayStaff.thu},${mod.weekdayStaff.fri},"${mod.note}"\n`;
  });
  downloadCSV(csv, 'モダリティDB_' + new Date().toISOString().split('T')[0] + '.csv');
}

export function exportStaffCSV(modalityData, staffData) {
  let csv = 'ID,氏名,入職年数,役職';
  modalityData.forEach(mod => csv += `,${mod.name}`);
  csv += '\n';

  staffData.forEach(staff => {
    csv += `"${staff.id}","${staff.name}",${staff.years},"${staff.position || ''}"`;
    modalityData.forEach(mod => csv += `,${staff.scores[mod.id]}`);
    csv += '\n';
  });
  downloadCSV(csv, '職員DB_' + new Date().toISOString().split('T')[0] + '.csv');
}
