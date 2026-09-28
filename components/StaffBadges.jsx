import React from 'react';

export const PART_TIME_SLOTS = [
  { value: 'am', label: 'AM' },
  { value: 'pm', label: 'PM' },
  { value: 'am_pm', label: 'AM＆PM' },
];

/** 職員一覧の行に表示するパート勤務帯・役職 */
export default function StaffBadges({ staff }) {
  const partTimeLabel = PART_TIME_SLOTS.find((s) => s.value === staff.partTimeSlot)?.label ?? 'PM';
  return (
    <>
      {staff.isPartTime && (
        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">{partTimeLabel}</span>
      )}
      {staff.position && <span className="text-stone-600 text-xs shrink-0 truncate max-w-[100px]">{staff.position}</span>}
    </>
  );
}
