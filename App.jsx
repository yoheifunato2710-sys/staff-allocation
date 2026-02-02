import React, { useState, useEffect } from 'react';
import { DataProvider } from './context/DataContext';
import MainMenu from './screens/MainMenu';
import ModalityDB from './screens/ModalityDB';
import StaffDB from './screens/StaffDB';
import RulesScreen from './screens/RulesScreen';
import ShiftScheduleScreen from './screens/ShiftScheduleScreen';
import LeaveInputScreen from './screens/LeaveInputScreen';
import AllocationScreen from './screens/AllocationScreen';
import PlaceholderScreen from './screens/PlaceholderScreen';

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState('main-menu');
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'バックアップを取得しましたか？データが失われる可能性があります。';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const onBack = () => setCurrentScreen('main-menu');
  const onNavigate = (screen) => setCurrentScreen(screen);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'main-menu':
        return <MainMenu onNavigate={onNavigate} />;
      case 'modality-db':
        return <ModalityDB onBack={onBack} />;
      case 'staff-db':
        return (
          <StaffDB
            onBack={onBack}
            showStaffForm={showStaffForm}
            setShowStaffForm={setShowStaffForm}
            editingStaff={editingStaff}
            setEditingStaff={setEditingStaff}
          />
        );
      case 'rules':
        return <RulesScreen onBack={onBack} />;
      case 'shift-schedule':
        return <ShiftScheduleScreen onBack={onBack} />;
      case 'leave-input':
        return <LeaveInputScreen onBack={onBack} />;
      case 'allocation':
        return <AllocationScreen onBack={onBack} />;
      case 'data-manage':
        return <PlaceholderScreen title="データ保存・読込" onBack={onBack} />;
      default:
        return <MainMenu onNavigate={onNavigate} />;
    }
  };

  return <div className="w-full min-h-screen min-w-0">{renderScreen()}</div>;
}

export default function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}
