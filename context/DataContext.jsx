import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getModalityData,
  setModalityData as persistModalityData,
  getStaffData,
  setStaffData as persistStaffData,
  getDataUpdatedAt,
  clearAllData,
} from '../utils/storage';
import { exportModalityCSV, exportStaffCSV } from '../utils/csv';
import {
  downloadFullBackup,
  downloadStaffModalityBackup,
  restoreFromBackupFile,
  restoreFromBackupObject,
} from '../utils/backup';
import {
  isElectronPersistAvailable,
  findNewerSavedData,
  listLocalSnapshots,
  loadLocalSnapshot,
  flushLocalAutosave,
  setupExitSnapshotHandler,
  getBackupDir,
  chooseBackupDir,
} from '../utils/localPersist';

const DataContext = createContext(null);

async function flushAndReload() {
  await flushLocalAutosave();
  window.location.reload();
}

export function DataProvider({ children }) {
  const [modalityData, setModalityData] = useState([]);
  const [staffData, setStaffData] = useState([]);
  const [persistReady, setPersistReady] = useState(false);

  // 起動時: 自動保存・バックアップ先の最新スナップショットが今のデータより新しければ、それを読み込んで再開
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isElectronPersistAvailable()) {
          const newer = await findNewerSavedData(getDataUpdatedAt());
          if (cancelled) return;
          if (newer) restoreFromBackupObject(newer);
          await flushLocalAutosave();
        }
      } catch (err) {
        console.error('Failed to hydrate from autosave:', err);
      } finally {
        if (!cancelled) {
          setModalityData(getModalityData());
          setStaffData(getStaffData());
          setPersistReady(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => (persistReady ? setupExitSnapshotHandler() : undefined), [persistReady]);

  useEffect(() => {
    if (persistReady) persistModalityData(modalityData);
  }, [modalityData, persistReady]);

  useEffect(() => {
    if (persistReady) persistStaffData(staffData);
  }, [staffData, persistReady]);

  const value = {
    modalityData,
    setModalityData,
    staffData,
    setStaffData,
    exportModalityCSV: () => exportModalityCSV(modalityData),
    exportStaffCSV: () => exportStaffCSV(modalityData, staffData),
    backupAll: downloadFullBackup,
    backupStaffModality: downloadStaffModalityBackup,
    restoreBackup: async (file) => {
      await restoreFromBackupFile(file);
      await flushAndReload();
    },
    restoreLocalSnapshot: async (filename) => {
      const result = await loadLocalSnapshot(filename);
      if (!result?.ok || !result.data) throw new Error(result?.error || 'スナップショットの読み込みに失敗しました');
      restoreFromBackupObject(result.data);
      await flushAndReload();
    },
    fetchLocalSnapshots: listLocalSnapshots,
    getBackupDir,
    chooseBackupDir,
    isElectronPersist: isElectronPersistAvailable(),
    resetAllData: () => {
      clearAllData();
      flushLocalAutosave().finally(() => window.location.reload());
    },
  };

  return <DataContext.Provider value={value}>{persistReady ? children : null}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
