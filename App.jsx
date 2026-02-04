import React, { useState, useEffect, useRef, Component } from 'react';
import { DataProvider } from './context/DataContext';
import MainMenu from './screens/MainMenu';
import ModalityDB from './screens/ModalityDB';
import StaffDB from './screens/StaffDB';
import RulesScreen from './screens/RulesScreen';
import ShiftScheduleScreen from './screens/ShiftScheduleScreen';
import LeaveInputScreen from './screens/LeaveInputScreen';
import AllocationScreen from './screens/AllocationScreen';
import PlaceholderScreen from './screens/PlaceholderScreen';

const NAV_GUARD_MS = 1200; // 遷移直後の誤タップで戻らないようガード（Edge 対策で 1.2 秒）

/** 画面でエラーが起きても背景だけにならないよう、メニューに戻れるフォールバックを表示 */
class ScreenErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ScreenErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-violet-400 flex items-center justify-center p-5">
          <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md border-2 border-stone-200">
            <p className="text-lg text-stone-800 mb-4 font-medium">表示中に問題が発生しました。</p>
            <button
              type="button"
              onClick={() => this.props.onBack()}
              className="min-h-[44px] px-5 py-2.5 rounded-lg text-base font-semibold border-2 border-slate-600 bg-white hover:bg-slate-100 text-stone-800 transition-all"
            >
              メニューに戻る
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState('main-menu');
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const lastNavigateAtRef = useRef(0);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'バックアップを取得しましたか？データが失われる可能性があります。';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const onBack = () => {
    if (Date.now() - lastNavigateAtRef.current < NAV_GUARD_MS) return;
    setCurrentScreen('main-menu');
  };
  const onNavigate = (screen) => {
    lastNavigateAtRef.current = Date.now();
    setCurrentScreen(screen);
  };

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

  const onForceBack = () => setCurrentScreen('main-menu');

  return (
    <div className="w-full min-h-screen min-w-0">
      <ScreenErrorBoundary key={currentScreen} onBack={onForceBack}>
        {renderScreen()}
      </ScreenErrorBoundary>
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}
