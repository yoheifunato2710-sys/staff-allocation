import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  getModalityData,
  setModalityData as persistModalityData,
  getStaffData,
  setStaffData as persistStaffData,
} from '../utils/storage';
import { exportModalityCSV as doExportModalityCSV, exportStaffCSV as doExportStaffCSV } from '../utils/csv';
import {
  downloadFullBackup,
  downloadStaffModalityBackup,
  restoreFromBackupFile,
  resetAllPersistedData,
} from '../utils/backup';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [modalityData, setModalityDataState] = useState([]);
  const [staffData, setStaffDataState] = useState([]);
  const modalityLoaded = useRef(false);
  const staffLoaded = useRef(false);

  const reloadFromStorage = useCallback(() => {
    setModalityDataState(getModalityData());
    setStaffDataState(getStaffData());
  }, []);

  useEffect(() => {
    reloadFromStorage();
  }, [reloadFromStorage]);

  useEffect(() => {
    if (!modalityLoaded.current) return;
    persistModalityData(modalityData);
  }, [modalityData]);

  useEffect(() => {
    if (!staffLoaded.current) return;
    persistStaffData(staffData);
  }, [staffData]);

  useEffect(() => {
    const t = setTimeout(() => { modalityLoaded.current = true; }, 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { staffLoaded.current = true; }, 100);
    return () => clearTimeout(t);
  }, []);

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
    window.location.reload();
  };

  const resetAllData = () => {
    resetAllPersistedData();
    window.location.reload();
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
