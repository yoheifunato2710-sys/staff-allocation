import React, { useState, useEffect, useRef } from 'react';
import { DataProvider } from './context/DataContext';
import ErrorBoundary from './components/ErrorBoundary';
import MainMenu from './screens/MainMenu';
import ModalityDB from './screens/ModalityDB';
import StaffDB from './screens/StaffDB';
import RulesScreen from './screens/RulesScreen';
import ShiftScheduleScreen from './screens/ShiftScheduleScreen';
import LeaveInputScreen from './screens/LeaveInputScreen';

const NAV_GUARD_MS = 1200; // 遷移直後の誤タップで戻らないようガード（Edge 対策で 1.2 秒）

const SCREENS = {
  'modality-db': ModalityDB,
  'staff-db': StaffDB,
  rules: RulesScreen,
  'shift-schedule': ShiftScheduleScreen,
  'leave-input': LeaveInputScreen,
};

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState('main-menu');
  const lastNavigateAtRef = useRef(0);

  useEffect(() => {
    // Electron では終了時に日時スナップショットを自動保存するため、ブラウザ警告は出さない
    if (window.electronAPI?.isElectron) return undefined;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'バックアップを取得しましたか？データが失われる可能性があります。';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const goMenu = () => setCurrentScreen('main-menu');
  const onBack = () => {
    if (Date.now() - lastNavigateAtRef.current >= NAV_GUARD_MS) goMenu();
  };
  const onNavigate = (screen) => {
    lastNavigateAtRef.current = Date.now();
    setCurrentScreen(screen);
  };

  const Screen = SCREENS[currentScreen];
  const fallback = (
    <div className="min-h-screen bg-violet-400 flex items-center justify-center p-5">
      <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md border-2 border-stone-200">
        <p className="text-lg text-stone-800 mb-4 font-medium">表示中に問題が発生しました。</p>
        <button
          type="button"
          onClick={goMenu}
          className="min-h-[44px] px-5 py-2.5 rounded-lg text-base font-semibold border-2 border-slate-600 bg-white hover:bg-slate-100 text-stone-800 transition-all"
        >
          メニューに戻る
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full min-h-screen min-w-0">
      <ErrorBoundary key={currentScreen} fallback={fallback}>
        {Screen ? <Screen onBack={onBack} /> : <MainMenu onNavigate={onNavigate} />}
      </ErrorBoundary>
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
