import { getAllPersistedData } from './storage';

const AUTOSAVE_DEBOUNCE_MS = 600;

function getApi() {
  return typeof window !== 'undefined' ? window.electronAPI : null;
}

export function isElectronPersistAvailable() {
  const api = getApi();
  return !!(api && api.isElectron && typeof api.writeAutosave === 'function');
}

let autosaveTimer = null;
let pendingFlush = null;

/** localStorage 変更後に Electron userData へデバウンス保存 */
export function scheduleLocalAutosave() {
  if (!isElectronPersistAvailable()) return;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    flushLocalAutosave().catch(() => {});
  }, AUTOSAVE_DEBOUNCE_MS);
}

export async function flushLocalAutosave() {
  const api = getApi();
  if (!api?.writeAutosave) return { ok: false, skipped: true };
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
  if (pendingFlush) return pendingFlush;
  pendingFlush = (async () => {
    try {
      const data = getAllPersistedData();
      return await api.writeAutosave(data);
    } finally {
      pendingFlush = null;
    }
  })();
  return pendingFlush;
}

/** 終了時用: 日時ラベル付きスナップショット + autosave */
export async function saveExitSnapshot() {
  const api = getApi();
  if (!api?.saveSnapshot) return { ok: false, skipped: true };
  const data = getAllPersistedData();
  await api.writeAutosave?.(data);
  return api.saveSnapshot(data);
}

export async function listLocalSnapshots() {
  const api = getApi();
  if (!api?.listSnapshots) return { ok: false, snapshots: [] };
  return api.listSnapshots();
}

export async function loadLocalSnapshot(filename) {
  const api = getApi();
  if (!api?.readSnapshot) return { ok: false, data: null };
  return api.readSnapshot(filename);
}

export async function loadAutosaveFile() {
  const api = getApi();
  if (!api?.readAutosave) return { ok: false, data: null };
  return api.readAutosave();
}

/**
 * 終了フックを登録。スナップショット保存後にウィンドウを閉じる。
 * @returns {() => void} cleanup
 */
export function setupExitSnapshotHandler() {
  const api = getApi();
  if (!api?.onPrepareExit) return () => {};

  return api.onPrepareExit(async () => {
    try {
      await saveExitSnapshot();
    } catch (err) {
      console.error('Exit snapshot failed:', err);
    } finally {
      api.notifyExitDone?.();
    }
  });
}

/** UI 表示用: 2026-09-11_16-59-00 → 2026-09-11 16:59:00 */
export function formatSnapshotLabel(labelOrFilename) {
  const base = String(labelOrFilename || '').replace(/\.json$/i, '');
  const m = base.match(/^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]} ${m[2]}:${m[3]}:${m[4]}`;
  return base;
}
