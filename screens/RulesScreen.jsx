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
  { id: 'auto', label: '自動配置のルール', icon: '✓' },
  { id: 'allocationLogic', label: '配置表作成のロジック', icon: '📐' }
];

const EXPLANATIONS = {
  staff: {
    title: '職員情報入力',
    body: (
      <>
        <p className="text-stone-700 text-base mb-3">職員を登録し、各モダリティの配置スコア（0〜4）を設定する画面です。</p>
        <ul className="text-stone-700 text-base space-y-2 list-disc list-inside">
          <li>左の一覧から職員をクリックして編集、または「新規登録」で追加</li>
          <li>職員ID・氏名・入職年数・役職を入力</li>
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
          <li>未配置は AM 用・PM 用で別表示。パートで AM のみ・PM のみの職員は、勤務可能な時間帯の未配置にのみ表示されます</li>
          <li>配置表の下の「週休割り当て結果」で、週休セルをドラッグ＆ドロップで別の平日に移動できます（当番表の週休ルールと同じ）</li>
          <li>配置結果は自動で保存されます。詳細は「自動配置のルール」「配置表作成のロジック」で確認</li>
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

        <p className="text-stone-700 text-base mb-2 font-semibold">【パートのAM/PM】</p>
        <ul className="text-stone-700 text-base space-y-1 list-disc list-inside mb-3">
          <li>パートで「AMのみ」「PMのみ」を指定した職員は、その時間帯にのみ配置可能です。もう一方の時間帯の未配置には表示されません。</li>
        </ul>

        <p className="text-stone-700 text-base mb-2 font-semibold">【スコアの意味】</p>
        <ul className="text-stone-700 text-base space-y-1 list-disc list-inside mb-3">
          <li><strong>0</strong> … そのモダリティには配置しない</li>
          <li><strong>1〜4</strong> … 必要人数を満たすために使用。4（絶対固定）→3→2→1の順で優先。同率の場合はランダムで選定</li>
          <li><strong>トレーニング（5）</strong> … そのモダリティに配置し配置表にも記載するが、<strong>必要人数には含めない</strong>。必要人数はスコア1〜4の職員で別途満たす。</li>
        </ul>

        <p className="text-stone-700 text-base mb-2 font-semibold">【トレーニングの扱い】</p>
        <ul className="text-stone-700 text-base space-y-1 list-disc list-inside mb-3">
          <li>トレーニング（スコア5）の職員は、そのモダリティに配置され、配置表にも表示されます。</li>
          <li>必要人数（○名）はトレーニングを除いた人数で判定します。不足・グレー表示も同様です。</li>
          <li>不足を埋める際は<strong>スコア1〜4の職員のみ</strong>を他モダリティから移動したり未配置から充てます。トレーニングは他モダリティへ移したり、不足補充には使いません。</li>
        </ul>

        <p className="text-stone-700 text-base mb-2 font-semibold">【B と救命(日勤)PM】</p>
        <ul className="text-stone-700 text-base space-y-1 list-disc list-inside mb-3">
          <li>当番表で B の職員は、その日の PM「救命(日勤)」に自動で充てられます。もともと救命PMにいた職員は、その日の PM 未配置に移ります。</li>
        </ul>

        <p className="text-stone-700 text-base mb-2 font-semibold">【配置表作成のロジック（概要）】</p>
        <p className="text-stone-700 text-base mb-1">詳細は「配置表作成のロジック」メニューを参照。ここでは要点のみ。</p>
        <ol className="text-stone-700 text-base space-y-1 list-decimal list-inside mb-3">
          <li>初回配置：①スコア4で埋める → ②トレーニングを配置 → ③対象職員が少ないモダリティからスコア1〜4で不足分を埋める。</li>
          <li>B を救命(日勤)PMに充て、退けた人を PM 未配置に追加。</li>
          <li>不足セルがある間、①他モダリティから移動 → ②空いた枠に未配置を配置、を繰り返す。</li>
          <li>それでも不足する場合は週休割り当てを変更して再配置。</li>
        </ol>

        <p className="text-stone-700 text-base mb-2 font-semibold">【表示】</p>
        <ul className="text-stone-700 text-base space-y-1 list-disc list-inside">
          <li>配置表の各セル内の職員名は、IDの昇順で表示されます。</li>
          <li>不足しているセル（必要人数に満たないAM/PM）は灰色で表示されます。</li>
        </ul>
      </>
    )
  },
  allocationLogic: {
    title: '配置表作成のロジック',
    body: (
      <>
        <p className="text-stone-700 text-base mb-2 font-semibold">【1. 初回配置（buildOneAllocation）】</p>
        <p className="text-stone-700 text-base mb-1">平日ごと、配置対象外を除いた職員で枠を埋めます。モダリティの処理順は<strong>対象職員が少ないモダリティから</strong>です。</p>
        <ol className="text-stone-700 text-base space-y-1 list-decimal list-inside mb-3">
          <li><strong>① スコア4で埋める</strong> … そのモダリティのスコアが4の職員を、必要AM/PMの範囲で優先配置（AM・PM両方可能な人は両方に配置）。</li>
          <li><strong>② トレーニングを配置</strong> … スコア5の職員をそのモダリティに配置。必要人数にはカウントしない。</li>
          <li><strong>③ スコア1〜4で不足分を埋める</strong> … 対象職員が少ないモダリティから順に、AM・PM両方可能な人を優先し、その後AMのみ・PMのみで埋める。同率はランダム。</li>
          <li>不足が残る場合はその日を「不足」としてマーク。</li>
        </ol>
        <p className="text-stone-700 text-base mb-2">複数回試行して不足が最小の結果を採用します。</p>

        <p className="text-stone-700 text-base mb-2 font-semibold">【2. B を救命(日勤)PMに充てる】</p>
        <ul className="text-stone-700 text-base space-y-1 list-disc list-inside mb-3">
          <li>当番表で B の職員がいる日は、その日の「救命(日勤)」モダリティの PM を B のみにします。</li>
          <li>もともと救命PMにいた職員（B以外）は、その時点で未配置扱いにし、<strong>PM 未配置</strong>に追加します（AM 未配置には出しません）。</li>
        </ul>

        <p className="text-stone-700 text-base mb-2 font-semibold">【3. 未配置リスト（AM / PM 別）】</p>
        <ul className="text-stone-700 text-base space-y-1 list-disc list-inside mb-3">
          <li>その日にいずれの AM スロットにも入っていない職員のリストを「AM 未配置」、PM スロットにも入っていない職員のリストを「PM 未配置」として保持します。</li>
          <li>パートで「AMのみ」「PMのみ」の職員は、勤務可能な時間帯の未配置にのみ含めます。配置できない時間帯の未配置には表示しません。</li>
        </ul>

        <p className="text-stone-700 text-base mb-2 font-semibold">【4. 不足を埋めるループ】</p>
        <p className="text-stone-700 text-base mb-1">不足しているモダリティ・AM/PM（トレーニング除く人数が不足）がある間、次を繰り返します。</p>
        <ol className="text-stone-700 text-base space-y-1 list-decimal list-inside mb-3">
          <li><strong>① 他モダリティから移動</strong> … 不足しているモダリティに、<strong>他モダリティの余剰（トレーニング以外）</strong>または<strong>未配置のスコア1〜4</strong>の職員を移動して配置。トレーニングは移動しない。</li>
          <li><strong>② 空きに未配置を配置</strong> … ①で空いた枠に、その日の未配置のうち<strong>スコア1〜4</strong>の職員を配置。トレーニングは不足補充には使わない。</li>
          <li>各ステップの最後で、その日の AM 未配置・PM 未配置を再計算。救命PMから退けた人は PM 未配置に必ず残す。</li>
        </ol>

        <p className="text-stone-700 text-base mb-2 font-semibold">【5. それでも不足する場合】</p>
        <ul className="text-stone-700 text-base space-y-1 list-disc list-inside mb-3">
          <li>週休の割り当てを自動で変更（週休を別の平日にずらす）し、初回配置から再実行。その後 ④ のループも再度実行します。週休の変更は当番表データに保存されます。</li>
        </ul>

        <p className="text-stone-700 text-base mb-2 font-semibold">【6. 重複表示】</p>
        <ul className="text-stone-700 text-base space-y-1 list-disc list-inside">
          <li>同一日の中で、モダリティ・未配置のうち同じ職員が AM 列または PM 列に 2 回以上登場する場合はグレー背景で表示。B の職員が救命(日勤)PMにいる場合は重複扱いにしません。</li>
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
