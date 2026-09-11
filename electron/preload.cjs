const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,

  writeAutosave: (data) => ipcRenderer.invoke('persist:writeAutosave', data),
  readAutosave: () => ipcRenderer.invoke('persist:readAutosave'),
  saveSnapshot: (data, label) => ipcRenderer.invoke('persist:saveSnapshot', data, label),
  listSnapshots: () => ipcRenderer.invoke('persist:listSnapshots'),
  readSnapshot: (filename) => ipcRenderer.invoke('persist:readSnapshot', filename),
  getPersistPaths: () => ipcRenderer.invoke('persist:getPaths'),

  onPrepareExit: (callback) => {
    const handler = () => {
      try {
        callback();
      } catch (_) {
        ipcRenderer.send('persist:exit-done');
      }
    };
    ipcRenderer.on('persist:prepare-exit', handler);
    return () => ipcRenderer.removeListener('persist:prepare-exit', handler);
  },

  notifyExitDone: () => ipcRenderer.send('persist:exit-done'),
});
