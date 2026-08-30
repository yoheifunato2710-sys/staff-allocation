/**
 * 週休データの正規化・参照（AM/PM 別・legacy 配列形式の両対応）
 */

/** 保存用に { am, pm } 形式へ正規化 */
export function normalizeWeeklyOff(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result = {};
  for (const [dateStr, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      result[dateStr] = value;
    } else if (value && typeof value === 'object' && !Array.isArray(value) && (value.am || value.pm)) {
      result[dateStr] = { am: value.am ? [...value.am] : [], pm: value.pm ? [...value.pm] : [] };
    }
  }
  return result;
}

/** AM/PM 別に取得。legacy 配列の場合は両スロットに同じリスト */
export function getWeeklyOffBySlot(weeklyOff, dateStr) {
  const raw = weeklyOff?.[dateStr];
  if (!raw) return { am: [], pm: [] };
  if (Array.isArray(raw)) return { am: [...raw], pm: [...raw] };
  return {
    am: Array.isArray(raw.am) ? raw.am : [],
    pm: Array.isArray(raw.pm) ? raw.pm : [],
  };
}

/** 表示・判定用（AM+PM マージ、重複除く） */
export function getWeeklyOffIds(weeklyOff, dateStr) {
  const raw = weeklyOff?.[dateStr];
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return [...new Set([...(raw.am || []), ...(raw.pm || [])])];
}

/** 配置ロジックの「利用不可」判定用（AM+PM マージ） */
export function getWeeklyOffMerged(weeklyOff, dateStr) {
  const { am, pm } = getWeeklyOffBySlot(weeklyOff, dateStr);
  return [...new Set([...am, ...pm])];
}

/** 保存用。空の日は省略 */
export function normalizeWeeklyOffForSave(weeklyOff) {
  const next = {};
  Object.keys(weeklyOff || {}).forEach((dateStr) => {
    const { am, pm } = getWeeklyOffBySlot(weeklyOff, dateStr);
    if (am.length > 0 || pm.length > 0) next[dateStr] = { am: [...am], pm: [...pm] };
  });
  return next;
}
