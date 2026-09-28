/**
 * 週休データの正規化・参照（AM/PM 別 { am, pm }・legacy 配列形式の両対応）
 */

/** 読み込み時の正規化。legacy 配列はそのまま、{ am, pm } は配列をコピー */
export function normalizeWeeklyOff(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result = {};
  for (const [dateStr, value] of Object.entries(raw)) {
    if (Array.isArray(value)) result[dateStr] = value;
    else if (value?.am || value?.pm) result[dateStr] = { am: [...(value.am || [])], pm: [...(value.pm || [])] };
  }
  return result;
}

/** AM/PM 別に取得。legacy 配列の場合は両スロットに同じリスト */
export function getWeeklyOffBySlot(weeklyOff, dateStr) {
  const raw = weeklyOff?.[dateStr];
  if (!raw) return { am: [], pm: [] };
  if (Array.isArray(raw)) return { am: [...raw], pm: [...raw] };
  return { am: Array.isArray(raw.am) ? raw.am : [], pm: Array.isArray(raw.pm) ? raw.pm : [] };
}

/** AM+PM をマージした職員 ID（重複なし） */
export function getWeeklyOffIds(weeklyOff, dateStr) {
  const { am, pm } = getWeeklyOffBySlot(weeklyOff, dateStr);
  return [...new Set([...am, ...pm])];
}

/** 保存用に { am, pm } 形式へ揃え、空の日は省略 */
export function normalizeWeeklyOffForSave(weeklyOff) {
  const next = {};
  Object.keys(weeklyOff || {}).forEach((dateStr) => {
    const { am, pm } = getWeeklyOffBySlot(weeklyOff, dateStr);
    if (am.length || pm.length) next[dateStr] = { am: [...am], pm: [...pm] };
  });
  return next;
}
