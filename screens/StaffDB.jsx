import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';

export default function StaffDB({ onBack, showStaffForm, setShowStaffForm, editingStaff, setEditingStaff }) {
  const { modalityData, staffData, setStaffData } = useData();
  const [formData, setFormData] = useState({ id: '', name: '', years: '', position: '', scores: {} });

  useEffect(() => {
    if (editingStaff) {
      setFormData(editingStaff);
    } else {
      resetForm();
    }
  }, [editingStaff]);

  const resetForm = () => {
    const scores = {};
    modalityData.forEach(mod => (scores[mod.id] = 0));
    setFormData({ id: '', name: '', years: '', position: '', scores });
  };

  const handleSubmit = () => {
    if (!formData.id || !formData.name || !formData.years) {
      alert('⚠️ 職員ID、氏名、入職年数は必須項目です');
      return;
    }
    const idAlreadyUsed = editingStaff
      ? staffData.some(s => s.id === formData.id && s.id !== editingStaff.id)
      : staffData.some(s => s.id === formData.id);
    if (idAlreadyUsed) {
      alert('⚠️ この職員IDは既に登録されています。別のIDを入力するか、編集を中断してください。');
      return;
    }
    if (editingStaff) {
      setStaffData(prev => prev.map(s => (s.id === editingStaff.id ? formData : s)));
      alert('✅ 職員情報を更新しました');
    } else {
      setStaffData(prev => [...prev, formData]);
      alert('✅ 職員を登録しました');
    }
    setShowStaffForm(false);
    setEditingStaff(null);
    resetForm();
  };

  const handleCancel = () => {
    setShowStaffForm(false);
    setEditingStaff(null);
    resetForm();
  };

  const deleteStaff = (id) => {
    if (!confirm('本当にこの職員を削除しますか？')) return;
    setStaffData(prev => prev.filter(s => s.id !== id));
    setShowStaffForm(false);
    setEditingStaff(null);
    resetForm();
    alert('✅ 職員を削除しました');
  };

  const openNewForm = () => {
    setEditingStaff(null);
    resetForm();
    setShowStaffForm(true);
  };

  const openEditForm = (staff) => {
    setEditingStaff(staff);
    setShowStaffForm(true);
  };

  const showForm = showStaffForm || editingStaff;

  return (
    <div className="min-h-screen bg-violet-400 p-5 relative overflow-hidden">
      <div className="absolute top-20 left-20 w-96 h-96 bg-violet-400/30 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col h-full w-full min-w-0 max-w-full">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h2 className="text-3xl font-bold text-stone-800">職員情報入力</h2>
          <div className="flex items-center gap-2">
            <button onClick={openNewForm} className="px-5 py-2.5 bg-white hover:bg-stone-50 border-2 border-violet-700 text-violet-900 rounded-xl text-lg font-semibold transition-all shadow-md">
              ➕ 新規登録
            </button>
            <button onClick={onBack} className="px-5 py-2.5 bg-stone-50 hover:bg-slate-100 border-2 border-slate-400 rounded-xl text-stone-800 text-lg font-semibold transition-all shadow-sm">
              ← メインメニュー
            </button>
          </div>
        </div>

        <div className="flex gap-6 flex-1 min-h-0 min-w-0 w-full">
          {/* 左: 職員一覧 */}
          <div className="w-[520px] min-w-[520px] shrink-0 flex flex-col">
            {staffData.length === 0 ? (
              <div className="bg-slate-50 rounded-xl border-2 border-slate-400 p-8 text-center shadow-md">
                <p className="text-stone-700 text-xl mb-5">まだ職員が登録されていません</p>
                <button onClick={openNewForm} className="px-6 py-3 bg-white hover:bg-stone-50 border-2 border-violet-700 text-violet-900 rounded-xl text-lg font-semibold transition-all shadow-md">
                  ➕ 新規登録
                </button>
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto pr-1">
                {[...staffData]
                  .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }))
                  .map(staff => (
                    <div
                      key={staff.id}
                      className={`rounded-xl border-2 overflow-hidden shadow-md cursor-pointer transition-all ${
                        editingStaff?.id === staff.id
                          ? 'border-violet-500 bg-violet-50/80 ring-2 ring-violet-200'
                          : 'border-slate-400 bg-slate-50 hover:bg-slate-100/80 hover:border-slate-500'
                      }`}
                      onClick={() => openEditForm(staff)}
                    >
                      <div className="flex items-center gap-3 px-3 py-3">
                        <span className="text-stone-700 text-lg font-semibold w-14 shrink-0 font-mono">{staff.id}</span>
                        <span className="flex-1 min-w-0 font-semibold text-stone-900 text-lg truncate">{staff.name}</span>
                        {staff.position ? <span className="text-stone-600 text-base shrink-0 truncate max-w-[120px]">{staff.position}</span> : null}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* 右: 編集パネル */}
          <div className="flex-1 min-w-0 overflow-auto flex flex-col">
            {showForm ? (
              <div className="bg-slate-50 rounded-xl border-2 border-slate-400 p-6 shadow-md flex-1 overflow-y-auto">
                <h3 className="text-2xl font-bold text-stone-800 mb-5">{editingStaff ? `編集: ${editingStaff.name}` : '新規登録'}</h3>
                <div className="space-y-5 max-w-3xl">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-2 font-semibold text-stone-800 text-base uppercase tracking-wider">職員ID *</label>
                      <input type="text" value={formData.id} onChange={(e) => setFormData({ ...formData, id: e.target.value })} className="w-full p-3 bg-white border-2 border-slate-400 rounded-xl text-stone-900 text-lg placeholder-stone-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all" placeholder="例: 001" />
                    </div>
                    <div>
                      <label className="block mb-2 font-semibold text-stone-800 text-base uppercase tracking-wider">氏名 *</label>
                      <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-3 bg-white border-2 border-slate-400 rounded-xl text-stone-900 text-lg placeholder-stone-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all" placeholder="例: 山田太郎" />
                    </div>
                    <div>
                      <label className="block mb-2 font-semibold text-stone-800 text-base uppercase tracking-wider">入職年数 *</label>
                      <input type="number" value={formData.years} onChange={(e) => setFormData({ ...formData, years: e.target.value })} className="w-full p-3 bg-white border-2 border-slate-400 rounded-xl text-stone-900 text-lg placeholder-stone-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all" placeholder="例: 2019" min="1900" max="2100" />
                    </div>
                    <div>
                      <label className="block mb-2 font-semibold text-stone-800 text-base uppercase tracking-wider">役職</label>
                      <input type="text" value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} className="w-full p-3 bg-white border-2 border-slate-400 rounded-xl text-stone-900 text-lg placeholder-stone-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all" placeholder="例: 主任" />
                    </div>
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold text-stone-800 text-base uppercase tracking-wider">モダリティ別配置スコア（0-4・トレーニング）</label>
                    <div className="bg-violet-50 border border-violet-200 px-3 py-2 rounded-xl mb-3 text-base text-violet-800">0:適正なし | 1:優先度低 | 2:優先度中 | 3:優先度高 | 4:絶対固定 | 5:トレーニング（配置するが必要人数に含めない）</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      {modalityData.map(mod => (
                        <div key={mod.id} className="flex items-center justify-between bg-white border-2 border-slate-400 py-3 px-4 rounded-xl gap-4 min-w-0">
                          <span className="text-stone-800 text-base font-medium truncate min-w-0">{mod.id}. {mod.name}</span>
                          <select value={formData.scores[mod.id] ?? 0} onChange={(e) => setFormData({ ...formData, scores: { ...formData.scores, [mod.id]: parseInt(e.target.value, 10) } })} className="w-40 min-w-[10rem] py-2 px-3 bg-white border-2 border-slate-400 rounded-xl text-stone-900 text-base font-semibold focus:border-violet-400 outline-none shrink-0">
                            <option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">トレーニング</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-3 items-center">
                    <button type="button" onClick={handleSubmit} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-lg font-semibold transition-all shadow-sm">
                      登録
                    </button>
                    <button type="button" onClick={handleCancel} className="px-5 py-2.5 bg-slate-100 hover:bg-stone-200 text-stone-800 rounded-xl text-lg font-semibold transition-all">
                      閉じる
                    </button>
                    {editingStaff && (
                      <button
                        type="button"
                        onClick={() => deleteStaff(editingStaff.id)}
                        className="ml-auto px-5 py-2.5 bg-red-500 hover:bg-red-400 text-white rounded-xl text-lg font-semibold transition-all shadow-sm"
                      >
                        削除
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50/80 rounded-xl border-2 border-dashed border-slate-300 p-8 flex items-center justify-center min-h-[280px]">
                <p className="text-stone-600 text-xl">左の一覧から職員をクリックして編集するか、新規登録をクリックしてください</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
