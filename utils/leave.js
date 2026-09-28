export const LEAVE_TYPES = ['週休', '年休', 'リフ休', '特別休', '出張'];

/** 休暇データ { [date]: [{ staffId, leaveType }] } を不変更新するヘルパー */
export function addLeaves(data, dates, staffId, leaveType) {
  const next = { ...data };
  dates.forEach((date) => {
    const list = next[date] || [];
    if (!list.some((l) => l.staffId === staffId)) next[date] = [...list, { staffId, leaveType }];
  });
  return next;
}

export function removeLeave(data, date, staffId) {
  const next = { ...data };
  const list = (next[date] || []).filter((l) => l.staffId !== staffId);
  if (list.length) next[date] = list;
  else delete next[date];
  return next;
}

export function updateLeaveType(data, date, staffId, leaveType) {
  if (!data[date]) return data;
  return { ...data, [date]: data[date].map((l) => (l.staffId === staffId ? { ...l, leaveType } : l)) };
}
