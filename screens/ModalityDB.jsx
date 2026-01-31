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
  const { modalityData, setModalityData, saveModalityData } = useData();
  const [expandedId, setExpandedId] = useState(null);

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

  return (
    <div className="min-h-screen bg-slate-950 p-5 relative overflow-hidden">
      <div className="absolute top-20 right-20 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />

      <div className="max-w-2xl mx-auto relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">モダリティ情報入力</h2>
          <div className="flex items-center gap-2">
            <button onClick={addModality} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all">
              ➕ 追加
            </button>
            <button onClick={onBack} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 text-sm font-medium transition-all">
              ← メインメニュー
            </button>
          </div>
        </div>

        {modalityData.length === 0 ? (
          <div className="bg-slate-900/40 rounded-xl border border-slate-800 p-8 text-center">
            <p className="text-slate-500 text-sm mb-3">モダリティがありません</p>
            <button onClick={addModality} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all">
              ➕ モダリティを追加
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {modalityData.map((mod) => (
              <div key={mod.id} className="bg-slate-900/40 rounded-xl border border-slate-800 overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
                  onClick={() => setExpandedId(expandedId === mod.id ? null : mod.id)}
                >
                  <span className="text-slate-400 text-xs w-5">{mod.id}</span>
                  <span className="flex-1 min-w-0 font-medium text-white truncate">{mod.name || '（未入力）'}</span>
                  <span className="text-slate-500 text-xs shrink-0">{getSimplifiedInfo(mod)}</span>
                  {mod.note ? <span className="text-slate-600 text-xs shrink-0" title={mod.note}>📝</span> : null}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteModality(mod.id); }}
                    className="shrink-0 text-slate-500 hover:text-red-400 text-xs px-2 py-1 rounded transition-colors"
                  >
                    削除
                  </button>
                  <span className="text-slate-500 text-sm shrink-0">{expandedId === mod.id ? '▲' : '▼'}</span>
                </div>

                {expandedId === mod.id && (
                  <div className="border-t border-slate-800 px-4 py-4 bg-slate-900/30 space-y-4">
                    <div>
                      <input
                        type="text"
                        value={mod.name}
                        onChange={(e) => updateModalityName(mod.id, e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:border-violet-500 outline-none"
                        placeholder="モダリティ名"
                      />
                    </div>

                    <div>
                      <div className="flex gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => changeStaffMode(mod.id, 'uniform')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${mod.staffMode === 'uniform' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                        >
                          一律
                        </button>
                        <button
                          type="button"
                          onClick={() => changeStaffMode(mod.id, 'individual')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${mod.staffMode === 'individual' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                        >
                          曜日別
                        </button>
                      </div>
                      {mod.staffMode === 'uniform' ? (
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 text-xs w-6">AM</span>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={mod.uniformStaffAm ?? mod.uniformStaff ?? 0}
                              onChange={(e) => updateUniformStaffSlot(mod.id, 'am', e.target.value)}
                              className="w-14 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm text-center focus:border-violet-500 outline-none"
                            />
                            <span className="text-slate-500 text-xs">名</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 text-xs w-6">PM</span>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={mod.uniformStaffPm ?? mod.uniformStaff ?? 0}
                              onChange={(e) => updateUniformStaffSlot(mod.id, 'pm', e.target.value)}
                              className="w-14 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm text-center focus:border-violet-500 outline-none"
                            />
                            <span className="text-slate-500 text-xs">名</span>
                          </div>
                          <span className="text-slate-500 text-xs">（月～金）</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {['mon', 'tue', 'wed', 'thu', 'fri'].map((day, idx) => {
                            const v = mod.weekdayStaff?.[day];
                            const amVal = typeof v === 'object' ? (v?.am ?? 0) : (v ?? 0);
                            const pmVal = typeof v === 'object' ? (v?.pm ?? 0) : (v ?? 0);
                            return (
                              <div key={day} className="flex items-center gap-2 flex-wrap">
                                <span className="text-slate-500 text-xs w-5">{['月', '火', '水', '木', '金'][idx]}</span>
                                <span className="text-slate-600 text-xs w-5">AM</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="10"
                                  value={amVal}
                                  onChange={(e) => updateWeekdayStaffSlot(mod.id, day, 'am', e.target.value)}
                                  className="w-12 px-1 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm text-center focus:border-violet-500 outline-none"
                                />
                                <span className="text-slate-600 text-xs w-5">PM</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="10"
                                  value={pmVal}
                                  onChange={(e) => updateWeekdayStaffSlot(mod.id, day, 'pm', e.target.value)}
                                  className="w-12 px-1 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm text-center focus:border-violet-500 outline-none"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <textarea
                        value={mod.note}
                        onChange={(e) => updateNote(mod.id, e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:border-violet-500 outline-none resize-y min-h-[60px]"
                        placeholder="備考（任意）"
                        rows={2}
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => { saveModalityData(); setExpandedId(null); }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all"
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedId(null)}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm font-medium transition-all"
                      >
                        取り消し
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
