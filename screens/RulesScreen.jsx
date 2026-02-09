import React, { useState } from 'react';

const MENU_ITEMS = [
  { id: 'staff', label: '職員情報入力', icon: '📝' },
  { id: 'modality', label: 'モダリティ情報入力', icon: '⚙️' },
  { id: 'leave', label: '休暇・出張入力', icon: '🏖️' },
  { id: 'shift', label: '当番表作成', icon: '🗓️' },
  { id: 'allocation', label: '配置表作成', icon: '📊' },
  { id: 'backup', label: 'バックアップ・復元', icon: '📦' },
  { id: 'score', label: '配置スコア', icon: '⚙️' },
  { id: 'exclude', label: '配置対象外', icon: '📅' },
  { id: 'auto', label: '自動配置のルール', icon: '✓' }
];

const EXPLANATIONS = {
  staff: {
    title: '職員情報入力',
    body: (
      <>
        <p className="text-stone-700 text-base mb-3">職員を登録し、各モダリティの配置スコア（0〜4）を設定する画面です。</p>
        <ul className="text-stone-700 text-base space-y-2 list-disc list-inside">
          <li>左の一覧から職員をクリックして編集、または「新規登録」で追加</li>
          <li>氏名・入職年数（必須）と役職を入力。一覧の順序はドラッグで変更可能</li>
          <li>各モダリティごとに配置スコア（0〜4）を設定。スコアの意味は「配置スコア」ボタンで確認</li>
          <li>入力内容は自動で保存されます</li>
        </ul>
      </>
    )
  },
  modality: {
    title: 'モダリティ情報入力',
    body: (
      <>
        <p className="text-stone-700 text-base mb-3">配置先となるモダリティ（診療科・部門など）を追加し、必要人数を設定する画面です。</p>
        <ul className="text-stone-700 text-base space-y-2 list-disc list-inside">
          <li>左の一覧からモダリティをクリックして編集、または「新規追加」で新規作成</li>
          <li>必要人数は「一律」（月〜金同じ）か「曜日別」（曜日ごとにAM/PMの人数）を選択</li>
          <li>一律の場合はAM○名・PM○名、曜日別の場合は月〜金それぞれにAM・PMの人数を入力</li>
          <li>入力内容は自動で保存されます</li>
        </ul>
      </>
    )
  },
  leave: {
    title: '休暇・出張入力',
    body: (
      <>
        <p className="text-stone-700 text-base mb-3">休暇・出張の日付と職員を登録し、カレンダーに反映する画面です。</p>
        <ul className="text-stone-700 text-base space-y-2 list-disc list-inside">
          <li>左に週休・リフ休を登録した職員の日数が自動表示されます</li>
          <li>カレンダー上で日付をドラッグして範囲選択 → 職員と種類（週休・年休・リフ休・特別休・出張）を選んで登録</li>
          <li>登録済みの休暇はセルをクリックで削除可能</li>
          <li>登録内容は自動で保存され、当番表・配置表で「配置対象外」として扱われます</li>
        </ul>
      </>
    )
  },
  shift: {
    title: '当番表作成',
    body: (
      <>
        <p className="text-stone-700 text-base mb-3">期間を決めてカレンダーを生成し、夜勤・日勤・週休の順番・ペアを設定する画面です。</p>
        <ul className="text-stone-700 text-base space-y-2 list-disc list-inside">
          <li>「期間設定」で開始日・終了日を入力し「カレンダー生成」を実行</li>
          <li>「順番設定」で夜勤順番リスト・日勤順番リスト・ペアを設定</li>
          <li>「当番自動配置」「週休自動割り当て」で自動割り当て可能</li>
          <li>週休のセルはクリックで手動追加・削除できます</li>
          <li>設定内容は自動で保存され、配置表作成で参照されます</li>
        </ul>
      </>
    )
  },
  allocation: {
    title: '配置表作成',
    body: (
      <>
        <p className="text-stone-700 text-base mb-3">当番表の期間を読み込み、スコアに基づいて各モダリティへ職員を自動配置する画面です。</p>
        <ul className="text-stone-700 text-base space-y-2 list-disc list-inside">
          <li>当番表作成でカレンダー・当番・週休を保存した状態で利用します</li>
          <li>「配置表作成」ボタンで、職員の配置スコアと当番表・休暇を考慮してモダリティ別に割り当て</li>
          <li>配置表の下の「週休割り当て結果」で、週休セルをドラッグ＆ドロップで別の平日に移動できます（当番表の週休ルールと同じ）</li>
          <li>配置結果は自動で保存されます。詳細は「自動配置のルール」「配置対象外」で確認</li>
        </ul>
      </>
    )
  },
  backup: {
    title: 'バックアップ・復元',
    body: (
      <>
        <p className="text-stone-700 text-base mb-3">メインメニュー左側の「データのバックアップ」で、全データをファイルに保存・復元できます。</p>
        <ul className="text-stone-700 text-base space-y-2 list-disc list-inside">
          <li><strong>今のデータをファイルに保存</strong> … 職員・モダリティ・当番表・休暇・配置表・カレンダーメモなどを1つのJSONファイルでダウンロード</li>
          <li><strong>ファイルからデータを復元</strong> … 保存したJSONファイルを選ぶと、その内容でデータを上書き復元します（画面が再読み込みされます）</li>
          <li>アプリを閉じる前にバックアップを取るよう、終了時に確認メッセージが表示されます</li>
        </ul>
      </>
    )
  },
  score: {
    title: '配置スコア（職員情報入力で設定）',
    body: (
      <>
        <p className="text-stone-700 text-base mb-3">各職員について、モダリティごとに 0〜4 またはトレーニングのスコアを付けます。</p>
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-base space-y-2 text-slate-700">
          <div><strong className="text-violet-600">0</strong> … 適正なし（このモダリティには配置しない）</div>
          <div><strong className="text-violet-600">1</strong> … 優先度低</div>
          <div><strong className="text-violet-600">2</strong> … 優先度中</div>
          <div><strong className="text-violet-600">3</strong> … 優先度高</div>
          <div><strong className="text-violet-600">4</strong> … 絶対固定（必ずこのモダリティに配置する）</div>
          <div><strong className="text-violet-600">トレーニング</strong> … 可能な限り配置するが、必要人数にはカウントされない（必要人数は他の職員で満たす）</div>
        </div>
      </>
    )
  },
  exclude: {
    title: '当番表で決まる「配置対象外」',
    body: (
      <>
        <p className="text-stone-700 text-base mb-3">当番表で次のいずれかに割り当てられた職員は、その日は配置表のモダリティに配置されません。</p>
        <ul className="text-stone-700 text-base space-y-1 list-disc list-inside">
          <li>夜勤（16）・日勤・サポート・B・非番</li>
          <li>週休（当番表の「週休」に登録された職員）</li>
          <li>休暇・出張管理で登録した日の職員</li>
        </ul>
      </>
    )
  },
  auto: {
    title: '配置表作成のルール（自動配置）',
    body: (
      <>
        <p className="text-stone-700 text-base mb-2 font-semibold">【前提】</p>
        <ul className="text-stone-700 text-base space-y-1 list-disc list-inside mb-3">
          <li>当番表でカレンダー・当番・週休を保存した状態で「配置表作成」を実行します。</li>
          <li>対象は平日のみ（土日・祝日は配置しません）。</li>
          <li>各モダリティの必要人数はモダリティ情報入力で設定（一律のAM/PM名数、または曜日別のAM/PM名数）。</li>
        </ul>

        <p className="text-stone-700 text-base mb-2 font-semibold">【配置対象外】</p>
        <p className="text-stone-700 text-base mb-1">その日に次のいずれかである職員は、モダリティに配置されません。</p>
        <ul className="text-stone-700 text-base space-y-1 list-disc list-inside mb-3">
          <li>夜勤（16）・日勤・サポート・B・非番（当番表の割り当て。Bは外科輪番の日は「翌日の夜勤者」）</li>
          <li>週休（当番表の週休に登録された日）</li>
          <li>休暇・出張で登録した日</li>
        </ul>

        <p className="text-stone-700 text-base mb-2 font-semibold">【スコアの意味】</p>
        <ul className="text-stone-700 text-base space-y-1 list-disc list-inside mb-3">
          <li><strong>0</strong> … そのモダリティには配置しない</li>
          <li><strong>1〜4</strong> … 必要人数を満たすために使用。4（絶対固定）→3→2→1の順で優先。同率の場合はランダムで選定</li>
          <li><strong>トレーニング（5）</strong> … 先に配置するが、必要人数にはカウントしない。余裕があれば追加で配置</li>
        </ul>

        <p className="text-stone-700 text-base mb-2 font-semibold">【初回配置（日付ごと・モダリティごと）】</p>
        <ol className="text-stone-700 text-base space-y-1 list-decimal list-inside mb-3">
          <li>トレーニング（スコア5）をそのモダリティに先に配置（必要人数には含めない）</li>
          <li>必要人数をスコア1〜4の職員で埋める。AMとPMに同じ職員を入れられる場合は同じ人を優先（パートでAM/PM未選択の場合は両方可能）</li>
          <li><strong>救命(日勤)</strong> … B担当者はその日の救命(日勤)のPMに配置し、もともとPMにいた人は未配置に戻します</li>
          <li>1人の職員は1日1つのモダリティのみ</li>
        </ol>

        <p className="text-stone-700 text-base mb-2 font-semibold">【必要人数が満たない場合のループ】</p>
        <p className="text-stone-700 text-base mb-1">次の①→②を、進まなくなるか不足が解消するまで繰り返します。</p>
        <ol className="text-stone-700 text-base space-y-1 list-decimal list-inside mb-3">
          <li><strong>① 他モダリティから移動</strong> … 不足しているモダリティに、他モダリティの余剰または未配置の職員を配置</li>
          <li><strong>② 空きに未配置を配置</strong> … ①で空いた枠に、その日の未配置職員を配置</li>
        </ol>

        <p className="text-stone-700 text-base mb-2 font-semibold">【それでも不足する場合】</p>
        <ul className="text-stone-700 text-base space-y-1 list-disc list-inside mb-3">
          <li>週休の割り当てを自動で変更（週休を別の平日にずらす）し、再配置してから再度 ①→② のループを実行します。週休割り当ての変更は当番表のデータにも保存されます。</li>
        </ul>

        <p className="text-stone-700 text-base mb-2 font-semibold">【表示】</p>
        <ul className="text-stone-700 text-base space-y-1 list-disc list-inside">
          <li>配置表の各セル内の職員名は、IDの昇順で表示されます。</li>
          <li>不足しているセル（必要人数に満たないAM/PM）は灰色で表示されます。</li>
        </ul>
      </>
    )
  }
};

export default function RulesScreen({ onBack }) {
  const [selectedId, setSelectedId] = useState(null);

  return (
    <div className="min-h-screen bg-violet-400 p-5 relative overflow-hidden">
      <div className="absolute top-20 right-20 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-6xl mx-auto">
        <div className="flex justify-between items-center gap-4 mb-4">
          <h2 className="text-3xl font-bold text-stone-800">ルール確認</h2>
          <button onClick={onBack} className="px-5 py-2.5 bg-white hover:bg-slate-100 border-2 border-slate-600 rounded-xl text-slate-800 text-lg font-semibold transition-all shadow-sm">
            ← メインメニュー
          </button>
        </div>

        <div className="flex gap-6">
          {/* 左: ボタン一覧 */}
          <div className="w-[520px] min-w-[520px] shrink-0 flex flex-col">
            <div className="bg-slate-50 rounded-2xl border-2 border-slate-400 p-4 shadow-md">
              <h3 className="text-lg font-bold text-stone-800 mb-3">メニューを選択</h3>
              <div className="grid grid-cols-1 gap-2">
                {MENU_ITEMS.map(({ id, label, icon }) => (
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

          {/* 右: 解説 */}
          <div className="flex-1 min-w-0">
            <div className="bg-slate-50 rounded-2xl border-2 border-slate-400 p-6 shadow-md min-h-[400px]">
              {selectedId && EXPLANATIONS[selectedId] ? (
                <>
                  <h3 className="text-2xl font-bold text-stone-800 mb-4">{EXPLANATIONS[selectedId].title}</h3>
                  <div className="text-stone-700">{EXPLANATIONS[selectedId].body}</div>
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
