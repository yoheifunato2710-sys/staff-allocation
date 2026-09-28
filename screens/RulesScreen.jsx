import React, { useState } from 'react';
import ScreenHeader from '../components/ScreenHeader';

const Intro = ({ children, className = 'mb-3' }) => <p className={`text-stone-700 text-base ${className}`}>{children}</p>;
const Heading = ({ children }) => <p className="text-stone-700 text-base mb-2 font-semibold">{children}</p>;
function List({ items, ordered = false, className = 'space-y-1 mb-3' }) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className={`text-stone-700 text-base list-inside ${ordered ? 'list-decimal' : 'list-disc'} ${className}`}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </Tag>
  );
}
const ScreenGuide = ({ intro, items }) => (
  <>
    <Intro>{intro}</Intro>
    <List items={items} className="space-y-2" />
  </>
);

const SCORES = [
  ['0', '適正なし（このモダリティには配置しない）'],
  ['1', '優先度低'],
  ['2', '優先度中'],
  ['3', '優先度高'],
  ['4', '絶対固定（必ずこのモダリティに配置する）'],
  ['トレーニング', '可能な限り配置するが、必要人数にはカウントされない（必要人数は他の職員で満たす）'],
];

const RULES = [
  {
    id: 'staff', label: '職員情報入力', icon: '📝', title: '職員情報入力',
    body: <ScreenGuide intro="職員を登録し、各モダリティの配置スコア（0〜4）を設定する画面です。" items={[
      '左の一覧から職員をクリックして編集、または「新規登録」で追加',
      '氏名・入職年数（必須）と役職を入力。一覧の順序はドラッグで変更可能',
      '各モダリティごとに配置スコア（0〜4）を設定。スコアの意味は「配置スコア」ボタンで確認',
      '入力内容は自動で保存されます',
    ]} />,
  },
  {
    id: 'modality', label: 'モダリティ情報入力', icon: '⚙️', title: 'モダリティ情報入力',
    body: <ScreenGuide intro="配置先となるモダリティ（診療科・部門など）を追加し、必要人数を設定する画面です。" items={[
      '左の一覧からモダリティをクリックして編集、または「新規追加」で新規作成',
      '必要人数は「一律」（月〜金同じ）か「曜日別」（曜日ごとにAM/PMの人数）を選択',
      '一律の場合はAM○名・PM○名、曜日別の場合は月〜金それぞれにAM・PMの人数を入力',
      '入力内容は自動で保存されます',
    ]} />,
  },
  {
    id: 'leave', label: '休暇・出張入力', icon: '🏖️', title: '休暇・出張入力',
    body: <ScreenGuide intro="休暇・出張の日付と職員を登録し、カレンダーに反映する画面です。" items={[
      '左に週休・リフ休を登録した職員の日数が自動表示されます',
      'カレンダー上で日付をドラッグして範囲選択 → 職員と種類（週休・年休・リフ休・特別休・出張）を選んで登録',
      '登録済みの休暇はセルをクリックで削除可能',
      '登録内容は自動で保存され、当番表・配置表で「配置対象外」として扱われます',
    ]} />,
  },
  {
    id: 'shift', label: '当番表作成', icon: '🗓️', title: '当番表作成',
    body: <ScreenGuide intro="期間を決めてカレンダーを生成し、夜勤・日勤・週休の順番・ペアを設定する画面です。" items={[
      '「期間設定」で開始日・終了日を入力し「カレンダーを生成」を実行',
      '「順番設定」の「一括設定」で夜勤順番リスト・日勤順番リスト・ペアを設定',
      '「当番表を再配置」「週休自動割当」で自動割り当て可能',
      '当番表の各欄の右側（手動欄）をクリックすると職員を手動で指定でき、自動の割り当てより優先されます',
      '「週休割り当て結果」の週休セルは、ドラッグ＆ドロップで別の平日に移動できます',
      '設定内容は自動で保存され、配置表作成で参照されます',
    ]} />,
  },
  {
    id: 'allocation', label: '配置表作成', icon: '📊', title: '配置表作成',
    body: <ScreenGuide intro="当番表作成画面の下部で、スコアに基づいて各モダリティへ職員を自動配置します。" items={[
      '当番表作成でカレンダー・当番・週休を作成した状態で利用します',
      '「配置表作成」ボタンで、職員の配置スコアと当番表・休暇を考慮してモダリティ別に割り当て',
      '配置表の職員名はドラッグ＆ドロップで別のモダリティや未配置へ移動でき、セルをクリックすると職員を選んで追加できます',
      '休暇者欄の週休はドラッグ＆ドロップで別の平日に移動できます（当番表の週休ルールと同じ）',
      '配置結果は自動で保存されます。詳細は「自動配置のルール」「配置対象外」で確認',
    ]} />,
  },
  {
    id: 'backup', label: 'バックアップ・復元', icon: '📦', title: 'バックアップ・復元',
    body: <ScreenGuide intro="メインメニュー左側の「データのバックアップ」で、全データをファイルに保存・復元できます。" items={[
      <><strong>今のデータをファイルに保存</strong> … 職員・モダリティ・当番表・休暇・配置表・カレンダーメモなどを1つのJSONファイルでダウンロード</>,
      <><strong>ファイルからデータを復元</strong> … 保存したJSONファイルを選ぶと、その内容でデータを上書き復元します（画面が再読み込みされます）</>,
      'アプリを閉じると、保存操作をしていなくても、指定したバックアップ先フォルダに日時名（例: 2026-09-28_10-11-00.json）で自動バックアップされます',
      '保存先フォルダは「データのバックアップ」欄の「変更」で指定できます',
      '起動時は、PC内のデータとバックアップ先フォルダの最新ファイルを比べ、最も新しいデータを自動で読み込みます',
    ]} />,
  },
  {
    id: 'score', label: '配置スコア', icon: '⚙️', title: '配置スコア（職員情報入力で設定）',
    body: (
      <>
        <Intro>各職員について、モダリティごとに 0〜4 またはトレーニングのスコアを付けます。</Intro>
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-base space-y-2 text-slate-700">
          {SCORES.map(([score, text]) => <div key={score}><strong className="text-violet-600">{score}</strong> … {text}</div>)}
        </div>
      </>
    ),
  },
  {
    id: 'exclude', label: '配置対象外', icon: '📅', title: '当番表で決まる「配置対象外」',
    body: (
      <>
        <Intro>当番表で次のいずれかに割り当てられた職員は、その日は配置表のモダリティに配置されません。</Intro>
        <List items={['夜勤（16）・日勤・サポート・B・非番', '週休（当番表の「週休」に登録された職員）', '休暇・出張管理で登録した日の職員']} className="space-y-1" />
      </>
    ),
  },
  {
    id: 'auto', label: '自動配置のルール', icon: '✓', title: '配置表作成のルール（自動配置）',
    body: (
      <>
        <Heading>【前提】</Heading>
        <List items={[
          '当番表でカレンダー・当番・週休を保存した状態で「配置表作成」を実行します。',
          '対象は平日のみ（土日・祝日は配置しません）。',
          '各モダリティの必要人数はモダリティ情報入力で設定（一律のAM/PM名数、または曜日別のAM/PM名数）。',
        ]} />
        <Heading>【配置対象外】</Heading>
        <Intro className="mb-1">その日に次のいずれかである職員は、モダリティに配置されません。</Intro>
        <List items={[
          '夜勤（16）・日勤・サポート・B・非番（当番表の割り当て。Bは外科輪番の日は「翌日の夜勤者」）',
          '週休（当番表の週休に登録された日）',
          '休暇・出張で登録した日',
        ]} />
        <Heading>【スコアの意味】</Heading>
        <List items={[
          <><strong>0</strong> … そのモダリティには配置しない</>,
          <><strong>1〜4</strong> … 必要人数を満たすために使用。4（絶対固定）→3→2→1の順で優先。同率の場合はランダムで選定</>,
          <><strong>トレーニング（5）</strong> … 先に配置するが、必要人数にはカウントしない。余裕があれば追加で配置</>,
        ]} />
        <Heading>【初回配置（日付ごと・モダリティごと）】</Heading>
        <List ordered items={[
          'トレーニング（スコア5）をそのモダリティに先に配置（必要人数には含めない）',
          '必要人数をスコア1〜4の職員で埋める。AMとPMに同じ職員を入れられる場合は同じ人を優先（パートでAM/PM未選択の場合は両方可能）',
          <><strong>救命(日勤)</strong> … B担当者はその日の救命(日勤)のPMに配置し、もともとPMにいた人は未配置に戻します</>,
          '1人の職員は1日1つのモダリティのみ',
        ]} />
        <Heading>【必要人数が満たない場合のループ】</Heading>
        <Intro className="mb-1">次の①→②を、進まなくなるか不足が解消するまで繰り返します。</Intro>
        <List ordered items={[
          <><strong>① 他モダリティから移動</strong> … 不足しているモダリティに、他モダリティの余剰または未配置の職員を配置</>,
          <><strong>② 空きに未配置を配置</strong> … ①で空いた枠に、その日の未配置職員を配置</>,
        ]} />
        <Heading>【それでも不足する場合】</Heading>
        <List items={[
          '初回配置からのループを最大5回試し、不足が最も少ない結果を採用します。',
          '週休は自動ではずらしません。必要に応じて週休をドラッグ＆ドロップで別の平日に移動し、再度「配置表作成」を実行してください。',
        ]} />
        <Heading>【表示】</Heading>
        <List items={['配置表の各セル内の職員名は、IDの昇順で表示されます。', '不足しているセル（必要人数に満たないAM/PM）は灰色で表示されます。']} className="space-y-1" />
      </>
    ),
  },
];

export default function RulesScreen({ onBack }) {
  const [selectedId, setSelectedId] = useState(null);
  const selected = RULES.find((r) => r.id === selectedId);

  return (
    <div className="min-h-screen bg-violet-400 p-5 relative overflow-hidden">
      <div className="absolute top-20 right-20 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-6xl mx-auto">
        <ScreenHeader title="ルール確認" onBack={onBack} />

        <div className="flex gap-6">
          <div className="w-[520px] min-w-[520px] shrink-0 flex flex-col">
            <div className="bg-slate-50 rounded-2xl border-2 border-slate-400 p-4 shadow-md">
              <h3 className="text-lg font-bold text-stone-800 mb-3">メニューを選択</h3>
              <div className="grid grid-cols-1 gap-2">
                {RULES.map(({ id, label, icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedId(selectedId === id ? null : id)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 text-left font-semibold text-lg transition-all ${
                      selectedId === id
                        ? 'bg-blue-100 border-blue-600 text-blue-900 ring-2 ring-blue-200'
                        : 'bg-white border-slate-500 text-slate-800 hover:border-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xl shrink-0">{icon}</span>
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="bg-slate-50 rounded-2xl border-2 border-slate-400 p-6 shadow-md min-h-[400px]">
              {selected ? (
                <>
                  <h3 className="text-2xl font-bold text-stone-800 mb-4">{selected.title}</h3>
                  <div className="text-stone-700">{selected.body}</div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[360px] text-stone-600 text-lg">
                  <p className="mb-2">左のボタンからメニューを選択すると、</p>
                  <p>ここに解説が表示されます。</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
