const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

const AUTOSAVE_FILENAME = 'autosave.json';
const SNAPSHOTS_DIRNAME = 'snapshots';

function getDataRoot() {
  return path.join(app.getPath('userData'), 'data');
}

function getAutosavePath() {
  return path.join(getDataRoot(), AUTOSAVE_FILENAME);
}

function getSnapshotsDir() {
  return path.join(getDataRoot(), SNAPSHOTS_DIRNAME);
}

function ensureDataDirs() {
  fs.mkdirSync(getDataRoot(), { recursive: true });
  fs.mkdirSync(getSnapshotsDir(), { recursive: true });
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Windows でも使える日時ファイル名: 2026-09-11_16-59-00.json */
function makeSnapshotFilename(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.json`;
}

function writeJsonFile(filePath, data) {
  ensureDataDirs();
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(text);
}

function registerIpc() {
  ipcMain.handle('persist:writeAutosave', (_event, data) => {
    try {
      writeJsonFile(getAutosavePath(), data);
      return { ok: true, path: getAutosavePath() };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('persist:readAutosave', () => {
    try {
      const data = readJsonFile(getAutosavePath());
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err?.message || String(err), data: null };
    }
  });

  ipcMain.handle('persist:saveSnapshot', (_event, data, label) => {
    try {
      ensureDataDirs();
      const filename = label && typeof label === 'string'
        ? (label.endsWith('.json') ? label : `${label}.json`)
        : makeSnapshotFilename();
      const filePath = path.join(getSnapshotsDir(), path.basename(filename));
      const payload = {
        ...data,
        backupAt: data?.backupAt || new Date().toISOString(),
        snapshotLabel: path.basename(filePath, '.json'),
      };
      writeJsonFile(filePath, payload);
      return { ok: true, path: filePath, filename: path.basename(filePath) };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('persist:listSnapshots', () => {
    try {
      ensureDataDirs();
      const dir = getSnapshotsDir();
      const files = fs.readdirSync(dir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => {
          const full = path.join(dir, name);
          const stat = fs.statSync(full);
          return {
            filename: name,
            label: name.replace(/\.json$/i, ''),
            mtimeMs: stat.mtimeMs,
            size: stat.size,
          };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);
      return { ok: true, snapshots: files, dir };
    } catch (err) {
      return { ok: false, error: err?.message || String(err), snapshots: [] };
    }
  });

  ipcMain.handle('persist:readSnapshot', (_event, filename) => {
    try {
      const safeName = path.basename(String(filename || ''));
      if (!safeName.endsWith('.json')) {
        return { ok: false, error: '不正なファイル名です', data: null };
      }
      const filePath = path.join(getSnapshotsDir(), safeName);
      if (!fs.existsSync(filePath)) {
        return { ok: false, error: 'ファイルが見つかりません', data: null };
      }
      const data = readJsonFile(filePath);
      return { ok: true, data, path: filePath };
    } catch (err) {
      return { ok: false, error: err?.message || String(err), data: null };
    }
  });

  ipcMain.handle('persist:getPaths', () => {
    ensureDataDirs();
    return {
      ok: true,
      dataRoot: getDataRoot(),
      autosavePath: getAutosavePath(),
      snapshotsDir: getSnapshotsDir(),
    };
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

  let allowClose = false;
  let exitInProgress = false;

  mainWindow.on('close', (e) => {
    if (allowClose) return;
    e.preventDefault();
    if (exitInProgress) return;
    exitInProgress = true;
    mainWindow.webContents.send('persist:prepare-exit');

    // レンダラー無応答時のフォールバック（最大 5 秒）
    const fallback = setTimeout(() => {
      allowClose = true;
      if (!mainWindow.isDestroyed()) mainWindow.close();
    }, 5000);

    const onExitDone = () => {
      clearTimeout(fallback);
      ipcMain.removeListener('persist:exit-done', onExitDone);
      allowClose = true;
      if (!mainWindow.isDestroyed()) mainWindow.close();
    };
    ipcMain.once('persist:exit-done', onExitDone);
  });

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  ensureDataDirs();
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
