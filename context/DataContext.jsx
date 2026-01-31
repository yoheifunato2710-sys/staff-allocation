import React, { createContext, useContext, useState, useEffect } from 'react';
import { exportModalityCSV as doExportModalityCSV, exportStaffCSV as doExportStaffCSV } from '../utils/csv';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [modalityData, setModalityData] = useState([]);
  const [staffData, setStaffData] = useState([]);

  const loadModalityData = () => {
    const saved = localStorage.getItem('modalityData');
    if (saved) {
      setModalityData(JSON.parse(saved));
    } else {
      setModalityData([]);
    }
  };

  const loadStaffData = () => {
    const saved = localStorage.getItem('staffData');
    if (saved) {
      setStaffData(JSON.parse(saved));
    }
  };

  useEffect(() => {
    loadModalityData();
    loadStaffData();
  }, []);

  const saveModalityData = () => {
    localStorage.setItem('modalityData', JSON.stringify(modalityData));
    alert('✅ モダリティデータを保存しました');
  };

  const saveStaffData = () => {
    localStorage.setItem('staffData', JSON.stringify(staffData));
    alert('✅ 職員データを保存しました');
  };

  const exportModalityCSV = () => {
    doExportModalityCSV(modalityData);
  };

  const exportStaffCSV = () => {
    doExportStaffCSV(modalityData, staffData);
  };

  const value = {
    modalityData,
    setModalityData,
    staffData,
    setStaffData,
    loadModalityData,
    loadStaffData,
    saveModalityData,
    saveStaffData,
    exportModalityCSV,
    exportStaffCSV
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
