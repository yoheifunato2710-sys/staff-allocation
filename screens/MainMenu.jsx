import React, { useState, useRef, useEffect } from 'react';
import MenuButton from '../components/MenuButton';
import MonthCalendar from '../components/MonthCalendar';
import Modal from '../components/Modal';
import { useData } from '../context/DataContext';
import { getWeeklyOffIds } from '../utils/weeklyOff';
import { pickShift } from '../utils/allocation';
import {
  getLeaveData,
  setLeaveData as persistLeaveData,
  getCalendarComments,
  setCalendarComments as persistCalendarComments,
  getMonthlyComments,
  setMonthlyComments as persistMonthlyComments,
  getAllocationData,
  getScheduleData,
} from '../utils/storage';
import { formatSnapshotLabel } from '../utils/localPersist';
import { LEAVE_TYPES, addLeaves, removeLeave, updateLeaveType } from '../utils/leave';
import { WEEK_LABELS, addDays, pad, parseDate } from '../utils/date';

const MENU_ITEMS = [
  { screen: 'staff-db', icon: '📝', title: '職員情報登録', detail: '職員の登録・編集、各モダリティの配置スコア（0〜4）を設定', accent: 'violet' },
  { screen: 'modality-db', icon: '⚙️', title: 'モダリティ情報入力', detail: '配置先モダリティの追加、必要人数（一律または曜日別）の設定', accent: 'cyan' },
  { screen: 'leave-input', icon: '🏖️', title: '休暇・出張入力', detail: '休暇・出張の日付と職員を登録し、カレンダーに反映', accent: 'rose' },
  { screen: 'shift-schedule', icon: '🗓️', title: '当番表・配置表作成', detail: '期間設定、当番表の作成・週休割当のあと、その下で配置表を自動作成・保存', accent: 'amber', navigateOnPointerDown: true },
  { screen: 'rules', icon: '📜', title: 'ルール', detail: '使い方の流れ、配置スコア・配置対象外・自動配置のルール確認', accent: 'emerald' },
];

const errorMessage = (err) => err?.message || String(err || '') || '不明なエラー';
const sortIds = (ids) => [...ids].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));

function formatDateHeader(dateStr) {
  const d = parseDate(dateStr);
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${WEEK_LABELS[d.getDay()]}`;
}

/** その日の配置表（モダリティ → 日勤・サポート・夜勤・B → 休暇者） */
function DayAllocationTable({ dateStr, modalityData, name, leaveData }) {
  const allocation = getAllocationData()?.allocation || {};
  const scheduleData = getScheduleData();
  const schedule = scheduleData.schedule || {};
  const manualOverrides = scheduleData.manualOverrides || {};
  const weeklyOff = scheduleData.weeklyOff || {};
  const surgeryDays = scheduleData.surgeryDays || [];
  const mergeSched = (d) => ({ ...schedule[d], ...manualOverrides[d] });
  const daySched = mergeSched(dateStr);
  const nextSched = mergeSched(addDays(dateStr, 1));
  const dayAlloc = allocation[dateStr];
  const manualStaff = dayAlloc?._manualStaff || [];
  const dayLeaves = leaveData[dateStr] || [];

  const scheduleRows = [
    ['日勤者', pickShift(daySched, 'dayShift')],
    ['サポート', pickShift(daySched, 'support')],
    ['夜勤者', pickShift(daySched, 'nightShift')],
    ['B', surgeryDays.includes(dateStr) ? pickShift(nextSched, 'nightShift') : pickShift(daySched, 'b')],
  ];

  const leaveLines = [];
  const dayOffId = pickShift(daySched, 'dayOff');
  if (dayOffId) leaveLines.push(`非番：${name(dayOffId)}`);
  const weeklyOffIds = [...new Set([...getWeeklyOffIds(weeklyOff, dateStr), ...dayLeaves.filter((l) => l.leaveType === '週休').map((l) => l.staffId)])];
  if (weeklyOffIds.length) leaveLines.push(`週休：${weeklyOffIds.map(name).join('、')}`);
  ['出張', 'リフ休', '年休', '特別休'].forEach((t) => {
    const names = dayLeaves.filter((l) => l.leaveType === t).map((l) => name(l.staffId));
    if (names.length) leaveLines.push(`${t}：${names.join('、')}`);
  });

  const cell = (content, border = 'border-l') => (
    <td className={`py-2 px-3 align-top ${border} border-stone-200 text-stone-800`}>{content}</td>
  );
  const rowLabel = (label) => <td className="py-2 px-3 font-semibold text-stone-700 bg-slate-50/80">{label}</td>;
  const rowClass = 'border-b border-stone-200 hover:bg-slate-50/50';

  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b-2 border-stone-400">
          <th className="py-2.5 px-3 font-bold text-stone-800 bg-slate-100 w-[140px]">モダリティ</th>
          <th className="py-2.5 px-3 font-bold text-stone-800 bg-slate-100 border-l-2 border-stone-300">{formatDateHeader(dateStr)} AM</th>
          <th className="py-2.5 px-3 font-bold text-stone-800 bg-slate-100 border-l border-stone-300">{formatDateHeader(dateStr)} PM</th>
        </tr>
      </thead>
      <tbody>
        {dayAlloc ? modalityData.map((mod) => {
          const slot = Array.isArray(dayAlloc[mod.id]) ? {} : dayAlloc[mod.id] || {};
          return (
            <tr key={mod.id} className={rowClass}>
              {rowLabel(mod.name)}
              {['am', 'pm'].map((h) => (
                <React.Fragment key={h}>
                  {cell(
                    <div className="flex flex-col gap-0.5">
                      {slot[h]?.length ? sortIds(slot[h]).map((id) => (
                        <span key={id} className={manualStaff.includes(id) ? 'text-red-600 font-medium' : ''}>{name(id)}</span>
                      )) : '－'}
                    </div>,
                    h === 'am' ? 'border-l-2' : 'border-l',
                  )}
                </React.Fragment>
              ))}
            </tr>
          );
        }) : (
          <tr>
            <td colSpan={3} className="py-3 px-3 text-stone-600 text-sm">この日のモダリティ配置データがありません。配置表作成で作成・保存してください。</td>
          </tr>
        )}
        {scheduleRows.map(([label, staffId]) => (
          <tr key={label} className={rowClass}>
            {rowLabel(label)}
            {cell(staffId ? name(staffId) : '－', 'border-l-2')}
            {cell(staffId ? name(staffId) : '－')}
          </tr>
        ))}
        <tr className={rowClass}>
          {rowLabel('休暇者')}
          <td colSpan={2} className="py-2 px-3 align-top border-l-2 border-stone-200 text-stone-800">
            {leaveLines.length ? <div className="flex flex-col gap-0.5">{leaveLines.map((line) => <span key={line}>{line}</span>)}</div> : '－'}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export default function MainMenu({ onNavigate }) {
  const {
    modalityData,
    staffData,
    backupAll,
    backupStaffModality,
    restoreBackup,
    restoreLocalSnapshot,
    fetchLocalSnapshots,
    getBackupDir,
    chooseBackupDir,
    isElectronPersist,
    resetAllData,
  } = useData();
  const [backupDir, setBackupDir] = useState('');
  const [monthDate, setMonthDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [comments, setComments] = useState(getCalendarComments);
  const [monthlyComments, setMonthlyComments] = useState(getMonthlyComments);
  const [leaveData, setLeaveData] = useState(getLeaveData);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editComment, setEditComment] = useState('');
  const [addLeaveForm, setAddLeaveForm] = useState(null); // { staffId, leaveType } 入力中のみ
  const [snapshots, setSnapshots] = useState(null); // null = 一覧を閉じている
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const restoreInputRef = useRef(null);

  useEffect(() => {
    if (isElectronPersist) getBackupDir().then(setBackupDir).catch(() => {});
  }, [isElectronPersist, getBackupDir]);

  const handleChooseBackupDir = async () => {
    const result = await chooseBackupDir();
    if (result?.dir) setBackupDir(result.dir);
    if (result?.error) alert(`保存先の変更に失敗しました。\n\n${result.error}`);
  };

  const name = (id) => (id ? staffData.find((s) => s.id === id)?.name || id : '');
  const monthKey = `${monthDate.getFullYear()}-${pad(monthDate.getMonth() + 1)}`;

  const commitLeave = (next) => {
    setLeaveData(next);
    persistLeaveData(next);
  };

  const openDate = (dateStr) => {
    setLeaveData(getLeaveData());
    setSelectedDate(dateStr);
    setEditComment(comments[dateStr] || '');
  };

  const closeModal = () => {
    setSelectedDate(null);
    setAddLeaveForm(null);
  };

  /** モーダルを閉じてコメントを保存（空なら削除） */
  const closeDate = (value = editComment) => {
    const next = { ...getCalendarComments() };
    const trimmed = value.trim();
    if (trimmed) next[selectedDate] = trimmed;
    else delete next[selectedDate];
    persistCalendarComments(next);
    setComments(next);
    closeModal();
  };

  const saveMonthlyComment = (value) => {
    const next = { ...monthlyComments, [monthKey]: value };
    setMonthlyComments(next);
    persistMonthlyComments(next);
  };

  const openSnapshotList = async () => {
    setSnapshots([]);
    setSnapshotsLoading(true);
    try {
      const result = await fetchLocalSnapshots();
      setSnapshots(result?.snapshots || []);
    } catch (_) {
      alert('保存一覧の取得に失敗しました');
    } finally {
      setSnapshotsLoading(false);
    }
  };

  const handleRestoreSnapshot = async ({ filename, label }) => {
    if (!window.confirm(`${formatSnapshotLabel(label || filename)} のデータを読み込んで再開しますか？\n現在の内容は上書きされます。`)) return;
    try {
      await restoreLocalSnapshot(filename);
    } catch (err) {
      alert(`再開に失敗しました。\n\n${errorMessage(err)}`);
    }
  };

  const handleRestoreFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await restoreBackup(file);
    } catch (err) {
      alert(`バックアップファイルの復元に失敗しました。\n\n${errorMessage(err)}`);
    }
  };

  const runBackup = (backup, message) => {
    try {
      backup();
      alert(message);
    } catch (_) {
      alert('バックアップの作成に失敗しました');
    }
  };

  const handleReset = () => {
    if (!window.confirm('すべてのデータ（職員・モダリティ・当番表・休暇・配置表・カレンダーコメント）を削除してリセットします。\n元に戻せません。よろしいですか？')) return;
    try {
      resetAllData();
      alert('データをリセットしました。画面を再読み込みします。');
    } catch (_) {
      alert('リセットに失敗しました');
    }
  };

  const backupButtons = [
    isElectronPersist && { icon: '🕒', label: '保存データから再開', color: 'sky', onClick: openSnapshotList },
    { icon: '📦', label: '今のデータをファイルに保存', color: 'amber', onClick: () => runBackup(backupAll, 'バックアップをダウンロードしました') },
    { icon: '👥', label: '職員・モダリティのみバックアップ', color: 'teal', onClick: () => runBackup(backupStaffModality, '職員・モダリティのバックアップをダウンロードしました') },
    { icon: '📥', label: 'ファイルからデータを復元', color: 'violet', onClick: () => restoreInputRef.current?.click() },
    { icon: '🗑️', label: '全データをリセット', color: 'rose', onClick: handleReset },
  ].filter(Boolean);

  const buttonColors = {
    sky: 'bg-sky-50 hover:bg-sky-100 border-sky-400 text-sky-900',
    amber: 'bg-amber-50 hover:bg-amber-100 border-amber-400 text-amber-900',
    teal: 'bg-teal-50 hover:bg-teal-100 border-teal-400 text-teal-900',
    violet: 'bg-violet-50 hover:bg-violet-100 border-violet-400 text-violet-900',
    rose: 'bg-rose-50 hover:bg-rose-100 border-rose-400 text-rose-800',
  };

  const dayLeavesList = leaveData[selectedDate] || [];
  const smallSelectClass = 'flex-1 p-2 text-sm bg-white border-2 border-slate-400 rounded-lg text-stone-800 focus:border-rose-400 outline-none';

  return (
    <div className="min-h-screen bg-violet-400 flex p-5 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-violet-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-200/30 rounded-full blur-3xl" />
      </div>

      <div className="relative flex gap-6 w-full max-w-6xl mx-auto items-stretch flex-1 min-h-0">
        <div className="relative z-10 shrink-0 w-[420px] flex flex-col min-h-0 bg-slate-50 rounded-2xl border-2 border-slate-400 shadow-sm p-1.5">
          <div className="flex-1 flex flex-col gap-1 min-h-0 min-w-0 overflow-y-auto">
            {MENU_ITEMS.map(({ screen, navigateOnPointerDown, ...item }) => (
              <MenuButton
                key={screen}
                {...item}
                onClick={() => onNavigate(screen)}
                onPointerDown={navigateOnPointerDown ? () => onNavigate(screen) : undefined}
              />
            ))}
            <input ref={restoreInputRef} type="file" accept=".json" className="hidden" onChange={handleRestoreFile} />
            <div className="mt-1.5 pt-1.5 border-t-2 border-slate-300 shrink-0">
              <p className="text-xs font-bold text-stone-600 uppercase tracking-wider mb-1 px-0.5">データのバックアップ</p>
              {isElectronPersist && (
                <div className="mb-1.5 px-0.5">
                  <p className="text-[11px] text-stone-500 leading-snug">
                    変更は自動でPCに保存されます。終了時は毎回、下のフォルダに日時付きでバックアップされ、起動時は最新のデータを読み込みます。
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="flex-1 min-w-0 truncate text-[11px] text-stone-700 bg-white border border-slate-300 rounded px-1.5 py-0.5" title={backupDir}>
                      📁 {backupDir || '（取得中）'}
                    </span>
                    <button type="button" onClick={handleChooseBackupDir} className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-lg border-2 border-slate-400 bg-white hover:bg-slate-100 text-stone-700">
                      変更
                    </button>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-1">
                {backupButtons.map(({ icon, label, color, onClick }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    className={`pl-3 pr-3 py-1.5 border-2 rounded-xl font-semibold text-base transition-all flex items-center gap-2 text-left w-full leading-tight ${buttonColors[color]}`}
                  >
                    <span className="shrink-0 text-lg">{icon}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <MonthCalendar
            monthDate={monthDate}
            onChangeMonth={setMonthDate}
            hint="日付をクリックでコメントを追加・編集"
            renderCell={({ dateStr, day, isWeekend, dateColor }) => (
              <button
                key={dateStr}
                type="button"
                onClick={() => openDate(dateStr)}
                className={`min-h-[88px] p-2 rounded-lg border-2 border-slate-400 hover:border-violet-500 hover:bg-violet-50/50 text-left transition-all flex flex-col ${isWeekend ? 'bg-slate-100' : 'bg-slate-50/50'}`}
              >
                <span className={`text-lg font-bold ${dateColor} shrink-0`}>{day}</span>
                {comments[dateStr] && (
                  <span className="mt-0.5 text-xs text-stone-700 leading-tight break-words line-clamp-2 block font-medium">{comments[dateStr]}</span>
                )}
              </button>
            )}
          >
            <div className="mt-2 shrink-0">
              <label className="block text-stone-800 text-sm font-semibold mb-1">{monthDate.getFullYear()}年{monthDate.getMonth() + 1}月のメモ</label>
              <textarea
                value={monthlyComments[monthKey] || ''}
                onChange={(e) => saveMonthlyComment(e.target.value)}
                placeholder="月ごとの自由メモ..."
                className="w-full min-h-[52px] max-h-[80px] p-2 bg-slate-50 border-2 border-slate-400 rounded-lg text-stone-900 placeholder-stone-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none resize-y text-sm font-medium"
              />
            </div>
          </MonthCalendar>
        </div>
      </div>

      {selectedDate !== null && (
        <Modal title={selectedDate} onClose={closeModal} className="max-w-4xl max-h-[90vh] overflow-hidden">
          <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-w-0 overflow-y-auto border border-slate-300 rounded-xl bg-white p-3">
              <DayAllocationTable dateStr={selectedDate} modalityData={modalityData} name={name} leaveData={leaveData} />
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-hidden">
              <form
                className="flex flex-col min-h-0 border border-slate-300 rounded-xl bg-white p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  closeDate();
                }}
              >
                <label className="text-stone-700 font-semibold text-sm mb-2 shrink-0">コメント・メモ</label>
                <textarea
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  placeholder="メモを入力..."
                  className="w-full flex-1 min-h-[100px] p-3 bg-slate-50 border-2 border-slate-400 rounded-xl text-stone-900 text-base font-medium placeholder-stone-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none resize-none"
                />
                <div className="flex gap-2 mt-3 shrink-0">
                  <button type="submit" className="btn-add flex-1 py-2.5 rounded-xl text-lg font-semibold">OK</button>
                  <button type="button" onClick={() => closeDate('')} className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-lg font-medium transition-all">クリア</button>
                </div>
              </form>

              <div className="flex flex-col min-h-0 border border-slate-300 rounded-xl bg-white p-3 shrink-0">
                <label className="text-stone-700 font-semibold text-sm mb-2 shrink-0">休暇・出張</label>
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 mb-3">
                  {dayLeavesList.length === 0 ? (
                    <p className="text-stone-500 text-sm">この日は登録がありません</p>
                  ) : dayLeavesList.map((leave) => (
                    <div key={leave.staffId} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="font-medium text-stone-800 text-sm min-w-[100px] truncate">{name(leave.staffId)}</span>
                      <select
                        value={leave.leaveType}
                        onChange={(e) => commitLeave(updateLeaveType(leaveData, selectedDate, leave.staffId, e.target.value))}
                        className="flex-1 min-w-0 p-1.5 text-sm bg-white border border-slate-400 rounded-lg text-stone-800 focus:border-rose-400 outline-none"
                      >
                        {LEAVE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => confirm('削除しますか？') && commitLeave(removeLeave(leaveData, selectedDate, leave.staffId))}
                        className="shrink-0 px-2 py-1 text-sm rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-medium"
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
                {addLeaveForm ? (
                  <div className="space-y-2 p-2 bg-rose-50/50 rounded-lg border border-rose-200">
                    <div className="flex gap-2 flex-wrap items-center">
                      <select value={addLeaveForm.staffId} onChange={(e) => setAddLeaveForm({ ...addLeaveForm, staffId: e.target.value })} className={`min-w-[120px] ${smallSelectClass}`}>
                        <option value="">職員を選択</option>
                        {staffData.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <select value={addLeaveForm.leaveType} onChange={(e) => setAddLeaveForm({ ...addLeaveForm, leaveType: e.target.value })} className={`min-w-[100px] ${smallSelectClass}`}>
                        <option value="">種類</option>
                        {LEAVE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const { staffId, leaveType } = addLeaveForm;
                          if (!staffId || !leaveType) {
                            alert('⚠️ 職員と種類を選択してください');
                            return;
                          }
                          commitLeave(addLeaves(leaveData, [selectedDate], staffId, leaveType));
                          setAddLeaveForm(null);
                        }}
                        className="btn-add flex-1 text-sm py-2"
                      >
                        登録
                      </button>
                      <button type="button" onClick={() => setAddLeaveForm(null)} className="btn-panel bg-white border-2 border-slate-600 text-stone-800 text-sm py-2">キャンセル</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAddLeaveForm({ staffId: '', leaveType: '' })} className="btn-add w-full text-sm py-2">＋ この日に追加</button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {snapshots && (
        <Modal title="保存データから再開" onClose={() => setSnapshots(null)} className="max-w-md max-h-[80vh] overflow-hidden">
          <p className="text-sm text-stone-600 mb-3 shrink-0">アプリ終了時にバックアップ先フォルダへ自動保存された日時一覧です。選ぶと当時の状態で再開します。</p>
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5">
            {snapshotsLoading ? (
              <p className="text-sm text-stone-500 py-4 text-center">読み込み中…</p>
            ) : snapshots.length === 0 ? (
              <p className="text-sm text-stone-500 py-4 text-center">まだ終了時の保存がありません</p>
            ) : snapshots.map((snap) => (
              <button
                key={snap.filename}
                type="button"
                onClick={() => handleRestoreSnapshot(snap)}
                className="w-full text-left px-3 py-2.5 rounded-xl border-2 border-sky-300 bg-white hover:bg-sky-50 text-stone-800 font-medium transition-all"
              >
                <span className="block text-base">{formatSnapshotLabel(snap.label)}</span>
                <span className="block text-xs text-stone-500 mt-0.5">{snap.filename}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSnapshots(null)}
            className="mt-3 shrink-0 min-h-[40px] px-4 py-2 rounded-lg border-2 border-slate-400 bg-white hover:bg-slate-100 text-stone-800 font-semibold"
          >
            閉じる
          </button>
        </Modal>
      )}
    </div>
  );
}
