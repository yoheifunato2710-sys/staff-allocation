import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { exportModalityCSV as doExportModalityCSV, exportStaffCSV as doExportStaffCSV } from '../utils/csv';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [modalityData, setModalityData] = useState([]);
  const [staffData, setStaffData] = useState([]);
  const modalityLoaded = useRef(false);
  const staffLoaded = useRef(false);

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

  useEffect(() => {
    if (!modalityLoaded.current) return;
    localStorage.setItem('modalityData', JSON.stringify(modalityData));
  }, [modalityData]);

  useEffect(() => {
    if (!staffLoaded.current) return;
    localStorage.setItem('staffData', JSON.stringify(staffData));
  }, [staffData]);

  useEffect(() => {
    const t = setTimeout(() => { modalityLoaded.current = true; }, 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { staffLoaded.current = true; }, 100);
    return () => clearTimeout(t);
  }, []);

  const saveModalityData = () => {
    localStorage.setItem('modalityData', JSON.stringify(modalityData));
  };

  const saveStaffData = () => {
    localStorage.setItem('staffData', JSON.stringify(staffData));
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
