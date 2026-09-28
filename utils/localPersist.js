import { getAllPersistedData } from './storage';

const AUTOSAVE_DEBOUNCE_MS = 600;

const getApi = () => (typeof window !== 'undefined' ? window.electronAPI : undefined);

export const isElectronPersistAvailable = () => typeof getApi()?.writeAutosave === 'function';

let autosaveTimer = null;
let pendingFlush = null;

/** localStorage 変更後に Electron userData へデバウンス保存 */
export function scheduleLocalAutosave() {
  if (!isElectronPersistAvailable()) return;
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => flushLocalAutosave().catch(() => {}), AUTOSAVE_DEBOUNCE_MS);
}

export async function flushLocalAutosave() {
  const api = getApi();
  if (!api?.writeAutosave) return { ok: false, skipped: true };
  clearTimeout(autosaveTimer);
  pendingFlush ??= api.writeAutosave(getAllPersistedData()).finally(() => { pendingFlush = null; });
  return pendingFlush;
}

export const listLocalSnapshots = async () => getApi()?.listSnapshots?.() ?? { ok: false, snapshots: [] };
export const loadLocalSnapshot = async (filename) => getApi()?.readSnapshot?.(filename) ?? { ok: false, data: null };
export const loadAutosaveFile = async () => getApi()?.readAutosave?.() ?? { ok: false, data: null };
export const loadLatestSnapshot = async () => getApi()?.readLatestSnapshot?.() ?? { ok: false, data: null };
export const getBackupDir = async () => (await getApi()?.getBackupDir?.())?.dir ?? '';
export const chooseBackupDir = async () => getApi()?.chooseBackupDir?.() ?? { ok: false };

const savedTime = (data) => Date.parse(data?.updatedAt || data?.backupAt || '') || 0;

/**
 * 起動時: 自動保存ファイルとバックアップ先の最新スナップショットのうち、
 * localStorage より新しいものがあればそれを返す（なければ null）
 */
export async function findNewerSavedData(localUpdatedAt) {
  const localTime = Date.parse(localUpdatedAt || '') || 0;
  const results = await Promise.all([loadAutosaveFile(), loadLatestSnapshot()]);
  const newest = results
    .map((r) => (r?.ok ? r.data : null))
    .filter((d) => d && typeof d === 'object')
    .sort((a, b) => savedTime(b) - savedTime(a))[0];
  return newest && savedTime(newest) > localTime ? newest : null;
}

/**
 * 終了フックを登録。変更の有無にかかわらず、日時付きスナップショットをバックアップ先へ保存してから閉じる。
 * @returns {() => void} cleanup
 */
export function setupExitSnapshotHandler() {
  const api = getApi();
  if (!api?.onPrepareExit) return () => {};
  return api.onPrepareExit(async () => {
    let saved = false;
    try {
      const data = getAllPersistedData();
      await api.writeAutosave?.(data);
      saved = !!(await api.saveSnapshot?.(data))?.ok;
    } catch (err) {
      console.error('Exit snapshot failed:', err);
    } finally {
      api.notifyExitDone?.(saved);
    }
  });
}

/** UI 表示用: 2026-09-11_16-59-00 → 2026-09-11 16:59:00 */
export function formatSnapshotLabel(labelOrFilename) {
  const base = String(labelOrFilename || '').replace(/\.json$/i, '');
  const m = base.match(/^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})$/);
  return m ? `${m[1]} ${m[2]}:${m[3]}:${m[4]}` : base;
}
