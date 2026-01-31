import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';

export default function StaffDB({ onBack, showStaffForm, setShowStaffForm, editingStaff, setEditingStaff }) {
  const { modalityData, staffData, setStaffData, saveStaffData } = useData();
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
    if (editingStaff) {
      setStaffData(prev => prev.map(s => (s.id === editingStaff.id ? formData : s)));
      alert('✅ 職員情報を更新しました');
    } else {
      if (staffData.some(s => s.id === formData.id)) {
        alert('⚠️ この職員IDは既に登録されています');
        return;
      }
      setStaffData(prev => [...prev, formData]);
      alert('✅ 職員を登録しました');
    }
    saveStaffData();
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
    alert('✅ 職員を削除しました');
  };

  return (
    <div className="min-h-screen bg-slate-950 p-5 relative overflow-hidden">
      <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto relative">
        <div className="flex justify-between items-center gap-4 mb-6">
          <h2 className="text-2xl font-bold text-white">職員情報入力</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowStaffForm(true); setEditingStaff(null); resetForm(); }} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all">
              ➕ 新規登録
            </button>
            <button onClick={onBack} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 text-sm font-medium transition-all">
              ← メインメニュー
            </button>
          </div>
        </div>

        {showStaffForm && (
          <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-slate-800">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-white">職員情報登録</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block mb-2 font-semibold text-slate-300 text-sm uppercase tracking-wider">職員ID *</label>
                <input type="text" value={formData.id} onChange={(e) => setFormData({ ...formData, id: e.target.value })} className="w-full p-3 bg-slate-800/50 border-2 border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-blue-500/50 outline-none transition-all" placeholder="例: 001" />
              </div>
              <div>
                <label className="block mb-2 font-semibold text-slate-300 text-sm uppercase tracking-wider">氏名 *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-3 bg-slate-800/50 border-2 border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-blue-500/50 outline-none transition-all" placeholder="例: 山田太郎" />
              </div>
              <div>
                <label className="block mb-2 font-semibold text-slate-300 text-sm uppercase tracking-wider">入職年数 *</label>
                <input type="number" value={formData.years} onChange={(e) => setFormData({ ...formData, years: e.target.value })} className="w-full p-3 bg-slate-800/50 border-2 border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-blue-500/50 outline-none transition-all" placeholder="例: 2019（西暦）" min="1900" max="2100" />
              </div>
              <div>
                <label className="block mb-2 font-semibold text-slate-300 text-sm uppercase tracking-wider">役職</label>
                <input type="text" value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} className="w-full p-3 bg-slate-800/50 border-2 border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-blue-500/50 outline-none transition-all" placeholder="例: 主任" />
              </div>
            </div>
            <div className="mb-6">
              <label className="block mb-3 font-semibold text-slate-300 text-sm uppercase tracking-wider">モダリティ別配置スコア（0-4）</label>
              <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl mb-4 text-sm text-blue-200">0:適正なし | 1:優先度低 | 2:優先度中 | 3:優先度高 | 4:絶対固定</div>
              <div className="grid grid-cols-2 gap-3">
                {modalityData.map(mod => (
                  <div key={mod.id} className="flex items-center justify-between bg-slate-800/30 border border-slate-700/50 p-3 rounded-xl">
                    <span className="text-slate-300 text-sm font-medium">{mod.id}. {mod.name}</span>
                    <select value={formData.scores[mod.id] || 0} onChange={(e) => setFormData({ ...formData, scores: { ...formData.scores, [mod.id]: parseInt(e.target.value) } })} className="p-2 bg-slate-700 border-2 border-slate-600 rounded-lg text-white font-bold focus:border-blue-500 outline-none transition-all">
                      <option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={handleSubmit} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all">
                保存
              </button>
              <button type="button" onClick={handleCancel} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm font-medium transition-all">
                取り消し
              </button>
            </div>
          </div>
        )}

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
                        <button onClick={() => { setEditingStaff(staff); setShowStaffForm(true); }} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg mr-2 text-sm font-semibold transition-all">編集</button>
                        <button onClick={() => deleteStaff(staff.id)} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-semibold transition-all">削除</button>
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
}
