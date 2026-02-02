import React, { useState, useEffect } from 'react';

export default function StaffAllocationSystem() {
  const [currentScreen, setCurrentScreen] = useState('main-menu');
  const [modalityData, setModalityData] = useState([]);
  const [staffData, setStaffData] = useState([]);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  // 初期化
  useEffect(() => {
    loadModalityData();
    loadStaffData();
  }, []);

  const loadModalityData = () => {
    const saved = localStorage.getItem('modalityData');
    if (saved) {
      setModalityData(JSON.parse(saved));
    } else {
      const initial = [
        { id: 1, name: '一般TV', staffMode: 'uniform', uniformStaff: 1, weekdayStaff: {mon: 1, tue: 1, wed: 1, thu: 1, fri: 1}, note: '' },
        { id: 2, name: 'CT', staffMode: 'uniform', uniformStaff: 1, weekdayStaff: {mon: 1, tue: 1, wed: 1, thu: 1, fri: 1}, note: '' },
        { id: 3, name: '救命(日勤)', staffMode: 'uniform', uniformStaff: 1, weekdayStaff: {mon: 1, tue: 1, wed: 1, thu: 1, fri: 1}, note: '' },
        { id: 4, name: '血管造影', staffMode: 'uniform', uniformStaff: 1, weekdayStaff: {mon: 1, tue: 1, wed: 1, thu: 1, fri: 1}, note: '' },
        { id: 5, name: 'RI', staffMode: 'uniform', uniformStaff: 1, weekdayStaff: {mon: 1, tue: 1, wed: 1, thu: 1, fri: 1}, note: '' },
        { id: 6, name: '主任者', staffMode: 'uniform', uniformStaff: 1, weekdayStaff: {mon: 1, tue: 1, wed: 1, thu: 1, fri: 1}, note: '' },
        { id: 7, name: 'MRI', staffMode: 'uniform', uniformStaff: 1, weekdayStaff: {mon: 1, tue: 1, wed: 1, thu: 1, fri: 1}, note: '' },
        { id: 8, name: 'ポータブル', staffMode: 'uniform', uniformStaff: 1, weekdayStaff: {mon: 1, tue: 1, wed: 1, thu: 1, fri: 1}, note: '' },
        { id: 9, name: '術場', staffMode: 'uniform', uniformStaff: 1, weekdayStaff: {mon: 1, tue: 1, wed: 1, thu: 1, fri: 1}, note: '' },
        { id: 10, name: '光学', staffMode: 'uniform', uniformStaff: 1, weekdayStaff: {mon: 1, tue: 1, wed: 1, thu: 1, fri: 1}, note: '' }
      ];
      setModalityData(initial);
    }
  };

  const loadStaffData = () => {
    const saved = localStorage.getItem('staffData');
    if (saved) {
      setStaffData(JSON.parse(saved));
    }
  };

  const saveModalityData = () => {
    localStorage.setItem('modalityData', JSON.stringify(modalityData));
    alert('✅ モダリティデータを保存しました');
  };

  const saveStaffData = () => {
    localStorage.setItem('staffData', JSON.stringify(staffData));
    alert('✅ 職員データを保存しました');
  };

  const exportModalityCSV = () => {
    let csv = 'ID,モダリティ名,設定モード,平日一律,月,火,水,木,金,備考\n';
    modalityData.forEach(mod => {
      csv += `${mod.id},"${mod.name}",${mod.staffMode},${mod.uniformStaff},${mod.weekdayStaff.mon},${mod.weekdayStaff.tue},${mod.weekdayStaff.wed},${mod.weekdayStaff.thu},${mod.weekdayStaff.fri},"${mod.note}"\n`;
    });
    downloadCSV(csv, 'モダリティDB_' + new Date().toISOString().split('T')[0] + '.csv');
  };

  const exportStaffCSV = () => {
    let csv = 'ID,氏名,入職年数,役職';
    modalityData.forEach(mod => csv += `,${mod.name}`);
    csv += '\n';

    staffData.forEach(staff => {
      csv += `"${staff.id}","${staff.name}",${staff.years},"${staff.position || ''}"`;
      modalityData.forEach(mod => csv += `,${staff.scores[mod.id]}`);
      csv += '\n';
    });
    downloadCSV(csv, '職員DB_' + new Date().toISOString().split('T')[0] + '.csv');
  };

  const downloadCSV = (csv, filename) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  // メインメニュー
  const MainMenu = () => (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-5 relative overflow-hidden">
      {/* 背景エフェクト */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative max-w-6xl w-full">
        {/* ヘッダー */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-violet-500/20 px-4 py-2 rounded-full mb-6 backdrop-blur-sm">
            <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-slate-300">Staff Allocation System v2.0</span>
          </div>
          <h1 className="text-6xl font-black text-white mb-4 tracking-tight">
            人員配置管理
          </h1>
          <p className="text-slate-400 text-xl font-light">Smart Workforce Optimization</p>
        </div>
        
        {/* メニューグリッド */}
        <div className="grid grid-cols-3 gap-4">
          <MenuButton 
            icon="👤" 
            title="職員DB" 
            desc="Staff Database"
            detail="登録・編集・管理"
            onClick={() => setCurrentScreen('staff-db')} 
            accent="violet" 
          />
          <MenuButton 
            icon="📋" 
            title="モダリティ" 
            desc="Modality Settings"
            detail="17種類の設定"
            onClick={() => setCurrentScreen('modality-db')} 
            accent="cyan" 
          />
          <MenuButton 
            icon="📖" 
            title="ルール" 
            desc="Rules Management"
            detail="配置ルール確認"
            onClick={() => setCurrentScreen('rules')} 
            accent="emerald" 
          />
          <MenuButton 
            icon="📅" 
            title="当番表" 
            desc="Shift Schedule"
            detail="夜勤・日勤・週休"
            onClick={() => setCurrentScreen('shift-schedule')} 
            accent="amber" 
          />
          <MenuButton 
            icon="✈️" 
            title="休暇管理" 
            desc="Leave Management"
            detail="休暇・出張入力"
            onClick={() => setCurrentScreen('leave-input')} 
            accent="rose" 
          />
          <MenuButton 
            icon="🎯" 
            title="配置表" 
            desc="Allocation"
            detail="自動配置作成"
            onClick={() => setCurrentScreen('allocation')} 
            accent="indigo" 
          />
        </div>
      </div>
    </div>
  );

  const MenuButton = ({ icon, title, desc, detail, onClick, accent }) => {
    const accentColors = {
      violet: 'group-hover:border-violet-500/50 group-hover:shadow-violet-500/20',
      cyan: 'group-hover:border-cyan-500/50 group-hover:shadow-cyan-500/20',
      emerald: 'group-hover:border-emerald-500/50 group-hover:shadow-emerald-500/20',
      amber: 'group-hover:border-amber-500/50 group-hover:shadow-amber-500/20',
      rose: 'group-hover:border-rose-500/50 group-hover:shadow-rose-500/20',
      indigo: 'group-hover:border-indigo-500/50 group-hover:shadow-indigo-500/20'
    };
    
    return (
      <button 
        onClick={onClick} 
        className={`group relative bg-slate-900/50 border border-slate-800 hover:bg-slate-900/80 p-6 rounded-2xl transition-all duration-500 hover:shadow-2xl ${accentColors[accent]} backdrop-blur-sm hover:-translate-y-1`}>
        {/* アクセント光 */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
        
        <div className="relative">
          {/* アイコン */}
          <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform duration-500">{icon}</div>
          
          {/* タイトル */}
          <h3 className="text-xl font-bold text-white mb-1">{title}</h3>
          <p className="text-xs text-slate-500 font-medium mb-3 uppercase tracking-wider">{desc}</p>
          
          {/* 詳細 */}
          <p className="text-sm text-slate-400">{detail}</p>
          
          {/* 矢印インジケーター */}
          <div className="absolute bottom-6 right-6 text-slate-600 group-hover:text-slate-400 transform group-hover:translate-x-1 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </button>
    );
  };

  // モダリティDB画面
  const ModalityDB = () => {
    const updateModalityName = (id, name) => {
      setModalityData(prev => prev.map(m => m.id === id ? {...m, name} : m));
    };

    const changeStaffMode = (id, mode) => {
      setModalityData(prev => prev.map(m => m.id === id ? {...m, staffMode: mode} : m));
    };

    const updateUniformStaff = (id, count) => {
      setModalityData(prev => prev.map(m => m.id === id ? {...m, uniformStaff: parseInt(count) || 0} : m));
    };

    const updateWeekdayStaff = (id, day, count) => {
      setModalityData(prev => prev.map(m => m.id === id ? {...m, weekdayStaff: {...m.weekdayStaff, [day]: parseInt(count) || 0}} : m));
    };

    const updateNote = (id, note) => {
      setModalityData(prev => prev.map(m => m.id === id ? {...m, note} : m));
    };

    return (
      <div className="min-h-screen bg-slate-900 p-5 relative overflow-hidden">
        {/* 背景エフェクト */}
        <div className="absolute top-20 right-20 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl"></div>
        
        <div className="max-w-5xl mx-auto relative">
          <button onClick={() => setCurrentScreen('main-menu')} className="mb-6 px-5 py-2.5 bg-slate-900/50 hover:bg-slate-800/50 border border-slate-800 rounded-xl transition-all font-medium text-slate-300 hover:text-white backdrop-blur-sm">
            ← メインメニュー
          </button>
          
          {/* ヘッダーカード */}
          <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl shadow-2xl p-8 mb-6 border border-slate-800">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-4xl font-black text-white mb-2">モダリティDB</h2>
                <p className="text-slate-400 text-sm">Modality Database Management</p>
              </div>
              <div className="flex gap-3">
                <button onClick={saveModalityData} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 transition-all font-semibold hover:-translate-y-0.5">
                  💾 保存
                </button>
                <button onClick={exportModalityCSV} className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl shadow-lg transition-all font-semibold hover:-translate-y-0.5">
                  📥 CSV
                </button>
              </div>
            </div>
            
            <div className="bg-cyan-500/10 border border-cyan-500/20 p-4 rounded-xl text-sm text-cyan-200 backdrop-blur-sm">
              <span className="font-semibold">ℹ️ 重要：</span> モダリティ1-10は平日（月～金）のみ配置対象です。
            </div>
          </div>

          {/* モダリティカード */}
          <div className="space-y-4">
            {modalityData.map((mod, idx) => (
              <div key={mod.id} className="group bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-800 hover:border-slate-700 transition-all hover:shadow-xl hover:shadow-slate-900/50">
                {/* ヘッダー */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-violet-500/20 blur-lg rounded-xl"></div>
                    <div className="relative bg-gradient-to-br from-slate-700 to-slate-800 text-white w-14 h-14 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg border border-slate-600">
                      {mod.id}
                    </div>
                  </div>
                  <input 
                    type="text" 
                    value={mod.name}
                    onChange={(e) => updateModalityName(mod.id, e.target.value)}
                    className="flex-1 p-3 bg-slate-800/50 border-2 border-slate-700 rounded-xl font-bold text-xl text-white placeholder-slate-500 focus:border-violet-500/50 focus:bg-slate-800/80 transition-all outline-none"
                  />
                </div>

                {/* 設定モード */}
                <div className="mb-6">
                  <label className="block mb-3 font-semibold text-slate-300 text-sm uppercase tracking-wider">必要人数設定</label>
                  <div className="flex gap-3 mb-4">
                    <label className="flex-1 relative cursor-pointer">
                      <input 
                        type="radio" 
                        checked={mod.staffMode === 'uniform'}
                        onChange={() => changeStaffMode(mod.id, 'uniform')}
                        className="peer sr-only"
                      />
                      <div className="p-3 bg-slate-800/30 border-2 border-slate-700 peer-checked:border-violet-500 peer-checked:bg-violet-500/10 rounded-xl transition-all text-center font-medium text-slate-300 peer-checked:text-violet-300">
                        一律設定
                      </div>
                    </label>
                    <label className="flex-1 relative cursor-pointer">
                      <input 
                        type="radio" 
                        checked={mod.staffMode === 'individual'}
                        onChange={() => changeStaffMode(mod.id, 'individual')}
                        className="peer sr-only"
                      />
                      <div className="p-3 bg-slate-800/30 border-2 border-slate-700 peer-checked:border-violet-500 peer-checked:bg-violet-500/10 rounded-xl transition-all text-center font-medium text-slate-300 peer-checked:text-violet-300">
                        曜日別設定
                      </div>
                    </label>
                  </div>

                  {mod.staffMode === 'uniform' ? (
                    <div className="flex items-center gap-4 bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                      <span className="text-slate-400 font-medium">平日（月～金）</span>
                      <input 
                        type="number" 
                        min="0" 
                        max="10"
                        value={mod.uniformStaff}
                        onChange={(e) => updateUniformStaff(mod.id, e.target.value)}
                        className="w-24 p-2.5 bg-slate-700/50 border-2 border-slate-600 rounded-lg text-white text-center font-bold focus:border-violet-500 outline-none transition-all"
                      />
                      <span className="text-slate-400 font-medium">名</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 gap-3">
                      {['mon', 'tue', 'wed', 'thu', 'fri'].map((day, idx) => (
                        <div key={day} className="bg-slate-800/30 border border-slate-700/50 p-3 rounded-xl">
                          <label className="block text-xs text-slate-400 mb-2 font-semibold text-center uppercase tracking-wider">
                            {['月', '火', '水', '木', '金'][idx]}
                          </label>
                          <input 
                            type="number" 
                            min="0" 
                            max="10"
                            value={mod.weekdayStaff[day]}
                            onChange={(e) => updateWeekdayStaff(mod.id, day, e.target.value)}
                            className="w-full p-2 bg-slate-700/50 border-2 border-slate-600 rounded-lg text-center text-white font-bold focus:border-violet-500 outline-none transition-all"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 備考 */}
                <div>
                  <label className="block mb-2 font-semibold text-slate-300 text-sm uppercase tracking-wider">備考</label>
                  <textarea 
                    value={mod.note}
                    onChange={(e) => updateNote(mod.id, e.target.value)}
                    className="w-full p-3 bg-slate-800/50 border-2 border-slate-700 rounded-xl resize-y min-h-[80px] text-white placeholder-slate-500 focus:border-violet-500/50 focus:bg-slate-800/80 outline-none transition-all"
                    placeholder="特記事項を入力..."
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 職員DB画面
  const StaffDB = () => {
    const [formData, setFormData] = useState({
      id: '', name: '', years: '', position: '', scores: {}
    });

    useEffect(() => {
      if (editingStaff) {
        setFormData(editingStaff);
      } else {
        resetForm();
      }
    }, [editingStaff]);

    const resetForm = () => {
      const scores = {};
      modalityData.forEach(mod => scores[mod.id] = 0);
      setFormData({ id: '', name: '', years: '', position: '', scores });
    };

    const handleSubmit = () => {
      if (!formData.id || !formData.name || !formData.years) {
        alert('⚠️ 職員ID、氏名、入職年数は必須項目です');
        return;
      }

      if (editingStaff) {
        setStaffData(prev => prev.map(s => s.id === editingStaff.id ? formData : s));
        alert('✅ 職員情報を更新しました');
      } else {
        if (staffData.some(s => s.id === formData.id)) {
          alert('⚠️ この職員IDは既に登録されています');
          return;
        }
        setStaffData(prev => [...prev, formData]);
        alert('✅ 職員を登録しました');
      }

      setShowStaffForm(false);
      setEditingStaff(null);
      resetForm();
    };

    const deleteStaff = (id) => {
      if (!confirm('本当にこの職員を削除しますか？')) return;
      setStaffData(prev => prev.filter(s => s.id !== id));
      alert('✅ 職員を削除しました');
    };

    return (
      <div className="min-h-screen bg-slate-900 p-5 relative overflow-hidden">
        {/* 背景エフェクト */}
        <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto relative">
          <button onClick={() => setCurrentScreen('main-menu')} className="mb-6 px-5 py-2.5 bg-slate-900/50 hover:bg-slate-800/50 border border-slate-800 rounded-xl transition-all font-medium text-slate-300 hover:text-white backdrop-blur-sm">
            ← メインメニュー
          </button>
          
          {/* ヘッダーカード */}
          <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl shadow-2xl p-8 mb-6 border border-slate-800">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-4xl font-black text-white mb-2">職員データベース</h2>
                <p className="text-slate-400 text-sm">Staff Database Management</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowStaffForm(true); setEditingStaff(null); resetForm(); }} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all font-semibold hover:-translate-y-0.5">
                  ➕ 新規登録
                </button>
                <button onClick={saveStaffData} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 transition-all font-semibold hover:-translate-y-0.5">
                  💾 保存
                </button>
                <button onClick={exportStaffCSV} className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl shadow-lg transition-all font-semibold hover:-translate-y-0.5">
                  📥 CSV
                </button>
              </div>
            </div>
          </div>

          {/* 登録フォーム */}
          {showStaffForm && (
            <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-slate-800">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-white">職員情報登録</h3>
                <button onClick={() => { setShowStaffForm(false); setEditingStaff(null); }} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-all">
                  ✕ 閉じる
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block mb-2 font-semibold text-slate-300 text-sm uppercase tracking-wider">職員ID *</label>
                  <input type="text" value={formData.id} onChange={(e) => setFormData({...formData, id: e.target.value})} 
                         className="w-full p-3 bg-slate-800/50 border-2 border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-blue-500/50 outline-none transition-all" placeholder="例: 001" />
                </div>
                <div>
                  <label className="block mb-2 font-semibold text-slate-300 text-sm uppercase tracking-wider">氏名 *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} 
                         className="w-full p-3 bg-slate-800/50 border-2 border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-blue-500/50 outline-none transition-all" placeholder="例: 山田太郎" />
                </div>
                <div>
                  <label className="block mb-2 font-semibold text-slate-300 text-sm uppercase tracking-wider">入職年数 *</label>
                  <input type="number" value={formData.years} onChange={(e) => setFormData({...formData, years: e.target.value})} 
                         className="w-full p-3 bg-slate-800/50 border-2 border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-blue-500/50 outline-none transition-all" placeholder="例: 5" min="0" />
                </div>
                <div>
                  <label className="block mb-2 font-semibold text-slate-300 text-sm uppercase tracking-wider">役職</label>
                  <input type="text" value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} 
                         className="w-full p-3 bg-slate-800/50 border-2 border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-blue-500/50 outline-none transition-all" placeholder="例: 主任" />
                </div>
              </div>

              <div className="mb-6">
                <label className="block mb-3 font-semibold text-slate-300 text-sm uppercase tracking-wider">モダリティ別配置スコア（0-4）</label>
                <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl mb-4 text-sm text-blue-200">
                  0:適正なし | 1:優先度低 | 2:優先度中 | 3:優先度高 | 4:絶対固定
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {modalityData.map(mod => (
                    <div key={mod.id} className="flex items-center justify-between bg-slate-800/30 border border-slate-700/50 p-3 rounded-xl">
                      <span className="text-slate-300 text-sm font-medium">{mod.id}. {mod.name}</span>
                      <select value={formData.scores[mod.id] || 0} 
                              onChange={(e) => setFormData({...formData, scores: {...formData.scores, [mod.id]: parseInt(e.target.value)}})}
                              className="p-2 bg-slate-700 border-2 border-slate-600 rounded-lg text-white font-bold focus:border-blue-500 outline-none transition-all">
                        <option value="0">0</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-right">
                <button onClick={handleSubmit} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5">
                  ✓ 登録
                </button>
              </div>
            </div>
          )}

          {/* 職員一覧 */}
          {staffData.length === 0 ? (
            <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-20 text-center border border-slate-800">
              <div className="text-slate-500 text-lg">まだ職員が登録されていません</div>
            </div>
          ) : (
            <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-800">
              <h3 className="mb-4 font-bold text-xl text-white">登録職員一覧（{staffData.length}名）</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="p-4 text-left text-slate-400 font-semibold text-sm uppercase tracking-wider">ID</th>
                      <th className="p-4 text-left text-slate-400 font-semibold text-sm uppercase tracking-wider">氏名</th>
                      <th className="p-4 text-center text-slate-400 font-semibold text-sm uppercase tracking-wider">入職年数</th>
                      <th className="p-4 text-left text-slate-400 font-semibold text-sm uppercase tracking-wider">役職</th>
                      <th className="p-4 text-center text-slate-400 font-semibold text-sm uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map(staff => (
                      <tr key={staff.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-all">
                        <td className="p-4 text-slate-300">{staff.id}</td>
                        <td className="p-4 text-white font-bold">{staff.name}</td>
                        <td className="p-4 text-center text-slate-300">{staff.years}年</td>
                        <td className="p-4 text-slate-300">{staff.position || '-'}</td>
                        <td className="p-4 text-center">
                          <button onClick={() => { setEditingStaff(staff); setShowStaffForm(true); }} 
                                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg mr-2 text-sm font-semibold transition-all">編集</button>
                          <button onClick={() => deleteStaff(staff.id)} 
                                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-semibold transition-all">削除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ルール管理画面
  const RulesScreen = () => (
    <div className="min-h-screen bg-slate-900 p-5 relative overflow-hidden">
      {/* 背景エフェクト */}
      <div className="absolute top-20 right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
      
      <div className="max-w-5xl mx-auto relative">
        <button onClick={() => setCurrentScreen('main-menu')} className="mb-6 px-5 py-2.5 bg-slate-900/50 hover:bg-slate-800/50 border border-slate-800 rounded-xl transition-all font-medium text-slate-300 hover:text-white backdrop-blur-sm">
          ← メインメニュー
        </button>
        
        {/* ヘッダーカード */}
        <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl shadow-2xl p-8 mb-6 border border-slate-800">
          <h2 className="text-4xl font-black text-white mb-2">配置ルール管理</h2>
          <p className="text-slate-400 text-sm">Allocation Rules Management</p>
        </div>
        
        <div className="space-y-6">
          {/* モダリティ分類 */}
          <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-800">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <span className="text-3xl">📋</span>
              モダリティ分類
            </h3>
            
            <div className="bg-blue-500/10 border border-blue-500/20 p-5 rounded-xl mb-4 backdrop-blur-sm">
              <h4 className="font-bold text-blue-200 mb-3 text-sm uppercase tracking-wider">配置先モダリティ（1-10）- スコア設定あり</h4>
              <div className="grid grid-cols-2 gap-2 text-sm text-slate-300">
                {['一般TV', 'CT', '救命(日勤)', '血管造影', 'RI', '主任者', 'MRI', 'ポータブル', '術場', '光学'].map((name, i) => (
                  <div key={i} className="bg-slate-800/30 px-3 py-2 rounded-lg">{i+1}. {name}</div>
                ))}
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-xl backdrop-blur-sm">
              <h4 className="font-bold text-amber-200 mb-3 text-sm uppercase tracking-wider">勤務状態（11-17）- 配置不可</h4>
              <div className="text-sm space-y-2 text-slate-300">
                <div className="bg-slate-800/30 px-3 py-2 rounded-lg"><strong className="text-amber-300">11. 日勤</strong> (1名) - 土日祝の勤務者</div>
                <div className="bg-slate-800/30 px-3 py-2 rounded-lg"><strong className="text-amber-300">12. サポート</strong> (1名) - 日勤サポート業務</div>
                <div className="bg-slate-800/30 px-3 py-2 rounded-lg"><strong className="text-amber-300">13. 16/夜勤</strong> (1名) - 毎日1名担当</div>
                <div className="bg-slate-800/30 px-3 py-2 rounded-lg"><strong className="text-amber-300">14. B</strong> (1名) - 夜勤前日＆外科輪番日の12:30-21:00勤務</div>
                <div className="bg-slate-800/30 px-3 py-2 rounded-lg"><strong className="text-amber-300">15. 非番</strong> (1名) - 夜勤翌日の休日</div>
                <div className="bg-slate-800/30 px-3 py-2 rounded-lg"><strong className="text-amber-300">16. 週休</strong> - 土日に日勤/夜勤した職員の休み</div>
                <div className="bg-slate-800/30 px-3 py-2 rounded-lg"><strong className="text-amber-300">17. 休暇</strong> - 通常休暇</div>
              </div>
            </div>
          </div>

          {/* 配置スコア */}
          <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-800">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <span className="text-3xl">⚙️</span>
              配置スコア
            </h3>
            <div className="bg-violet-500/10 border border-violet-500/20 p-5 rounded-xl backdrop-blur-sm text-sm space-y-2 text-slate-300">
              <div className="bg-slate-800/30 px-3 py-2 rounded-lg"><strong className="text-violet-300">0：</strong>適正なし（配置不可）</div>
              <div className="bg-slate-800/30 px-3 py-2 rounded-lg"><strong className="text-violet-300">1：</strong>優先度低</div>
              <div className="bg-slate-800/30 px-3 py-2 rounded-lg"><strong className="text-violet-300">2：</strong>優先度中</div>
              <div className="bg-slate-800/30 px-3 py-2 rounded-lg"><strong className="text-violet-300">3：</strong>優先度高</div>
              <div className="bg-slate-800/30 px-3 py-2 rounded-lg"><strong className="text-violet-300">4：</strong>絶対固定（必ずこのモダリティに配置）</div>
            </div>
          </div>

          {/* 基本ルール */}
          <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-800">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <span className="text-3xl">📝</span>
              基本ルール
            </h3>
            <div className="bg-slate-800/30 border border-slate-700/50 p-5 rounded-xl text-sm space-y-2 text-slate-300">
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1">✓</span>
                <span>夜勤、日勤、サポート、B、非番に割り当てられた職員は、他のモダリティに配置できない</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1">✓</span>
                <span>週休、休暇の職員も配置対象外</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1">✓</span>
                <span>1人の職員は1日1つのモダリティのみ配置</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1">✓</span>
                <span>スコア4（絶対固定）の職員は優先的に配置</span>
              </div>
            </div>
          </div>

          {/* 注意 */}
          <div className="bg-amber-500/10 border-l-4 border-amber-500 p-5 rounded-xl backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📌</span>
              <div>
                <strong className="text-amber-300">注意：</strong>
                <div className="text-sm mt-2 text-slate-400">
                  追加のルールがある場合は、このセクションに記載してください。
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // 休暇・出張入力画面
  const LeaveInputScreen = () => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [leaveData, setLeaveData] = useState({});
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [selectedDates, setSelectedDates] = useState([]);
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState('');
    const [selectedLeaveType, setSelectedLeaveType] = useState('');

    const leaveTypes = ['週休', '年休', 'リフ休', '特別休', '出張'];

    // 月のカレンダー生成
    const generateMonthCalendar = (date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      const days = [];
      for (let d = 1; d <= lastDay.getDate(); d++) {
        const currentDate = new Date(year, month, d);
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayOfWeek = currentDate.getDay();
        
        days.push({
          date: dateStr,
          day: d,
          dayOfWeek: ['日', '月', '火', '水', '木', '金', '土'][dayOfWeek],
          isWeekend: dayOfWeek === 0 || dayOfWeek === 6
        });
      }
      return days;
    };

    const monthCalendar = generateMonthCalendar(currentMonth);

    // 日付選択開始
    const handleDateMouseDown = (date) => {
      setIsSelecting(true);
      setSelectedDates([date]);
    };

    // 日付選択中
    const handleDateMouseEnter = (date) => {
      if (isSelecting && selectedDates.length > 0) {
        const start = selectedDates[0];
        const allDates = monthCalendar.map(d => d.date);
        const startIdx = allDates.indexOf(start);
        const endIdx = allDates.indexOf(date);
        
        const minIdx = Math.min(startIdx, endIdx);
        const maxIdx = Math.max(startIdx, endIdx);
        
        setSelectedDates(allDates.slice(minIdx, maxIdx + 1));
      }
    };

    // 日付選択終了
    const handleDateMouseUp = () => {
      if (selectedDates.length > 0) {
        setIsSelecting(false);
        setShowLeaveModal(true);
      }
    };

    // 休暇登録
    const addLeave = () => {
      if (!selectedStaff || !selectedLeaveType) {
        alert('⚠️ 職員と種類を選択してください');
        return;
      }

      const newLeaveData = { ...leaveData };
      
      selectedDates.forEach(date => {
        if (!newLeaveData[date]) {
          newLeaveData[date] = [];
        }
        
        // 重複チェック
        const exists = newLeaveData[date].some(item => item.staffId === selectedStaff);
        if (!exists) {
          newLeaveData[date].push({
            staffId: selectedStaff,
            leaveType: selectedLeaveType
          });
        }
      });

      setLeaveData(newLeaveData);
      setShowLeaveModal(false);
      setSelectedDates([]);
      setSelectedStaff('');
      setSelectedLeaveType('');
      alert('✅ 登録しました');
    };

    // 休暇削除
    const removeLeave = (date, staffId) => {
      if (!confirm('削除しますか？')) return;

      const newLeaveData = { ...leaveData };
      newLeaveData[date] = newLeaveData[date].filter(item => item.staffId !== staffId);
      
      if (newLeaveData[date].length === 0) {
        delete newLeaveData[date];
      }

      setLeaveData(newLeaveData);
      alert('✅ 削除しました');
    };

    // データ保存
    const saveLeaveData = () => {
      const data = { leaveData };
      localStorage.setItem('leaveData', JSON.stringify(data));
      alert('✅ 休暇・出張データを保存しました');
    };

    // データ読み込み
    useEffect(() => {
      const saved = localStorage.getItem('leaveData');
      if (saved) {
        const data = JSON.parse(saved);
        setLeaveData(data.leaveData || {});
      }
    }, []);

    // 月変更
    const changeMonth = (offset) => {
      const newDate = new Date(currentMonth);
      newDate.setMonth(newDate.getMonth() + offset);
      setCurrentMonth(newDate);
    };

    return (
      <div className="min-h-screen bg-slate-900 p-5 relative overflow-hidden">
        {/* 背景エフェクト */}
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto relative">
          <button onClick={() => setCurrentScreen('main-menu')} className="mb-6 px-5 py-2.5 bg-slate-900/50 hover:bg-slate-800/50 border border-slate-800 rounded-xl transition-all font-medium text-slate-300 hover:text-white backdrop-blur-sm">
            ← メインメニュー
          </button>
          
          {/* ヘッダーカード */}
          <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl shadow-2xl p-8 mb-6 border border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-4xl font-black text-white mb-2">休暇・出張入力</h2>
                <p className="text-slate-400 text-sm">Leave & Business Trip Management</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm text-slate-400 mb-1">登録件数</div>
                  <div className="text-3xl font-bold text-white">{Object.values(leaveData).flat().length}</div>
                </div>
                <button onClick={saveLeaveData} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 transition-all font-semibold hover:-translate-y-0.5">
                  💾 保存
                </button>
              </div>
            </div>
          </div>

          {/* 使い方 */}
          <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl mb-6 text-sm text-rose-200 backdrop-blur-sm">
            <strong>📌 使い方：</strong> カレンダー上で日付をドラッグして範囲選択 → 職員と種類を選択して登録
          </div>

          {/* カレンダー */}
          <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-800">
            {/* 月選択 */}
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => changeMonth(-1)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all">
                ← 前月
              </button>
              <h3 className="text-2xl font-bold text-white">
                {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月
              </h3>
              <button onClick={() => changeMonth(1)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all">
                次月 →
              </button>
            </div>

            {/* カレンダーグリッド */}
            <div className="grid grid-cols-7 gap-2" onMouseUp={handleDateMouseUp} onMouseLeave={() => setIsSelecting(false)}>
              {/* 曜日ヘッダー */}
              {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
                <div key={day} className={`text-center font-bold py-2 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'}`}>
                  {day}
                </div>
              ))}
              
              {/* 日付セル */}
              {monthCalendar.map(day => {
                const isSelected = selectedDates.includes(day.date);
                const dayLeaves = leaveData[day.date] || [];
                
                return (
                  <div
                    key={day.date}
                    onMouseDown={() => handleDateMouseDown(day.date)}
                    onMouseEnter={() => handleDateMouseEnter(day.date)}
                    className={`
                      min-h-[100px] p-2 rounded-lg border-2 cursor-pointer transition-all select-none
                      ${isSelected ? 'bg-rose-500/30 border-rose-500' : 'bg-slate-800/30 border-slate-700 hover:border-slate-600'}
                      ${day.isWeekend ? 'bg-slate-800/50' : ''}
                    `}
                  >
                    <div className={`font-bold mb-1 ${day.isWeekend ? 'text-blue-400' : 'text-white'}`}>
                      {day.day}
                    </div>
                    <div className="space-y-1">
                      {dayLeaves.map((leave, idx) => {
                        const staff = staffData.find(s => s.id === leave.staffId);
                        const colorMap = {
                          '週休': 'bg-violet-500/30 text-violet-200',
                          '年休': 'bg-emerald-500/30 text-emerald-200',
                          'リフ休': 'bg-purple-500/30 text-purple-200',
                          '特別休': 'bg-amber-500/30 text-amber-200',
                          '出張': 'bg-red-500/30 text-red-200'
                        };
                        
                        return (
                          <div
                            key={idx}
                            onClick={(e) => { e.stopPropagation(); removeLeave(day.date, leave.staffId); }}
                            className={`text-xs px-2 py-1 rounded ${colorMap[leave.leaveType]} hover:opacity-75 transition-opacity`}
                          >
                            {staff?.name || leave.staffId}
                            <br />
                            ({leave.leaveType})
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 登録モーダル */}
          {showLeaveModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5 z-50">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-white text-xl">
                    休暇・出張登録
                    {selectedDates.length > 1 && <span className="text-rose-400 ml-2">({selectedDates.length}日間)</span>}
                  </h3>
                  <button onClick={() => { setShowLeaveModal(false); setSelectedDates([]); }} className="text-slate-400 hover:text-white transition-colors text-2xl">✕</button>
                </div>

                <div className="bg-slate-800/50 p-3 rounded-lg mb-4 text-sm text-slate-300">
                  期間: {selectedDates[0]} 〜 {selectedDates[selectedDates.length - 1]}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm mb-2 font-semibold text-slate-300 uppercase tracking-wider">職員を選択 *</label>
                    <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} 
                            className="w-full p-3 bg-slate-800 border-2 border-slate-700 rounded-xl text-white focus:border-rose-500 outline-none transition-all">
                      <option value="">-- 職員を選択 --</option>
                      {staffData.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm mb-2 font-semibold text-slate-300 uppercase tracking-wider">種類を選択 *</label>
                    <select value={selectedLeaveType} onChange={(e) => setSelectedLeaveType(e.target.value)} 
                            className="w-full p-3 bg-slate-800 border-2 border-slate-700 rounded-xl text-white focus:border-rose-500 outline-none transition-all">
                      <option value="">-- 種類を選択 --</option>
                      {leaveTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button onClick={addLeave} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-3 rounded-xl transition-all font-semibold">
                      ✓ 登録
                    </button>
                    <button onClick={() => { setShowLeaveModal(false); setSelectedDates([]); }} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl transition-all font-semibold">
                      キャンセル
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 配置表作成画面
  const AllocationScreen = () => {
    const [allocation, setAllocation] = useState({});
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [calendar, setCalendar] = useState([]);
    const [isAutoAllocating, setIsAutoAllocating] = useState(false);

    // データ読み込み
    useEffect(() => {
      const scheduleData = localStorage.getItem('scheduleData');
      if (scheduleData) {
        const data = JSON.parse(scheduleData);
        setStartDate(data.startDate || '');
        setEndDate(data.endDate || '');
        setCalendar(data.calendar || []);
      }
    }, []);

    // 自動配置実行
    const autoAllocate = () => {
      if (calendar.length === 0) {
        alert('⚠️ まず夜勤・日勤当番表でカレンダーを生成してください');
        return;
      }

      setIsAutoAllocating(true);

      // スケジュールと休暇データを取得
      const scheduleData = JSON.parse(localStorage.getItem('scheduleData') || '{}');
      const leaveData = JSON.parse(localStorage.getItem('leaveData') || '{}');
      const schedule = scheduleData.schedule || {};
      const weeklyOff = scheduleData.weeklyOff || {};
      const leaves = leaveData.leaveData || {};

      const newAllocation = {};

      // 各日付について配置を計算
      calendar.forEach(day => {
        const dateStr = day.date;
        
        // 土日祝はスキップ
        if (day.isWeekend || day.isHoliday) {
          return;
        }

        newAllocation[dateStr] = {};

        // この日配置できない職員を特定
        const unavailableStaff = new Set();

        // 当番表での割り当て
        const daySchedule = schedule[dateStr] || {};
        if (daySchedule.nightShift) unavailableStaff.add(daySchedule.nightShift);
        if (daySchedule.dayShift) unavailableStaff.add(daySchedule.dayShift);
        if (daySchedule.support) unavailableStaff.add(daySchedule.support);
        if (daySchedule.b) unavailableStaff.add(daySchedule.b);
        if (daySchedule.dayOff) unavailableStaff.add(daySchedule.dayOff);

        // 週休
        if (weeklyOff[dateStr]) {
          weeklyOff[dateStr].forEach(id => unavailableStaff.add(id));
        }

        // 休暇・出張
        if (leaves[dateStr]) {
          leaves[dateStr].forEach(leave => unavailableStaff.add(leave.staffId));
        }

        // 各モダリティについて配置
        modalityData.forEach(modality => {
          const modalityId = modality.id;
          
          // 必要人数を取得
          let requiredCount = 0;
          const dayOfWeek = new Date(dateStr).getDay();
          const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
          const dayMap = { mon: 'mon', tue: 'tue', wed: 'wed', thu: 'thu', fri: 'fri' };
          
          if (modality.staffMode === 'uniform') {
            requiredCount = modality.uniformStaff;
          } else {
            const dayKey = dayMap[dayNames[dayOfWeek]];
            requiredCount = modality.weekdayStaff[dayKey] || 0;
          }

          // スコア順に職員をソート
          const availableStaff = staffData
            .filter(staff => !unavailableStaff.has(staff.id))
            .map(staff => ({
              ...staff,
              score: staff.scores[modalityId] || 0
            }))
            .filter(staff => staff.score > 0) // スコア0は除外
            .sort((a, b) => b.score - a.score); // スコア降順

          // 配置
          const assigned = [];
          
          // スコア4（絶対固定）を優先
          availableStaff.forEach(staff => {
            if (staff.score === 4 && assigned.length < requiredCount) {
              assigned.push(staff.id);
              unavailableStaff.add(staff.id);
            }
          });

          // 残りをスコア順で配置
          availableStaff.forEach(staff => {
            if (staff.score < 4 && assigned.length < requiredCount && !unavailableStaff.has(staff.id)) {
              assigned.push(staff.id);
              unavailableStaff.add(staff.id);
            }
          });

          if (assigned.length > 0) {
            newAllocation[dateStr][modalityId] = assigned;
          }
        });
      });

      setAllocation(newAllocation);
      setIsAutoAllocating(false);
      alert('✅ 自動配置が完了しました');
    };

    // 職員の配置を取得（表示用）
    const getStaffAllocation = (staffId, date) => {
      // スケジュールと休暇データを取得
      const scheduleData = JSON.parse(localStorage.getItem('scheduleData') || '{}');
      const leaveData = JSON.parse(localStorage.getItem('leaveData') || '{}');
      const schedule = scheduleData.schedule || {};
      const weeklyOff = scheduleData.weeklyOff || {};
      const leaves = leaveData.leaveData || {};

      // 休暇チェック
      const leave = leaves[date]?.find(l => l.staffId === staffId);
      if (leave) return leave.leaveType;

      // 週休チェック
      if (weeklyOff[date]?.includes(staffId)) return '週休';

      // 当番表チェック
      const daySchedule = schedule[date] || {};
      if (daySchedule.nightShift === staffId) return '16';
      if (daySchedule.dayShift === staffId) return '日勤';
      if (daySchedule.support === staffId) return 'サポート';
      if (daySchedule.b === staffId) return 'B';
      if (daySchedule.dayOff === staffId) return '非番';

      // モダリティ配置チェック
      if (allocation[date]) {
        for (const [modalityId, assignedStaff] of Object.entries(allocation[date])) {
          if (assignedStaff.includes(staffId)) {
            const modality = modalityData.find(m => m.id === parseInt(modalityId));
            return modality?.name || `M${modalityId}`;
          }
        }
      }

      return '-';
    };

    // データ保存
    const saveAllocation = () => {
      const data = { allocation, startDate, endDate };
      localStorage.setItem('allocationData', JSON.stringify(data));
      alert('✅ 配置表を保存しました');
    };

    // CSVエクスポート
    const exportAllocationCSV = () => {
      if (calendar.length === 0) {
        alert('⚠️ データがありません');
        return;
      }

      let csv = '職員ID,氏名';
      calendar.forEach(day => {
        csv += `,${day.date}(${day.dayOfWeek})`;
      });
      csv += '\n';

      staffData.forEach(staff => {
        csv += `"${staff.id}","${staff.name}"`;
        calendar.forEach(day => {
          const assignment = getStaffAllocation(staff.id, day.date);
          csv += `,"${assignment}"`;
        });
        csv += '\n';
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = '配置表_' + new Date().toISOString().split('T')[0] + '.csv';
      link.click();
    };

    return (
      <div className="min-h-screen bg-slate-900 p-5 relative overflow-hidden">
        {/* 背景エフェクト */}
        <div className="absolute top-20 right-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
        
        <div className="max-w-full mx-auto relative px-4">
          <button onClick={() => setCurrentScreen('main-menu')} className="mb-6 px-5 py-2.5 bg-slate-900/50 hover:bg-slate-800/50 border border-slate-800 rounded-xl transition-all font-medium text-slate-300 hover:text-white backdrop-blur-sm">
            ← メインメニュー
          </button>
          
          {/* ヘッダーカード */}
          <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl shadow-2xl p-8 mb-6 border border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-4xl font-black text-white mb-2">配置表作成</h2>
                <p className="text-slate-400 text-sm">Staff Allocation Table</p>
                {startDate && endDate && (
                  <p className="text-slate-500 text-sm mt-2">期間: {startDate} 〜 {endDate}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={autoAllocate} 
                  disabled={isAutoAllocating}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-semibold hover:-translate-y-0.5">
                  {isAutoAllocating ? '配置中...' : '🎯 自動配置'}
                </button>
                <button onClick={saveAllocation} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 transition-all font-semibold hover:-translate-y-0.5">
                  💾 保存
                </button>
                <button onClick={exportAllocationCSV} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl shadow-lg transition-all font-semibold hover:-translate-y-0.5">
                  📥 CSV
                </button>
              </div>
            </div>
          </div>

          {/* マトリックス表示 */}
          {calendar.length > 0 ? (
            <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-800 overflow-x-auto">
              <h3 className="font-bold mb-4 text-white text-lg">📊 配置表マトリックス</h3>
              <div className="overflow-x-auto">
                <table className="border-collapse text-xs min-w-full">
                  <thead>
                    <tr className="bg-slate-800/50">
                      <th className="border border-slate-700 p-3 sticky left-0 bg-slate-800 z-20 min-w-[120px]">
                        <div className="font-bold text-slate-200 uppercase tracking-wider">職員</div>
                      </th>
                      {calendar.map(day => (
                        <th key={day.date} className={`border border-slate-700 p-2 min-w-[80px] ${day.isWeekend ? 'bg-slate-700/50' : ''}`}>
                          <div className="text-slate-300">{day.date.split('-')[2]}</div>
                          <div className="text-xs text-slate-500">{day.dayOfWeek}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map(staff => (
                      <tr key={staff.id} className="hover:bg-slate-800/30 transition-all">
                        <td className="border border-slate-700 p-3 font-bold sticky left-0 bg-slate-900/90 z-10 text-white">
                          <div>{staff.name}</div>
                          <div className="text-xs text-slate-500">{staff.id}</div>
                        </td>
                        {calendar.map(day => {
                          const assignment = getStaffAllocation(staff.id, day.date);
                          const colorMap = {
                            '16': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                            '日勤': 'bg-green-500/20 text-green-300 border-green-500/30',
                            'サポート': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
                            'B': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
                            '非番': 'bg-red-500/20 text-red-300 border-red-500/30',
                            '週休': 'bg-violet-500/20 text-violet-300 border-violet-500/30',
                            '年休': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                            'リフ休': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                            '特別休': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                            '出張': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
                            '-': 'text-slate-600'
                          };
                          
                          const isModality = !colorMap[assignment];
                          const cellClass = isModality ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : colorMap[assignment];
                          
                          return (
                            <td key={day.date} className={`border border-slate-700 p-1 text-center ${day.isWeekend ? 'bg-slate-800/30' : ''}`}>
                              <div className={`text-xs py-1 px-2 rounded border ${cellClass} font-semibold`}>
                                {assignment}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 凡例 */}
              <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-cyan-500/20 border border-cyan-500/30 rounded"></div>
                  <span className="text-slate-300">モダリティ配置</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500/20 border border-blue-500/30 rounded"></div>
                  <span className="text-slate-300">16(夜勤)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500/20 border border-green-500/30 rounded"></div>
                  <span className="text-slate-300">日勤</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-violet-500/20 border border-violet-500/30 rounded"></div>
                  <span className="text-slate-300">週休</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-emerald-500/20 border border-emerald-500/30 rounded"></div>
                  <span className="text-slate-300">休暇</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-20 text-center border border-slate-800">
              <div className="text-6xl mb-4">📅</div>
              <div className="text-slate-400 text-xl">表示する期間がありません</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // プレースホルダー画面
  const PlaceholderScreen = ({ title }) => (
    <div className="min-h-screen bg-slate-900 p-5 relative overflow-hidden">
      {/* 背景エフェクト */}
      <div className="absolute top-20 right-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
      
      <div className="max-w-4xl mx-auto relative">
        <button onClick={() => setCurrentScreen('main-menu')} className="mb-6 px-5 py-2.5 bg-slate-900/50 hover:bg-slate-800/50 border border-slate-800 rounded-xl transition-all font-medium text-slate-300 hover:text-white backdrop-blur-sm">
          ← メインメニュー
        </button>
        
        {/* ヘッダーカード */}
        <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl shadow-2xl p-8 mb-6 border border-slate-800">
          <h2 className="text-4xl font-black text-white mb-2">{title}</h2>
          <p className="text-slate-400 text-sm">Coming Soon...</p>
        </div>
        
        <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-20 text-center border border-slate-800">
          <div className="text-6xl mb-4">🚧</div>
          <div className="text-slate-400 text-xl">後続のステップで作成します</div>
        </div>
      </div>
    </div>
  );

  // 夜勤・日勤当番表画面
  const ShiftScheduleScreen = () => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [calendar, setCalendar] = useState([]);
    const [surgeryDays, setSurgeryDays] = useState([]);
    const [nightShiftOrder, setNightShiftOrder] = useState([]);
    const [dayShiftOrder, setDayShiftOrder] = useState([]);
    const [pairs, setPairs] = useState([]);
    const [schedule, setSchedule] = useState({});
    const [weeklyOff, setWeeklyOff] = useState({});
    const [showNightShiftModal, setShowNightShiftModal] = useState(false);
    const [showDayShiftModal, setShowDayShiftModal] = useState(false);
    const [showPairModal, setShowPairModal] = useState(false);
    const [showMatrix, setShowMatrix] = useState(false);

    // カレンダー生成
    const generateCalendar = () => {
      if (!startDate || !endDate) {
        alert('⚠️ 開始日と終了日を入力してください');
        return;
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start > end) {
        alert('⚠️ 開始日は終了日より前にしてください');
        return;
      }

      const days = [];
      const current = new Date(start);
      
      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        const dayOfWeek = current.getDay(); // 0:日, 1:月, ..., 6:土
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        days.push({
          date: dateStr,
          dayOfWeek: ['日', '月', '火', '水', '木', '金', '土'][dayOfWeek],
          dayOfWeekNum: dayOfWeek,
          isWeekend,
          isHoliday: false
        });
        
        current.setDate(current.setDate() + 1);
      }
      
      setCalendar(days);
      alert('✅ カレンダーを生成しました');
    };

    // 外科輪番日の切り替え
    const toggleSurgeryDay = (date) => {
      setSurgeryDays(prev => 
        prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
      );
    };

    // 自動配置
    const autoAssign = () => {
      if (calendar.length === 0) {
        alert('⚠️ まずカレンダーを生成してください');
        return;
      }

      if (nightShiftOrder.length === 0) {
        alert('⚠️ 夜勤順番リストを設定してください');
        return;
      }

      const newSchedule = {};
      let nightIndex = 0;
      let dayIndex = 0;

      calendar.forEach((day, idx) => {
        const dateStr = day.date;
        newSchedule[dateStr] = {
          nightShift: null,
          dayShift: null,
          support: null,
          b: null,
          dayOff: null
        };

        // 夜勤を割り当て
        if (nightShiftOrder.length > 0) {
          newSchedule[dateStr].nightShift = nightShiftOrder[nightIndex % nightShiftOrder.length];
          nightIndex++;
        }

        // 前日の夜勤者の非番を設定
        if (idx > 0) {
          const prevDate = calendar[idx - 1].date;
          if (newSchedule[prevDate]?.nightShift) {
            newSchedule[dateStr].dayOff = newSchedule[prevDate].nightShift;
          }
        }

        // 土日祝の日勤とサポート
        if (day.isWeekend || day.isHoliday) {
          if (dayShiftOrder.length > 0) {
            const dayShiftPerson = dayShiftOrder[dayIndex % dayShiftOrder.length];
            newSchedule[dateStr].dayShift = dayShiftPerson;
            
            // ペアをサポートに割り当て
            const pair = pairs.find(p => p.person1 === dayShiftPerson || p.person2 === dayShiftPerson);
            if (pair) {
              newSchedule[dateStr].support = pair.person1 === dayShiftPerson ? pair.person2 : pair.person1;
            }
            
            dayIndex++;
          }
        }

        // B（外科輪番日の場合、翌日の夜勤者を設定）
        if (surgeryDays.includes(dateStr)) {
          if (idx < calendar.length - 1) {
            const nextDate = calendar[idx + 1].date;
            if (newSchedule[nextDate]?.nightShift) {
              newSchedule[dateStr].b = newSchedule[nextDate].nightShift;
            }
          }
        }
      });

      setSchedule(newSchedule);
      alert('✅ 自動配置が完了しました');
    };

    // 週休自動割り当て
    const autoAssignWeeklyOff = () => {
      if (calendar.length === 0 || Object.keys(schedule).length === 0) {
        alert('⚠️ まず当番表を作成してください');
        return;
      }

      // 休暇データを読み込み
      const savedLeaveData = localStorage.getItem('leaveData');
      const leaveData = savedLeaveData ? JSON.parse(savedLeaveData).leaveData || {} : {};

      const newWeeklyOff = {};

      // 各職員について週休を計算
      staffData.forEach(staff => {
        const staffId = staff.id;
        let weeklyOffDays = 0;

        calendar.forEach((day, idx) => {
          const dateStr = day.date;
          const daySchedule = schedule[dateStr];
          if (!daySchedule) return;

          // 週休が必要な条件をチェック
          // 金曜16
          if (day.dayOfWeekNum === 5 && daySchedule.nightShift === staffId) {
            weeklyOffDays += 1;
          }
          // 土曜16 (2日分)
          if (day.dayOfWeekNum === 6 && daySchedule.nightShift === staffId) {
            weeklyOffDays += 2;
          }
          // 土曜日勤
          if (day.dayOfWeekNum === 6 && daySchedule.dayShift === staffId) {
            weeklyOffDays += 1;
          }
          // 日曜日勤
          if (day.dayOfWeekNum === 0 && daySchedule.dayShift === staffId) {
            weeklyOffDays += 1;
          }
          // 日曜16
          if (day.dayOfWeekNum === 0 && daySchedule.nightShift === staffId) {
            weeklyOffDays += 1;
          }
        });

        // 週休を割り当て
        let assignedDays = 0;
        for (let i = 0; i < calendar.length && assignedDays < weeklyOffDays; i++) {
          const day = calendar[i];
          const dateStr = day.date;

          // 平日かつ他の休暇がない日
          if (!day.isWeekend && !day.isHoliday) {
            // 他の休暇チェック
            const hasOtherLeave = leaveData[dateStr]?.some(leave => leave.staffId === staffId);
            
            // 当番表での割り当てチェック
            const daySchedule = schedule[dateStr];
            const isAssigned = daySchedule?.nightShift === staffId ||
                             daySchedule?.dayShift === staffId ||
                             daySchedule?.support === staffId ||
                             daySchedule?.b === staffId ||
                             daySchedule?.dayOff === staffId;

            // 週休が割り当て可能
            if (!hasOtherLeave && !isAssigned) {
              if (!newWeeklyOff[dateStr]) {
                newWeeklyOff[dateStr] = [];
              }
              if (!newWeeklyOff[dateStr].includes(staffId)) {
                newWeeklyOff[dateStr].push(staffId);
                assignedDays++;
              }
            }
          }
        }
      });

      setWeeklyOff(newWeeklyOff);
      alert('✅ 週休を自動割り当てしました');
    };

    // 手動編集
    const updateSchedule = (date, field, value) => {
      setSchedule(prev => ({
        ...prev,
        [date]: {
          ...prev[date],
          [field]: value
        }
      }));
    };

    // 週休の手動追加/削除
    const toggleWeeklyOff = (date, staffId) => {
      setWeeklyOff(prev => {
        const newData = { ...prev };
        if (!newData[date]) {
          newData[date] = [];
        }
        
        if (newData[date].includes(staffId)) {
          newData[date] = newData[date].filter(id => id !== staffId);
          if (newData[date].length === 0) {
            delete newData[date];
          }
        } else {
          newData[date].push(staffId);
        }
        
        return newData;
      });
    };

    // マトリックス表示用のデータ取得
    const getStaffAssignment = (staffId, date) => {
      const daySchedule = schedule[date];
      
      // 休暇データを確認
      const savedLeaveData = localStorage.getItem('leaveData');
      const leaveData = savedLeaveData ? JSON.parse(savedLeaveData).leaveData || {} : {};
      const leave = leaveData[date]?.find(l => l.staffId === staffId);
      if (leave) return leave.leaveType;

      // 週休
      if (weeklyOff[date]?.includes(staffId)) return '週休';

      // 当番表での割り当て
      if (daySchedule?.nightShift === staffId) return '16';
      if (daySchedule?.dayShift === staffId) return '日勤';
      if (daySchedule?.support === staffId) return 'サポート';
      if (daySchedule?.b === staffId) return 'B';
      if (daySchedule?.dayOff === staffId) return '非番';

      return '-';
    };

    // 夜勤順番リスト追加
    const addToNightShiftOrder = (staffId) => {
      if (!nightShiftOrder.includes(staffId)) {
        setNightShiftOrder([...nightShiftOrder, staffId]);
      }
    };

    // 日勤順番リスト追加
    const addToDayShiftOrder = (staffId) => {
      if (!dayShiftOrder.includes(staffId)) {
        setDayShiftOrder([...dayShiftOrder, staffId]);
      }
    };

    // ペア追加
    const addPair = (person1, person2) => {
      if (person1 && person2 && person1 !== person2) {
        setPairs([...pairs, { person1, person2 }]);
      }
    };

    // データ保存
    const saveScheduleData = () => {
      const data = {
        startDate,
        endDate,
        calendar,
        surgeryDays,
        nightShiftOrder,
        dayShiftOrder,
        pairs,
        schedule,
        weeklyOff
      };
      localStorage.setItem('scheduleData', JSON.stringify(data));
      alert('✅ 当番表データを保存しました');
    };

    // データ読み込み
    useEffect(() => {
      const saved = localStorage.getItem('scheduleData');
      if (saved) {
        const data = JSON.parse(saved);
        setStartDate(data.startDate || '');
        setEndDate(data.endDate || '');
        setCalendar(data.calendar || []);
        setSurgeryDays(data.surgeryDays || []);
        setNightShiftOrder(data.nightShiftOrder || []);
        setDayShiftOrder(data.dayShiftOrder || []);
        setPairs(data.pairs || []);
        setSchedule(data.schedule || {});
        setWeeklyOff(data.weeklyOff || {});
      }
    }, []);

    return (
      <div className="min-h-screen bg-gray-100 p-5">
        <div className="max-w-7xl mx-auto">
          <button onClick={() => setCurrentScreen('main-menu')} className="mb-5 px-5 py-2 bg-gray-300 rounded-lg hover:bg-gray-400">
            ← メインメニューに戻る
          </button>
          <h2 className="text-3xl font-bold mb-2 pb-4 border-b-4 border-purple-500">夜勤・日勤当番表作成</h2>

          {/* 設定エリア */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
            {/* 期間設定 */}
            <div className="bg-white rounded-xl p-5 shadow">
              <h3 className="font-bold mb-3">📅 期間設定</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm mb-1">開始日</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} 
                         className="w-full p-2 border-2 border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm mb-1">終了日</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} 
                         className="w-full p-2 border-2 border-gray-300 rounded-lg" />
                </div>
                <button onClick={generateCalendar} className="w-full bg-purple-500 text-white py-2 rounded-lg hover:bg-purple-600">
                  カレンダー生成
                </button>
              </div>
            </div>

            {/* 順番設定 */}
            <div className="bg-white rounded-xl p-5 shadow">
              <h3 className="font-bold mb-3">👥 順番設定</h3>
              <div className="space-y-2">
                <button onClick={() => setShowNightShiftModal(true)} className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 text-sm">
                  夜勤順番リスト ({nightShiftOrder.length}名)
                </button>
                <button onClick={() => setShowDayShiftModal(true)} className="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 text-sm">
                  日勤順番リスト ({dayShiftOrder.length}名)
                </button>
                <button onClick={() => setShowPairModal(true)} className="w-full bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600 text-sm">
                  ペア設定 ({pairs.length}組)
                </button>
              </div>
            </div>

            {/* 実行・保存 */}
            <div className="bg-white rounded-xl p-5 shadow">
              <h3 className="font-bold mb-3">⚙️ 実行・保存</h3>
              <div className="space-y-2">
                <button onClick={autoAssign} className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 text-sm">
                  🎯 当番自動配置
                </button>
                <button onClick={autoAssignWeeklyOff} className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 text-sm">
                  📅 週休自動割り当て
                </button>
                <button onClick={() => setShowMatrix(!showMatrix)} className="w-full bg-cyan-600 text-white py-2 rounded-lg hover:bg-cyan-700 text-sm">
                  {showMatrix ? '📋 基本表示' : '📊 マトリックス表示'}
                </button>
                <button onClick={saveScheduleData} className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 text-sm">
                  💾 保存
                </button>
              </div>
            </div>
          </div>

          {/* マトリックス表示 */}
          {showMatrix && calendar.length > 0 && (
            <div className="bg-white rounded-xl p-5 shadow mb-5">
              <h3 className="font-bold mb-4">📊 職員×日付マトリックス（16、日勤、サポート、B、非番、週休、休暇）</h3>
              <div className="overflow-x-auto">
                <table className="border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 sticky left-0 bg-gray-100 z-10 min-w-[100px]">職員</th>
                      {calendar.map(day => (
                        <th key={day.date} className="border p-2 min-w-[80px]">
                          <div>{day.date.split('-')[2]}</div>
                          <div className="text-xs font-normal">{day.dayOfWeek}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map(staff => (
                      <tr key={staff.id}>
                        <td className="border p-2 font-bold sticky left-0 bg-white z-10">{staff.name}</td>
                        {calendar.map(day => {
                          const assignment = getStaffAssignment(staff.id, day.date);
                          const colorMap = {
                            '16': 'bg-blue-100',
                            '日勤': 'bg-green-100',
                            'サポート': 'bg-yellow-100',
                            'B': 'bg-orange-100',
                            '非番': 'bg-red-100',
                            '週休': 'bg-purple-100',
                            '年休': 'bg-teal-100',
                            'リフ休': 'bg-pink-100',
                            '特別休': 'bg-indigo-100',
                            '出張': 'bg-gray-200'
                          };
                          
                          return (
                            <td key={day.date} 
                                className={`border p-1 text-center cursor-pointer hover:bg-yellow-50 ${colorMap[assignment] || ''}`}
                                onClick={() => {
                                  if (assignment === '週休') {
                                    toggleWeeklyOff(day.date, staff.id);
                                  }
                                }}>
                              <div className="text-xs">{assignment}</div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-xs text-gray-600">
                ※週休のセルをクリックで手動追加/削除が可能です
              </div>
            </div>
          )}

          {/* カレンダー表示 */}
          {!showMatrix && calendar.length > 0 && (
            <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-800">
              <h3 className="font-bold mb-4 text-white text-lg">📆 当番表カレンダー</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="p-3 text-left text-slate-400 font-semibold uppercase tracking-wider">日付</th>
                      <th className="p-3 text-center text-slate-400 font-semibold uppercase tracking-wider">曜日</th>
                      <th className="p-3 text-left text-slate-400 font-semibold uppercase tracking-wider bg-blue-500/10">夜勤(16)</th>
                      <th className="p-3 text-left text-slate-400 font-semibold uppercase tracking-wider bg-green-500/10">日勤</th>
                      <th className="p-3 text-left text-slate-400 font-semibold uppercase tracking-wider bg-yellow-500/10">サポート</th>
                      <th className="p-3 text-left text-slate-400 font-semibold uppercase tracking-wider bg-orange-500/10">B</th>
                      <th className="p-3 text-left text-slate-400 font-semibold uppercase tracking-wider bg-red-500/10">非番</th>
                      <th className="p-3 text-center text-slate-400 font-semibold uppercase tracking-wider">外科輪番</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calendar.map(day => {
                      const isSurgery = surgeryDays.includes(day.date);
                      const daySchedule = schedule[day.date] || {};
                      
                      return (
                        <tr key={day.date} className={`border-b border-slate-800 hover:bg-slate-800/30 transition-all ${day.isWeekend ? 'bg-slate-800/20' : ''}`}>
                          <td className="p-3 text-slate-300">{day.date}</td>
                          <td className="p-3 text-center text-white font-bold">{day.dayOfWeek}</td>
                          <td className="p-3 bg-blue-500/10 text-blue-300">{daySchedule.nightShift || '-'}</td>
                          <td className="p-3 bg-green-500/10 text-green-300">{daySchedule.dayShift || '-'}</td>
                          <td className="p-3 bg-yellow-500/10 text-yellow-300">{daySchedule.support || '-'}</td>
                          <td className="p-3 bg-orange-500/10 text-orange-300">{daySchedule.b || '-'}</td>
                          <td className="p-3 bg-red-500/10 text-red-300">{daySchedule.dayOff || '-'}</td>
                          <td className="p-3 text-center">
                            <button 
                              onClick={() => toggleSurgeryDay(day.date)}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${isSurgery ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>
                              {isSurgery ? '✓' : '−'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                ※外科輪番日はボタンをクリックして指定してください
              </div>
            </div>
          )}

          {/* 夜勤順番モーダル */}
          {showNightShiftModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5 z-50">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full max-h-96 overflow-y-auto shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-white text-xl">夜勤順番リスト設定</h3>
                  <button onClick={() => setShowNightShiftModal(false)} className="text-slate-400 hover:text-white transition-colors text-2xl">✕</button>
                </div>
                <div className="mb-4">
                  <label className="block text-sm mb-2 text-slate-300 font-semibold uppercase tracking-wider">職員を選択して追加</label>
                  <select onChange={(e) => { addToNightShiftOrder(e.target.value); e.target.value = ''; }} 
                          className="w-full p-3 bg-slate-800 border-2 border-slate-700 rounded-xl text-white focus:border-blue-500 outline-none transition-all">
                    <option value="">-- 職員を選択 --</option>
                    {staffData.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-sm text-slate-300 uppercase tracking-wider">現在の順番：</h4>
                  {nightShiftOrder.map((id, idx) => {
                    const staff = staffData.find(s => s.id === id);
                    return (
                      <div key={idx} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                        <span className="text-white">{idx + 1}. {staff?.name || id}</span>
                        <button onClick={() => setNightShiftOrder(nightShiftOrder.filter((_, i) => i !== idx))} 
                                className="text-red-400 hover:text-red-300 font-semibold transition-colors">削除</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 日勤順番モーダル */}
          {showDayShiftModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5 z-50">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full max-h-96 overflow-y-auto shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-white text-xl">日勤順番リスト設定</h3>
                  <button onClick={() => setShowDayShiftModal(false)} className="text-slate-400 hover:text-white transition-colors text-2xl">✕</button>
                </div>
                <div className="mb-4">
                  <label className="block text-sm mb-2 text-slate-300 font-semibold uppercase tracking-wider">職員を選択して追加</label>
                  <select onChange={(e) => { addToDayShiftOrder(e.target.value); e.target.value = ''; }} 
                          className="w-full p-3 bg-slate-800 border-2 border-slate-700 rounded-xl text-white focus:border-green-500 outline-none transition-all">
                    <option value="">-- 職員を選択 --</option>
                    {staffData.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-sm text-slate-300 uppercase tracking-wider">現在の順番：</h4>
                  {dayShiftOrder.map((id, idx) => {
                    const staff = staffData.find(s => s.id === id);
                    return (
                      <div key={idx} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                        <span className="text-white">{idx + 1}. {staff?.name || id}</span>
                        <button onClick={() => setDayShiftOrder(dayShiftOrder.filter((_, i) => i !== idx))} 
                                className="text-red-400 hover:text-red-300 font-semibold transition-colors">削除</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ペア設定モーダル */}
          {showPairModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5 z-50">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full max-h-96 overflow-y-auto shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-white text-xl">ペア設定</h3>
                  <button onClick={() => setShowPairModal(false)} className="text-slate-400 hover:text-white transition-colors text-2xl">✕</button>
                </div>
                <div className="mb-4">
                  <label className="block text-sm mb-2 text-slate-300 font-semibold uppercase tracking-wider">新しいペアを追加</label>
                  <div className="flex gap-2">
                    <select id="pair-person1" className="flex-1 p-3 bg-slate-800 border-2 border-slate-700 rounded-xl text-white text-sm focus:border-orange-500 outline-none transition-all">
                      <option value="">-- 職員1 --</option>
                      {staffData.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <select id="pair-person2" className="flex-1 p-3 bg-slate-800 border-2 border-slate-700 rounded-xl text-white text-sm focus:border-orange-500 outline-none transition-all">
                      <option value="">-- 職員2 --</option>
                      {staffData.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={() => {
                    const p1 = document.getElementById('pair-person1').value;
                    const p2 = document.getElementById('pair-person2').value;
                    addPair(p1, p2);
                    document.getElementById('pair-person1').value = '';
                    document.getElementById('pair-person2').value = '';
                  }} className="w-full mt-3 bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl transition-all font-semibold shadow-lg shadow-orange-500/20 hover:-translate-y-0.5">
                    追加
                  </button>
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-sm text-slate-300 uppercase tracking-wider">現在のペア：</h4>
                  {pairs.map((pair, idx) => {
                    const staff1 = staffData.find(s => s.id === pair.person1);
                    const staff2 = staffData.find(s => s.id === pair.person2);
                    return (
                      <div key={idx} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                        <span className="text-white">{staff1?.name || pair.person1} ↔ {staff2?.name || pair.person2}</span>
                        <button onClick={() => setPairs(pairs.filter((_, i) => i !== idx))} 
                                className="text-red-400 hover:text-red-300 font-semibold transition-colors">削除</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 画面ルーティング
  const renderScreen = () => {
    switch (currentScreen) {
      case 'main-menu': return <MainMenu />;
      case 'modality-db': return <ModalityDB />;
      case 'staff-db': return <StaffDB />;
      case 'rules': return <RulesScreen />;
      case 'shift-schedule': return <ShiftScheduleScreen />;
      case 'leave-input': return <LeaveInputScreen />;
      case 'allocation': return <AllocationScreen />;
      case 'data-manage': return <PlaceholderScreen title="データ保存・読込" />;
      default: return <MainMenu />;
    }
  };

  return <div>{renderScreen()}</div>;
}
