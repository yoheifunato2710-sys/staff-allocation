import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';

export default function StaffDB({ onBack, showStaffForm, setShowStaffForm, editingStaff, setEditingStaff }) {
  const { modalityData, staffData, setStaffData } = useData();
  const [formData, setFormData] = useState({ id: '', name: '', years: '', position: '', scores: {}, isPartTime: false, partTimeSlot: 'am_pm' });
  const [dragFromIndex, setDragFromIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const leftListRef = useRef(null);
  const rightPanelRef = useRef(null);
  const scrollToSyncRef = useRef(null);

  useEffect(() => {
    if (editingStaff) {
      setFormData(editingStaff);
    } else {
      resetForm();
    }
  }, [editingStaff]);

  // 職員をクリックして編集を開いたとき、右パネルを左リストのスクロール位置に合わせる
  useEffect(() => {
    if (!editingStaff || scrollToSyncRef.current == null) return;
    const scrollVal = scrollToSyncRef.current;
    scrollToSyncRef.current = null;
    const sync = () => {
      if (rightPanelRef.current != null) {
        rightPanelRef.current.scrollTop = scrollVal;
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(sync));
  }, [editingStaff]);

  const resetForm = () => {
    const scores = {};
    modalityData.forEach(mod => (scores[mod.id] = 0));
    setFormData({ id: '', name: '', years: '', position: '', scores, isPartTime: false, partTimeSlot: 'am_pm' });
  };

  const getNextStaffId = () => {
    if (staffData.length === 0) return '1';
    const nums = staffData.map(s => parseInt(String(s.id), 10)).filter(n => !Number.isNaN(n));
    return String((nums.length ? Math.max(...nums) : 0) + 1);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.years) {
      alert('⚠️ 氏名、入職年数は必須項目です');
      return;
    }
    if (editingStaff) {
      setStaffData(prev => prev.map(s => (s.id === editingStaff.id ? { ...formData, id: editingStaff.id } : s)));
      alert('✅ 職員情報を更新しました');
    } else {
      const newId = getNextStaffId();
      setStaffData(prev => [...prev, { ...formData, id: newId }]);
      alert('✅ 職員を登録しました');
    }
    setShowStaffForm(false);
    setEditingStaff(null);
    resetForm();
  };

  const moveStaffToIndex = (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    setStaffData(prev => {
      const arr = [...prev];
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return arr;
    });
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    setDragFromIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDrop = (e, toIdx) => {
    e.preventDefault();
    const fromIdx = dragFromIndex;
    if (fromIdx !== null && fromIdx !== toIdx) moveStaffToIndex(fromIdx, toIdx);
    setDragFromIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragFromIndex(null);
    setDragOverIndex(null);
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
    scrollToSyncRef.current = leftListRef.current?.scrollTop ?? 0;
    setEditingStaff(staff);
    setShowStaffForm(true);
  };

  const showForm = showStaffForm || editingStaff;

  return (
    <div className="h-screen flex flex-col bg-violet-400 p-5 relative overflow-hidden">
      <div className="absolute top-20 left-20 w-96 h-96 bg-violet-400/30 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col flex-1 min-h-0 w-full min-w-0 max-w-full">
        <div className="flex justify-between items-center mb-2 shrink-0">
          <h2 className="text-3xl font-bold text-stone-800">職員情報登録</h2>
          <div className="flex items-center gap-2">
            <button onClick={openNewForm} className="btn-add">
              ➕ 新規追加
            </button>
            <button onClick={onBack} className="btn-header">
              ← メインメニュー
            </button>
          </div>
        </div>

        <div className="flex gap-6 flex-1 min-h-0 min-w-0 w-full">
          {/* 左: 職員一覧（このエリアのみスクロール） */}
          <div className="w-[520px] min-w-[520px] shrink-0 flex flex-col min-h-0">
            {staffData.length === 0 ? (
              <div className="bg-slate-50 rounded-xl border-2 border-slate-400 p-6 text-center shadow-md">
                <p className="text-stone-700 text-base mb-4">まだ職員が登録されていません</p>
                <button onClick={openNewForm} className="btn-add">
                  ➕ 新規追加
                </button>
              </div>
            ) : (
              <div ref={leftListRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-1 pr-1">
                {staffData.map((staff, index) => (
                  <div
                    key={staff.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`rounded-lg border-2 overflow-hidden shadow-sm cursor-grab active:cursor-grabbing transition-all ${
                      dragFromIndex === index ? 'opacity-50' : ''
                    } ${
                      dragOverIndex === index ? 'ring-2 ring-emerald-400 border-emerald-400 bg-emerald-50/80' : ''
                    } ${
                      editingStaff?.id === staff.id && dragOverIndex !== index
                        ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-200'
                        : 'border-slate-400 bg-slate-50 hover:bg-slate-100/80 hover:border-slate-500'
                    }`}
                    onClick={() => openEditForm(staff)}
                  >
                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <div className="flex items-center shrink-0 gap-0 text-slate-400 cursor-grab active:cursor-grabbing" onClick={(e) => e.stopPropagation()} title="ドラッグで順序変更">
                        <span className="text-base leading-none select-none">⋮⋮</span>
                      </div>
                      <span className="text-stone-700 text-sm font-semibold w-5 shrink-0">{index + 1}</span>
                      <span className="flex-1 min-w-0 font-semibold text-stone-900 text-base truncate">{staff.name}</span>
                      {staff.isPartTime ? <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">{staff.partTimeSlot === 'am_pm' ? 'AM＆PM' : staff.partTimeSlot === 'am' ? 'AM' : 'PM'}</span> : null}
                      {staff.position ? <span className="text-stone-600 text-xs shrink-0 truncate max-w-[100px]">{staff.position}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 右: 編集パネル */}
          <div ref={rightPanelRef} className="flex-1 min-w-0 overflow-auto flex flex-col">
            {showForm ? (
              <div className="bg-slate-50 rounded-xl border-2 border-slate-400 p-4 shadow-md flex-1 overflow-y-auto">
                <h3 className="text-xl font-bold text-stone-800 mb-3">{editingStaff ? `編集: ${editingStaff.name}` : '新規追加'}</h3>
                <div className="space-y-3 max-w-3xl">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block mb-1.5 font-semibold text-stone-800 text-sm uppercase tracking-wider">氏名 *</label>
                      <div className="flex items-center gap-3 flex-wrap">
                        <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="flex-1 min-w-[200px] p-2 bg-white border-2 border-slate-400 rounded-lg text-stone-900 text-base placeholder-stone-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all" placeholder="例: 山田太郎" />
                        <label className="flex items-center gap-2 cursor-pointer shrink-0">
                          <input type="checkbox" checked={formData.isPartTime ?? false} onChange={(e) => setFormData({ ...formData, isPartTime: e.target.checked, partTimeSlot: e.target.checked ? (formData.partTimeSlot ?? 'am_pm') : 'am_pm' })} className="w-4 h-4 rounded border-2 border-slate-400 text-violet-600 focus:ring-violet-400" />
                          <span className="text-stone-800 text-sm font-medium">パート</span>
                        </label>
                      </div>
                      {(formData.isPartTime ?? false) && (
                        <div className="mt-2 flex items-center gap-3 flex-wrap">
                          <span className="text-stone-800 text-sm font-medium shrink-0">勤務可能時間帯</span>
                          <div className="flex items-center gap-3 flex-wrap">
                            {[
                              { value: 'am', label: 'AM' },
                              { value: 'pm', label: 'PM' },
                              { value: 'am_pm', label: 'AM＆PM' }
                            ].map(({ value, label }) => (
                              <label key={value} className="flex items-center gap-1.5 cursor-pointer">
                                <input type="radio" name="partTimeSlot" value={value} checked={(formData.partTimeSlot ?? 'am_pm') === value} onChange={() => setFormData({ ...formData, partTimeSlot: value })} className="w-3.5 h-3.5 text-violet-600 focus:ring-violet-400" />
                                <span className="text-stone-800 text-sm">{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block mb-1.5 font-semibold text-stone-800 text-sm uppercase tracking-wider">入職年数 *</label>
                      <input type="number" value={formData.years} onChange={(e) => setFormData({ ...formData, years: e.target.value })} className="w-full p-2 bg-white border-2 border-slate-400 rounded-lg text-stone-900 text-base placeholder-stone-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all" placeholder="例: 2019" min="1900" max="2100" />
                    </div>
                    <div>
                      <label className="block mb-1.5 font-semibold text-stone-800 text-sm uppercase tracking-wider">役職</label>
                      <input type="text" value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} className="w-full p-2 bg-white border-2 border-slate-400 rounded-lg text-stone-900 text-base placeholder-stone-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all" placeholder="例: 主任" />
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1.5 font-semibold text-stone-800 text-sm uppercase tracking-wider">モダリティ別配置スコア（0-4・トレーニング）</label>
                    <div className="bg-violet-50 border border-violet-200 px-2 py-1.5 rounded-lg mb-2 text-sm text-violet-800">0:適正なし | 1:優先度低 | 2:優先度中 | 3:優先度高 | 4:絶対固定 | 5:トレーニング（配置するが必要人数に含めない）</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                      {modalityData.map((mod, idx) => (
                        <div key={mod.id} className="flex items-center justify-between bg-white border-2 border-slate-400 py-2 px-3 rounded-lg gap-3 min-w-0">
                          <span className="text-stone-800 text-sm font-medium truncate min-w-0">{idx + 1}. {mod.name}</span>
                          <select value={formData.scores[mod.id] ?? 0} onChange={(e) => setFormData({ ...formData, scores: { ...formData.scores, [mod.id]: parseInt(e.target.value, 10) } })} className="w-36 min-w-[8rem] py-1.5 px-2 bg-white border-2 border-slate-400 rounded-lg text-stone-900 text-sm font-semibold focus:border-violet-400 outline-none shrink-0">
                            <option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">トレーニング</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 items-center">
                    <button type="button" onClick={handleSubmit} className="btn-add">
                      登録
                    </button>
                    <button type="button" onClick={handleCancel} className="btn-panel bg-white hover:bg-slate-100 border-2 border-slate-600 text-stone-800">
                      閉じる
                    </button>
                    {editingStaff && (
                      <button
                        type="button"
                        onClick={() => deleteStaff(editingStaff.id)}
                        className="btn-panel ml-auto bg-red-500 hover:bg-red-400 text-white shadow-sm"
                      >
                        削除
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50/80 rounded-xl border-2 border-dashed border-slate-300 p-6 flex items-center justify-center min-h-[200px]">
                <p className="text-stone-600 text-base">左の一覧から職員をクリックして編集するか、新規追加をクリックしてください</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
