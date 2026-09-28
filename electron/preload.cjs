const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  writeAutosave: (data) => ipcRenderer.invoke('persist:writeAutosave', data),
  readAutosave: () => ipcRenderer.invoke('persist:readAutosave'),
  saveSnapshot: (data) => ipcRenderer.invoke('persist:saveSnapshot', data),
  listSnapshots: () => ipcRenderer.invoke('persist:listSnapshots'),
  readSnapshot: (filename) => ipcRenderer.invoke('persist:readSnapshot', filename),
  readLatestSnapshot: () => ipcRenderer.invoke('persist:readLatestSnapshot'),
  getBackupDir: () => ipcRenderer.invoke('persist:getBackupDir'),
  chooseBackupDir: () => ipcRenderer.invoke('persist:chooseBackupDir'),

  onPrepareExit: (callback) => {
    const handler = () => {
      try {
        callback();
      } catch (_) {
        ipcRenderer.send('persist:exit-done', false);
      }
    };
    ipcRenderer.on('persist:prepare-exit', handler);
    return () => ipcRenderer.removeListener('persist:prepare-exit', handler);
  },

  notifyExitDone: (saved) => ipcRenderer.send('persist:exit-done', saved === true),
});
