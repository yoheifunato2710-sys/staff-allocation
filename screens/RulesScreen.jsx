import React from 'react';

export default function RulesScreen({ onBack }) {
  return (
    <div className="min-h-screen bg-slate-950 p-5 relative overflow-hidden">
      <div className="absolute top-20 right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />

      <div className="max-w-3xl mx-auto relative">
        <div className="flex justify-between items-center gap-4 mb-6">
          <h2 className="text-2xl font-bold text-white">ルール確認</h2>
          <button onClick={onBack} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 text-sm font-medium transition-all">
            ← メインメニュー
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4">📌 使い方の流れ</h3>
            <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
              <li><strong className="text-white">職員情報入力</strong> … 職員を登録し、各モダリティの配置スコア（0〜4）を設定</li>
              <li><strong className="text-white">モダリティ情報入力</strong> … 配置先モダリティを追加し、必要人数（一律 or 曜日別）を設定</li>
              <li><strong className="text-white">当番表作成</strong> … 期間を決めてカレンダーを生成し、夜勤・日勤の順番・ペアを設定して保存</li>
              <li><strong className="text-white">休暇・出張管理</strong> … 休暇・出張の日付と職員を登録して保存</li>
              <li><strong className="text-white">配置表作成</strong> … 当番表の期間を読み込み、「自動配置」でスコアに基づき割り当て。必要に応じて保存・CSV出力</li>
            </ol>
          </div>

          <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4">⚙️ 配置スコア（職員情報入力で設定）</h3>
            <p className="text-slate-400 text-sm mb-3">各職員について、モダリティごとに 0〜4 のスコアを付けます。</p>
            <div className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-xl text-sm space-y-2 text-slate-300">
              <div><strong className="text-violet-300">0</strong> … 適正なし（このモダリティには配置しない）</div>
              <div><strong className="text-violet-300">1</strong> … 優先度低</div>
              <div><strong className="text-violet-300">2</strong> … 優先度中</div>
              <div><strong className="text-violet-300">3</strong> … 優先度高</div>
              <div><strong className="text-violet-300">4</strong> … 絶対固定（必ずこのモダリティに配置する）</div>
            </div>
          </div>

          <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4">📅 当番表で決まる「配置対象外」</h3>
            <p className="text-slate-400 text-sm mb-3">当番表で次のいずれかに割り当てられた職員は、その日は配置表のモダリティに配置されません。</p>
            <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
              <li>夜勤（16）・日勤・サポート・B・非番</li>
              <li>週休（当番表の「週休」に登録された職員）</li>
              <li>休暇・出張管理で登録した日の職員</li>
            </ul>
          </div>

          <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4">✓ 自動配置のルール</h3>
            <ul className="text-sm text-slate-300 space-y-2">
              <li>平日（土日・祝日を除く）の各日について、各モダリティの必要人数まで職員を割り当てます。</li>
              <li>必要人数はモダリティ情報入力で設定します。一律の場合は「AM○名・PM○名」、曜日別の場合は「月〜金」ごとに「AM○・PM○」を設定できます。</li>
              <li>スコア 0 の職員はそのモダリティには配置されません。</li>
              <li>スコア 4（絶対固定）の職員を優先して配置し、残りをスコアの高い順に埋めます。</li>
              <li>1人の職員は1日1つのモダリティのみ配置されます。</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
