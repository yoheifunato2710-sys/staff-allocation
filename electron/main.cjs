const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
const EXIT_FALLBACK_MS = 5000;
const SNAPSHOT_NAME = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/;

const dataRoot = () => path.join(app.getPath('userData'), 'data');
const autosavePath = () => path.join(dataRoot(), 'autosave.json');
const settingsPath = () => path.join(dataRoot(), 'settings.json');
const legacySnapshotsDir = () => path.join(dataRoot(), 'snapshots');
const defaultBackupDir = () => path.join(app.getPath('documents'), '人員配置管理バックアップ');

const pad = (n) => String(n).padStart(2, '0');

/** Windows でも使える日時ファイル名: 2026-09-11_16-59-00.json */
function makeSnapshotFilename(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.json`;
}

function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function readJsonFile(filePath) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')) : null;
}

function readSettings() {
  try {
    return readJsonFile(settingsPath()) || {};
  } catch (_) {
    return {};
  }
}

const getBackupDir = () => readSettings().backupDir || defaultBackupDir();

/** 日時名のスナップショットを新しい順に（バックアップ先 → 旧保存先の順で同名は前者を優先） */
function listSnapshotFiles() {
  const seen = new Set();
  return [getBackupDir(), legacySnapshotsDir()]
    .flatMap((dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => SNAPSHOT_NAME.test(n)).map((n) => ({ dir, filename: n })) : []))
    .filter(({ filename }) => !seen.has(filename) && seen.add(filename))
    .sort((a, b) => b.filename.localeCompare(a.filename));
}

function saveSnapshot(data) {
  const filename = makeSnapshotFilename();
  const filePath = path.join(getBackupDir(), filename);
  writeJsonFile(filePath, {
    ...data,
    backupAt: data?.backupAt || new Date().toISOString(),
    snapshotLabel: path.basename(filename, '.json'),
  });
  return { path: filePath, filename };
}

/** 例外は { ok: false, error, ...fallback } に変換して返す */
function handle(channel, fn, fallback = {}) {
  ipcMain.handle(channel, (_event, ...args) => {
    try {
      return { ok: true, ...fn(...args) };
    } catch (err) {
      return { ok: false, error: err?.message || String(err), ...fallback };
    }
  });
}

function registerIpc() {
  handle('persist:writeAutosave', (data) => {
    writeJsonFile(autosavePath(), data);
    return { path: autosavePath() };
  });

  handle('persist:readAutosave', () => ({ data: readJsonFile(autosavePath()) }), { data: null });

  handle('persist:saveSnapshot', saveSnapshot);

  handle('persist:listSnapshots', () => ({
    snapshots: listSnapshotFiles().map(({ filename }) => ({ filename, label: filename.replace(/\.json$/i, '') })),
    dir: getBackupDir(),
  }), { snapshots: [] });

  handle('persist:readSnapshot', (filename) => {
    const safeName = path.basename(String(filename || ''));
    const entry = listSnapshotFiles().find((f) => f.filename === safeName);
    if (!entry) throw new Error('ファイルが見つかりません');
    const filePath = path.join(entry.dir, safeName);
    return { data: readJsonFile(filePath), path: filePath };
  }, { data: null });

  /** 最新のスナップショット（壊れたファイルは飛ばす） */
  handle('persist:readLatestSnapshot', () => {
    for (const { dir, filename } of listSnapshotFiles()) {
      try {
        const data = readJsonFile(path.join(dir, filename));
        if (data && typeof data === 'object') return { data, filename };
      } catch (_) { /* 次のファイルへ */ }
    }
    return { data: null };
  }, { data: null });

  handle('persist:getBackupDir', () => ({ dir: getBackupDir() }));

  ipcMain.handle('persist:chooseBackupDir', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
      title: 'バックアップの保存先フォルダを選択',
      defaultPath: getBackupDir(),
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true, dir: getBackupDir() };
    try {
      writeJsonFile(settingsPath(), { ...readSettings(), backupDir: result.filePaths[0] });
      return { ok: true, dir: result.filePaths[0] };
    } catch (err) {
      return { ok: false, error: err?.message || String(err), dir: getBackupDir() };
    }
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '人員配置管理',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // 閉じる前にレンダラーへ最新データのバックアップを依頼する。
  // 失敗・無応答（5 秒）のときは直近の autosave をバックアップ先へ書き出してから閉じる
  let allowClose = false;
  let exitInProgress = false;
  mainWindow.on('close', (e) => {
    if (allowClose) return;
    e.preventDefault();
    if (exitInProgress) return;
    exitInProgress = true;
    const onDone = (_event, saved) => finish(saved === true);
    const finish = (saved) => {
      clearTimeout(fallback);
      ipcMain.removeListener('persist:exit-done', onDone);
      if (!saved) {
        try {
          const data = readJsonFile(autosavePath());
          if (data) saveSnapshot(data);
        } catch (err) {
          console.error('Exit backup failed:', err);
        }
      }
      allowClose = true;
      if (!mainWindow.isDestroyed()) mainWindow.close();
    };
    const fallback = setTimeout(() => finish(false), EXIT_FALLBACK_MS);
    ipcMain.once('persist:exit-done', onDone);
    mainWindow.webContents.send('persist:prepare-exit');
  });

  if (app.isPackaged) mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  else mainWindow.loadURL(DEV_SERVER_URL);
}

app.whenReady().then(() => {
  fs.mkdirSync(dataRoot(), { recursive: true });
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
