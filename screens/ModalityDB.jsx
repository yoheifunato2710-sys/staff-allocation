import React, { useState } from 'react';
import { useData } from '../context/DataContext';

function getSimplifiedInfo(mod) {
  if (mod.staffMode === 'uniform') {
    const am = mod.uniformStaffAm ?? mod.uniformStaff ?? 0;
    const pm = mod.uniformStaffPm ?? mod.uniformStaff ?? 0;
    return `AM${am} PM${pm}`;
  }
  const ws = mod.weekdayStaff || {};
  const dayLabels = ['月', '火', '水', '木', '金'];
  const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri'];
  return dayKeys.map((d, i) => {
    const v = ws[d];
    const a = typeof v === 'object' ? (v?.am ?? 0) : (v ?? 0);
    const p = typeof v === 'object' ? (v?.pm ?? 0) : (v ?? 0);
    return `${dayLabels[i]}${a}/${p}`;
  }).join(' ');
}

export default function ModalityDB({ onBack }) {
  const { modalityData, setModalityData } = useData();
  const [expandedId, setExpandedId] = useState(null);
  const [dragFromIndex, setDragFromIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const addModality = () => {
    const newId = modalityData.length > 0
      ? Math.max(...modalityData.map(m => m.id)) + 1
      : 1;
    const dayDefault = { am: 1, pm: 1 };
    const newMod = {
      id: newId,
      name: '新規モダリティ',
      staffMode: 'uniform',
      uniformStaffAm: 1,
      uniformStaffPm: 1,
      weekdayStaff: { mon: { ...dayDefault }, tue: { ...dayDefault }, wed: { ...dayDefault }, thu: { ...dayDefault }, fri: { ...dayDefault } },
      note: ''
    };
    setModalityData(prev => [...prev, newMod]);
    setExpandedId(newId);
  };

  const deleteModality = (id) => {
    if (!confirm('このモダリティを削除しますか？')) return;
    setModalityData(prev => prev.filter(m => m.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const updateModalityName = (id, name) => {
    setModalityData(prev => prev.map(m => m.id === id ? { ...m, name } : m));
  };

  const changeStaffMode = (id, mode) => {
    setModalityData(prev => prev.map(m => m.id === id ? { ...m, staffMode: mode } : m));
  };

  const updateUniformStaffSlot = (id, slot, count) => {
    const key = slot === 'am' ? 'uniformStaffAm' : 'uniformStaffPm';
    setModalityData(prev => prev.map(m => m.id === id ? { ...m, [key]: parseInt(count) || 0 } : m));
  };

  const updateWeekdayStaffSlot = (id, day, slot, count) => {
    setModalityData(prev => prev.map(m => {
      if (m.id !== id) return m;
      const ws = m.weekdayStaff || {};
      const current = ws[day];
      const base = typeof current === 'object' && current !== null
        ? { am: current.am ?? 0, pm: current.pm ?? 0 }
        : { am: current ?? 0, pm: current ?? 0 };
      const next = { ...base, [slot]: parseInt(count) || 0 };
      return { ...m, weekdayStaff: { ...ws, [day]: next } };
    }));
  };

  const updateNote = (id, note) => {
    setModalityData(prev => prev.map(m => m.id === id ? { ...m, note } : m));
  };

  const moveModalityToIndex = (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    setModalityData(prev => {
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
    if (fromIdx !== null && fromIdx !== toIdx) {
      moveModalityToIndex(fromIdx, toIdx);
    }
    setDragFromIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragFromIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="h-screen flex flex-col w-full min-w-0 bg-violet-400 p-5 relative overflow-hidden box-border">
      <div className="absolute top-20 right-20 w-96 h-96 bg-violet-400/30 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col flex-1 min-h-0 w-full min-w-0 max-w-full">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h2 className="text-3xl font-bold text-stone-800">モダリティ情報入力</h2>
          <div className="flex items-center gap-2">
            <button onClick={addModality} className="btn-add">
              ➕ 新規追加
            </button>
            <button onClick={onBack} className="btn-header">
              ← メインメニュー
            </button>
          </div>
        </div>

        <div className="flex gap-6 flex-1 min-h-0 min-w-0 w-full">
          {/* 左: モダリティ一覧（このエリアのみスクロール） */}
          <div className="w-[520px] min-w-[520px] shrink-0 flex flex-col min-h-0">
            {modalityData.length === 0 ? (
              <div className="bg-slate-50 rounded-xl border-2 border-slate-400 p-8 text-center shadow-md">
                <p className="text-stone-700 text-xl mb-5">モダリティがありません</p>
                <button onClick={addModality} className="btn-add">
                  ➕ 新規追加
                </button>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-1 pr-1">
                {modalityData.map((mod, index) => (
                  <div
                    key={mod.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`rounded-lg border-2 overflow-hidden shadow-sm cursor-grab active:cursor-grabbing transition-all ${
                      dragFromIndex === index ? 'opacity-50' : ''
                    } ${
                      expandedId === mod.id && dragOverIndex !== index
                        ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-200'
                        : 'border-slate-400 bg-slate-50 hover:bg-slate-100/80 hover:border-slate-500'
                    } ${
                      dragOverIndex === index ? 'ring-2 ring-emerald-400 border-emerald-400 bg-emerald-50/80' : ''
                    }`}
                    onClick={() => setExpandedId(mod.id)}
                  >
                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <div
                        className="flex items-center shrink-0 gap-0 text-slate-400 cursor-grab active:cursor-grabbing"
                        onClick={(e) => e.stopPropagation()}
                        title="ドラッグで順序変更"
                      >
                        <span className="text-base leading-none select-none">⋮⋮</span>
                      </div>
                      <span className="text-stone-700 text-sm font-semibold w-5 shrink-0">{index + 1}</span>
                      <span className="flex-1 min-w-0 font-semibold text-stone-900 text-base truncate">{mod.name || '（未入力）'}</span>
                      <span className="text-stone-600 text-xs shrink-0">{getSimplifiedInfo(mod)}</span>
                      {mod.note ? <span className="text-stone-500 text-xs shrink-0" title={mod.note}>📝</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 右: 編集パネル */}
          <div className="flex-1 min-w-0 overflow-auto flex flex-col">
            {expandedId !== null && modalityData.find(m => m.id === expandedId) ? (
              (() => {
                const mod = modalityData.find(m => m.id === expandedId);
                if (!mod) return null;
                return (
                  <div className="bg-slate-50 rounded-xl border-2 border-slate-400 p-6 shadow-md flex-1 overflow-y-auto">
                    <h3 className="text-2xl font-bold text-stone-800 mb-6">編集: {mod.name || '（未入力）'}</h3>
                    <div className="space-y-5 w-full min-w-0">
                      <div>
                        <label className="block text-stone-700 text-lg font-medium mb-2">モダリティ名</label>
                        <input
                          type="text"
                          value={mod.name}
                          onChange={(e) => updateModalityName(mod.id, e.target.value)}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-400 rounded-xl text-stone-900 text-lg placeholder-stone-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
                          placeholder="モダリティ名"
                        />
                      </div>

                      <div>
                        <label className="block text-stone-700 text-lg font-medium mb-2">必要人数</label>
                        <div className="flex gap-3 mb-3">
                          <button
                            type="button"
                            onClick={() => changeStaffMode(mod.id, 'uniform')}
                            className={`btn-panel ${mod.staffMode === 'uniform' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}
                          >
                            一律
                          </button>
                          <button
                            type="button"
                            onClick={() => changeStaffMode(mod.id, 'individual')}
                            className={`btn-panel ${mod.staffMode === 'individual' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}
                          >
                            曜日別
                          </button>
                        </div>
                        {mod.staffMode === 'uniform' ? (
                          <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                              <span className="text-stone-700 text-lg font-medium w-9">AM</span>
                              <input
                                type="number"
                                min="0"
                                max="10"
                                value={mod.uniformStaffAm ?? mod.uniformStaff ?? 0}
                                onChange={(e) => updateUniformStaffSlot(mod.id, 'am', e.target.value)}
                                className="w-20 px-3 py-2.5 bg-white border-2 border-slate-400 rounded-xl text-stone-900 text-lg text-center focus:border-violet-400 outline-none"
                              />
                              <span className="text-stone-700 text-lg">名</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-stone-700 text-lg font-medium w-9">PM</span>
                              <input
                                type="number"
                                min="0"
                                max="10"
                                value={mod.uniformStaffPm ?? mod.uniformStaff ?? 0}
                                onChange={(e) => updateUniformStaffSlot(mod.id, 'pm', e.target.value)}
                                className="w-20 px-3 py-2.5 bg-white border-2 border-slate-400 rounded-xl text-stone-900 text-lg text-center focus:border-violet-400 outline-none"
                              />
                              <span className="text-stone-700 text-lg">名</span>
                            </div>
                            <span className="text-stone-600 text-lg">（月～金）</span>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {['mon', 'tue', 'wed', 'thu', 'fri'].map((day, idx) => {
                              const v = mod.weekdayStaff?.[day];
                              const amVal = typeof v === 'object' ? (v?.am ?? 0) : (v ?? 0);
                              const pmVal = typeof v === 'object' ? (v?.pm ?? 0) : (v ?? 0);
                              return (
                                <div key={day} className="flex items-center gap-3 flex-wrap">
                                  <span className="text-stone-700 text-lg font-medium w-8">{['月', '火', '水', '木', '金'][idx]}</span>
                                  <span className="text-stone-700 text-lg w-9">AM</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    value={amVal}
                                    onChange={(e) => updateWeekdayStaffSlot(mod.id, day, 'am', e.target.value)}
                                    className="w-16 px-2 py-2.5 bg-white border-2 border-slate-400 rounded-lg text-stone-900 text-lg text-center focus:border-violet-400 outline-none"
                                  />
                                  <span className="text-stone-700 text-lg w-9">PM</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    value={pmVal}
                                    onChange={(e) => updateWeekdayStaffSlot(mod.id, day, 'pm', e.target.value)}
                                    className="w-16 px-2 py-2.5 bg-white border-2 border-slate-400 rounded-lg text-stone-900 text-lg text-center focus:border-violet-400 outline-none"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-stone-700 text-lg font-medium mb-2">備考（任意）</label>
                        <textarea
                          value={mod.note}
                          onChange={(e) => updateNote(mod.id, e.target.value)}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-400 rounded-xl text-stone-900 text-lg placeholder-stone-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none resize-y min-h-[90px]"
                          placeholder="備考（任意）"
                          rows={2}
                        />
                      </div>

                      <div className="flex flex-wrap gap-3 pt-3 items-center">
                        <button
                          type="button"
                          onClick={() => setExpandedId(null)}
                          className="btn-panel bg-white hover:bg-slate-100 border-2 border-slate-600 text-stone-800"
                        >
                          閉じる
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteModality(mod.id)}
                          className="btn-panel ml-auto bg-red-500 hover:bg-red-400 text-white shadow-sm"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="bg-slate-50/80 rounded-xl border-2 border-dashed border-slate-300 p-8 flex items-center justify-center min-h-[280px]">
                <p className="text-stone-600 text-xl">左の一覧からモダリティをクリックして編集してください</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
