import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import ScreenHeader from '../components/ScreenHeader';
import SortableList from '../components/SortableList';
import StaffBadges, { PART_TIME_SLOTS } from '../components/StaffBadges';
import { removeStaffReferences } from '../utils/cleanup';

const labelClass = 'block mb-1.5 font-semibold text-stone-800 text-sm uppercase tracking-wider';
const inputClass = 'p-2 bg-white border-2 border-slate-400 rounded-lg text-stone-900 text-base placeholder-stone-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all';
const SCORE_OPTIONS = [['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', 'トレーニング']];

export default function StaffDB({ onBack }) {
  const { modalityData, staffData, setStaffData, exportStaffCSV } = useData();
  const [form, setForm] = useState(null); // null = フォームを閉じている
  const [editingId, setEditingId] = useState(null);
  const leftListRef = useRef(null);
  const rightPanelRef = useRef(null);
  const scrollToSyncRef = useRef(null);

  // 職員をクリックして編集を開いたとき、右パネルを左リストのスクロール位置に合わせる
  useEffect(() => {
    if (editingId == null || scrollToSyncRef.current == null) return;
    const scrollTop = scrollToSyncRef.current;
    scrollToSyncRef.current = null;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (rightPanelRef.current) rightPanelRef.current.scrollTop = scrollTop;
    }));
  }, [editingId]);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const close = () => {
    setForm(null);
    setEditingId(null);
  };

  const openNewForm = () => {
    setEditingId(null);
    setForm({
      id: '', name: '', displayName: '', years: '', position: '', isPartTime: false, partTimeSlot: 'am_pm',
      scores: Object.fromEntries(modalityData.map((m) => [m.id, 0])),
    });
  };

  const openEditForm = (staff) => {
    scrollToSyncRef.current = leftListRef.current?.scrollTop ?? 0;
    setEditingId(staff.id);
    setForm(staff);
  };

  const handleSubmit = () => {
    if (!form.name || !form.years) {
      alert('⚠️ 氏名、入職年数は必須項目です');
      return;
    }
    if (editingId != null) {
      setStaffData((prev) => prev.map((s) => (s.id === editingId ? { ...form, id: editingId } : s)));
      alert('✅ 職員情報を更新しました');
    } else {
      const nums = staffData.map((s) => parseInt(String(s.id), 10)).filter((n) => !Number.isNaN(n));
      const newId = String((nums.length ? Math.max(...nums) : 0) + 1);
      setStaffData((prev) => [...prev, { ...form, id: newId }]);
      alert('✅ 職員を登録しました');
    }
    close();
  };

  const deleteStaff = () => {
    if (!confirm('本当にこの職員を削除しますか？\n当番表・順番設定・週休・休暇・配置表からもこの職員を外します。')) return;
    removeStaffReferences(editingId);
    setStaffData((prev) => prev.filter((s) => s.id !== editingId));
    close();
    alert('✅ 職員を削除しました');
  };

  const editingName = staffData.find((s) => s.id === editingId)?.name;

  return (
    <div className="h-screen flex flex-col bg-violet-400 p-5 relative overflow-hidden">
      <div className="absolute top-20 left-20 w-96 h-96 bg-violet-400/30 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col flex-1 min-h-0 w-full min-w-0 max-w-full">
        <ScreenHeader title="職員情報登録" onBack={onBack} className="mb-2">
          <button type="button" onClick={exportStaffCSV} className="btn-panel bg-white border-2 border-slate-600 text-stone-800">📄 CSV出力</button>
          <button type="button" onClick={openNewForm} className="btn-add">➕ 新規追加</button>
        </ScreenHeader>

        <div className="flex gap-6 flex-1 min-h-0 min-w-0 w-full">
          <div className="w-[520px] min-w-[520px] shrink-0 flex flex-col min-h-0">
            {staffData.length === 0 ? (
              <div className="bg-slate-50 rounded-xl border-2 border-slate-400 p-6 text-center shadow-md">
                <p className="text-stone-700 text-base mb-4">まだ職員が登録されていません</p>
                <button type="button" onClick={openNewForm} className="btn-add">➕ 新規追加</button>
              </div>
            ) : (
              <SortableList items={staffData} setItems={setStaffData} selectedId={editingId} onSelect={openEditForm} listRef={leftListRef}>
                {(staff) => (
                  <>
                    <span className="flex-1 min-w-0 font-semibold text-stone-900 text-base truncate">{staff.name}</span>
                    <StaffBadges staff={staff} />
                  </>
                )}
              </SortableList>
            )}
          </div>

          <div ref={rightPanelRef} className="flex-1 min-w-0 overflow-auto flex flex-col">
            {form ? (
              <div className="bg-slate-50 rounded-xl border-2 border-slate-400 p-4 shadow-md flex-1 overflow-y-auto">
                <h3 className="text-xl font-bold text-stone-800 mb-3">{editingId != null ? `編集: ${editingName}` : '新規追加'}</h3>
                <div className="space-y-3 max-w-3xl">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className={labelClass}>氏名 *</label>
                      <div className="flex items-center gap-3 flex-wrap">
                        <input type="text" value={form.name} onChange={(e) => update({ name: e.target.value })} className={`flex-1 min-w-[200px] ${inputClass}`} placeholder="例: 山田太郎" />
                        <label className="flex items-center gap-2 cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={form.isPartTime ?? false}
                            onChange={(e) => update({ isPartTime: e.target.checked, partTimeSlot: e.target.checked ? (form.partTimeSlot ?? 'am_pm') : 'am_pm' })}
                            className="w-4 h-4 rounded border-2 border-slate-400 text-violet-600 focus:ring-violet-400"
                          />
                          <span className="text-stone-800 text-sm font-medium">パート</span>
                        </label>
                      </div>
                      {form.isPartTime && (
                        <div className="mt-2 flex items-center gap-3 flex-wrap">
                          <span className="text-stone-800 text-sm font-medium shrink-0">勤務可能時間帯</span>
                          {PART_TIME_SLOTS.map(({ value, label }) => (
                            <label key={value} className="flex items-center gap-1.5 cursor-pointer">
                              <input type="radio" name="partTimeSlot" value={value} checked={(form.partTimeSlot ?? 'am_pm') === value} onChange={() => update({ partTimeSlot: value })} className="w-3.5 h-3.5 text-violet-600 focus:ring-violet-400" />
                              <span className="text-stone-800 text-sm">{label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="col-span-2">
                      <label className={labelClass}>配置表での表示名</label>
                      <input
                        type="text"
                        value={form.displayName ?? ''}
                        onChange={(e) => update({ displayName: e.target.value })}
                        className={`w-full ${inputClass}`}
                        placeholder={`未入力なら氏名（${form.name || '例: 山田太郎'}）を表示`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>入職年数 *</label>
                      <input type="number" value={form.years} onChange={(e) => update({ years: e.target.value })} className={`w-full ${inputClass}`} placeholder="例: 2019" min="1900" max="2100" />
                    </div>
                    <div>
                      <label className={labelClass}>役職</label>
                      <input type="text" value={form.position} onChange={(e) => update({ position: e.target.value })} className={`w-full ${inputClass}`} placeholder="例: 主任" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>モダリティ別配置スコア（0-4・トレーニング）</label>
                    <div className="bg-violet-50 border border-violet-200 px-2 py-1.5 rounded-lg mb-2 text-sm text-violet-800">0:適正なし | 1:優先度低 | 2:優先度中 | 3:優先度高 | 4:絶対固定 | 5:トレーニング（配置するが必要人数に含めない）</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                      {modalityData.map((mod, idx) => (
                        <div key={mod.id} className="flex items-center justify-between bg-white border-2 border-slate-400 py-2 px-3 rounded-lg gap-3 min-w-0">
                          <span className="text-stone-800 text-sm font-medium truncate min-w-0">{idx + 1}. {mod.name}</span>
                          <select
                            value={form.scores[mod.id] ?? 0}
                            onChange={(e) => update({ scores: { ...form.scores, [mod.id]: parseInt(e.target.value, 10) } })}
                            className="w-36 min-w-[8rem] py-1.5 px-2 bg-white border-2 border-slate-400 rounded-lg text-stone-900 text-sm font-semibold focus:border-violet-400 outline-none shrink-0"
                          >
                            {SCORE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 items-center">
                    <button type="button" onClick={handleSubmit} className="btn-add">登録</button>
                    <button type="button" onClick={close} className="btn-panel bg-white hover:bg-slate-100 border-2 border-slate-600 text-stone-800">閉じる</button>
                    {editingId != null && (
                      <button type="button" onClick={deleteStaff} className="btn-panel ml-auto bg-red-500 hover:bg-red-400 text-white shadow-sm">削除</button>
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
