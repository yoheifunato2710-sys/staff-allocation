import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import ScreenHeader from '../components/ScreenHeader';
import SortableList from '../components/SortableList';
import { removeModalityReferences } from '../utils/cleanup';

const WEEKDAYS = [['mon', '月'], ['tue', '火'], ['wed', '水'], ['thu', '木'], ['fri', '金']];
const inputClass = 'bg-white border-2 border-slate-400 text-stone-900 text-lg focus:border-violet-400 outline-none';
const textClass = `w-full px-4 py-3 rounded-xl ${inputClass} placeholder-stone-500 focus:ring-2 focus:ring-violet-100`;

/** 曜日別の人数（legacy は数値、現行は { am, pm }） */
function getDayStaff(mod, day) {
  const v = mod.weekdayStaff?.[day];
  return v && typeof v === 'object' ? { am: v.am ?? 0, pm: v.pm ?? 0 } : { am: v ?? 0, pm: v ?? 0 };
}

const uniformStaff = (mod) => ({ am: mod.uniformStaffAm ?? mod.uniformStaff ?? 0, pm: mod.uniformStaffPm ?? mod.uniformStaff ?? 0 });

function getSimplifiedInfo(mod) {
  if (mod.staffMode === 'uniform') {
    const { am, pm } = uniformStaff(mod);
    return `AM${am} PM${pm}`;
  }
  return WEEKDAYS.map(([day, label]) => {
    const { am, pm } = getDayStaff(mod, day);
    return `${label}${am}/${pm}`;
  }).join(' ');
}

function CountInput({ label, value, onChange, className }) {
  return (
    <>
      <span className="text-stone-700 text-lg font-medium w-9">{label}</span>
      <input type="number" min="0" max="10" value={value} onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)} className={`py-2.5 text-center ${inputClass} ${className}`} />
    </>
  );
}

export default function ModalityDB({ onBack }) {
  const { modalityData, setModalityData, setStaffData, exportModalityCSV } = useData();
  const [expandedId, setExpandedId] = useState(null);
  const mod = modalityData.find((m) => m.id === expandedId);

  const updateMod = (patch) => setModalityData((prev) => prev.map((m) => (m.id === expandedId ? { ...m, ...patch } : m)));

  const addModality = () => {
    const id = modalityData.length > 0 ? Math.max(...modalityData.map((m) => m.id)) + 1 : 1;
    setModalityData((prev) => [...prev, {
      id,
      name: '新規モダリティ',
      staffMode: 'uniform',
      uniformStaffAm: 1,
      uniformStaffPm: 1,
      weekdayStaff: Object.fromEntries(WEEKDAYS.map(([day]) => [day, { am: 1, pm: 1 }])),
      note: '',
    }]);
    setExpandedId(id);
  };

  const deleteModality = () => {
    if (!confirm('このモダリティを削除しますか？\n配置表でこのモダリティに配置されていた職員は未配置に戻り、各職員のスコアからも削除されます。')) return;
    removeModalityReferences(expandedId);
    setStaffData((prev) => prev.map((s) => {
      if (!s.scores || !(expandedId in s.scores)) return s;
      const { [expandedId]: _removed, ...scores } = s.scores;
      return { ...s, scores };
    }));
    setModalityData((prev) => prev.filter((m) => m.id !== expandedId));
    setExpandedId(null);
  };

  const modeButton = (mode, label) => (
    <button
      type="button"
      onClick={() => updateMod({ staffMode: mode })}
      className={`btn-panel ${mod.staffMode === mode ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="h-screen flex flex-col w-full min-w-0 bg-violet-400 p-5 relative overflow-hidden box-border">
      <div className="absolute top-20 right-20 w-96 h-96 bg-violet-400/30 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col flex-1 min-h-0 w-full min-w-0 max-w-full">
        <ScreenHeader title="モダリティ情報入力" onBack={onBack}>
          <button type="button" onClick={exportModalityCSV} className="btn-panel bg-white border-2 border-slate-600 text-stone-800">📄 CSV出力</button>
          <button type="button" onClick={addModality} className="btn-add">➕ 新規追加</button>
        </ScreenHeader>

        <div className="flex gap-6 flex-1 min-h-0 min-w-0 w-full">
          <div className="w-[520px] min-w-[520px] shrink-0 flex flex-col min-h-0">
            {modalityData.length === 0 ? (
              <div className="bg-slate-50 rounded-xl border-2 border-slate-400 p-8 text-center shadow-md">
                <p className="text-stone-700 text-xl mb-5">モダリティがありません</p>
                <button type="button" onClick={addModality} className="btn-add">➕ 新規追加</button>
              </div>
            ) : (
              <SortableList items={modalityData} setItems={setModalityData} selectedId={expandedId} onSelect={(m) => setExpandedId(m.id)}>
                {(m) => (
                  <>
                    <span className="flex-1 min-w-0 font-semibold text-stone-900 text-base truncate">{m.name || '（未入力）'}</span>
                    <span className="text-stone-600 text-xs shrink-0">{getSimplifiedInfo(m)}</span>
                    {m.note && <span className="text-stone-500 text-xs shrink-0" title={m.note}>📝</span>}
                  </>
                )}
              </SortableList>
            )}
          </div>

          <div className="flex-1 min-w-0 overflow-auto flex flex-col">
            {mod ? (
              <div className="bg-slate-50 rounded-xl border-2 border-slate-400 p-6 shadow-md flex-1 overflow-y-auto">
                <h3 className="text-2xl font-bold text-stone-800 mb-6">編集: {mod.name || '（未入力）'}</h3>
                <div className="space-y-5 w-full min-w-0">
                  <div>
                    <label className="block text-stone-700 text-lg font-medium mb-2">モダリティ名</label>
                    <input type="text" value={mod.name} onChange={(e) => updateMod({ name: e.target.value })} className={textClass} placeholder="モダリティ名" />
                  </div>

                  <div>
                    <label className="block text-stone-700 text-lg font-medium mb-2">必要人数</label>
                    <div className="flex gap-3 mb-3">
                      {modeButton('uniform', '一律')}
                      {modeButton('individual', '曜日別')}
                    </div>
                    {mod.staffMode === 'uniform' ? (
                      <div className="flex items-center gap-6">
                        {[['am', 'uniformStaffAm'], ['pm', 'uniformStaffPm']].map(([half, key]) => (
                          <div key={half} className="flex items-center gap-2">
                            <CountInput label={half.toUpperCase()} value={uniformStaff(mod)[half]} onChange={(n) => updateMod({ [key]: n })} className="w-20 px-3 rounded-xl" />
                            <span className="text-stone-700 text-lg">名</span>
                          </div>
                        ))}
                        <span className="text-stone-600 text-lg">（月～金）</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {WEEKDAYS.map(([day, label]) => {
                          const current = getDayStaff(mod, day);
                          const setHalf = (half) => (n) => updateMod({ weekdayStaff: { ...mod.weekdayStaff, [day]: { ...current, [half]: n } } });
                          return (
                            <div key={day} className="flex items-center gap-3 flex-wrap">
                              <span className="text-stone-700 text-lg font-medium w-8">{label}</span>
                              <CountInput label="AM" value={current.am} onChange={setHalf('am')} className="w-16 px-2 rounded-lg" />
                              <CountInput label="PM" value={current.pm} onChange={setHalf('pm')} className="w-16 px-2 rounded-lg" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-stone-700 text-lg font-medium mb-2">備考（任意）</label>
                    <textarea value={mod.note} onChange={(e) => updateMod({ note: e.target.value })} className={`${textClass} resize-y min-h-[90px]`} placeholder="備考（任意）" rows={2} />
                  </div>

                  <div className="flex flex-wrap gap-3 pt-3 items-center">
                    <button type="button" onClick={() => setExpandedId(null)} className="btn-panel bg-white hover:bg-slate-100 border-2 border-slate-600 text-stone-800">閉じる</button>
                    <button type="button" onClick={deleteModality} className="btn-panel ml-auto bg-red-500 hover:bg-red-400 text-white shadow-sm">削除</button>
                  </div>
                </div>
              </div>
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
