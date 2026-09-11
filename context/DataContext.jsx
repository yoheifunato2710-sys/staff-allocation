import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  getModalityData,
  setModalityData as persistModalityData,
  getStaffData,
  setStaffData as persistStaffData,
  getScheduleData,
} from '../utils/storage';
import { exportModalityCSV as doExportModalityCSV, exportStaffCSV as doExportStaffCSV } from '../utils/csv';
import {
  downloadFullBackup,
  downloadStaffModalityBackup,
  restoreFromBackupFile,
  restoreFromBackupObject,
  resetAllPersistedData,
} from '../utils/backup';
import {
  isElectronPersistAvailable,
  loadAutosaveFile,
  listLocalSnapshots,
  loadLocalSnapshot,
  flushLocalAutosave,
  setupExitSnapshotHandler,
} from '../utils/localPersist';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [modalityData, setModalityDataState] = useState([]);
  const [staffData, setStaffDataState] = useState([]);
  const [persistReady, setPersistReady] = useState(false);
  const modalityLoaded = useRef(false);
  const staffLoaded = useRef(false);

  const reloadFromStorage = useCallback(() => {
    setModalityDataState(getModalityData());
    setStaffDataState(getStaffData());
  }, []);

  // 起動時: Electron の autosave があれば localStorage へ反映して再開
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isElectronPersistAvailable()) {
          const staff = getStaffData();
          const modality = getModalityData();
          const schedule = Object.keys(getScheduleData() || {}).length > 0;
          const hasLocal = (Array.isArray(staff) && staff.length > 0)
            || (Array.isArray(modality) && modality.length > 0)
            || schedule;
          if (!hasLocal) {
            const result = await loadAutosaveFile();
            if (!cancelled && result?.ok && result.data) {
              restoreFromBackupObject(result.data);
            }
          } else {
            await flushLocalAutosave();
          }
        }
      } catch (err) {
        console.error('Failed to hydrate from autosave:', err);
      } finally {
        if (!cancelled) {
          reloadFromStorage();
          setPersistReady(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [reloadFromStorage]);

  useEffect(() => {
    if (!persistReady) return undefined;
    return setupExitSnapshotHandler();
  }, [persistReady]);

  useEffect(() => {
    if (!persistReady || !modalityLoaded.current) return;
    persistModalityData(modalityData);
  }, [modalityData, persistReady]);

  useEffect(() => {
    if (!persistReady || !staffLoaded.current) return;
    persistStaffData(staffData);
  }, [staffData, persistReady]);

  useEffect(() => {
    if (!persistReady) return undefined;
    const t = setTimeout(() => { modalityLoaded.current = true; }, 100);
    return () => clearTimeout(t);
  }, [persistReady]);

  useEffect(() => {
    if (!persistReady) return undefined;
    const t = setTimeout(() => { staffLoaded.current = true; }, 100);
    return () => clearTimeout(t);
  }, [persistReady]);

  const setModalityData = (updater) => {
    setModalityDataState((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  };

  const setStaffData = (updater) => {
    setStaffDataState((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  };

  const saveModalityData = () => persistModalityData(modalityData);
  const saveStaffData = () => persistStaffData(staffData);

  const exportModalityCSV = () => doExportModalityCSV(modalityData);
  const exportStaffCSV = () => doExportStaffCSV(modalityData, staffData);

  const backupAll = () => downloadFullBackup();
  const backupStaffModality = () => downloadStaffModalityBackup();

  const restoreBackup = async (file) => {
    await restoreFromBackupFile(file);
    await flushLocalAutosave();
    window.location.reload();
  };

  const restoreLocalSnapshot = async (filename) => {
    const result = await loadLocalSnapshot(filename);
    if (!result?.ok || !result.data) {
      throw new Error(result?.error || 'スナップショットの読み込みに失敗しました');
    }
    restoreFromBackupObject(result.data);
    await flushLocalAutosave();
    window.location.reload();
  };

  const fetchLocalSnapshots = async () => listLocalSnapshots();

  const resetAllData = () => {
    resetAllPersistedData();
    flushLocalAutosave().finally(() => window.location.reload());
  };

  const value = {
    modalityData,
    setModalityData,
    staffData,
    setStaffData,
    reloadFromStorage,
    saveModalityData,
    saveStaffData,
    exportModalityCSV,
    exportStaffCSV,
    backupAll,
    backupStaffModality,
    restoreBackup,
    restoreLocalSnapshot,
    fetchLocalSnapshots,
    isElectronPersist: isElectronPersistAvailable(),
    persistReady,
    resetAllData,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
